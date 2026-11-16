<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Bulk messages to clients filtered by product / service status / client
 * status. Recipients are queued (low priority) and sent by the cron at
 * bulk_per_run messages per run. Bulk messages are never "critical": opt-outs
 * always apply.
 */
final class Bulk
{
    public const TABLE = 'mod_wabek_bulk';
    public const SERVICE_STATUSES = ['Active', 'Suspended', 'Pending', 'Terminated', 'Cancelled', 'Completed', 'Fraud'];
    public const CLIENT_STATUSES = ['Active', 'Inactive', 'Closed'];
    private const MAX_RECIPIENTS = 20000;

    /** Keep only known values from a submitted filter. */
    public static function sanitizeFilters(array $in): array
    {
        $products = array_values(array_unique(array_filter(array_map('intval', (array) ($in['product_ids'] ?? [])), function ($v) {
            return $v > 0;
        })));
        $svc = array_values(array_intersect(self::SERVICE_STATUSES, (array) ($in['service_status'] ?? [])));
        $cli = array_values(array_intersect(self::CLIENT_STATUSES, (array) ($in['client_status'] ?? [])));
        return ['product_ids' => $products, 'service_status' => $svc, 'client_status' => $cli ?: ['Active']];
    }

    /** @return array<int,int|null> client id => first matching service id */
    public static function recipients(array $filters): array
    {
        $out = [];
        if ($filters['product_ids'] || $filters['service_status']) {
            $q = Capsule::table('tblhosting as h')->join('tblclients as c', 'c.id', '=', 'h.userid')
                ->whereIn('c.status', $filters['client_status']);
            if ($filters['product_ids']) {
                $q->whereIn('h.packageid', $filters['product_ids']);
            }
            if ($filters['service_status']) {
                $q->whereIn('h.domainstatus', $filters['service_status']);
            }
            foreach ($q->orderBy('h.id')->limit(self::MAX_RECIPIENTS * 3)->get(['h.id', 'h.userid']) as $r) {
                if (!isset($out[(int) $r->userid])) {
                    $out[(int) $r->userid] = (int) $r->id;
                }
                if (count($out) >= self::MAX_RECIPIENTS) {
                    break;
                }
            }
            return $out;
        }
        foreach (Capsule::table('tblclients')->whereIn('status', $filters['client_status'])
            ->orderBy('id')->limit(self::MAX_RECIPIENTS)->pluck('id') as $id) {
            $out[(int) $id] = null;
        }
        return $out;
    }

    /** @return array{total:int, sendable:int, no_phone:int, no_consent:int} */
    public static function preview(array $filters): array
    {
        $stats = ['total' => 0, 'sendable' => 0, 'no_phone' => 0, 'no_consent' => 0];
        foreach (self::recipients($filters) as $clientId => $serviceId) {
            $stats['total']++;
            if (Phone::forClient($clientId) === null) {
                $stats['no_phone']++;
            } elseif (!Consent::allows($clientId, false)) {
                $stats['no_consent']++;
            } else {
                $stats['sendable']++;
            }
        }
        return $stats;
    }

    public static function queue(string $name, string $message, array $filters, int $adminId): array
    {
        $now = date('Y-m-d H:i:s');
        $bulkId = (int) Capsule::table(self::TABLE)->insertGetId([
            'name'       => substr($name, 0, 150),
            'message'    => $message,
            'filters'    => json_encode($filters),
            'total'      => 0,
            'skipped'    => 0,
            'status'     => 'queued',
            'admin_id'   => $adminId ?: null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $queued = 0;
        $skipped = 0;
        foreach (self::recipients($filters) as $clientId => $serviceId) {
            $phone = Phone::forClient($clientId);
            if ($phone === null || !Consent::allows($clientId, false)) {
                $skipped++;
                continue;
            }
            $ctx = $serviceId ? Context::service($serviceId) : Context::client($clientId);
            if (!$ctx) {
                $skipped++;
                continue;
            }
            $text = Renderer::render($message, $ctx);
            if ($text === '') {
                $skipped++;
                continue;
            }
            $id = Outbox::enqueue([
                'event'      => 'bulk',
                'audience'   => 'client',
                'client_id'  => $clientId,
                'phone'      => $phone,
                'message'    => $text,
                'critical'   => false,
                'priority'   => 1,
                'bulk_id'    => $bulkId,
                'related_id' => 'bulk:' . $bulkId,
                'dedupe_key' => 'bulk:' . $bulkId . ':' . $clientId,
                'admin_id'   => $adminId ?: null,
            ]);
            $id > 0 ? $queued++ : $skipped++;
        }

        Capsule::table(self::TABLE)->where('id', $bulkId)->update([
            'total' => $queued, 'skipped' => $skipped, 'status' => $queued > 0 ? 'queued' : 'done', 'updated_at' => date('Y-m-d H:i:s'),
        ]);
        return ['id' => $bulkId, 'queued' => $queued, 'skipped' => $skipped];
    }

    public static function cancel(int $bulkId): int
    {
        $n = (int) Capsule::table(Outbox::TABLE)->where('bulk_id', $bulkId)->where('status', 'pending')
            ->update(['status' => 'cancelled', 'updated_at' => date('Y-m-d H:i:s')]);
        Capsule::table(self::TABLE)->where('id', $bulkId)->update(['status' => 'cancelled', 'updated_at' => date('Y-m-d H:i:s')]);
        return $n;
    }

    public static function refreshStatuses(): void
    {
        foreach (Capsule::table(self::TABLE)->where('status', 'queued')->pluck('id') as $id) {
            $open = Capsule::table(Outbox::TABLE)->where('bulk_id', (int) $id)->whereIn('status', ['pending', 'sending'])->exists();
            if (!$open) {
                Capsule::table(self::TABLE)->where('id', (int) $id)->update(['status' => 'done', 'updated_at' => date('Y-m-d H:i:s')]);
            }
        }
    }

    /** @return array<int,array> recent campaigns with live progress */
    public static function recent(int $limit = 20): array
    {
        $out = [];
        foreach (Capsule::table(self::TABLE)->orderBy('id', 'desc')->limit($limit)->get() as $b) {
            $counts = [];
            foreach (Capsule::table(Outbox::TABLE)->where('bulk_id', (int) $b->id)->groupBy('status')
                ->select('status', Capsule::raw('COUNT(*) AS c'))->get() as $r) {
                $counts[$r->status] = (int) $r->c;
            }
            $out[] = ['row' => $b, 'counts' => $counts];
        }
        return $out;
    }
}
