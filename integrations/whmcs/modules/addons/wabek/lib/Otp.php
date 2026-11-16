<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * WhatsApp verification codes through the platform OTP endpoints
 * (POST /api/v1/otp, POST /api/v1/otp-verify). The platform generates,
 * stores (hashed) and delivers the code; this class adds local rate limits
 * and binds each code to the WHMCS client that requested it.
 *
 * Modes: off | verify (client can verify their number) | login (WhatsApp
 * code required after every client login).
 */
final class Otp
{
    public const TABLE = 'mod_wabek_otp_requests';

    public static function mode(): string
    {
        return Security::choice(Config::get('otp_mode'), ['off', 'verify', 'login'], 'off');
    }

    /**
     * @return array{ok:bool, error?:string, wait?:int, request_id?:int, phone?:string}
     */
    public static function request(int $clientId, string $purpose, string $ip): array
    {
        if (self::mode() === 'off') {
            return ['ok' => false, 'error' => 'otp_disabled'];
        }
        $phone = Phone::forClient($clientId);
        if ($phone === null) {
            return ['ok' => false, 'error' => 'otp_no_phone'];
        }

        $hourAgo = date('Y-m-d H:i:s', time() - 3600);
        $perHour = Config::int('otp_per_hour', 1, 20);
        $byClient = Capsule::table(self::TABLE)->where('client_id', $clientId)->where('created_at', '>=', $hourAgo)->count();
        $byIp = $ip !== '' ? Capsule::table(self::TABLE)->where('ip', $ip)->where('created_at', '>=', $hourAgo)->count() : 0;
        if ($byClient >= $perHour || $byIp >= $perHour * 3) {
            return ['ok' => false, 'error' => 'otp_rate_limited'];
        }
        $last = Capsule::table(self::TABLE)->where('client_id', $clientId)->orderBy('id', 'desc')->value('created_at');
        $gap = Config::int('otp_resend_seconds', 0, 3600);
        if ($last && ($elapsed = time() - strtotime((string) $last)) < $gap) {
            return ['ok' => false, 'error' => 'otp_too_soon', 'wait' => $gap - $elapsed];
        }

        $now = time();
        $rowId = (int) Capsule::table(self::TABLE)->insertGetId([
            'client_id'  => $clientId,
            'phone'      => $phone,
            'purpose'    => $purpose === 'login' ? 'login' : 'verification',
            'remote_id'  => '',
            'attempts'   => 0,
            'status'     => 'pending',
            'ip'         => substr($ip, 0, 45),
            'created_at' => date('Y-m-d H:i:s', $now),
            'expires_at' => date('Y-m-d H:i:s', $now + Config::int('otp_ttl_minutes', 1, 60) * 60),
        ]);

        $res = ApiClient::make()->otpSend(
            Phone::apiFormat($phone),
            $purpose === 'login' ? 'login' : 'verification',
            Config::get('default_instance'),
            substr(Config::companyName(), 0, 60)
        );
        $remoteId = is_scalar($res->data['otpId'] ?? null) ? (string) $res->data['otpId'] : '';
        if (!$res->ok() || $remoteId === '' || (isset($res->data['success']) && $res->data['success'] === false)) {
            Capsule::table(self::TABLE)->where('id', $rowId)->update(['status' => 'failed']);
            $code = (string) ($res->data['code'] ?? '');
            // Configuration problems on the platform side are reported to the admin, not the client.
            if (in_array($code, ['no_instance', 'template_failed', 'outside_window'], true) && function_exists('logActivity')) {
                logActivity('WABEK OTP could not be sent (' . $code . '): check the WhatsApp instance and the Authentication template in WABEK.');
            }
            return ['ok' => false, 'error' => $res->retryable || $res->status === 0 ? 'otp_service_down' : 'otp_send_failed'];
        }
        Capsule::table(self::TABLE)->where('id', $rowId)->update(['status' => 'sent', 'remote_id' => substr($remoteId, 0, 128)]);
        return ['ok' => true, 'request_id' => $rowId, 'phone' => $phone];
    }

    /** @return array{ok:bool, error?:string, phone?:string} */
    public static function verify(int $clientId, int $requestId, string $code): array
    {
        $code = preg_replace('/\s+/', '', $code);
        if (!preg_match('/^\d{4,8}$/', (string) $code)) {
            return ['ok' => false, 'error' => 'otp_invalid'];
        }
        $row = Capsule::table(self::TABLE)->where('id', $requestId)->where('client_id', $clientId)->first();
        if (!$row || $row->status !== 'sent' || $row->remote_id === '') {
            return ['ok' => false, 'error' => 'otp_expired'];
        }
        if (strtotime((string) $row->expires_at) < time()) {
            Capsule::table(self::TABLE)->where('id', $requestId)->update(['status' => 'expired']);
            return ['ok' => false, 'error' => 'otp_expired'];
        }
        $max = Config::int('otp_max_attempts', 1, 10);
        if ((int) $row->attempts >= $max) {
            Capsule::table(self::TABLE)->where('id', $requestId)->update(['status' => 'failed']);
            return ['ok' => false, 'error' => 'otp_too_many'];
        }
        Capsule::table(self::TABLE)->where('id', $requestId)->increment('attempts');

        $res = ApiClient::make()->otpVerify((string) $row->remote_id, (string) $code);
        if (!$res->ok()) {
            return ['ok' => false, 'error' => $res->retryable ? 'otp_service_down' : 'otp_invalid'];
        }
        if (!empty($res->data['valid'])) {
            Capsule::table(self::TABLE)->where('id', $requestId)->update(['status' => 'verified']);
            Consent::markVerified($clientId, (string) $row->phone);
            return ['ok' => true, 'phone' => (string) $row->phone];
        }
        $reason = strtolower((string) ($res->data['reason'] ?? ''));
        if (strpos($reason, 'expired') !== false || strpos($reason, 'used') !== false || strpos($reason, 'too many') !== false
            || (int) $row->attempts + 1 >= $max) {
            Capsule::table(self::TABLE)->where('id', $requestId)->update(['status' => 'failed']);
            return ['ok' => false, 'error' => strpos($reason, 'expired') !== false ? 'otp_expired' : 'otp_too_many'];
        }
        return ['ok' => false, 'error' => 'otp_invalid'];
    }

    // ── Login gate (otp_mode = login) ──────────────────────────────────

    /** Called from the login hooks. */
    public static function markLoginPending(): void
    {
        if (self::mode() !== 'login' || !empty($_SESSION['adminid'])) {
            return;
        }
        $_SESSION['wabek_2fa_pending'] = 1;
        unset($_SESSION['wabek_otp_request']);
    }

    public static function loginPending(): bool
    {
        return self::mode() === 'login' && !empty($_SESSION['wabek_2fa_pending']) && empty($_SESSION['adminid']);
    }

    public static function clearLoginPending(): void
    {
        unset($_SESSION['wabek_2fa_pending'], $_SESSION['wabek_otp_request']);
    }
}
