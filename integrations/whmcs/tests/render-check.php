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
 * 3. Checkout consent markup per variant; homepage panel body per variant
 *    (bs3 / bs4 / lagom2, LTR / RTL); admin client summary box (LTR / RTL).
 * 4. Renders every template (real Smarty when --smarty is given, otherwise a
 *    small built-in renderer for the constructs the templates use) into full
 *    pages that simulate six, Lagom 1, twenty-one and Lagom 2 (light/dark),
 *    LTR and RTL, with the real Bootstrap CSS — plus the homepage with the
 *    WhatsApp panel in every theme and the admin client summary (Bootstrap 3
 *    admin) in LTR / RTL; writes manifest.json for tests/screenshot.mjs.
 *
 * Exit code 0 when every check passes.
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
define('WHMCS', true);

$MOD = realpath(__DIR__ . '/../modules/addons/wabek');
require $MOD . '/bootstrap.php';

use WABEK\Admin\ClientSummary;
use WABEK\Checkout;
use WABEK\Client\ClientController;
use WABEK\Client\HomePanel;
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
foreach (['ClientAreaSecondaryNavbar', 'ClientAreaPrimarySidebar', 'ClientAreaHeadOutput', 'ShoppingCartCheckoutOutput', 'ShoppingCartValidateCheckout', 'PreShoppingCartCheckout', 'AfterShoppingCartCheckout', 'ClientAreaPage',
    'ClientAreaHomepagePanels', 'ClientAreaFooterOutput', 'ClientAdd', 'ClientEdit', 'AdminAreaClientSummaryPage', 'AdminAreaClientSummaryActionLinks', 'AdminClientProfileTabFields', 'AdminClientProfileTabFieldsSave'] as $h) {
    check(strpos($hooks, "add_hook('$h'") !== false, "hooks.php registers $h");
}
check(strpos($hooks, "Theme::brandIcon('whatsapp')") !== false, 'menu items use the theme-aware icon class');

foreach ($PAGES as $p) {
    $shim = (string) @file_get_contents("$MOD/templates/$p.tpl");
    check(strpos($shim, '{include file="`$wabekTplDir`/' . $p . '.tpl"}') !== false, "templates/$p.tpl includes the variant from \$wabekTplDir");
    check(strpos($shim, '{include file="./bs4/' . $p . '.tpl"}') !== false, "templates/$p.tpl falls back to bs4");
    $text = preg_replace(['/\{\*.*?\*\}/s', '/\{[^}]*\}/'], ' ', $shim);
    check(!preg_match('/\p{L}/u', $text), "templates/$p.tpl: shim has no text of its own");
}
foreach ($VARIANTS as $v) {
    check(ClientController::variantDir($v) === str_replace('\\', '/', $MOD) . '/templates/' . $v, "variantDir($v) is the absolute path of templates/$v");
}
foreach (['', '../six', 'bs4/../../x', 'six'] as $bad) {
    check(ClientController::variantDir($bad) === str_replace('\\', '/', $MOD) . '/templates/bs4', "variantDir('$bad') falls back to bs4");
}

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


// ── 3b. Homepage panel and admin client summary box ────────────────────

$CLIENT_KEYS_NEW = ['client_state_line_on', 'client_state_line_off', 'client_sent_to', 'client_hp_manage', 'client_no_phone', 'client_btn_subscribe',
    'client_btn_unsubscribe', 'client_verified_badge', 'client_state_on', 'client_state_off', 'cf_consent_name', 'cf_consent_desc'];
foreach ($CLIENT_KEYS_NEW as $k) {
    foreach ($langs as $l => $strings) {
        check(isset($strings[$k]) && trim((string) $strings[$k]) !== '', "lang/$l.php has '$k'");
    }
}
$ADMIN_KEYS_NEW = ['cs_title', 'cs_on', 'cs_off', 'cs_state_opted_in', 'cs_state_opted_out', 'cs_state_default_on', 'cs_state_default_off', 'cs_number',
    'cs_not_verified', 'cs_source_field', 'cs_source_override', 'cs_source_profile', 'cs_consent', 'cs_last_message', 'cs_none', 'cs_btn_turn_off',
    'cs_btn_turn_on', 'cs_btn_send', 'cs_btn_log', 'cs_unavailable', 'cs_ok_on', 'cs_ok_off', 'al_send', 'al_log', 'pf_yes', 'pf_no', 'pf_phone',
    'pf_phone_help', 'pf_phone_field_note', 'pf_consent_field_note', 'set_consent_field_auto', 'help_consent_field_auto', 'set_consent_field_meaning',
    'consent_field_receive', 'consent_field_opt_out', 'ok_consent_field_created', 'err_consent_field'];
foreach ($ADMIN_KEYS_NEW as $k) {
    foreach (['english', 'arabic'] as $l) {
        check(isset($langs[$l][$k]) && trim((string) $langs[$l][$k]) !== '', "lang/$l.php has admin key '$k'");
    }
}
check($langs['arabic']['cs_btn_turn_off'] === 'إيقاف إشعارات واتساب' && $langs['arabic']['cs_btn_turn_on'] === 'تفعيل إشعارات واتساب', 'Arabic toggle labels');
check($langs['arabic']['cf_consent_name'] === 'استقبال إشعارات واتساب', 'Arabic custom field name');
check($langs['arabic']['client_state_line_on'] === 'إشعارات واتساب مفعّلة لحسابك' && $langs['arabic']['client_state_line_off'] === 'إشعارات واتساب موقوفة لحسابك', 'Arabic account state lines');

/** Static checks shared by generated HTML fragments. */
function fragmentChecks(string $h, string $what): void
{
    check(!preg_match('/\b(?:pull|float|text)-(?:left|right)\b|\b[mp][lr]-(?:\d|auto)\b/', $h), "$what: no physical left/right classes");
    preg_match_all('/<form\b[^>]*>(.*?)<\/form>/si', $h, $forms, PREG_SET_ORDER);
    foreach ($forms as $f) {
        if (preg_match('/method="post"/i', $f[0])) {
            check(preg_match('/<input type="hidden" name="token" value="[^"]+">/', $f[1]) === 1, "$what: POST form carries the token");
        }
    }
    check(strpos($h, '<script') === false, "$what: hostile values escaped");
}

$hpBase = ['subscribed' => true, 'has_phone' => true, 'phone_masked' => '+966•••••567', 'verified' => true, 'token' => 'tok"en', 'url_self' => 'index.php?m=wabek', 'flash' => ''];
foreach (['english' => false, 'arabic' => true] as $l => $rtl) {
    Lang::init([], $l);
    $wl = Lang::all();
    foreach ($VARIANTS as $v) {
        foreach ([true, false] as $on) {
            $h = HomePanel::markup($v, ['subscribed' => $on] + $hpBase, $wl, $rtl);
            $what = "homepage panel $v " . ($on ? 'on' : 'off') . " $l";
            check(strpos($h, 'class="wabek-ca wabek-hp wabek-v-' . $v . '" dir="' . ($rtl ? 'rtl' : 'ltr') . '"') !== false, "$what: scoped root + dir");
            check(strpos($h, '<form method="post" action="index.php?m=wabek"') !== false, "$what: posts to the preferences page");
            check(strpos($h, 'name="token" value="tok&quot;en"') !== false, "$what: token escaped");
            check(strpos($h, 'name="wb_action" value="' . ($on ? 'unsubscribe' : 'subscribe') . '"') !== false, "$what: toggle action");
            check(strpos($h, 'name="return" value="home"') !== false, "$what: returns to the homepage");
            check(strpos($h, Security_e($wl[$on ? 'client_state_line_on' : 'client_state_line_off'])) !== false, "$what: account state line");
            check(strpos($h, Security_e($wl[$on ? 'client_btn_unsubscribe' : 'client_btn_subscribe'])) !== false, "$what: single toggle button");
            check(substr_count($h, '<button') === 1, "$what: exactly one button");
            check(strpos($h, '<bdi class="wabek-phone" dir="ltr">') !== false, "$what: LTR phone");
            $native = ['bs3' => $on ? 'label label-success' : 'label label-default', 'bs4' => $on ? 'badge badge-success' : 'badge badge-secondary',
                'lagom2' => $on ? 'label label-success badge badge-success' : 'label label-default badge badge-secondary'][$v];
            check(strpos($h, 'class="' . $native) !== false, "$what: theme-native badge ($native)");
            check(strpos($h, $on ? ($v === 'bs3' ? 'btn btn-default btn-sm' : 'btn btn-sm btn-outline-danger') : 'btn btn-primary btn-sm') !== false, "$what: theme-native button");
            check(!preg_match('/\sstyle="/', $h), "$what: no inline styles");
            fragmentChecks($h, $what);
        }
        $h = HomePanel::markup($v, ['has_phone' => false, 'phone_masked' => '', 'flash' => 'OK <b>'] + $hpBase, $wl, $rtl);
        check(strpos($h, Security_e($wl['client_no_phone'])) !== false && strpos($h, 'wabek-phone') === false, "homepage panel $v $l: no phone");
        check(strpos($h, 'OK &lt;b&gt;') !== false, "homepage panel $v $l: flash escaped");
        $h = HomePanel::markup($v, ['phone_masked' => '<script>x</script>', 'token' => '"><script>'] + $hpBase, $wl, $rtl);
        fragmentChecks($h, "homepage panel $v $l (hostile)");
    }

    $cs = ['client_id' => 42, 'phone' => '+966501234567', 'phone_source' => 'profile', 'state' => 'default_on', 'subscribed' => true, 'verified' => true,
        'last' => ['when' => '2026-11-16 10:20:30', 'status' => 'sent', 'delivery' => 'read', 'event' => 'invoice_created'], 'token' => 'tok"en', 'flash' => '', 'partial' => false];
    $t = ClientSummary::texts();
    foreach ([true, false] as $on) {
        $h = ClientSummary::markup(['subscribed' => $on, 'state' => $on ? 'opted_in' : 'opted_out'] + $cs, $t, $rtl);
        $what = 'admin summary ' . ($on ? 'on' : 'off') . " $l";
        check(strpos($h, '<div class="panel panel-default wabek-cs" id="wabekClientSummary" dir="' . ($rtl ? 'rtl' : 'ltr') . '"') !== false, "$what: Bootstrap 3 admin panel + dir");
        check(strpos($h, 'action="addonmodules.php?module=wabek&amp;page=consent"') !== false, "$what: toggle posts to the addon");
        check(strpos($h, 'name="wb_action" value="client_toggle"') !== false && strpos($h, 'name="client" value="42"') !== false, "$what: toggle fields");
        check(strpos($h, 'name="consent" value="' . ($on ? 'out' : 'in') . '"') !== false && strpos($h, 'name="return" value="summary"') !== false, "$what: toggle target");
        check(strpos($h, 'name="token" value="tok&quot;en"') !== false, "$what: token escaped");
        check(strpos($h, Security_e($t[$on ? 'cs_btn_turn_off' : 'cs_btn_turn_on'])) !== false, "$what: toggle label");
        check(strpos($h, 'href="addonmodules.php?module=wabek&amp;page=send&amp;client=42"') !== false, "$what: send button");
        check(strpos($h, 'href="addonmodules.php?module=wabek&amp;page=log&amp;client=42"') !== false, "$what: log button");
        check(strpos($h, '<bdi dir="ltr">+966501234567</bdi>') !== false, "$what: full number for admins, LTR");
        check(strpos($h, Security_e($t['client_verified_badge'])) !== false, "$what: verified badge");
        check(strpos($h, '2026-11-16 10:20') !== false && strpos($h, Security_e($t['delivery_read'])) !== false && strpos($h, Security_e($t['event_invoice_created'])) !== false, "$what: last message time, status, event");
        check(strpos($h, Security_e($t['cs_state_' . ($on ? 'opted_in' : 'opted_out')])) !== false, "$what: recorded state");
        fragmentChecks($h, $what);
    }
    $h = ClientSummary::markup(['phone' => null, 'phone_source' => '', 'verified' => false, 'last' => null, 'partial' => true, 'flash' => 'cs_ok_off'] + $cs, $t, $rtl);
    check(strpos($h, Security_e($t['err_phone'])) !== false && strpos($h, Security_e($t['cs_none'])) !== false, "admin summary $l: no phone, no message");
    check(strpos($h, Security_e($t['cs_unavailable'])) !== false && strpos($h, Security_e($t['cs_ok_off'])) !== false, "admin summary $l: partial warning + flash");
    $h = ClientSummary::markup(['subscribed' => null, 'state' => ''] + $cs, $t, $rtl);
    check(strpos($h, '<form') === false && strpos($h, 'page=send') !== false, "admin summary $l: consent unknown → no toggle, links kept");
    $h = ClientSummary::markup(['phone' => '<script>', 'last' => ['when' => '<script>', 'status' => '<script>', 'delivery' => '', 'event' => '<script>']] + $cs, $t, $rtl);
    fragmentChecks($h, "admin summary $l (hostile)");
}
Lang::init([], 'english');

function Security_e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
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
        $parts = preg_split('/(\{literal\}.*?\{\/literal\}|\{(?:\/?if|elseif|else|include)\b[^}]*\}|\{\$[^}]+\})/s', $src, -1, PREG_SPLIT_DELIM_CAPTURE);
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
            } elseif (preg_match('/^\{include\s+file="([^"]+)"\}$/', $part, $m)) {
                $expr = var_export('', true);
                foreach (preg_split('/`\$([a-z0-9_.]+)`/i', $m[1], -1, PREG_SPLIT_DELIM_CAPTURE) as $j => $seg) {
                    $expr .= ' . ' . ($j % 2 ? '(string) $get(' . var_export($seg, true) . ')' : var_export($seg, true));
                }
                $php .= 'echo $include(' . $expr . ');';
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
        $self = $this;
        $include = function (string $path) use ($self, $file) {
            if (strpos($path, './') === 0) {
                $path = dirname($file) . substr($path, 1);
            }
            return $self->fetch($path);
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
        $s->enableSecurity('Smarty_Security');
        $s->security_policy->secure_dir = [dirname($file)];
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

/** Homepage panels as each theme prints them (heading with icon, body, footer / header button from 'extras'). */
function homeContent(array $cfg, array $wl, string $body): string
{
    $e = function ($s) {
        return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    };
    $label = $e($wl['client_nav']);
    $btn = $e($wl['client_hp_manage']);
    $other = $cfg['css'] === 'bs3'
        ? '<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title">Your Active Products/Services</h3></div><div class="list-group"><a class="list-group-item" href="#">Shared Hosting — example.com</a></div></div>'
        : '<div class="card"><div class="card-header"><h3 class="card-title m-0">Your Active Products/Services</h3></div><div class="list-group list-group-flush"><a class="list-group-item" href="#">Shared Hosting — example.com</a></div></div>';
    if ($cfg['css'] === 'bs3') {
        $panel = '<div class="panel panel-default panel-accent-green"><div class="panel-heading"><h3 class="panel-title"><i class="fa fa-whatsapp"></i> ' . $label . '</h3></div>'
            . '<div class="panel-body">' . $body . '</div><div class="panel-footer"><a class="btn btn-default btn-xs" href="#"><i class="fa fa-cog"></i> ' . $btn . '</a></div></div>';
        return '<div class="row"><div class="col-sm-6">' . $panel . '</div><div class="col-sm-6">' . $other . '</div></div>';
    }
    $panel = $cfg['variant'] === 'lagom2'
        ? '<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title"><i class="fab fa-whatsapp"></i> ' . $label . '</h3></div>'
          . '<div class="panel-body">' . $body . '</div><div class="panel-footer"><a class="btn btn-default btn-sm" href="#">' . $btn . '</a></div></div>'
        : '<div class="card card-accent-green mb-3"><div class="card-header"><h3 class="card-title m-0"><i class="fab fa-whatsapp"></i> ' . $label . '</h3></div>'
          . '<div class="card-body">' . $body . '</div><div class="card-footer"><a class="btn btn-default btn-sm" href="#"><i class="fas fa-cog"></i> ' . $btn . '</a></div></div>';
    return '<div class="row"><div class="col-md-6">' . $panel . '</div><div class="col-md-6">' . $other . '</div></div>';
}

/** WHMCS admin client summary page (blend, Bootstrap 3): our box above the theme's summary boxes. */
function adminShell(string $dir, string $lang, string $box): string
{
    global $bsCss;
    $e = function ($s) {
        return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    };
    $css = $bsCss['bs3'] !== '' ? '<link rel="stylesheet" href="file://' . $e($bsCss['bs3']) . '">' : '';
    return '<!doctype html><html lang="' . $e($lang) . '" dir="' . $e($dir) . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>Client summary — admin</title>' . $css
        . '<style>body{background:#f3f3f3;font-size:13px}#header{background:#1a4d80;color:#fff;padding:10px 15px}.contentarea{padding:15px}.clientssummarybox{background:#fff;border:1px solid #ddd;padding:10px;margin-bottom:15px}.clientssummarybox .title{font-weight:bold;margin-bottom:6px}</style>'
        . '</head><body><div id="header"><strong>WHMCS</strong> · Clients</div><div class="contentarea"><h1>Client Profile</h1>'
        . $box
        . '<div class="row"><div class="col-sm-4"><div class="clientssummarybox"><div class="title">Clients Information</div>Jane Doe<br>jane@example.com</div></div>'
        . '<div class="col-sm-4"><div class="clientssummarybox"><div class="title">Invoices/Billing</div>Paid: 3</div></div>'
        . '<div class="col-sm-4"><div class="clientssummarybox"><div class="title">Other Actions</div><a href="#">Send WhatsApp message</a></div></div></div>'
        . '</div></body></html>';
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
            $tplDir = ClientController::variantDir($cfg['variant']);
            $probeHtml = render("$MOD/templates/{$def['page']}.tpl", ['wabek' => $probe, 'wl' => $wl, 'wabekTplDir' => $tplDir]);
            check(strpos($probeHtml, 'wabek-v-' . $cfg['variant']) !== false, "shim {$def['page']}.tpl includes the {$cfg['variant']} variant");
            check(strpos($probeHtml, '<script>') === false, "{$cfg['variant']}/{$def['page']}: hostile values are escaped");
            check(strpos($probeHtml, '<form') === false || strpos($probeHtml, 'value="tok&quot;en"') !== false,"{$cfg['variant']}/{$def['page']}: token escaped in attribute");

            $content = render("$MOD/templates/{$def['page']}.tpl", ['wabek' => $view, 'wl' => $wl, 'wabekTplDir' => $tplDir]);
            $title = $def['page'] === 'verify' ? $wl['client_verify_title'] : $wl['client_prefs_title'];
            $name = "$shell-$state-$dir.html";
            file_put_contents("$OUT/$name", shell($shell, $cfg, $dir, $lang === 'arabic' ? 'ar' : 'en', $title, $content, $wl, !$view['login_gate']));
            $manifest[] = ['file' => $name, 'shell' => $shell, 'variant' => $cfg['variant'], 'dir' => $dir, 'state' => $state, 'kind' => 'page'];
        }
        $name = "$shell-checkout-$dir.html";
        file_put_contents("$OUT/$name", shell($shell, $cfg, $dir, $lang === 'arabic' ? 'ar' : 'en', 'Checkout', checkoutContent($shell, $cfg['variant'], $dir === 'rtl', $wl), $wl, false));
        $manifest[] = ['file' => $name, 'shell' => $shell, 'variant' => $cfg['variant'], 'dir' => $dir, 'state' => 'checkout', 'kind' => 'checkout'];

        // Client-area homepage with the WhatsApp panel, framed the way each theme prints homepage panels.
        foreach ([true, false] as $on) {
            $body = HomePanel::markup($cfg['variant'], ['subscribed' => $on, 'has_phone' => true, 'phone_masked' => '+966•••••567', 'verified' => $on,
                'token' => 't', 'url_self' => 'index.php?m=wabek', 'flash' => $on ? $wl['client_ok_subscribed'] : ''], $wl, $dir === 'rtl');
            $name = "$shell-home-" . ($on ? 'on' : 'off') . "-$dir.html";
            file_put_contents("$OUT/$name", shell($shell, $cfg, $dir, $lang === 'arabic' ? 'ar' : 'en', 'Portal Home', homeContent($cfg, $wl, $body), $wl, false));
            $manifest[] = ['file' => $name, 'shell' => $shell, 'variant' => $cfg['variant'], 'dir' => $dir, 'state' => 'home-' . ($on ? 'on' : 'off'), 'kind' => 'home'];
        }
    }
    // Admin client summary (WHMCS admin "blend" is Bootstrap 3).
    foreach ([true, false] as $on) {
        $box = ClientSummary::markup(['client_id' => 42, 'phone' => '+966501234567', 'phone_source' => 'profile', 'state' => $on ? 'default_on' : 'opted_out',
            'subscribed' => $on, 'verified' => $on, 'last' => ['when' => '2026-11-16 10:20:30', 'status' => $on ? 'sent' : 'failed', 'delivery' => $on ? 'read' : '',
            'event' => 'invoice_created'], 'token' => 't', 'flash' => $on ? 'cs_ok_on' : '', 'partial' => false], ClientSummary::texts(), $dir === 'rtl');
        $name = 'admin-summary-' . ($on ? 'on' : 'off') . "-$dir.html";
        file_put_contents("$OUT/$name", adminShell($dir, $lang === 'arabic' ? 'ar' : 'en', $box));
        $manifest[] = ['file' => $name, 'shell' => 'admin', 'variant' => 'bs3', 'dir' => $dir, 'state' => 'admin-' . ($on ? 'on' : 'off'), 'kind' => 'admin'];
    }
}
Lang::init([], 'english');
foreach ($PAGES as $p) {
    $html = render("$MOD/templates/$p.tpl", ['wabek' => ['dir' => 'ltr', 'has_phone' => true, 'token' => 't', 'url_self' => 'x', 'url_verify' => 'y'], 'wl' => Lang::all()]);
    check(strpos($html, 'wabek-v-bs4') !== false, "templates/$p.tpl without \$wabekTplDir renders the bs4 set");
}
file_put_contents("$OUT/manifest.json", json_encode(['engine' => $engine, 'pages' => $manifest], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

printf("render-check: %d passed, %d failed; %d pages rendered with %s into %s\n", $passes, count($fails), count($manifest), $engine, $OUT);
exit($fails ? 1 : 0);
