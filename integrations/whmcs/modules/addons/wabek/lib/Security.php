<?php

namespace WABEK;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/** CSRF, escaping and request-input helpers. */
final class Security
{
    public static function e($value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** The WHMCS session CSRF token (same value WHMCS injects as "token"). */
    public static function token(): string
    {
        return function_exists('generate_token') ? (string) generate_token('plain') : '';
    }

    public static function tokenField(): string
    {
        return '<input type="hidden" name="token" value="' . self::e(self::token()) . '">';
    }

    public static function isPost(): bool
    {
        return strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST';
    }

    /**
     * True only for a POST that carries this session's CSRF token. The value
     * is compared in constant time, then WHMCS check_token() runs as well.
     */
    public static function validPost(bool $admin): bool
    {
        if (!self::isPost()) {
            return false;
        }
        $expected = self::token();
        $given = isset($_POST['token']) && is_string($_POST['token']) ? $_POST['token'] : '';
        if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
            return false;
        }
        if (function_exists('check_token')) {
            check_token($admin ? 'WHMCS.admin.default' : 'WHMCS.default');
        }
        return true;
    }

    public static function post(string $key, int $maxLen = 255): string
    {
        $v = $_POST[$key] ?? '';
        if (!is_string($v)) {
            return '';
        }
        $v = str_replace("\0", '', $v);
        return function_exists('mb_substr') ? mb_substr(trim($v), 0, $maxLen, 'UTF-8') : substr(trim($v), 0, $maxLen);
    }

    /** Multi-line text (messages): keeps newlines, trims the ends. */
    public static function postText(string $key, int $maxLen = 4000): string
    {
        $v = $_POST[$key] ?? '';
        if (!is_string($v)) {
            return '';
        }
        $v = str_replace(["\r\n", "\r", "\0"], ["\n", "\n", ''], $v);
        return function_exists('mb_substr') ? mb_substr(trim($v), 0, $maxLen, 'UTF-8') : substr(trim($v), 0, $maxLen);
    }

    public static function postInt(string $key, int $min = 0, int $max = PHP_INT_MAX): int
    {
        $v = $_POST[$key] ?? 0;
        $n = is_scalar($v) ? (int) $v : 0;
        return max($min, min($max, $n));
    }

    public static function postBool(string $key): bool
    {
        return !empty($_POST[$key]) && $_POST[$key] !== '0';
    }

    /** @return string[] */
    public static function postArray(string $key): array
    {
        $v = $_POST[$key] ?? [];
        if (!is_array($v)) {
            return [];
        }
        return array_values(array_filter(array_map(function ($x) {
            return is_scalar($x) ? substr(trim((string) $x), 0, 64) : '';
        }, $v), 'strlen'));
    }

    public static function get(string $key, int $maxLen = 100): string
    {
        $v = $_GET[$key] ?? '';
        return is_string($v) ? substr(trim($v), 0, $maxLen) : '';
    }

    /** One of $allowed, else $default. */
    public static function choice(string $value, array $allowed, string $default): string
    {
        return in_array($value, $allowed, true) ? $value : $default;
    }

    public static function ip(): string
    {
        $ip = '';
        try {
            if (class_exists('\\App') && method_exists('\\App', 'getRemoteIp')) {
                $ip = (string) \App::getRemoteIp();
            }
        } catch (\Throwable $e) {
            $ip = '';
        }
        if ($ip === '') {
            $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        }
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
    }
}
