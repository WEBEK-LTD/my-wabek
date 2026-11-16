<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Turns a WHMCS event + merge context into queued WhatsApp messages,
 * applying the event toggle, phone validation and consent.
 */
final class Notifier
{
    /**
     * @param array       $ctx       merge context; must contain client_id
     * @param string|null $dedupeKey prevents sending the same reminder twice
     */
    public static function client(string $eventKey, ?array $ctx, string $relatedId = '', ?string $dedupeKey = null): int
    {
        $event = Events::get($eventKey);
        if (!$event || !$event['enabled'] || $event['audience'] !== 'client' || !$ctx) {
            return 0;
        }
        $clientId = (int) ($ctx['_client_id'] ?? $ctx['client_id'] ?? 0);
        if ($clientId <= 0) {
            return 0;
        }
        if ($dedupeKey !== null && Capsule::table(Outbox::TABLE)->where('dedupe_key', $dedupeKey)->exists()) {
            return 0;
        }

        $phone = Phone::forClient($clientId);
        if ($phone === null) {
            self::skip($eventKey, $clientId, '', 'No valid WhatsApp number on the client profile', $relatedId, $dedupeKey);
            return 0;
        }
        if (!Consent::allows($clientId, $event['critical'])) {
            self::skip($eventKey, $clientId, $phone, 'Client has not consented to WhatsApp messages', $relatedId, $dedupeKey);
            return 0;
        }

        $arabic = Context::isArabic($ctx);
        $message = Renderer::render($arabic ? $event['body_ar'] : $event['body_en'], $ctx);
        if ($message === '') {
            return 0;
        }

        return Outbox::dispatch([
            'event'              => $eventKey,
            'audience'           => 'client',
            'client_id'          => $clientId,
            'phone'              => $phone,
            'message'            => $message,
            'wa_template'        => $event['wa_template'],
            'wa_template_params' => self::templateParams($event, $ctx),
            'critical'           => $event['critical'],
            'priority'           => $event['critical'] ? 8 : 5,
            'related_id'         => $relatedId,
            'dedupe_key'         => $dedupeKey,
        ], $event['critical'] && Config::bool('immediate_critical'));
    }

    /** Alert every configured admin phone. */
    public static function admins(string $eventKey, ?array $ctx, string $relatedId = ''): int
    {
        $event = Events::get($eventKey);
        if (!$event || !$event['enabled'] || $event['audience'] !== 'admin' || !$ctx) {
            return 0;
        }
        $phones = Phone::parseList(Config::get('admin_phones'));
        if (!$phones) {
            return 0;
        }
        $arabic = Config::get('admin_language') === 'arabic';
        $message = Renderer::render($arabic ? $event['body_ar'] : $event['body_en'], $ctx);
        if ($message === '') {
            return 0;
        }
        $count = 0;
        foreach ($phones as $phone) {
            $id = Outbox::dispatch([
                'event'              => $eventKey,
                'audience'           => 'admin',
                'client_id'          => null,
                'phone'              => $phone,
                'message'            => $message,
                'wa_template'        => $event['wa_template'],
                'wa_template_params' => self::templateParams($event, $ctx),
                'critical'           => true,
                'priority'           => 7,
                'related_id'         => $relatedId,
                'dedupe_key'         => $eventKey . ':' . $relatedId . ':' . $phone,
            ], $event['critical'] && Config::bool('immediate_critical'));
            if ($id > 0) {
                $count++;
            }
        }
        return $count;
    }

    /** Rendered "name=value" parameters for the event's approved template. */
    public static function templateParams(array $event, array $ctx): array
    {
        if ($event['wa_template'] === '') {
            return [];
        }
        $out = [];
        foreach (Events::parseTemplateParams($event['wa_template_params']) as $name => $value) {
            $rendered = Renderer::render($value, $ctx);
            // Meta template parameters cannot contain newlines/tabs.
            $out[$name] = trim((string) preg_replace('/\s+/u', ' ', $rendered));
        }
        return $out;
    }

    private static function skip(string $eventKey, int $clientId, string $phone, string $reason, string $relatedId, ?string $dedupeKey): void
    {
        $id = Outbox::enqueue([
            'event'      => $eventKey,
            'audience'   => 'client',
            'client_id'  => $clientId,
            'phone'      => $phone,
            'message'    => '',
            'related_id' => $relatedId,
            'dedupe_key' => $dedupeKey,
        ]);
        if ($id > 0) {
            Capsule::table(Outbox::TABLE)->where('id', $id)->update(['status' => 'skipped', 'last_error' => $reason]);
        }
    }
}
