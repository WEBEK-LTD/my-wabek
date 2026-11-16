<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * WhatsApp consent per client (mod_wabek_consent), optionally mirrored to a
 * client "tickbox" custom field where ticked means "opted out".
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
        $state = self::state($clientId);
        if ($state['opted_out']) {
            return false;
        }
        if (Config::get('consent_mode') === 'opt_in') {
            return $state['opted_in'];
        }
        return true;
    }

    /** @return array{opted_in:bool, opted_out:bool, verified_phone:string, verified_at:string, updated_at:string} */
    public static function state(int $clientId): array
    {
        $row = Capsule::table(self::TABLE)->where('client_id', $clientId)->first();
        $state = [
            'opted_in'       => $row ? (bool) $row->opted_in : false,
            'opted_out'      => $row ? (bool) $row->opted_out : false,
            'verified_phone' => $row ? (string) $row->verified_phone : '',
            'verified_at'    => $row ? (string) $row->verified_at : '',
            'updated_at'     => $row ? (string) $row->updated_at : '',
        ];
        $fieldId = Config::int('consent_field_id');
        if ($fieldId > 0) {
            $v = strtolower((string) Capsule::table('tblcustomfieldsvalues')
                ->where('fieldid', $fieldId)->where('relid', $clientId)->value('value'));
            if (in_array($v, ['on', 'yes', '1'], true)) {
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

        $fieldId = Config::int('consent_field_id');
        if ($fieldId > 0) {
            Capsule::table('tblcustomfieldsvalues')->updateOrInsert(
                ['fieldid' => $fieldId, 'relid' => $clientId],
                ['value' => $subscribe ? '' : 'on']
            );
        }

        if (!$subscribe) {
            // Nothing non-critical still waiting in the queue may go out.
            Outbox::cancelNonCriticalFor($clientId);
        }
        self::syncToPlatform($clientId, !$subscribe);
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
