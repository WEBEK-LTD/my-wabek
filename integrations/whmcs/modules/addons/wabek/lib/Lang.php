<?php

namespace WABEK;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/** Module language strings (lang/english.php, lang/arabic.php). */
final class Lang
{
    /** @var array<string,string> */
    private static $strings = [];
    /** @var string */
    private static $language = 'english';

    public const SUPPORTED = ['english', 'arabic'];

    /** Use the strings WHMCS passed in $vars['_lang'], with English as fallback. */
    public static function init(array $vars = [], string $language = ''): void
    {
        $language = strtolower($language);
        if ($language === '' && !empty($vars['_lang']['_language'])) {
            $language = (string) $vars['_lang']['_language'];
        }
        self::$language = in_array($language, self::SUPPORTED, true) ? $language : 'english';
        $strings = self::file('english');
        if (self::$language !== 'english') {
            $strings = array_merge($strings, self::file(self::$language));
        }
        if (!empty($vars['_lang']) && is_array($vars['_lang'])) {
            $strings = array_merge($strings, array_filter($vars['_lang'], 'is_string'));
        }
        self::$strings = $strings;
    }

    /** Language for the current client-area / admin session. */
    public static function initForSession(bool $admin): void
    {
        $lang = '';
        if ($admin) {
            $lang = (string) ($_SESSION['adminlang'] ?? '');
        } else {
            $lang = (string) ($_SESSION['Language'] ?? '');
        }
        self::init([], $lang !== '' ? $lang : Config::systemLanguage());
    }

    public static function t(string $key, array $replace = []): string
    {
        if (!self::$strings) {
            self::init();
        }
        $s = self::$strings[$key] ?? $key;
        return $replace ? strtr($s, $replace) : $s;
    }

    public static function all(): array
    {
        if (!self::$strings) {
            self::init();
        }
        return self::$strings;
    }

    public static function isRtl(): bool
    {
        return (self::$strings['_dir'] ?? 'ltr') === 'rtl';
    }

    public static function language(): string
    {
        return self::$language;
    }

    private static function file(string $language): array
    {
        $_ADDONLANG = [];
        $file = WABEK_MODULE_DIR . '/lang/' . $language . '.php';
        if (in_array($language, self::SUPPORTED, true) && is_file($file)) {
            include $file;
        }
        return is_array($_ADDONLANG) ? $_ADDONLANG : [];
    }
}
