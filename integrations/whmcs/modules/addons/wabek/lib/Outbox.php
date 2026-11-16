<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Outgoing message queue and send log (mod_wabek_outbox).
 *
 * pending → sending → sent | failed | skipped; pending items may be cancelled.
 * Retries with exponential backoff on 5xx / 429 / network errors only; any
 * other 4xx is final.
 */
final class Outbox
{
    public const TABLE = 'mod_wabek_outbox';

    public const STATUSES = ['pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled'];

    private const MAX_BACKOFF = 21600; // 6h

    /**
     * Queue one message. Returns the row id, or 0 when an identical message
     * (same dedupe key) was already queued.
     *
     * @param array{event:string,audience?:string,client_id?:int|null,phone:string,message:string,
     *              wa_template?:string,wa_template_params?:array,critical?:bool,priority?:int,
     *              bulk_id?:int|null,related_id?:string,dedupe_key?:string|null,admin_id?:int|null} $item
     */
    public static function enqueue(array $item): int
    {
        $dedupe = isset($item['dedupe_key']) && $item['dedupe_key'] !== '' ? substr((string) $item['dedupe_key'], 0, 160) : null;
        if ($dedupe !== null && Capsule::table(self::TABLE)->where('dedupe_key', $dedupe)->exists()) {
            return 0;
        }
        $now = date('Y-m-d H:i:s');
        try {
            return (int) Capsule::table(self::TABLE)->insertGetId([
                'event'              => substr((string) $item['event'], 0, 48),
                'audience'           => substr((string) ($item['audience'] ?? 'client'), 0, 10),
                'client_id'          => !empty($item['client_id']) ? (int) $item['client_id'] : null,
                'phone'              => substr((string) $item['phone'], 0, 20),
                'message'            => (string) $item['message'],
                'wa_template'        => substr((string) ($item['wa_template'] ?? ''), 0, 128),
                'wa_template_params' => !empty($item['wa_template_params']) ? json_encode($item['wa_template_params'], JSON_UNESCAPED_UNICODE) : '',
                'critical'           => !empty($item['critical']) ? 1 : 0,
                'priority'           => max(0, min(9, (int) ($item['priority'] ?? 5))),
                'status'             => 'pending',
                'attempts'           => 0,
                'next_attempt_at'    => $now,
                'last_error'         => '',
                'http_code'          => 0,
                'remote_id'          => '',
                'bulk_id'            => !empty($item['bulk_id']) ? (int) $item['bulk_id'] : null,
                'related_id'         => substr((string) ($item['related_id'] ?? ''), 0, 64),
                'dedupe_key'         => $dedupe,
                'admin_id'           => !empty($item['admin_id']) ? (int) $item['admin_id'] : null,
                'created_at'         => $now,
                'updated_at'         => $now,
            ]);
        } catch (\Throwable $e) {
            // Unique dedupe key raced with another process.
            return 0;
        }
    }

    /**
     * Queue and, when $immediate, try to send right away. A failed immediate
     * attempt stays in the queue (retryable) or is marked failed (final).
     */
    public static function dispatch(array $item, bool $immediate): int
    {
        $id = self::enqueue($item);
        if ($id > 0 && $immediate) {
            self::sendRow($id);
        }
        return $id;
    }

    /** Send one queued row now. Returns the final status of the row. */
    public static function sendRow(int $id, ?ApiClient $api = null): string
    {
        // Claim the row atomically so two cron runs never send it twice.
        $claimed = Capsule::table(self::TABLE)->where('id', $id)->where('status', 'pending')
            ->update(['status' => 'sending', 'updated_at' => date('Y-m-d H:i:s')]);
        if (!$claimed) {
            return (string) Capsule::table(self::TABLE)->where('id', $id)->value('status');
        }
        $row = Capsule::table(self::TABLE)->where('id', $id)->first();
        if (!$row) {
            return 'missing';
        }

        // Consent may have changed since the message was queued.
        if ($row->audience !== 'admin' && !Consent::allows((int) $row->client_id, (bool) $row->critical)) {
            self::finish($id, 'skipped', 0, 'Client has not consented to WhatsApp messages', '');
            return 'skipped';
        }

        $api = $api ?: ApiClient::make();
        if (!$api->configured()) {
            self::retryLater($row, 'WABEK API is not configured', 0, 0);
            return 'pending';
        }

        $params = [];
        if ((string) $row->wa_template_params !== '') {
            $decoded = json_decode((string) $row->wa_template_params, true);
            $params = is_array($decoded) ? array_map('strval', $decoded) : [];
        }
        $customerName = '';
        if ((int) $row->client_id > 0) {
            $customerName = (string) Capsule::table('tblclients')->where('id', (int) $row->client_id)->value('firstname');
        }

        $res = $api->send(
            Phone::apiFormat((string) $row->phone),
            (string) $row->message,
            Config::get('default_instance'),
            (string) $row->wa_template,
            $params,
            $customerName
        );

        if ($res->ok()) {
            self::finish($id, 'sent', $res->status, '', $res->messageId(), (int) $row->attempts + 1);
            return 'sent';
        }
        if ($res->retryable) {
            return self::retryLater($row, $res->error, $res->status, $res->retryAfter);
        }
        self::finish($id, 'failed', $res->status, $res->error, '', (int) $row->attempts + 1);
        return 'failed';
    }

    private static function retryLater(object $row, string $error, int $status, int $retryAfter): string
    {
        $attempts = (int) $row->attempts + 1;
        $max = Config::int('max_attempts', 1, 10);
        if ($attempts >= $max) {
            self::finish((int) $row->id, 'failed', $status, $error, '', $attempts);
            return 'failed';
        }
        $delay = min(self::MAX_BACKOFF, 60 * (2 ** ($attempts - 1)));
        $delay = max($delay, $retryAfter) + random_int(0, 30);
        Capsule::table(self::TABLE)->where('id', (int) $row->id)->update([
            'status'          => 'pending',
            'attempts'        => $attempts,
            'http_code'       => $status,
            'last_error'      => substr($error, 0, 500),
            'next_attempt_at' => date('Y-m-d H:i:s', time() + $delay),
            'updated_at'      => date('Y-m-d H:i:s'),
        ]);
        return 'pending';
    }

    private static function finish(int $id, string $status, int $httpCode, string $error, string $remoteId, ?int $attempts = null): void
    {
        $data = [
            'status'     => $status,
            'http_code'  => $httpCode,
            'last_error' => substr($error, 0, 500),
            'remote_id'  => substr($remoteId, 0, 128),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        if ($attempts !== null) {
            $data['attempts'] = min(255, $attempts);
        }
        if ($status === 'sent') {
            $data['sent_at'] = date('Y-m-d H:i:s');
        }
        Capsule::table(self::TABLE)->where('id', $id)->update($data);
    }

    /**
     * Cron worker: send due messages. Transactional messages first, then a
     * smaller, rate-limited slice of bulk messages.
     */
    public static function process(): array
    {
        $stats = ['sent' => 0, 'failed' => 0, 'pending' => 0, 'skipped' => 0];

        // Rows stuck in "sending" (process died mid-request) go back to the queue.
        Capsule::table(self::TABLE)->where('status', 'sending')
            ->where('updated_at', '<', date('Y-m-d H:i:s', time() - 900))
            ->update(['status' => 'pending', 'updated_at' => date('Y-m-d H:i:s')]);

        $api = ApiClient::make();
        if (!$api->configured()) {
            return $stats;
        }
        $delayUs = Config::int('send_delay_ms', 0, 5000) * 1000;
        $deadline = time() + 240; // stay well inside a 5-minute cron interval

        $now = date('Y-m-d H:i:s');
        $regular = Capsule::table(self::TABLE)->where('status', 'pending')->whereNull('bulk_id')
            ->where('next_attempt_at', '<=', $now)
            ->orderBy('priority', 'desc')->orderBy('id')
            ->limit(Config::int('queue_batch', 1, 500))->pluck('id');
        $bulk = Capsule::table(self::TABLE)->where('status', 'pending')->whereNotNull('bulk_id')
            ->where('next_attempt_at', '<=', $now)
            ->orderBy('id')
            ->limit(Config::int('bulk_per_run', 0, 500))->pluck('id');

        foreach ([$regular, $bulk] as $ids) {
            foreach ($ids as $id) {
                if (time() > $deadline) {
                    break 2;
                }
                $status = self::sendRow((int) $id, $api);
                if (isset($stats[$status])) {
                    $stats[$status]++;
                }
                if ($delayUs > 0) {
                    usleep($delayUs);
                }
            }
        }

        Bulk::refreshStatuses();
        return $stats;
    }

    /** Queue a fresh copy of a logged message (the original row stays as history). */
    public static function resend(int $id, ?int $adminId): int
    {
        $row = Capsule::table(self::TABLE)->where('id', $id)->first();
        if (!$row || in_array($row->status, ['pending', 'sending'], true) || (string) $row->message === '' || (string) $row->phone === '') {
            return 0;
        }
        $params = json_decode((string) $row->wa_template_params, true);
        return self::enqueue([
            'event'              => (string) $row->event,
            'audience'           => (string) $row->audience,
            'client_id'          => $row->client_id ? (int) $row->client_id : null,
            'phone'              => (string) $row->phone,
            'message'            => (string) $row->message,
            'wa_template'        => (string) $row->wa_template,
            'wa_template_params' => is_array($params) ? $params : [],
            'critical'           => (bool) $row->critical,
            'priority'           => 8,
            'related_id'         => (string) $row->related_id,
            'admin_id'           => $adminId,
        ]);
    }

    public static function cancel(int $id): bool
    {
        return (bool) Capsule::table(self::TABLE)->where('id', $id)->where('status', 'pending')
            ->update(['status' => 'cancelled', 'updated_at' => date('Y-m-d H:i:s')]);
    }

    public static function cancelNonCriticalFor(int $clientId): void
    {
        Capsule::table(self::TABLE)->where('client_id', $clientId)->where('status', 'pending')
            ->where('critical', 0)->where('audience', '!=', 'admin')
            ->update(['status' => 'cancelled', 'last_error' => 'Client opted out', 'updated_at' => date('Y-m-d H:i:s')]);
    }

    public static function purge(int $days): int
    {
        if ($days <= 0) {
            return 0;
        }
        return (int) Capsule::table(self::TABLE)
            ->whereIn('status', ['sent', 'failed', 'skipped', 'cancelled'])
            ->where('created_at', '<', date('Y-m-d H:i:s', time() - $days * 86400))
            ->delete();
    }

    /** @return array<string,int> status => count over the last $hours */
    public static function counts(int $hours = 24): array
    {
        $out = array_fill_keys(self::STATUSES, 0);
        $rows = Capsule::table(self::TABLE)->where('created_at', '>=', date('Y-m-d H:i:s', time() - $hours * 3600))
            ->groupBy('status')->select('status', Capsule::raw('COUNT(*) AS c'))->get();
        foreach ($rows as $r) {
            $out[$r->status] = (int) $r->c;
        }
        $out['queued_total'] = (int) Capsule::table(self::TABLE)->where('status', 'pending')->count();
        return $out;
    }
}
