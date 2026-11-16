<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Module settings, stored in mod_wabek_config. The API key is stored with
 * WHMCS encrypt() and only ever decrypted in memory for the outgoing request.
 */
final class Config
{
    public const TABLE = 'mod_wabek_config';

    /** Defaults for every setting the module reads. */
    public const DEFAULTS = [
        'api_base_url'         => 'https://waabek.com',
        'api_key'              => '',          // encrypted
        'default_instance'     => '',
        'admin_phones'         => '',
        'default_country_code' => '',
        'message_language'     => 'auto',      // auto | english | arabic
        'admin_language'       => 'english',   // english | arabic
        'immediate_critical'   => '1',
        'queue_batch'          => '40',        // messages per cron run
        'bulk_per_run'         => '20',        // bulk messages per cron run
        'send_delay_ms'        => '250',
        'max_attempts'         => '5',
        'reminder_days_before' => '3',
        'reminder_on_due'      => '1',
        'reminder_days_after'  => '1,5',
        'domain_reminder_days' => '30,7,1',
        'include_credentials'  => '0',
        'consent_mode'         => 'opt_out',   // opt_out | opt_in
        'consent_field_id'     => '0',         // optional tickbox custom field: ticked = opted out
        'checkout_consent'     => '0',         // show a WhatsApp consent checkbox at checkout
        'phone_field_id'       => '0',         // optional custom field holding the WhatsApp number
        'otp_mode'             => 'off',       // off | verify | login
        'otp_skip_no_phone'    => '1',
        'otp_per_hour'         => '3',
        'otp_resend_seconds'   => '60',
        'otp_max_attempts'     => '5',
        'otp_ttl_minutes'      => '10',
        'log_retention_days'   => '90',
        'cron_lock'            => '0',
        'install_id'           => '',          // random, prefixes Idempotency-Key values
    ];

    /** @var array<string,string>|null */
    private static $cache = null;

    public static function all(): array
    {
        if (self::$cache === null) {
            $rows = [];
            try {
                $rows = Capsule::table(self::TABLE)->pluck('value', 'setting');
                $rows = is_array($rows) ? $rows : $rows->toArray();
            } catch (\Throwable $e) {
                $rows = [];
            }
            self::$cache = array_merge(self::DEFAULTS, array_map('strval', $rows));
        }
        return self::$cache;
    }

    public static function get(string $key, string $default = ''): string
    {
        $all = self::all();
        return array_key_exists($key, $all) ? (string) $all[$key] : $default;
    }

    public static function bool(string $key): bool
    {
        return in_array(strtolower(self::get($key)), ['1', 'on', 'yes', 'true'], true);
    }

    public static function int(string $key, int $min = 0, int $max = PHP_INT_MAX): int
    {
        $v = (int) self::get($key, (string) (self::DEFAULTS[$key] ?? '0'));
        return max($min, min($max, $v));
    }

    /** @return int[] positive day offsets from a comma list, e.g. "1, 3,7" */
    public static function intList(string $key, int $max = 365): array
    {
        $out = [];
        foreach (explode(',', self::get($key)) as $part) {
            $n = (int) trim($part);
            if ($n > 0 && $n <= $max) {
                $out[$n] = $n;
            }
        }
        ksort($out);
        return array_values($out);
    }

    public static function set(string $key, string $value): void
    {
        if (!array_key_exists($key, self::DEFAULTS)) {
            throw new \InvalidArgumentException('Unknown setting');
        }
        Capsule::table(self::TABLE)->updateOrInsert(['setting' => $key], ['value' => $value]);
        if (self::$cache !== null) {
            self::$cache[$key] = $value;
        }
    }

    public static function flush(): void
    {
        self::$cache = null;
    }

    // ── API key (encrypted at rest) ────────────────────────────────────

    public static function apiKey(): string
    {
        $stored = self::get('api_key');
        if ($stored === '') {
            return '';
        }
        $plain = function_exists('decrypt') ? (string) decrypt($stored) : '';
        return trim($plain);
    }

    public static function setApiKey(string $plain): void
    {
        $plain = trim($plain);
        self::set('api_key', $plain === '' ? '' : (string) encrypt($plain));
    }

    /** "••••••••ab12" — never more than the last four characters. */
    public static function maskedApiKey(): string
    {
        $key = self::apiKey();
        if ($key === '') {
            return '';
        }
        $tail = strlen($key) > 8 ? substr($key, -4) : '';
        return str_repeat('•', 8) . $tail;
    }

    /** Random id of this WHMCS install (created once), so two installs on one WABEK account never share idempotency keys. */
    public static function installId(): string
    {
        $id = self::get('install_id');
        if (!preg_match('/^[a-f0-9]{12}$/', $id)) {
            $id = bin2hex(random_bytes(6));
            self::set('install_id', $id);
        }
        return $id;
    }

    public static function apiBaseUrl(): string
    {
        $url = rtrim(trim(self::get('api_base_url')), '/');
        return $url !== '' ? $url : self::DEFAULTS['api_base_url'];
    }

    // ── Validation helpers used by the settings form ───────────────────

    public static function isValidBaseUrl(string $url): bool
    {
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }
        $parts = parse_url($url);
        return isset($parts['scheme'], $parts['host'])
            && strtolower($parts['scheme']) === 'https'
            && empty($parts['user']) && empty($parts['pass'])
            && empty($parts['query']) && empty($parts['fragment']);
    }

    /** WHMCS System URL with a trailing slash. */
    public static function systemUrl(): string
    {
        static $url = null;
        if ($url === null) {
            try {
                $url = (string) Capsule::table('tblconfiguration')->where('setting', 'SystemURL')->value('value');
            } catch (\Throwable $e) {
                $url = '';
            }
            $url = rtrim($url, '/') . '/';
        }
        return $url;
    }

    public static function companyName(): string
    {
        try {
            return (string) Capsule::table('tblconfiguration')->where('setting', 'CompanyName')->value('value');
        } catch (\Throwable $e) {
            return '';
        }
    }

    public static function systemLanguage(): string
    {
        try {
            return strtolower((string) Capsule::table('tblconfiguration')->where('setting', 'Language')->value('value'));
        } catch (\Throwable $e) {
            return 'english';
        }
    }
}
