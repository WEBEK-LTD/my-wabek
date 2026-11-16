<?php

namespace WABEK;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Active client-area theme detection, so the client pages and the checkout
 * box render with the theme's own markup.
 *
 *   variant  template folder   used for
 *   bs3      templates/bs3/    six, Lagom 1.x and other Bootstrap 3 themes
 *   bs4      templates/bs4/    twenty-one, nexus and other Bootstrap 4/5 themes (default)
 *   lagom2   templates/lagom2/ Lagom 2.x and its child themes (Bootstrap 4 + Lagom components)
 *
 * The theme name comes from the hook/template variables, WHMCS' own Theme
 * class, the session (?systpl=) or the "Template" setting. Child themes are
 * followed through the "parent:" key of their theme.yaml (WHMCS 8) until a
 * known theme is found; unknown themes are sniffed for their Bootstrap
 * version and default to bs4.
 */
final class Theme
{
    public const VARIANTS = ['bs3', 'bs4', 'lagom2'];

    /** Known theme folders → [variant, lagom major version]. */
    private const KNOWN = [
        'six'        => ['bs3', 0],
        'twenty-one' => ['bs4', 0],
        'nexus'      => ['bs4', 0],
        'lagom'      => ['bs3', 1],
        'lagom2'     => ['lagom2', 2],
    ];

    /** @var array<string,array{name:string,chain:string[],variant:string,family:string,lagom:int}> */
    private static $cache = [];

    /** @var string|null forced theme root (tests) */
    private static $root = null;

    /**
     * @param array $vars hook / template variables (may hold 'template')
     * @return array{name:string,chain:string[],variant:string,family:string,lagom:int}
     */
    public static function detect(array $vars = []): array
    {
        return self::resolve(self::activeName($vars));
    }

    public static function variant(array $vars = []): string
    {
        return self::detect($vars)['variant'];
    }

    /** @return array{name:string,chain:string[],variant:string,family:string,lagom:int} */
    public static function resolve(string $name): array
    {
        $name = self::clean($name);
        if (isset(self::$cache[$name])) {
            return self::$cache[$name];
        }
        $chain = self::chain($name);
        $variant = '';
        $lagom = 0;
        foreach ($chain as $theme) {
            $known = self::known($theme);
            if ($known !== null) {
                [$variant, $lagom] = $known;
                break;
            }
        }
        if ($variant === '') {
            foreach ($chain as $theme) {
                $variant = self::sniff($theme);
                if ($variant !== '') {
                    break;
                }
            }
        }
        if ($variant === '') {
            $variant = 'bs4';
        }
        if ($variant === 'lagom2' && $lagom === 0) {
            $lagom = 2;
        }
        return self::$cache[$name] = [
            'name'    => $name,
            'chain'   => $chain,
            'variant' => $variant,
            'family'  => $variant === 'bs3' ? 'bs3' : 'bs4',
            'lagom'   => $lagom,
        ];
    }

    /** Font Awesome class for a brand icon: FA4 (or FA5 v4-shims) on Bootstrap 3 themes, FA5/6 elsewhere. */
    public static function brandIcon(string $icon, array $vars = []): string
    {
        $icon = preg_replace('/[^a-z0-9-]/', '', strtolower($icon));
        return self::detect($vars)['family'] === 'bs3' ? 'fa fa-' . $icon : 'fab fa-' . $icon;
    }

    /** Name of the active client-area theme ('' when unknown). */
    public static function activeName(array $vars = []): string
    {
        $candidates = [];
        if (isset($vars['template']) && is_string($vars['template'])) {
            $candidates[] = $vars['template'];
        }
        try {
            if (class_exists('\\WHMCS\\View\\Template\\Theme') && method_exists('\\WHMCS\\View\\Template\\Theme', 'factory')) {
                $theme = \WHMCS\View\Template\Theme::factory();
                if (is_object($theme) && method_exists($theme, 'getName')) {
                    $candidates[] = (string) $theme->getName();
                }
            }
        } catch (\Throwable $e) {
            // older WHMCS: fall through to the settings
        }
        if (isset($_SESSION['Template']) && is_string($_SESSION['Template'])) {
            $candidates[] = $_SESSION['Template'];
        }
        try {
            if (class_exists('\\WHMCS\\Config\\Setting')) {
                $candidates[] = (string) \WHMCS\Config\Setting::getValue('Template');
            }
        } catch (\Throwable $e) {
            // ignore
        }
        if (isset($GLOBALS['CONFIG']['Template']) && is_string($GLOBALS['CONFIG']['Template'])) {
            $candidates[] = $GLOBALS['CONFIG']['Template'];
        }
        foreach ($candidates as $c) {
            $c = self::clean($c);
            if ($c !== '') {
                return $c;
            }
        }
        return '';
    }

    /** Theme and its parents, child first (max 5 levels, no cycles). @return string[] */
    public static function chain(string $name): array
    {
        $chain = [];
        $name = self::clean($name);
        while ($name !== '' && !in_array($name, $chain, true) && count($chain) < 5) {
            $chain[] = $name;
            if (self::known($name) !== null) {
                break;
            }
            $name = self::parentOf($name);
        }
        return $chain;
    }

    /** For tests: read themes from another templates/ folder. */
    public static function setRoot(?string $templatesDir): void
    {
        self::$root = $templatesDir;
        self::$cache = [];
    }

    // ── internals ──────────────────────────────────────────────────────

    /** @return array{0:string,1:int}|null */
    private static function known(string $name): ?array
    {
        $n = strtolower($name);
        if (isset(self::KNOWN[$n])) {
            return self::KNOWN[$n];
        }
        // Copies renamed by the vendor's own conventions ("lagom2-dark", "lagom-1.9").
        if (strpos($n, 'lagom2') === 0 || strpos($n, 'lagom-2') === 0) {
            return self::KNOWN['lagom2'];
        }
        return null;
    }

    private static function clean(string $name): string
    {
        $name = trim($name);
        return preg_match('/^[A-Za-z0-9_.-]{1,64}$/', $name) && strpos($name, '..') === false ? $name : '';
    }

    private static function templatesDir(): string
    {
        if (self::$root !== null) {
            return rtrim(self::$root, '/');
        }
        $root = defined('ROOTDIR') ? (string) ROOTDIR : dirname(WABEK_MODULE_DIR, 3);
        return rtrim($root, '/') . '/templates';
    }

    private static function readHead(string $file, int $bytes): string
    {
        if (!is_file($file) || !is_readable($file)) {
            return '';
        }
        $s = @file_get_contents($file, false, null, 0, $bytes);
        return is_string($s) ? $s : '';
    }

    private static function parentOf(string $name): string
    {
        $yaml = self::readHead(self::templatesDir() . '/' . $name . '/theme.yaml', 16384);
        if ($yaml !== '' && preg_match('/^\s*parent\s*:\s*["\']?([A-Za-z0-9_.-]+)/mi', $yaml, $m)) {
            return self::clean($m[1]);
        }
        return '';
    }

    /** Variant from theme.yaml or the compiled CSS of an unknown theme ('' when unsure). */
    private static function sniff(string $name): string
    {
        $dir = self::templatesDir() . '/' . $name;
        $yaml = self::readHead($dir . '/theme.yaml', 16384);
        if ($yaml !== '') {
            if (preg_match('/^\s*name\s*:\s*["\']?\s*lagom\s*2/mi', $yaml)) {
                return 'lagom2';
            }
            if (preg_match('/bootstrap[A-Za-z_]*\s*:\s*["\']?v?(\d)/i', $yaml, $m)) {
                return $m[1] === '3' ? 'bs3' : 'bs4';
            }
        }
        foreach (['css/bootstrap.min.css', 'css/all.min.css', 'css/theme.min.css', 'css/main.min.css'] as $css) {
            $head = self::readHead($dir . '/' . $css, 8192);
            if ($head !== '' && preg_match('/Bootstrap\s+v(\d)\./i', $head, $m)) {
                return $m[1] === '3' ? 'bs3' : 'bs4';
            }
        }
        return '';
    }
}
