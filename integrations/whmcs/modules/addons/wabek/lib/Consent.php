<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * WhatsApp consent per client (mod_wabek_consent), mirrored to the client
 * "tickbox" custom field managed by ConsentField (the native "Receive
 * WhatsApp notifications" field, or an opt-out field from 4.0 / 4.1).
 *
 * consent_mode = opt_out: non-critical messages are sent unless the client opted out.
 * consent_mode = opt_in:  non-critical messages need an explicit opt-in.
 * Critical events (configurable per event) are always sent.
 */
final class Consent
{
    public const TABLE = 'mod_wabek_consent';

    public static function allows(int $clientId, bool $critical): bool
    {
        if ($critical) {
            return true;
        }
        if ($clientId <= 0) {
            return false;
        }
        return self::subscribed($clientId);
    }

    /** Whether non-critical WhatsApp messages go to this client (recorded choice + consent mode). */
    public static function subscribed(int $clientId, bool $withField = true): bool
    {
        if ($clientId <= 0) {
            return false;
        }
        return self::isSubscribed(self::state($clientId, $withField));
    }

    /** @param array{opted_in:bool, opted_out:bool} $state */
    public static function isSubscribed(array $state): bool
    {
        return !$state['opted_out'] && (Config::get('consent_mode') !== 'opt_in' || $state['opted_in']);
    }

    /**
     * @param bool $withField apply an opt-out field of 4.0 / 4.1 (ticked = opted out) on top of the table
     * @return array{opted_in:bool, opted_out:bool, verified_phone:string, verified_at:string, updated_at:string, source:string}
     */
    public static function state(int $clientId, bool $withField = true): array
    {
        $row = Capsule::table(self::TABLE)->where('client_id', $clientId)->first();
        $state = [
            'opted_in'       => $row ? (bool) $row->opted_in : false,
            'opted_out'      => $row ? (bool) $row->opted_out : false,
            'verified_phone' => $row ? (string) $row->verified_phone : '',
            'verified_at'    => $row ? (string) $row->verified_at : '',
            'updated_at'     => $row ? (string) $row->updated_at : '',
            'source'         => $row ? (string) $row->source : '',
        ];
        // The "receive" field is a mirror kept in sync by hooks; an opt-out field keeps its 4.x override.
        if ($withField && ConsentField::meaning() === ConsentField::OPT_OUT) {
            $v = ConsentField::stored($clientId);
            if ($v !== null && !ConsentField::subscribedFromValue($v)) {
                $state['opted_out'] = true;
                $state['opted_in'] = false;
            }
        }
        return $state;
    }

    public static function set(int $clientId, bool $subscribe, string $source, string $ip = ''): void
    {
        if ($clientId <= 0) {
            return;
        }
        $now = date('Y-m-d H:i:s');
        $data = [
            'opted_in'   => $subscribe ? 1 : 0,
            'opted_out'  => $subscribe ? 0 : 1,
            'updated_ip' => substr($ip, 0, 45),
            'source'     => substr($source, 0, 16),
            'updated_at' => $now,
        ];
        $data[$subscribe ? 'opted_in_at' : 'opted_out_at'] = $now;
        Capsule::table(self::TABLE)->updateOrInsert(['client_id' => $clientId], $data);

        try {
            ConsentField::write($clientId, $subscribe);
        } catch (\Throwable $e) {
            if (function_exists('logActivity')) {
                logActivity('WABEK: could not update the WhatsApp custom field of client #' . $clientId . ': ' . substr($e->getMessage(), 0, 200));
            }
        }

        if (!$subscribe) {
            // Nothing non-critical still waiting in the queue may go out.
            Outbox::cancelNonCriticalFor($clientId);
        }
        self::syncToPlatform($clientId, !$subscribe);
    }

    /** Re-send the current choice to WABEK (e.g. after the client's WhatsApp number changed). */
    public static function resyncPlatform(int $clientId): void
    {
        if ($clientId > 0) {
            self::syncToPlatform($clientId, !self::subscribed($clientId));
        }
    }

    /** Mirror the choice to WABEK contacts so the platform's own send guard honours it too. */
    private static function syncToPlatform(int $clientId, bool $optedOut): void
    {
        $phone = Phone::forClient($clientId);
        $api = ApiClient::make();
        if ($phone === null || !$api->configured()) {
            return;
        }
        $res = $api->contactOptOut(Phone::apiFormat($phone), $optedOut);
        if (!$res->ok() && function_exists('logActivity')) {
            logActivity('WABEK: could not sync WhatsApp opt-' . ($optedOut ? 'out' : 'in') . ' of client #' . $clientId
                . ' to WABEK (' . substr($res->error, 0, 200) . ')');
        }
    }

    public static function markVerified(int $clientId, string $e164): void
    {
        $now = date('Y-m-d H:i:s');
        Capsule::table(self::TABLE)->updateOrInsert(['client_id' => $clientId], [
            'verified_phone' => substr($e164, 0, 20),
            'verified_at'    => $now,
            'updated_at'     => $now,
        ]);
    }
}
