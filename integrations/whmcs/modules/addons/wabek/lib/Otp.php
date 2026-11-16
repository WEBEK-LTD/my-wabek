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
 * Modes: off | verify (client can verify / change their number) |
 * optional (as verify, and each client may turn on a WhatsApp code at
 * login) | login (WhatsApp code required after every client login).
 *
 * Purposes stored per request: verification, login, change (a new number
 * the client typed; it becomes their WhatsApp number once the code is
 * confirmed, see Phone::setClientNumber()).
 */
final class Otp
{
    public const TABLE = 'mod_wabek_otp_requests';

    public static function mode(): string
    {
        return Security::choice(Config::get('otp_mode'), ['off', 'verify', 'optional', 'login'], 'verify');
    }

    /** Whether this client turned on the WhatsApp code at login (only used in "optional" mode). */
    public static function clientLoginChoice(int $clientId): bool
    {
        if ($clientId <= 0) {
            return false;
        }
        try {
            if (!Capsule::schema()->hasColumn(Consent::TABLE, 'login_otp')) {
                return false;
            }
            return (bool) Capsule::table(Consent::TABLE)->where('client_id', $clientId)->value('login_otp');
        } catch (\Throwable $e) {
            return false;
        }
    }

    public static function setClientLoginChoice(int $clientId, bool $on): void
    {
        if ($clientId <= 0) {
            return;
        }
        Capsule::table(Consent::TABLE)->updateOrInsert(['client_id' => $clientId], [
            'login_otp'  => $on ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /** Whether a WhatsApp code is asked after this client's login. */
    public static function loginRequiredFor(int $clientId): bool
    {
        $mode = self::mode();
        return $mode === 'login' || ($mode === 'optional' && self::clientLoginChoice($clientId));
    }

    /**
     * @return array{ok:bool, error?:string, wait?:int, request_id?:int, phone?:string}
     */
    public static function request(int $clientId, string $purpose, string $ip, ?string $toPhone = null): array
    {
        if (self::mode() === 'off') {
            return ['ok' => false, 'error' => 'otp_disabled'];
        }
        $purpose = in_array($purpose, ['login', 'change'], true) ? $purpose : 'verification';
        $phone = $purpose === 'change' ? $toPhone : Phone::forClient($clientId);
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
            'purpose'    => $purpose,
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
            if ((string) $row->purpose === 'change') {
                // The client proved they own the new number: it becomes their WhatsApp number.
                Phone::setClientNumber($clientId, (string) $row->phone);
                Consent::resyncPlatform($clientId);
                if (function_exists('logActivity')) {
                    logActivity('WABEK: client changed their WhatsApp number to ' . Phone::mask((string) $row->phone) . ' (verified by WhatsApp code)', $clientId);
                }
            }
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

    // ── Login gate (otp_mode = login, or optional + the client's choice) ──

    /** Called from the login hooks. In optional mode the gate (ClientAreaPage) drops it for clients who did not opt in. */
    public static function markLoginPending(): void
    {
        if (!in_array(self::mode(), ['login', 'optional'], true) || !empty($_SESSION['adminid'])) {
            return;
        }
        $_SESSION['wabek_2fa_pending'] = 1;
        unset($_SESSION['wabek_otp_request']);
    }

    public static function loginPending(): bool
    {
        if (empty($_SESSION['wabek_2fa_pending']) || !empty($_SESSION['adminid'])) {
            return false;
        }
        $mode = self::mode();
        if ($mode === 'login') {
            return true;
        }
        if ($mode === 'optional') {
            $clientId = (int) ($_SESSION['uid'] ?? 0);
            if ($clientId <= 0) {
                return true; // not known yet: decided once the client is selected
            }
            if (self::clientLoginChoice($clientId)) {
                return true;
            }
        }
        unset($_SESSION['wabek_2fa_pending']);
        return false;
    }

    public static function clearLoginPending(): void
    {
        unset($_SESSION['wabek_2fa_pending'], $_SESSION['wabek_otp_request']);
    }
}
