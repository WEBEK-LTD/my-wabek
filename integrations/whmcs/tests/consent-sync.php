<?php
/**
 * WABEK for WHMCS — consent ↔ custom field sync, against an in-memory SQLite
 * database (no WHMCS install needed).
 *
 *   php integrations/whmcs/tests/consent-sync.php --illuminate=/path/to/vendor/autoload.php
 *
 * Needs illuminate/database (composer, outside the repository; run.sh
 * installs it into its work folder). Covers: creating the native field
 * (idempotent, translations, backfill), field → consent on ClientAdd /
 * ClientEdit (posted form, unticked box, stored value), consent → field,
 * consent-mode resync, reuse of a 4.x opt-out field, hiding the field,
 * the admin summary box (also with a failing part), the homepage panel,
 * the admin profile tab and the WhatsApp number override.
 *
 * Exit code 0 when every check passes.
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
define('WHMCS', true);

$opt = getopt('', ['illuminate:']);
$autoload = (string) ($opt['illuminate'] ?? '');
if ($autoload === '' || !is_file($autoload)) {
    fwrite(STDERR, "consent-sync: --illuminate=/path/to/vendor/autoload.php (illuminate/database) is required\n");
    exit(2);
}
require $autoload;

use Illuminate\Database\Capsule\Manager;
use Illuminate\Database\Schema\Blueprint;

$db = new Manager();
$db->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
$db->setAsGlobal();
class_alias(Manager::class, 'WHMCS\\Database\\Capsule');

$LOG = [];
function logActivity($m)
{
    global $LOG;
    $LOG[] = (string) $m;
}
function generate_token($t = 'plain')
{
    return 'tok';
}
$_SESSION = [];

$MOD = realpath(__DIR__ . '/../modules/addons/wabek');
require $MOD . '/bootstrap.php';

use WABEK\Admin\ClientProfile;
use WABEK\Admin\ClientSummary;
use WABEK\Client\HomePanel;
use WABEK\Config;
use WABEK\Consent;
use WABEK\ConsentField;
use WABEK\Phone;
use WABEK\Schema;
use WHMCS\Database\Capsule;

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

// ── WHMCS tables used by the addon ─────────────────────────────────────
$s = Capsule::schema();
$s->create('tblclients', function (Blueprint $t) {
    $t->increments('id');
    $t->string('firstname')->default('');
    $t->string('phonenumber')->default('');
    $t->string('country', 2)->default('');
});
$s->create('tblcustomfields', function (Blueprint $t) {
    $t->increments('id');
    foreach (['type', 'fieldname', 'fieldtype', 'adminonly', 'required', 'showorder', 'showinvoice'] as $c) {
        $t->string($c)->default('');
    }
    $t->integer('relid')->default(0);
    $t->text('description')->nullable();
    $t->text('fieldoptions')->nullable();
    $t->text('regexpr')->nullable();
    $t->integer('sortorder')->default(0);
    $t->timestamp('created_at')->nullable();
    $t->timestamp('updated_at')->nullable();
});
$s->create('tblcustomfieldsvalues', function (Blueprint $t) {
    $t->increments('id');
    $t->integer('fieldid');
    $t->integer('relid');
    $t->text('value');
    $t->timestamp('created_at')->nullable();
    $t->timestamp('updated_at')->nullable();
});
$s->create('tblconfiguration', function (Blueprint $t) {
    $t->string('setting');
    $t->text('value');
});
$s->create('tbladdonmodules', function (Blueprint $t) {
    $t->string('module');
    $t->string('setting');
    $t->text('value');
});
$s->create('tbldynamic_translations', function (Blueprint $t) {
    $t->increments('id');
    $t->string('related_type');
    $t->integer('related_id');
    $t->string('language');
    $t->text('translation');
    $t->string('input_type');
    $t->timestamp('created_at')->nullable();
    $t->timestamp('updated_at')->nullable();
});
Capsule::table('tblconfiguration')->insert([['setting' => 'Language', 'value' => 'arabic'], ['setting' => 'SystemURL', 'value' => 'https://example.test/']]);
foreach ([['A', '+966.501234567', 'SA'], ['B', '0501234568', 'SA'], ['C', '+90.5321234569', 'TR']] as [$n, $p, $c]) {
    Capsule::table('tblclients')->insert(['firstname' => $n, 'phonenumber' => $p, 'country' => $c]);
}

Schema::install();
Consent::set(2, false, 'client'); // client 2 opted out before 4.2.0

$reset = function () {
    Config::flush();
    ConsentField::flush();
    $_POST = [];
};
$value = function (int $client): ?string {
    $v = Capsule::table('tblcustomfieldsvalues')->where('fieldid', ConsentField::id())->where('relid', $client)->value('value');
    return $v === null ? null : (string) $v;
};

// ── 1. Field created once, translated, backfilled ──────────────────────
Schema::ensureConsentField();
$reset();
$id = ConsentField::id();
check($id > 0, 'field created');
$f = Capsule::table('tblcustomfields')->where('id', $id)->first();
check($f->type === 'client' && $f->fieldtype === 'tickbox' && $f->showorder === 'on' && $f->adminonly === '', 'client tickbox, on order form, visible to clients');
check($f->fieldname === 'استقبال إشعارات واتساب / Receive WhatsApp notifications', 'bilingual name from the lang files: ' . $f->fieldname);
check(ConsentField::meaning() === ConsentField::RECEIVE && Config::int('consent_field_created') === $id, 'meaning receive, remembered as ours');
check(Capsule::table('tbldynamic_translations')->where('related_type', "custom_field.$id.name")->count() === 6, 'name translated for the six languages');
check(Capsule::table('tbldynamic_translations')->where('related_type', "custom_field.$id.name")->where('language', 'english')->value('translation') === 'Receive WhatsApp notifications', 'English translation');
check($value(1) === 'on' && $value(2) === '' && $value(3) === 'on', 'backfill: opt-out mode, client 2 opted out');
Schema::ensureConsentField();
Schema::upgrade('4.1.0');
$reset();
check(Capsule::table('tblcustomfields')->count() === 1 && ConsentField::id() === $id, 'idempotent: no second field on re-activate / upgrade');
check(Capsule::table('tbldynamic_translations')->count() === 12, 'translations not duplicated');

// ── 2. field → consent (ClientEdit) ────────────────────────────────────
$_POST = ['customfield' => ['99' => 'x']]; // details form submitted, our box unticked
ConsentField::syncFromSubmission(1, false, 'client_details');
$reset();
$st = Consent::state(1);
check($st['opted_out'] && $st['source'] === 'client_details' && $value(1) === '', 'unticked on Account details → opted out');
$_POST = ['customfield' => [$id => 'on']];
ConsentField::syncFromSubmission(2, false, 'client_details');
$reset();
check(Consent::subscribed(2) && $value(2) === 'on', 'ticked on Account details → subscribed');
Capsule::table('tblcustomfieldsvalues')->where('fieldid', $id)->where('relid', 3)->update(['value' => '']);
ConsentField::syncFromSubmission(3, false, 'admin'); // e.g. API UpdateClient: no form, stored value
$reset();
check(!Consent::subscribed(3), 'stored value (API) → opted out');
$before = count($LOG);
ConsentField::syncFromSubmission(3, false, 'admin');
check(!Consent::subscribed(3) && Consent::state(3)['source'] === 'admin', 'unchanged value: nothing recorded twice');

// ── 3. consent → field ─────────────────────────────────────────────────
Consent::set(1, true, 'client');
$reset();
check($value(1) === 'on', 'preferences page turned on → field ticked');
ClientSummary::toggle(1, false, 7);
$reset();
check($value(1) === '' && !Consent::subscribed(1) && Consent::state(1)['source'] === 'admin', 'admin toggle → field unticked');
check((int) ($_SESSION[ClientSummary::FLASH][0] ?? 0) === 1, 'admin toggle leaves a flash for the summary box');
check(strpos(end($LOG), 'User ID: 1') !== false, 'admin toggle logged against the client');

// ── 4. New clients (ClientAdd) ─────────────────────────────────────────
Capsule::table('tblclients')->insert(['firstname' => 'D', 'phonenumber' => '+966.501234570', 'country' => 'SA']);
Capsule::table('tblclients')->insert(['firstname' => 'E', 'phonenumber' => '', 'country' => 'SA']);
$_POST = ['customfield' => [$id => 'on']];
ConsentField::syncFromSubmission(4, true, 'register');
$reset();
check(Consent::subscribed(4) && $value(4) === 'on' && !Capsule::table(Consent::TABLE)->where('client_id', 4)->exists(), 'registration ticked (opt-out mode): default kept, field written');
ConsentField::syncFromSubmission(5, true, 'register'); // created without the form (API AddClient)
$reset();
check($value(5) === 'on', 'client added without the field: default mirrored');

// ── 5. Consent mode change → resync ────────────────────────────────────
Config::set('consent_mode', 'opt_in');
ConsentField::resyncAll();
$reset();
check($value(4) === '' && $value(5) === '', 'opt-in mode: clients without a choice unticked');
check($value(2) === 'on' && $value(1) === '' && $value(3) === '', 'opt-in mode: recorded choices kept');
Capsule::table('tblclients')->insert(['firstname' => 'F', 'phonenumber' => '+966.501234571', 'country' => 'SA']);
$_POST = ['customfield' => [$id => 'on']];
ConsentField::syncFromSubmission(6, true, 'register');
$reset();
$st = Consent::state(6);
check($st['opted_in'] && $st['source'] === 'register', 'opt-in mode: ticked at registration → opt-in recorded');
Config::set('consent_mode', 'opt_out');
ConsentField::resyncAll();
$reset();

// ── 6. Pre-ticked box on registration / checkout ───────────────────────
$_SERVER['REQUEST_METHOD'] = 'GET';
$js = ConsentField::prefillScript('register', false);
check(strpos($js, '"customfield[' . $id . ']"') !== false && strpos($js, 'iCheck') !== false, 'registration (opt-out mode): box pre-ticked by script');
check(ConsentField::prefillScript('register', true) === '' && ConsentField::prefillScript('clientarea', false) === '', 'no script for logged-in clients / other pages');
$_SERVER['REQUEST_METHOD'] = 'POST';
check(ConsentField::prefillScript('register', false) === '', 'no script on a re-displayed form');
$_SERVER['REQUEST_METHOD'] = 'GET';
Config::set('consent_mode', 'opt_in');
check(ConsentField::prefillScript('register', false) === '', 'opt-in mode: never pre-ticked');
Config::set('consent_mode', 'opt_out');
$reset();

// ── 7. Admin summary box ───────────────────────────────────────────────
Capsule::table('mod_wabek_outbox')->insert(['event' => 'invoice_created', 'audience' => 'client', 'client_id' => 2, 'phone' => '+966501234568',
    'message' => 'x', 'status' => 'sent', 'delivery_status' => 'read', 'created_at' => '2026-11-16 10:00:00', 'sent_at' => '2026-11-16 10:00:05']);
Consent::markVerified(2, '+966501234568');
$_SESSION['adminlang'] = 'english';
$h = ClientSummary::render(2);
check(strpos($h, 'id="wabekClientSummary"') !== false && strpos($h, '+966501234568') !== false, 'summary: box with the number');
check(strpos($h, 'Verified') !== false && strpos($h, '2026-11-16 10:00') !== false && strpos($h, 'Read') !== false, 'summary: verified, last message time + status');
check(strpos($h, 'Turn off WhatsApp notifications') !== false && strpos($h, 'name="token" value="tok"') !== false, 'summary: toggle with token');
$h = ClientSummary::render(1);
check(strpos($h, 'WhatsApp notifications are now off for this client.') !== false && !isset($_SESSION[ClientSummary::FLASH]), 'summary: flash shown once');
check(strpos($h, 'Turn on WhatsApp notifications') !== false && strpos($h, 'No message yet') !== false, 'summary: off client, no message');
$_SESSION['adminlang'] = 'arabic';
$h = ClientSummary::render(1);
check(strpos($h, 'dir="rtl"') !== false && strpos($h, 'تفعيل إشعارات واتساب') !== false, 'summary: Arabic, RTL');
$_SESSION['adminlang'] = 'english';
Capsule::schema()->rename('mod_wabek_outbox', 'mod_wabek_outbox_x');
$n = count($LOG);
$h = ClientSummary::render(2);
check(strpos($h, 'id="wabekClientSummary"') !== false && strpos($h, 'could not be loaded') !== false, 'summary: a failing part still renders the box');
check(count($LOG) > $n && strpos(end($LOG), 'WABEK: client summary box (last message) failed') === 0, 'summary: failure logged');
Capsule::schema()->rename('mod_wabek_outbox_x', 'mod_wabek_outbox');
check(ClientSummary::render(0) === '', 'summary: no client id → nothing');
$links = ClientSummary::actionLinks(2);
check(count($links) === 2 && strpos($links[0], 'page=send&amp;client=2') !== false && strpos($links[1], 'page=log&amp;client=2') !== false, 'action links');

// ── 8. Homepage panel ──────────────────────────────────────────────────
final class FakeMenu
{
    public $children = [];

    public function getChild($n)
    {
        return $this->children[$n] ?? null;
    }

    public function addChild($n, $a)
    {
        return $this->children[$n] = $a;
    }
}
$_SESSION['uid'] = 2;
$_SESSION['Language'] = 'arabic';
$_SESSION[HomePanel::FLASH] = 'تم.';
$menu = new FakeMenu();
HomePanel::add($menu, ['template' => 'lagom2']);
$p = $menu->children[HomePanel::NAME] ?? [];
check(($p['label'] ?? '') === 'إشعارات واتساب' && ($p['extras']['btn-link'] ?? '') === 'index.php?m=wabek', 'homepage panel: label + button to the preferences page');
check(strpos($p['bodyHtml'] ?? '', 'wabek-v-lagom2') !== false && strpos($p['bodyHtml'], 'dir="rtl"') !== false && strpos($p['bodyHtml'], 'تم.') !== false, 'homepage panel: Lagom 2 body, RTL, flash');
check(strpos($p['bodyHtml'], 'إشعارات واتساب مفعّلة لحسابك') !== false && strpos($p['bodyHtml'], 'value="unsubscribe"') !== false, 'homepage panel: state + toggle');
HomePanel::add($menu);
check(count($menu->children) === 1, 'homepage panel added once');
unset($_SESSION['uid']);

// ── 9. Admin profile tab + number override ─────────────────────────────
$fields = ClientProfile::fields(2);
$html = implode('', $fields);
check(strpos($html, 'name="wabek_consent"') === false && strpos($html, 'استقبال إشعارات واتساب / Receive') !== false, 'profile: native field active → no second control, pointer to it');
check(strpos($html, 'name="wabek_phone_override"') !== false, 'profile: number override input');
$_POST = ['wabek_profile' => '1', 'wabek_phone_override' => '0555 000 111'];
ClientProfile::save(['userid' => 2]);
$reset();
$l = Phone::lookup(2);
check($l['phone'] === '+966555000111' && $l['source'] === 'override', 'profile: override saved as E.164 and used');
$_POST = ['wabek_profile' => '1', 'wabek_phone_override' => 'abc'];
ClientProfile::save(['userid' => 2]);
check(Phone::override(2) === '+966555000111' && strpos(end($LOG), 'invalid WhatsApp number') !== false, 'profile: invalid number ignored and logged');
$_POST = ['wabek_profile' => '1', 'wabek_phone_override' => ''];
ClientProfile::save(['userid' => 2]);
check(Phone::lookup(2)['source'] === 'profile', 'profile: empty override → profile phone');

// Without the native field: Yes/No select.
Config::set('consent_field_auto', '0');
ConsentField::retire();
Config::set('consent_field_id', '0');
$reset();
check(Capsule::table('tblcustomfields')->where('id', $id)->value('adminonly') === 'on', 'setting off: field hidden from clients, kept');
$html = implode('', ClientProfile::fields(2));
check(strpos($html, 'name="wabek_consent"') !== false && strpos($html, 'name="wabek_consent_was" value="1"') !== false, 'profile: select when no native field');
$_POST = ['wabek_profile' => '1', 'wabek_consent' => '0', 'wabek_consent_was' => '1'];
ClientProfile::save(['userid' => 2]);
$reset();
check(!Consent::subscribed(2) && Consent::state(2)['source'] === 'admin', 'profile: select saved');
$_POST = ['wabek_profile' => '1', 'wabek_consent' => '0', 'wabek_consent_was' => '0'];
Consent::set(2, true, 'client');
ClientProfile::save(['userid' => 2]);
check(Consent::subscribed(2), 'profile: unchanged select never overwrites');

// ── 10. 4.x opt-out field reused, never a second one ───────────────────
$legacy = (int) Capsule::table('tblcustomfields')->insertGetId(['type' => 'client', 'fieldname' => 'No WhatsApp', 'fieldtype' => 'tickbox', 'adminonly' => 'on']);
Capsule::table('mod_wabek_config')->where('setting', 'like', 'consent_field_%')->delete();
Config::set('consent_field_id', (string) $legacy);
Config::set('consent_field_auto', '1');
$reset();
Consent::set(3, false, 'client'); // recorded opt-out
Capsule::table('tblcustomfieldsvalues')->where('fieldid', $legacy)->delete();
Schema::ensureConsentField();
$reset();
check(ConsentField::id() === $legacy && ConsentField::meaning() === ConsentField::OPT_OUT, 'legacy field reused with its meaning');
check(Config::get('consent_field_meaning') === 'opt_out' && Capsule::table('mod_wabek_config')->where('setting', 'consent_field_meaning')->exists(), 'legacy meaning stored explicitly');
check(Capsule::table('tblcustomfields')->where('type', 'client')->count() === 2 && Capsule::table('tblcustomfields')->where('id', $legacy)->value('adminonly') === 'on', 'no new field; the admin\'s own settings untouched');
check($value(3) === 'on', 'legacy: recorded opt-outs ticked');
Capsule::table('tblcustomfieldsvalues')->insert(['fieldid' => $legacy, 'relid' => 4, 'value' => 'on']);
check(!Consent::allows(4, false), 'legacy: ticked = opted out (4.x behaviour)');
ConsentField::syncFromSubmission(4, false, 'admin');
$reset();
check(Consent::state(4, false)['opted_out'], 'legacy: ticked box recorded as an opt-out');
Consent::set(4, true, 'client');
$reset();
check($value(4) === '' && Consent::allows(4, false), 'legacy: opt-in unticks the opt-out box');

printf("consent-sync: %d passed, %d failed\n", $passes, count($fails));
exit($fails ? 1 : 0);
