<?php
/**
 * WABEK for WHMCS — client-area theme check (no WHMCS install needed).
 *
 *   php integrations/whmcs/tests/render-check.php --out=/tmp/wabek-theme-test/pages \
 *       [--smarty=/path/to/vendor/autoload.php] [--bs3=/path/bootstrap-3.4.1.min.css] [--bs4=/path/bootstrap-4.6.2.min.css]
 *
 * 1. Static checks of templates/{bs3,bs4,lagom2}: every output escaped, CSRF
 *    token in every POST form, no hard-coded text, no physical left/right
 *    utility classes, every lang key present (English, Arabic and the
 *    client-area languages), client.css fully scoped and RTL-safe.
 * 2. Theme detection (six, twenty-one, nexus, Lagom 1, Lagom 2, child themes
 *    via theme.yaml, sniffed Bootstrap version, unknown, cycles).
 * 3. Checkout consent markup per variant.
 * 4. Renders every template (real Smarty when --smarty is given, otherwise a
 *    small built-in renderer for the constructs the templates use) into full
 *    pages that simulate six, Lagom 1, twenty-one and Lagom 2 (light/dark),
 *    LTR and RTL, with the real Bootstrap CSS; writes manifest.json for
 *    tests/screenshot.mjs.
 *
 * Exit code 0 when every check passes.
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
define('WHMCS', true);

$MOD = realpath(__DIR__ . '/../modules/addons/wabek');
require $MOD . '/bootstrap.php';

use WABEK\Checkout;
use WABEK\Lang;
use WABEK\Theme;

$opt = getopt('', ['out:', 'smarty::', 'bs3::', 'bs4::']);
$OUT = rtrim((string) ($opt['out'] ?? (sys_get_temp_dir() . '/wabek-theme-test/pages')), '/');
@mkdir($OUT, 0777, true);

$passes = 0;
$fails = [];
function check(bool $ok, string $what): void
{
    global $passes, $fails;
    if ($ok) {
        $passes++;
    } else {
        $fails[] = $what;
        fwrite(STDERR, "FAIL: $what\n");
    }
}

$VARIANTS = Theme::VARIANTS;
$PAGES = ['preferences', 'verify'];

// ── 1. Static template checks ──────────────────────────────────────────

$langs = [];
foreach (['english', 'arabic', 'french', 'german', 'spanish', 'turkish'] as $l) {
    $_ADDONLANG = [];
    include $MOD . '/lang/' . $l . '.php';
    $langs[$l] = $_ADDONLANG;
}
check(array_keys($langs['english']) == array_keys($langs['english']) && !array_diff_key($langs['english'], $langs['arabic']) && !array_diff_key($langs['arabic'], $langs['english']),
    'english.php and arabic.php have the same keys: ' . implode(',', array_keys(array_diff_key($langs['english'], $langs['arabic']) + array_diff_key($langs['arabic'], $langs['english']))));

$usedKeys = [];
foreach ($VARIANTS as $v) {
    foreach ($PAGES as $p) {
        $file = "$MOD/templates/$v/$p.tpl";
        check(is_file($file), "template $v/$p.tpl exists");
        if (!is_file($file)) {
            continue;
        }
        $tpl = (string) file_get_contents($file);
        $code = preg_replace('/\{\*.*?\*\}/s', '', $tpl);

        preg_match_all('/\{\$[^}]+\}/', $code, $m);
        foreach ($m[0] as $out) {
            check(strpos($out, '|escape') !== false, "$v/$p: output is escaped: $out");
        }
        preg_match_all('/\{\$wl\.([a-z0-9_]+)/', $code, $m);
        foreach ($m[1] as $k) {
            $usedKeys[$k] = true;
        }
        preg_match_all('/<form\b[^>]*>(.*?)<\/form>/si', $code, $forms, PREG_SET_ORDER);
        check(count($forms) > 0, "$v/$p: has forms");
        foreach ($forms as $f) {
            if (preg_match('/method="post"/i', $f[0])) {
                check(strpos($f[1], 'name="token" value="{$wabek.token|escape:\'html\'}"') !== false, "$v/$p: POST form carries the CSRF token");
            }
        }
        $text = preg_replace('/\{literal\}.*?\{\/literal\}/s', '', $code);
        $text = preg_replace('/\{[^}]*\}/', ' ', $text);
        $text = preg_replace('/<[^>]*>/s', ' ', $text);
        $text = preg_replace('/&[a-z]+;/i', ' ', $text);
        check(!preg_match('/\p{L}/u', $text), "$v/$p: no hard-coded text (found: " . trim(preg_replace('/\s+/', ' ', $text)) . ')');
        check(!preg_match('/<style|\sstyle="/i', $code), "$v/$p: no inline styles");
        check(!preg_match('/\b(?:pull|float|text)-(?:left|right)\b|\b[mp][lr]-(?:\d|auto)\b|\b(?:left|right)\s*:/', $code), "$v/$p: no physical left/right classes");
        check(strpos($code, 'class="wabek-ca wabek-v-' . $v) !== false, "$v/$p: root carries .wabek-ca.wabek-v-$v");
        check(strpos($code, 'dir="{$wabek.dir|escape:\'html\'}"') !== false, "$v/$p: root carries dir");
    }
}
foreach (array_merge(array_keys($usedKeys), ['client_nav', 'client_nav_prefs', 'checkout_consent_label', 'checkout_consent_help', 'err_csrf']) as $k) {
    foreach ($langs as $l => $strings) {
        check(isset($strings[$k]) && trim((string) $strings[$k]) !== '', "lang/$l.php has '$k'");
    }
}
foreach ($langs as $l => $strings) {
    check(($strings['_language'] ?? '') === $l, "lang/$l.php _language");
    check(in_array($l, Lang::SUPPORTED, true), "Lang::SUPPORTED lists $l");
}

$css = (string) file_get_contents($MOD . '/assets/client.css');
$cssNoComments = preg_replace('/\/\*.*?\*\//s', '', $css);
preg_match_all('/([^{}]+)\{([^}]*)\}/', $cssNoComments, $rules, PREG_SET_ORDER);
check(count($rules) > 5, 'client.css has rules');
foreach ($rules as $r) {
    foreach (explode(',', $r[1]) as $sel) {
        $sel = trim($sel);
        check(strpos($sel, '.wabek-ca') === 0 || strpos($sel, '.wabek-co') === 0, "client.css selector is scoped: $sel");
    }
    if (preg_match('/\b(?:margin|padding|border)-(?:left|right)\b|(?<![-\w])(?:left|right)\s*:|float\s*:|text-align\s*:\s*(?:left|right)/', $r[2])) {
        check(strpos($r[1], '[dir="rtl"]') !== false, 'client.css: physical left/right only in explicit RTL rules: ' . trim($r[1]));
    }
    check(!preg_match('/!important/', $r[2]), 'client.css: no !important: ' . trim($r[1]));
    check(!preg_match('/(?:^|;)\s*(?:background|color)\s*:/', $r[2]), 'client.css: no hard-coded colours/backgrounds: ' . trim($r[1]));
}

// Hooks: only the menu API for navigation, stylesheet only on our pages / checkout.
$hooks = (string) file_get_contents($MOD . '/hooks.php');
foreach (['ClientAreaSecondaryNavbar', 'ClientAreaPrimarySidebar', 'ClientAreaHeadOutput', 'ShoppingCartCheckoutOutput', 'ShoppingCartValidateCheckout', 'PreShoppingCartCheckout', 'AfterShoppingCartCheckout', 'ClientAreaPage'] as $h) {
    check(strpos($hooks, "add_hook('$h'") !== false, "hooks.php registers $h");
}
check(strpos($hooks, "Theme::brandIcon('whatsapp')") !== false, 'menu items use the theme-aware icon class');

// ── 2. Theme detection ─────────────────────────────────────────────────

$root = sys_get_temp_dir() . '/wabek-theme-detect-' . getmypid();
$themes = [
    'six'          => [],
    'twenty-one'   => [],
    'nexus'        => ['theme.yaml' => "name: \"Nexus\"\nconfig:\n  parent: twenty-one\n"],
    'lagom'        => [],
    'lagom2'       => ['theme.yaml' => "name: \"Lagom 2\"\n"],
    'lagom2-child' => ['theme.yaml' => "name: \"My Lagom\"\nparent: lagom2\n"],
    'my-lagom2'    => ['theme.yaml' => "name: 'Lagom 2 copy'\n"],
    'lagom-old'    => ['theme.yaml' => "name: Mine\nparent: \"lagom\"\n"],
    'six-child'    => ['theme.yaml' => "name: Six child\nconfig:\n    parent: six\n"],
    'deep-child'   => ['theme.yaml' => "parent: six-child\n"],
    'tw-child'     => ['theme.yaml' => "name: x\nparent: twenty-one\n"],
    'custom-bs3'   => ['css/all.min.css' => "/*!\n * Bootstrap v3.4.1 (https://getbootstrap.com/)\n */"],
    'custom-bs5'   => ['css/theme.min.css' => "/*!\n * Bootstrap  v5.3.2 (https://getbootstrap.com/)\n */"],
    'yaml-bs3'     => ['theme.yaml' => "name: y\nconfig:\n  bootstrapVersion: 3\n"],
    'cycle-a'      => ['theme.yaml' => "parent: cycle-b\n"],
    'cycle-b'      => ['theme.yaml' => "parent: cycle-a\n"],
    'unknown'      => [],
];
foreach ($themes as $name => $files) {
    @mkdir("$root/$name/css", 0777, true);
    foreach ($files as $f => $content) {
        file_put_contents("$root/$name/$f", $content);
    }
}
Theme::setRoot($root);
$expect = [
    'six' => ['bs3', 0], 'twenty-one' => ['bs4', 0], 'nexus' => ['bs4', 0], 'lagom' => ['bs3', 1], 'lagom2' => ['lagom2', 2],
    'lagom2-child' => ['lagom2', 2], 'my-lagom2' => ['lagom2', 2], 'lagom-old' => ['bs3', 1], 'six-child' => ['bs3', 0],
    'deep-child' => ['bs3', 0], 'tw-child' => ['bs4', 0], 'custom-bs3' => ['bs3', 0], 'custom-bs5' => ['bs4', 0],
    'yaml-bs3' => ['bs3', 0], 'cycle-a' => ['bs4', 0], 'unknown' => ['bs4', 0], '' => ['bs4', 0], '../six' => ['bs4', 0],
];
foreach ($expect as $name => [$variant, $lagom]) {
    $t = Theme::resolve($name);
    check($t['variant'] === $variant, "theme '$name' → $variant (got {$t['variant']}, chain " . implode('>', $t['chain']) . ')');
    check($t['lagom'] === $lagom, "theme '$name' → lagom $lagom (got {$t['lagom']})");
}
check(Theme::resolve('deep-child')['chain'] === ['deep-child', 'six-child', 'six'], 'parent chain followed through theme.yaml');
check(Theme::detect(['template' => 'lagom2-child'])['variant'] === 'lagom2', 'template variable wins');
$_SESSION['Template'] = 'six';
check(Theme::detect()['name'] === 'six', 'session Template used when no variable is given');
$GLOBALS['CONFIG']['Template'] = 'twenty-one';
unset($_SESSION['Template']);
check(Theme::detect()['name'] === 'twenty-one', '$CONFIG[Template] fallback');
check(Theme::brandIcon('whatsapp', ['template' => 'six']) === 'fa fa-whatsapp', 'six: FA4-compatible icon');
check(Theme::brandIcon('whatsapp', ['template' => 'lagom2']) === 'fab fa-whatsapp', 'lagom2: FA5/6 brand icon');
check(Theme::brandIcon('whatsapp', ['template' => 'twenty-one']) === 'fab fa-whatsapp', 'twenty-one: FA5/6 brand icon');
Theme::setRoot(null);
array_map('unlink', array_merge(glob("$root/*/theme.yaml") ?: [], glob("$root/*/css/*.css") ?: []));

// ── 3. Checkout markup ─────────────────────────────────────────────────

foreach ($VARIANTS as $v) {
    foreach ([true, false] as $checked) {
        $h = Checkout::markup($v, $checked, false, ['label' => 'L<b>', 'help' => 'H&']);
        check(strpos($h, 'name="' . Checkout::SHOWN . '" value="1"') !== false, "checkout $v: hidden 'shown' field");
        check(strpos($h, 'name="' . Checkout::FIELD . '" id="wabekWaConsent" value="1"') !== false, "checkout $v: checkbox");
        check(strpos($h, 'for="wabekWaConsent"') !== false, "checkout $v: label bound to checkbox");
        check((strpos($h, ' checked') !== false) === $checked, "checkout $v: checked=" . var_export($checked, true));
        check(strpos($h, 'L&lt;b&gt;') !== false && strpos($h, 'H&amp;') !== false && strpos($h, '<b>') === false, "checkout $v: text escaped");
        check(strpos($h, $v === 'bs3' ? 'class="checkbox' : 'class="form-check') !== false, "checkout $v: native checkbox markup");
    }
    check(strpos(Checkout::markup($v, true, true, ['label' => 'a', 'help' => '']), 'dir="rtl"') !== false, "checkout $v: RTL wrapper");
}

// ── 4. Render pages ────────────────────────────────────────────────────

/** Minimal Smarty subset: {* *}, {literal}, {$a.b|escape:'html'}, {if}/{elseif}/{else}/{/if} with !, &&, ||, eq. */
final class MiniSmarty
{
    private $vars = [];

    public function assign(string $k, $v): void
    {
        $this->vars[$k] = $v;
    }

    public function fetch(string $file): string
    {
        $src = preg_replace('/\{\*.*?\*\}/s', '', (string) file_get_contents($file));
        $parts = preg_split('/(\{literal\}.*?\{\/literal\}|\{(?:\/?if|elseif|else)\b[^}]*\}|\{\$[^}]+\})/s', $src, -1, PREG_SPLIT_DELIM_CAPTURE);
        $php = '';
        foreach ($parts as $i => $part) {
            if ($i % 2 === 0) {
                $php .= $part === '' ? '' : 'echo ' . var_export($part, true) . ';';
            } elseif (strpos($part, '{literal}') === 0) {
                $php .= 'echo ' . var_export(substr($part, 9, -10), true) . ';';
            } elseif (preg_match('/^\{if\s+(.+)\}$/s', $part, $m)) {
                $php .= 'if (' . $this->cond($m[1]) . ') {';
            } elseif (preg_match('/^\{elseif\s+(.+)\}$/s', $part, $m)) {
                $php .= '} elseif (' . $this->cond($m[1]) . ') {';
            } elseif ($part === '{else}') {
                $php .= '} else {';
            } elseif ($part === '{/if}') {
                $php .= '}';
            } elseif (preg_match('/^\{\$([a-z0-9_.]+)((?:\|[a-z_]+(?::\'[^\']*\')?)*)\}$/i', $part, $m)) {
                $expr = '$get(' . var_export($m[1], true) . ')';
                $php .= 'echo ' . (strpos($m[2], '|escape') !== false ? 'htmlspecialchars((string) ' . $expr . ', ENT_QUOTES, "UTF-8")' : '(string) ' . $expr) . ';';
            } else {
                throw new RuntimeException('MiniSmarty: unsupported tag ' . $part);
            }
        }
        $vars = $this->vars;
        $get = function (string $path) use ($vars) {
            $v = $vars;
            foreach (explode('.', $path) as $seg) {
                $v = is_array($v) && array_key_exists($seg, $v) ? $v[$seg] : null;
            }
            return $v;
        };
        ob_start();
        eval($php);
        return (string) ob_get_clean();
    }

    private function cond(string $c): string
    {
        $c = preg_replace_callback('/\$([a-z0-9_.]+)/i', function ($m) {
            return '$get(' . var_export($m[1], true) . ')';
        }, $c);
        return str_replace([' eq ', ' neq '], [' == ', ' != '], $c);
    }
}

$smartyAutoload = (string) ($opt['smarty'] ?? '');
$engine = 'mini';
if ($smartyAutoload !== '' && is_file($smartyAutoload)) {
    require $smartyAutoload;
    $engine = 'smarty ' . (defined('Smarty::SMARTY_VERSION') ? Smarty::SMARTY_VERSION : '?');
}
@mkdir("$OUT/compile", 0777, true);

function render(string $file, array $vars): string
{
    global $engine, $OUT;
    if ($engine === 'mini') {
        $s = new MiniSmarty();
    } else {
        $s = new Smarty();
        $s->setCompileDir("$OUT/compile");
        $s->setCaching(Smarty::CACHING_OFF);
        $s->setErrorReporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
    }
    foreach ($vars as $k => $v) {
        $s->assign($k, $v);
    }
    return $s->fetch($file);
}

$evil = '<script>alert("x")</script>';
$states = [
    'prefs-on'    => ['page' => 'preferences', 'v' => ['subscribed' => true, 'verified' => true, 'flash_type' => 'success', 'flash_text' => 'client_ok_subscribed']],
    'prefs-off'   => ['page' => 'preferences', 'v' => ['subscribed' => false, 'verified' => false]],
    'prefs-nophone' => ['page' => 'preferences', 'v' => ['has_phone' => false, 'subscribed' => true, 'flash_type' => 'error', 'flash_text' => 'err_csrf']],
    'verify-send' => ['page' => 'verify', 'v' => ['verified' => false]],
    'verify-code' => ['page' => 'verify', 'v' => ['verified' => false, 'code_sent' => true, 'login_gate' => true, 'flash_type' => 'error', 'flash_text' => 'otp_invalid']],
    'verify-done' => ['page' => 'verify', 'v' => ['verified' => true]],
];

$shells = [
    'six'         => ['variant' => 'bs3', 'css' => 'bs3', 'label' => 'six (Bootstrap 3)'],
    'lagom1'      => ['variant' => 'bs3', 'css' => 'bs3', 'label' => 'Lagom 1.x (Bootstrap 3)'],
    'twenty-one'  => ['variant' => 'bs4', 'css' => 'bs4', 'label' => 'twenty-one (Bootstrap 4)'],
    'lagom2'      => ['variant' => 'lagom2', 'css' => 'bs4', 'label' => 'Lagom 2.x light'],
    'lagom2-dark' => ['variant' => 'lagom2', 'css' => 'bs4', 'label' => 'Lagom 2.x dark'],
];

$bsCss = [
    'bs3' => (string) ($opt['bs3'] ?? ''),
    'bs4' => (string) ($opt['bs4'] ?? ''),
];
$clientCss = $MOD . '/assets/client.css';

/** Simulated theme chrome: header, breadcrumb, sidebar (as the menu API renders it), content column. */
function shell(string $shell, array $cfg, string $dir, string $lang, string $title, string $content, array $strings, bool $sidebar = true): string
{
    global $bsCss, $clientCss;
    $e = function ($s) {
        return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    };
    $css = $bsCss[$cfg['css']] !== '' ? '<link rel="stylesheet" href="file://' . $e($bsCss[$cfg['css']]) . '">' : '';
    $css .= '<link rel="stylesheet" href="file://' . $e($clientCss) . '">';
    $sim = [
        'six' => 'body{background:#fff}#header{padding:14px 0;border-bottom:1px solid #e5e5e5;margin-bottom:0}.header-lined{margin-bottom:20px}.header-lined h1{margin:0 0 6px;font-size:2em}#main-body{padding:20px 0}',
        'lagom1' => ':root{--brand-primary:#2b6ef5}body{background:#f2f5fa;color:#3c4858}#header{background:#fff;padding:14px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}.main-header{padding:24px 0 8px}.main-header-title{margin:0;font-size:24px;font-weight:600}#main-body{padding:16px 0 32px}'
            . '.btn-primary{background:var(--brand-primary);border-color:var(--brand-primary)}.panel{border:0;border-radius:6px;box-shadow:0 2px 6px rgba(28,40,64,.08)}.panel-default>.panel-heading{background:#fff;border-bottom:1px solid #eef1f6;border-radius:6px 6px 0 0}',
        'twenty-one' => 'body{background:#f6f7f8}header.header{background:#fff;padding:14px 0;border-bottom:1px solid #e5e5e5}.master-breadcrumb{background:#fff;border-bottom:1px solid #eee}.master-breadcrumb .breadcrumb{background:none;margin:0;padding:10px 0}#main-body{padding:24px 0}',
        'lagom2' => ':root{--brand-primary:#7a57d1;--brand-primary-hover:#6643bf}body{background:#f4f6fb;color:#45526e}#header{background:#fff;padding:14px 0;box-shadow:0 1px 2px rgba(0,0,0,.06)}.main-header{padding:28px 0 12px}.main-header-title{margin:0;font-size:26px;font-weight:600}#main-body{padding:12px 0 40px}'
            . '.btn-primary{background-color:var(--brand-primary);border-color:var(--brand-primary)}.btn-primary:hover{background-color:var(--brand-primary-hover)}.section-header{margin-bottom:14px}.section-title{font-size:18px;font-weight:600;margin:0}.section-desc{margin:4px 0 0;color:#8592ad}'
            . '.panel{background:#fff;border:0;border-radius:8px;box-shadow:0 2px 8px rgba(29,42,71,.08)}.panel-body{padding:24px}.label{display:inline-block;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600}.label-success{background:#e3f7ea;color:#14803c}.label-default{background:#eceff5;color:#5b6884}'
            . '.panel-sidebar .panel-heading{padding:16px 20px;border-bottom:1px solid #eef0f6}.panel-sidebar .panel-title{margin:0;font-size:15px;font-weight:600}',
    ];
    $sim['lagom2-dark'] = $sim['lagom2'] . 'body{background:#11141b;color:#c9cfdd}#header{background:#191d27}.panel,.card{background:#191d27;color:#c9cfdd;border-color:#262c3a}.text-muted,.section-desc{color:#8790a6!important}'
        . '.form-control,.form-control:focus{background:#11141b;color:#e3e7f0;border-color:#2c3344}.label-default{background:#262c3a;color:#aab2c5}.label-success{background:#123524;color:#6fdc97}.btn-outline-secondary{color:#aab2c5;border-color:#3a4256}.list-group-item{background:#191d27;color:#c9cfdd;border-color:#262c3a}';

    $nav = $e($strings['client_nav']);
    $prefs = $e($strings['client_nav_prefs']);
    $verify = $e($strings['client_btn_verify']);
    $profile = $e($strings['client_edit_profile']);
    $family = $cfg['css'];
    if ($family === 'bs3') {
        $side = '<div class="panel panel-default panel-sidebar"><div class="panel-heading"><h3 class="panel-title"><i class="fa fa-whatsapp"></i> ' . $nav . '</h3></div>'
            . '<div class="list-group"><a class="list-group-item active" href="#">' . $prefs . '</a><a class="list-group-item" href="#">' . $verify . '</a><a class="list-group-item" href="#">' . $profile . '</a></div></div>';
        $head = $shell === 'lagom1'
            ? '<div class="main-header"><div class="container"><h1 class="main-header-title">' . $e($title) . '</h1></div></div>'
            : '';
        $pageHeader = $shell === 'six'
            ? '<div class="header-lined"><h1>' . $e($title) . '</h1><ol class="breadcrumb"><li><a href="#">Portal</a></li><li class="active">' . $e($title) . '</li></ol></div>'
            : '';
        $body = '<section id="header"><div class="container"><strong>Example Hosting</strong></div></section>' . $head
            . '<section id="main-body"><div class="container"><div class="row">'
            . ($sidebar ? '<div class="col-md-3 sidebar">' . $side . '</div><div class="col-md-9 main-content">' : '<div class="col-md-12 main-content">')
            . $pageHeader . $content . '</div></div></div></section>';
    } else {
        $isLagom = strpos($shell, 'lagom2') === 0;
        $side = $isLagom
            ? '<div class="panel panel-sidebar mb-4"><div class="panel-heading"><h3 class="panel-title"><i class="fab fa-whatsapp"></i> ' . $nav . '</h3></div>'
              . '<div class="list-group list-group-flush"><a class="list-group-item active" href="#">' . $prefs . '</a><a class="list-group-item" href="#">' . $verify . '</a><a class="list-group-item" href="#">' . $profile . '</a></div></div>'
            : '<div class="card card-sidebar mb-3"><div class="card-header"><h3 class="card-title h6 m-0"><i class="fab fa-whatsapp"></i> ' . $nav . '</h3></div>'
              . '<div class="list-group list-group-flush"><a class="list-group-item list-group-item-action active" href="#">' . $prefs . '</a><a class="list-group-item list-group-item-action" href="#">' . $verify . '</a><a class="list-group-item list-group-item-action" href="#">' . $profile . '</a></div></div>';
        $head = $isLagom
            ? '<div id="header"><div class="container"><strong>Example Hosting</strong></div></div><div class="main-header"><div class="container"><h1 class="main-header-title">' . $e($title) . '</h1></div></div>'
            : '<header class="header"><div class="container"><strong>Example Hosting</strong></div></header><nav class="master-breadcrumb"><div class="container"><ol class="breadcrumb"><li class="breadcrumb-item"><a href="#">Portal</a></li><li class="breadcrumb-item active">' . $e($title) . '</li></ol></div></nav>';
        $body = $head . '<section id="main-body"><div class="container"><div class="row">'
            . ($sidebar ? '<div class="col-lg-4 col-xl-3"><div class="sidebar">' . $side . '</div></div><div class="col-lg-8 col-xl-9 primary-content">' : '<div class="col-12 primary-content">')
            . $content . '</div></div></div></section>';
    }
    return '<!doctype html><html lang="' . $e($lang) . '" dir="' . $e($dir) . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . $e($title) . ' — ' . $e($cfg['label']) . '</title>' . $css . '<style>' . $sim[$shell] . '</style></head><body class="theme-' . $e($shell) . '">'
        . $body . '</body></html>';
}

/** standard_cart / Lagom checkout simulation around the ShoppingCartCheckoutOutput box. */
function checkoutContent(string $shell, string $variant, bool $rtl, array $strings): string
{
    $box = Checkout::markup($variant, true, $rtl, ['label' => $strings['checkout_consent_label'], 'help' => $strings['checkout_consent_help']]);
    $form = '<form method="post" action="#" id="frmCheckout"><input type="hidden" name="token" value="t">'
        . '<div class="form-group"><label for="inputEmail">Email</label><input class="form-control" id="inputEmail" type="email" value="client@example.com"></div>'
        . '<div class="form-group"><label for="inputPhone">Phone</label><input class="form-control" id="inputPhone" type="tel" value="+966 50 123 4567"></div>'
        . '<div>' . $box . '</div>'
        . '<div class="text-center"><button type="submit" class="btn btn-primary btn-lg">Complete Order</button></div></form>';
    if ($variant === 'bs3') {
        return '<div id="order-standard_cart"><div class="panel panel-default"><div class="panel-body">' . $form . '</div></div></div>';
    }
    if ($variant === 'lagom2') {
        return '<div class="main-body order-lagom"><div class="section"><div class="section-body"><div class="panel"><div class="panel-body">' . $form . '</div></div></div></div></div>';
    }
    return '<div id="order-standard_cart"><div class="card"><div class="card-body">' . $form . '</div></div></div>';
}

$manifest = [];
foreach (['ltr' => 'english', 'rtl' => 'arabic'] as $dir => $lang) {
    Lang::init([], $lang);
    $wl = Lang::all();
    check(($dir === 'rtl') === Lang::isRtl(), "$lang: _dir");
    foreach ($shells as $shell => $cfg) {
        foreach ($states as $state => $def) {
            $view = array_merge([
                'action' => $def['page'] === 'verify' ? 'verify' : 'preferences', 'token' => 'tok"en', 'dir' => $dir,
                'theme' => $shell, 'variant' => $cfg['variant'], 'family' => $cfg['css'], 'lagom' => 0,
                'phone_masked' => '+966 •••• 4567', 'has_phone' => true, 'subscribed' => true, 'verified' => false,
                'otp_enabled' => true, 'login_gate' => false, 'code_sent' => false, 'flash_type' => '', 'flash_text' => '',
                'company' => 'Example', 'url_self' => 'index.php?m=wabek', 'url_verify' => 'index.php?m=wabek&action=verify',
                'url_profile' => 'clientarea.php?action=details', 'url_logout' => 'logout.php',
            ], $def['v']);
            if ($view['flash_text'] !== '') {
                $view['flash_text'] = $wl[$view['flash_text']] ?? $view['flash_text'];
            }
            // Escaping probe: a hostile value must come out encoded.
            $probe = $view;
            $probe['flash_type'] = 'error';
            $probe['flash_text'] = $evil;
            $probe['phone_masked'] = $evil;
            $probeHtml = render("$MOD/templates/{$cfg['variant']}/{$def['page']}.tpl", ['wabek' => $probe, 'wl' => $wl]);
            check(strpos($probeHtml, '<script>') === false, "{$cfg['variant']}/{$def['page']}: hostile values are escaped");
            check(strpos($probeHtml, '<form') === false || strpos($probeHtml, 'value="tok&quot;en"') !== false,"{$cfg['variant']}/{$def['page']}: token escaped in attribute");

            $content = render("$MOD/templates/{$cfg['variant']}/{$def['page']}.tpl", ['wabek' => $view, 'wl' => $wl]);
            $title = $def['page'] === 'verify' ? $wl['client_verify_title'] : $wl['client_prefs_title'];
            $name = "$shell-$state-$dir.html";
            file_put_contents("$OUT/$name", shell($shell, $cfg, $dir, $lang === 'arabic' ? 'ar' : 'en', $title, $content, $wl, !$view['login_gate']));
            $manifest[] = ['file' => $name, 'shell' => $shell, 'variant' => $cfg['variant'], 'dir' => $dir, 'state' => $state, 'kind' => 'page'];
        }
        $name = "$shell-checkout-$dir.html";
        file_put_contents("$OUT/$name", shell($shell, $cfg, $dir, $lang === 'arabic' ? 'ar' : 'en', 'Checkout', checkoutContent($shell, $cfg['variant'], $dir === 'rtl', $wl), $wl, false));
        $manifest[] = ['file' => $name, 'shell' => $shell, 'variant' => $cfg['variant'], 'dir' => $dir, 'state' => 'checkout', 'kind' => 'checkout'];
    }
}
file_put_contents("$OUT/manifest.json", json_encode(['engine' => $engine, 'pages' => $manifest], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

printf("render-check: %d passed, %d failed; %d pages rendered with %s into %s\n", $passes, count($fails), count($manifest), $engine, $OUT);
exit($fails ? 1 : 0);
