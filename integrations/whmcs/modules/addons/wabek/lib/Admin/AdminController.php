<?php

namespace WABEK\Admin;

use WABEK\ApiClient;
use WABEK\Bulk;
use WABEK\Config;
use WABEK\Consent;
use WABEK\ConsentField;
use WABEK\Context;
use WABEK\Events;
use WABEK\Lang;
use WABEK\Notifier;
use WABEK\Outbox;
use WABEK\Phone;
use WABEK\Renderer;
use WABEK\Security;
use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Admin area (addonmodules.php?module=wabek). WHMCS only calls wabek_output()
 * for logged-in admins whose role has access to the module; the controller
 * checks the admin session again and accepts state changes only as POST
 * with a valid CSRF token.
 */
final class AdminController
{
    private const PAGES = ['dashboard', 'settings', 'events', 'log', 'send', 'bulk', 'consent'];
    private const PER_PAGE = 50;

    /** @var string */
    private $link;
    /** @var int */
    private $adminId;
    /** @var array<int,array{0:string,1:string}> */
    private $flash = [];
    /** @var array view data produced by POST handlers */
    private $result = [];

    public function __construct(array $vars)
    {
        $this->link = (string) ($vars['modulelink'] ?? 'addonmodules.php?module=wabek');
        $this->adminId = (int) ($_SESSION['adminid'] ?? 0);
        Lang::init($vars);
    }

    public function render(): string
    {
        if ($this->adminId <= 0) {
            return View::alert('error', Lang::t('err_not_admin'));
        }
        $page = Security::choice(Security::get('page', 20), self::PAGES, 'dashboard');

        if (Security::isPost()) {
            if (!Security::validPost(true)) {
                $this->flash[] = ['error', Lang::t('err_csrf')];
            } else {
                try {
                    $this->handlePost($page, Security::post('wb_action', 40));
                } catch (\Throwable $e) {
                    $this->flash[] = ['error', Lang::t('err_generic')];
                    if (function_exists('logActivity')) {
                        logActivity('WABEK admin action failed: ' . substr($e->getMessage(), 0, 300));
                    }
                }
            }
        }

        $method = 'page' . ucfirst($page);
        $body = $this->$method();

        $tabs = [];
        foreach (self::PAGES as $p) {
            $tabs[$p] = Lang::t('tab_' . $p);
        }
        return View::layout($this->link, $page, $tabs, $body, $this->flash);
    }

    // ── POST actions ───────────────────────────────────────────────────

    private function handlePost(string $page, string $action): void
    {
        switch ($action) {
            case 'save_settings':
                $this->saveSettings();
                break;
            case 'test_connection':
                $this->testConnection();
                break;
            case 'test_send':
                $this->testSend();
                break;
            case 'save_event':
                $this->saveEvent();
                break;
            case 'test_event':
                $this->testEvent();
                break;
            case 'resend':
                $id = Outbox::resend(Security::postInt('id', 1), $this->adminId);
                $this->flash[] = $id > 0 ? ['success', Lang::t('ok_resend_queued', ['{id}' => (string) $id])] : ['error', Lang::t('err_resend')];
                break;
            case 'check_status':
                $st = Outbox::refreshDeliveryStatus(Security::postInt('id', 1));
                $this->flash[] = $st !== '' ? ['success', Lang::t('ok_delivery_status', ['{status}' => Lang::t('delivery_' . $st)])] : ['error', Lang::t('err_delivery_status')];
                break;
            case 'cancel':
                $this->flash[] = Outbox::cancel(Security::postInt('id', 1)) ? ['success', Lang::t('ok_cancelled')] : ['error', Lang::t('err_cancel')];
                break;
            case 'manual_send':
                $this->manualSend();
                break;
            case 'bulk_preview':
            case 'bulk_queue':
                $this->bulk($action === 'bulk_queue');
                break;
            case 'bulk_cancel':
                $n = Bulk::cancel(Security::postInt('bulk_id', 1));
                $this->flash[] = ['success', Lang::t('ok_bulk_cancelled', ['{n}' => (string) $n])];
                break;
            case 'client_toggle':
                // Posted from the WhatsApp box of the client summary page.
                $clientId = Security::postInt('client', 1);
                if (!ClientSummary::toggle($clientId, Security::post('consent', 4) === 'in', $this->adminId)) {
                    $this->flash[] = ['error', Lang::t('err_client_not_found')];
                    break;
                }
                if (Security::post('return', 10) === 'summary' && !headers_sent()) {
                    header('Location: clientssummary.php?userid=' . $clientId, true, 303);
                    exit;
                }
                $this->flash[] = ['success', Lang::t('ok_saved')];
                break;
            case 'set_consent':
                $clientId = $this->resolveClient(Security::post('client', 190));
                if ($clientId <= 0) {
                    $this->flash[] = ['error', Lang::t('err_client_not_found')];
                    break;
                }
                Consent::set($clientId, Security::post('consent', 10) === 'in', 'admin', Security::ip());
                $this->flash[] = ['success', Lang::t('ok_saved')];
                break;
            default:
                $this->flash[] = ['error', Lang::t('err_unknown_action')];
        }
    }

    private function saveSettings(): void
    {
        $errors = [];
        $before = [
            'consent_mode'          => Config::get('consent_mode'),
            'consent_field_id'      => Config::get('consent_field_id'),
            'consent_field_meaning' => Config::get('consent_field_meaning'),
            'consent_field_auto'    => Config::get('consent_field_auto'),
        ];
        $url = rtrim(Security::post('api_base_url', 200), '/');
        if (!Config::isValidBaseUrl($url)) {
            $errors[] = Lang::t('err_base_url');
        } else {
            Config::set('api_base_url', $url);
        }

        if (Security::postBool('api_key_clear')) {
            Config::setApiKey('');
        } else {
            $key = Security::post('api_key', 256);
            if ($key !== '') {
                if (!preg_match('/^[\x21-\x7e]{8,256}$/', $key)) {
                    $errors[] = Lang::t('err_api_key');
                } else {
                    Config::setApiKey($key);
                }
            }
        }

        $instance = Security::post('default_instance', 64);
        if ($instance === '' || preg_match('/^[A-Za-z0-9_-]{1,64}$/', $instance)) {
            Config::set('default_instance', $instance);
        } else {
            $errors[] = Lang::t('err_instance');
        }

        $phones = Security::postText('admin_phones', 1000);
        $parsed = Phone::parseList($phones);
        Config::set('admin_phones', implode(', ', $parsed));
        if ($phones !== '' && count($parsed) < count(array_filter(preg_split('/[\s,;]+/', $phones)))) {
            $errors[] = Lang::t('err_admin_phones');
        }

        $cc = preg_replace('/\D/', '', Security::post('default_country_code', 5));
        Config::set('default_country_code', (string) $cc);

        $choices = [
            'message_language' => ['auto', 'english', 'arabic'],
            'admin_language'   => ['english', 'arabic'],
            'consent_mode'     => ['opt_out', 'opt_in'],
            'otp_mode'         => ['off', 'verify', 'login'],
        ];
        foreach ($choices as $k => $allowed) {
            Config::set($k, Security::choice(Security::post($k, 20), $allowed, Config::DEFAULTS[$k]));
        }

        Config::set('consent_field_meaning', Security::choice(Security::post('consent_field_meaning', 10),
            [ConsentField::RECEIVE, ConsentField::OPT_OUT], ConsentField::meaning()));

        foreach (['immediate_critical', 'reminder_on_due', 'include_credentials', 'otp_skip_no_phone', 'checkout_consent', 'consent_field_auto'] as $k) {
            Config::set($k, Security::postBool($k) ? '1' : '0');
        }

        $ints = [
            'queue_batch' => [1, 500], 'bulk_per_run' => [0, 500], 'send_delay_ms' => [0, 5000], 'max_attempts' => [1, 10],
            'otp_per_hour' => [1, 20], 'otp_resend_seconds' => [0, 3600], 'otp_max_attempts' => [1, 10], 'otp_ttl_minutes' => [1, 60],
            'log_retention_days' => [0, 3650], 'consent_field_id' => [0, PHP_INT_MAX], 'phone_field_id' => [0, PHP_INT_MAX],
        ];
        foreach ($ints as $k => [$min, $max]) {
            Config::set($k, (string) Security::postInt($k, $min, $max));
        }

        foreach (['reminder_days_before' => 60, 'reminder_days_after' => 365, 'domain_reminder_days' => 365] as $k => $max) {
            $list = [];
            foreach (explode(',', Security::post($k, 100)) as $p) {
                $n = (int) trim($p);
                if ($n > 0 && $n <= $max) {
                    $list[$n] = $n;
                }
            }
            ksort($list);
            Config::set($k, implode(',', array_slice($list, 0, 10)));
        }

        Config::flush();
        $this->applyConsentField($before, $errors);
        if ($errors) {
            foreach ($errors as $err) {
                $this->flash[] = ['error', $err];
            }
        } else {
            $this->flash[] = ['success', Lang::t('ok_settings_saved')];
        }
    }

    /** Create / hide / resync the native consent custom field after the settings changed. */
    private function applyConsentField(array $before, array &$errors): void
    {
        try {
            ConsentField::flush();
            $hadField = ConsentField::id();
            if (Config::bool('consent_field_auto')) {
                $id = ConsentField::ensure();
                if ($id !== $hadField) {
                    $this->flash[] = ['success', Lang::t('ok_consent_field_created', ['{name}' => ConsentField::name(), '{id}' => (string) $id])];
                    return; // ensure() already wrote every value
                }
            } elseif ($before['consent_field_auto'] === '1') {
                ConsentField::retire();
            }
            Config::flush();
            foreach (['consent_mode', 'consent_field_id', 'consent_field_meaning'] as $k) {
                if ($before[$k] !== Config::get($k)) {
                    ConsentField::resyncAll();
                    break;
                }
            }
        } catch (\Throwable $e) {
            $errors[] = Lang::t('err_consent_field');
            if (function_exists('logActivity')) {
                logActivity('WABEK: consent custom field update failed: ' . substr($e->getMessage(), 0, 300));
            }
        }
    }

    private function testConnection(): void
    {
        $api = ApiClient::make();
        if (!$api->configured()) {
            $this->flash[] = ['error', Lang::t('err_not_configured')];
            return;
        }
        $res = $api->instances();
        $list = [];
        if ($res->ok()) {
            foreach ((array) ($res->data['instances'] ?? []) as $i) {
                if (!is_array($i) || !isset($i['id']) || !is_scalar($i['id'])) {
                    continue;
                }
                $list[] = [
                    'id'     => substr((string) $i['id'], 0, 64),
                    'name'   => substr((string) ($i['display_name'] ?? $i['name'] ?? ''), 0, 100),
                    'phone'  => substr((string) ($i['phone_number'] ?? ''), 0, 32),
                    'status' => substr((string) ($i['status'] ?? ''), 0, 20),
                    'type'   => substr((string) ($i['instance_type'] ?? ''), 0, 20),
                    'default' => !empty($i['is_default']),
                ];
            }
            $_SESSION['wabek_instances'] = ['at' => time(), 'list' => $list];
            $this->flash[] = ['success', Lang::t('ok_connection', ['{n}' => (string) count($list)])];
        } elseif ($res->status === 404 && ($res->data['error'] ?? '') === 'Unknown action') {
            // Authenticated (401 would come first) but this platform version has no listing.
            unset($_SESSION['wabek_instances']);
            $this->flash[] = ['success', Lang::t('ok_connection_no_list')];
        } elseif ($res->status === 401) {
            $this->flash[] = ['error', Lang::t('err_invalid_key')];
        } elseif ($res->status === 0) {
            $this->flash[] = ['error', Lang::t('err_network', ['{error}' => $res->error])];
        } else {
            $this->flash[] = ['error', Lang::t('err_api', ['{status}' => (string) $res->status, '{error}' => $res->error])];
        }
        $this->result['instances'] = $list;
    }

    private function testSend(): void
    {
        $phone = Phone::fromPost('test_phone');
        if ($phone === null) {
            $this->flash[] = ['error', Lang::t('err_phone')];
            return;
        }
        $msg = Lang::t('test_message', ['{system_name}' => Config::companyName()]);
        $this->sendNow('test', null, $phone, $msg, true);
    }

    private function saveEvent(): void
    {
        $key = Security::post('event', 48);
        if (!Events::exists($key)) {
            $this->flash[] = ['error', Lang::t('err_unknown_event')];
            return;
        }
        $reset = Security::postBool('reset');
        $template = Security::post('wa_template', 128);
        if ($template !== '' && !preg_match('/^[a-z0-9_]{1,128}$/', $template)) {
            $this->flash[] = ['error', Lang::t('err_template_name')];
            return;
        }
        $templateLang = Security::post('wa_template_lang', 16);
        if (!Events::validTemplateLanguage($templateLang)) {
            $this->flash[] = ['error', Lang::t('err_template_lang')];
            return;
        }
        $def = Events::get($key);
        Events::save($key, [
            'enabled'            => Security::postBool('enabled'),
            'critical'           => Security::postBool('critical'),
            'body_en'            => $reset ? $def['default_en'] : Security::postText('body_en'),
            'body_ar'            => $reset ? $def['default_ar'] : Security::postText('body_ar'),
            'wa_template'        => $template,
            'wa_template_lang'   => $templateLang,
            'wa_template_params' => Security::postText('wa_template_params', 1000),
        ]);
        $this->flash[] = ['success', Lang::t('ok_event_saved', ['{event}' => Lang::t('event_' . $key)])];
        $this->result['open_event'] = $key;
    }

    private function testEvent(): void
    {
        $key = Security::post('event', 48);
        $event = Events::get($key);
        $phone = Phone::fromPost('test_phone');
        if (!$event || $phone === null) {
            $this->flash[] = ['error', Lang::t('err_phone')];
            return;
        }
        $lang = Security::choice(Security::post('lang', 10), ['en', 'ar'], 'en');
        $msg = Renderer::render($lang === 'ar' ? $event['body_ar'] : $event['body_en'], self::sampleContext());
        $this->sendNow('test', null, $phone, $msg, true, $event['wa_template'], Notifier::templateParams($event, self::sampleContext()),
            Notifier::templateLanguage($event, $lang === 'ar'));
        $this->result['open_event'] = $key;
    }

    private function manualSend(): void
    {
        $raw = Security::post('client', 190);
        $clientId = $raw !== '' ? $this->resolveClient($raw) : 0;
        if ($raw !== '' && $clientId <= 0) {
            $this->flash[] = ['error', Lang::t('err_client_not_found')];
            return;
        }
        $phoneInput = Security::post('phone', 32);
        $phone = $phoneInput !== '' ? Phone::fromPost('phone') : ($clientId > 0 ? Phone::forClient($clientId) : null);
        if ($phone === null) {
            $this->flash[] = ['error', Lang::t('err_phone')];
            return;
        }
        $body = Security::postText('message');
        if ($body === '') {
            $this->flash[] = ['error', Lang::t('err_message_empty')];
            return;
        }
        $transactional = Security::postBool('transactional');
        if ($clientId > 0 && !Consent::allows($clientId, $transactional)) {
            $this->flash[] = ['error', Lang::t('err_no_consent')];
            return;
        }
        $ctx = $clientId > 0 ? (Context::client($clientId) ?: Context::base()) : Context::base();
        $msg = Renderer::render($body, $ctx);
        if (Security::post('mode', 10) === 'queue') {
            Outbox::enqueue([
                'event' => 'manual', 'audience' => $clientId > 0 ? 'client' : 'admin', 'client_id' => $clientId ?: null,
                'phone' => $phone, 'message' => $msg, 'critical' => $transactional || $clientId <= 0, 'priority' => 7, 'admin_id' => $this->adminId,
            ]);
            $this->flash[] = ['success', Lang::t('ok_queued')];
            return;
        }
        $this->sendNow('manual', $clientId ?: null, $phone, $msg, $transactional || $clientId <= 0);
    }

    /** Send immediately and report the outcome (the attempt is logged in the outbox). */
    private function sendNow(string $event, ?int $clientId, string $phone, string $msg, bool $critical, string $template = '', array $params = [], string $templateLang = ''): void
    {
        $id = Outbox::enqueue([
            'event' => $event, 'audience' => $clientId ? 'client' : 'admin', 'client_id' => $clientId,
            'phone' => $phone, 'message' => $msg, 'wa_template' => $template, 'wa_template_lang' => $templateLang, 'wa_template_params' => $params,
            'critical' => $critical, 'priority' => 9, 'admin_id' => $this->adminId,
        ]);
        $status = $id > 0 ? Outbox::sendRow($id) : 'failed';
        if ($status === 'sent') {
            $this->flash[] = ['success', Lang::t('ok_sent', ['{phone}' => $phone])];
            return;
        }
        $error = (string) Capsule::table(Outbox::TABLE)->where('id', $id)->value('last_error');
        $this->flash[] = [$status === 'pending' ? 'warning' : 'error',
            Lang::t($status === 'pending' ? 'warn_send_retry' : 'err_send_failed', ['{error}' => $error])];
    }

    private function bulk(bool $queue): void
    {
        $filters = Bulk::sanitizeFilters([
            'product_ids'    => Security::postArray('product_ids'),
            'service_status' => Security::postArray('service_status'),
            'client_status'  => Security::postArray('client_status'),
        ]);
        $message = Security::postText('message');
        $name = Security::post('name', 150);
        $this->result['bulk'] = ['filters' => $filters, 'message' => $message, 'name' => $name];
        if (!$queue) {
            $this->result['bulk_preview'] = Bulk::preview($filters);
            return;
        }
        if ($message === '') {
            $this->flash[] = ['error', Lang::t('err_message_empty')];
            return;
        }
        if (Security::post('confirm', 10) !== 'yes') {
            $this->flash[] = ['error', Lang::t('err_bulk_confirm')];
            $this->result['bulk_preview'] = Bulk::preview($filters);
            return;
        }
        $r = Bulk::queue($name !== '' ? $name : Lang::t('bulk_default_name', ['{date}' => date('Y-m-d H:i')]), $message, $filters, $this->adminId);
        $this->flash[] = ['success', Lang::t('ok_bulk_queued', ['{queued}' => (string) $r['queued'], '{skipped}' => (string) $r['skipped']])];
        $this->result['bulk'] = null;
    }

    private function resolveClient(string $raw): int
    {
        $raw = trim($raw);
        if ($raw === '') {
            return 0;
        }
        if (ctype_digit($raw)) {
            return (int) Capsule::table('tblclients')->where('id', (int) $raw)->value('id');
        }
        if (filter_var($raw, FILTER_VALIDATE_EMAIL)) {
            return (int) Capsule::table('tblclients')->where('email', $raw)->value('id');
        }
        return 0;
    }

    public static function sampleContext(): array
    {
        return array_merge(Context::base(), [
            'client_name' => 'Ahmed Ali', 'first_name' => 'Ahmed', 'last_name' => 'Ali', 'company' => 'Example LLC',
            'email' => 'client@example.com', 'client_id' => '1001',
            'invoice_id' => '2045', 'invoice_num' => 'INV-2045', 'invoice_total' => '$49.00 USD', 'invoice_balance' => '$49.00 USD',
            'invoice_status' => 'Unpaid', 'due_date' => Context::date(date('Y-m-d', strtotime('+3 days'))), 'days' => '3',
            'invoice_url' => Config::systemUrl() . 'viewinvoice.php?id=2045',
            'service_id' => '77', 'service_name' => 'Business Hosting', 'service_label' => 'Business Hosting (example.com)',
            'product_group' => 'Hosting', 'domain' => 'example.com', 'billing_cycle' => 'Monthly',
            'next_due_date' => Context::date(date('Y-m-d', strtotime('+30 days'))), 'amount' => '$49.00 USD',
            'service_url' => Config::systemUrl() . 'clientarea.php?action=productdetails&id=77', 'credentials' => '',
            'ticket_id' => '482913', 'ticket_subject' => 'Email setup', 'ticket_status' => 'Answered', 'ticket_department' => 'Support',
            'ticket_url' => Config::systemUrl() . 'viewticket.php?tid=482913',
            'order_id' => '310', 'order_number' => '5829301746', 'order_total' => '$49.00 USD',
            'expiry_date' => Context::date(date('Y-m-d', strtotime('+30 days'))),
            'renew_url' => Config::systemUrl() . 'clientarea.php?action=domains',
        ]);
    }

    // ── Pages ──────────────────────────────────────────────────────────

    private function pageDashboard(): string
    {
        $c = Outbox::counts(24);
        $stats = '<div class="wb-stats">'
            . View::stat(Lang::t('stat_sent'), $c['sent'], 'is-good')
            . View::stat(Lang::t('stat_failed'), $c['failed'], $c['failed'] ? 'is-bad' : '')
            . View::stat(Lang::t('stat_skipped'), $c['skipped'])
            . View::stat(Lang::t('stat_queue'), $c['queued_total'], 'is-accent')
            . '</div>';

        $checks = [];
        $checks[] = [Config::apiKey() !== '', Lang::t('check_api_key')];
        $checks[] = [Config::get('default_instance') !== '', Lang::t('check_instance')];
        $checks[] = [Phone::parseList(Config::get('admin_phones')) !== [], Lang::t('check_admin_phones')];
        $lastCron = '';
        try {
            $lastCron = (string) Capsule::table('tblconfiguration')->where('setting', 'lastDailyCronInvocationTime')->value('value');
        } catch (\Throwable $e) {
            $lastCron = '';
        }
        $checks[] = [$lastCron !== '' && strtotime($lastCron) > time() - 2 * 86400, Lang::t('check_cron')];
        $list = '<ul class="wb-checklist">';
        foreach ($checks as [$ok, $label]) {
            $list .= '<li class="' . ($ok ? 'is-ok' : 'is-todo') . '"><span aria-hidden="true">' . ($ok ? '✓' : '•') . '</span> ' . View::e($label) . '</li>';
        }
        $list .= '</ul>';

        $warn = '';
        if (defined('ROOTDIR') && is_file(ROOTDIR . '/includes/hooks/wabek_notifications.php')) {
            $warn .= View::alert('warning', Lang::t('warn_legacy_hook'));
        }
        if (!function_exists('curl_init')) {
            $warn .= View::alert('error', Lang::t('err_no_curl'));
        }

        $recent = Capsule::table(Outbox::TABLE)->orderBy('id', 'desc')->limit(8)->get();
        $rows = [];
        foreach ($recent as $r) {
            $rows[] = [View::e($r->created_at), View::e($this->eventLabel((string) $r->event)), View::e($r->phone), View::badge((string) $r->status)];
        }

        return $warn . $stats
            . '<div class="wb-grid-2">'
            . View::card(Lang::t('setup_checklist'), $list . '<p><a class="wb-link" href="' . View::e($this->link . '&page=settings') . '">' . View::e(Lang::t('go_settings')) . '</a></p>')
            . View::card(Lang::t('recent_activity'), View::table([Lang::t('col_date'), Lang::t('col_event'), Lang::t('col_phone'), Lang::t('col_status')], $rows, Lang::t('empty_log'))
                . '<p><a class="wb-link" href="' . View::e($this->link . '&page=log') . '">' . View::e(Lang::t('view_full_log')) . '</a></p>')
            . '</div>';
    }

    private function pageSettings(): string
    {
        $s = Config::all();
        $masked = Config::maskedApiKey();

        $instances = $this->result['instances'] ?? ($_SESSION['wabek_instances']['list'] ?? []);
        if ($instances) {
            $opts = ['' => Lang::t('instance_auto')];
            foreach ($instances as $i) {
                $opts[$i['id']] = trim(($i['name'] ?: $i['id']) . ' ' . ($i['phone'] ? '· ' . $i['phone'] : '') . ' · ' . $i['status']);
            }
            if ($s['default_instance'] !== '' && !isset($opts[$s['default_instance']])) {
                $opts[$s['default_instance']] = $s['default_instance'];
            }
            $instanceControl = View::select('default_instance', $opts, $s['default_instance']);
        } else {
            $instanceControl = View::input('default_instance', $s['default_instance'], 'text', ['placeholder' => Lang::t('instance_placeholder'), 'maxlength' => '64', 'autocomplete' => 'off']);
        }

        $clientFields = ['0' => Lang::t('none')];
        $tickFields = ['0' => Lang::t('none')];
        foreach (Capsule::table('tblcustomfields')->where('type', 'client')->orderBy('sortorder')->get(['id', 'fieldname', 'fieldtype']) as $f) {
            $label = '#' . $f->id . ' ' . $f->fieldname;
            if ($f->fieldtype === 'tickbox') {
                $tickFields[(string) $f->id] = $label;
            } else {
                $clientFields[(string) $f->id] = $label;
            }
        }

        $connection = View::field(Lang::t('set_api_base_url'), View::input('api_base_url', $s['api_base_url'], 'url', ['required' => true, 'maxlength' => '200']), Lang::t('help_api_base_url'))
            . View::field(Lang::t('set_api_key'), View::input('api_key', '', 'password', ['placeholder' => $masked !== '' ? $masked : Lang::t('api_key_placeholder'), 'autocomplete' => 'new-password', 'maxlength' => '256']),
                $masked !== '' ? Lang::t('help_api_key_keep') : Lang::t('help_api_key'))
            . ($masked !== '' ? View::toggle('api_key_clear', false, Lang::t('set_api_key_clear')) : '')
            . View::field(Lang::t('set_default_instance'), $instanceControl, Lang::t('help_default_instance'));

        $alerts = View::field(Lang::t('set_admin_phones'), View::textarea('admin_phones', $s['admin_phones'], 2, ['placeholder' => '+966500000000, +905550000000']), Lang::t('help_admin_phones'))
            . View::field(Lang::t('set_admin_language'), View::select('admin_language', ['english' => 'English', 'arabic' => 'العربية'], $s['admin_language']));

        $delivery = View::field(Lang::t('set_message_language'), View::select('message_language', ['auto' => Lang::t('lang_auto'), 'english' => 'English', 'arabic' => 'العربية'], $s['message_language']), Lang::t('help_message_language'))
            . View::field(Lang::t('set_default_country_code'), View::input('default_country_code', $s['default_country_code'], 'text', ['inputmode' => 'numeric', 'maxlength' => '4', 'placeholder' => '966']), Lang::t('help_default_country_code'))
            . View::field(Lang::t('set_phone_field'), View::select('phone_field_id', $clientFields, $s['phone_field_id']), Lang::t('help_phone_field'))
            . View::toggle('immediate_critical', $s['immediate_critical'] === '1', Lang::t('set_immediate_critical'))
            . '<div class="wb-grid-4">'
            . View::field(Lang::t('set_queue_batch'), View::input('queue_batch', $s['queue_batch'], 'number', ['min' => '1', 'max' => '500']))
            . View::field(Lang::t('set_bulk_per_run'), View::input('bulk_per_run', $s['bulk_per_run'], 'number', ['min' => '0', 'max' => '500']))
            . View::field(Lang::t('set_send_delay_ms'), View::input('send_delay_ms', $s['send_delay_ms'], 'number', ['min' => '0', 'max' => '5000']))
            . View::field(Lang::t('set_max_attempts'), View::input('max_attempts', $s['max_attempts'], 'number', ['min' => '1', 'max' => '10']))
            . '</div><small class="wb-help">' . View::e(Lang::t('help_queue')) . '</small>';

        $reminders = '<div class="wb-grid-3">'
            . View::field(Lang::t('set_reminder_days_before'), View::input('reminder_days_before', $s['reminder_days_before'], 'text', ['placeholder' => '3']), Lang::t('help_days_list'))
            . View::field(Lang::t('set_reminder_days_after'), View::input('reminder_days_after', $s['reminder_days_after'], 'text', ['placeholder' => '1,5']), Lang::t('help_days_list'))
            . View::field(Lang::t('set_domain_reminder_days'), View::input('domain_reminder_days', $s['domain_reminder_days'], 'text', ['placeholder' => '30,7,1']), Lang::t('help_days_list'))
            . '</div>'
            . View::toggle('reminder_on_due', $s['reminder_on_due'] === '1', Lang::t('set_reminder_on_due'));

        $privacy = View::field(Lang::t('set_consent_mode'), View::select('consent_mode', ['opt_out' => Lang::t('consent_opt_out'), 'opt_in' => Lang::t('consent_opt_in')], $s['consent_mode']), Lang::t('help_consent_mode'))
            . View::toggle('consent_field_auto', $s['consent_field_auto'] === '1', Lang::t('set_consent_field_auto'))
            . '<small class="wb-help">' . View::e(Lang::t('help_consent_field_auto')) . '</small>'
            . '<div class="wb-grid-2">'
            . View::field(Lang::t('set_consent_field'), View::select('consent_field_id', $tickFields, $s['consent_field_id']), Lang::t('help_consent_field'))
            . View::field(Lang::t('set_consent_field_meaning'), View::select('consent_field_meaning', [
                ConsentField::RECEIVE => Lang::t('consent_field_receive'),
                ConsentField::OPT_OUT => Lang::t('consent_field_opt_out'),
            ], ConsentField::meaning()))
            . '</div>'
            . View::toggle('checkout_consent', $s['checkout_consent'] === '1', Lang::t('set_checkout_consent'))
            . '<small class="wb-help">' . View::e(Lang::t('help_checkout_consent')) . '</small>'
            . View::toggle('include_credentials', $s['include_credentials'] === '1', Lang::t('set_include_credentials'))
            . '<small class="wb-help">' . View::e(Lang::t('help_include_credentials')) . '</small>'
            . View::field(Lang::t('set_log_retention_days'), View::input('log_retention_days', $s['log_retention_days'], 'number', ['min' => '0', 'max' => '3650']), Lang::t('help_log_retention'));

        $otp = View::field(Lang::t('set_otp_mode'), View::select('otp_mode', ['off' => Lang::t('otp_off'), 'verify' => Lang::t('otp_verify'), 'login' => Lang::t('otp_login')], $s['otp_mode']), Lang::t('help_otp_mode'))
            . View::toggle('otp_skip_no_phone', $s['otp_skip_no_phone'] === '1', Lang::t('set_otp_skip_no_phone'))
            . '<div class="wb-grid-4">'
            . View::field(Lang::t('set_otp_per_hour'), View::input('otp_per_hour', $s['otp_per_hour'], 'number', ['min' => '1', 'max' => '20']))
            . View::field(Lang::t('set_otp_resend_seconds'), View::input('otp_resend_seconds', $s['otp_resend_seconds'], 'number', ['min' => '0', 'max' => '3600']))
            . View::field(Lang::t('set_otp_max_attempts'), View::input('otp_max_attempts', $s['otp_max_attempts'], 'number', ['min' => '1', 'max' => '10']))
            . View::field(Lang::t('set_otp_ttl_minutes'), View::input('otp_ttl_minutes', $s['otp_ttl_minutes'], 'number', ['min' => '1', 'max' => '60']))
            . '</div>';

        $form = View::form('save_settings', 'settings', $this->link,
            View::card(Lang::t('sec_connection'), $connection)
            . View::card(Lang::t('sec_admin_alerts'), $alerts)
            . View::card(Lang::t('sec_delivery'), $delivery)
            . View::card(Lang::t('sec_reminders'), $reminders)
            . View::card(Lang::t('sec_privacy'), $privacy)
            . View::card(Lang::t('sec_otp'), $otp)
            . '<div class="wb-actions wb-sticky">' . View::button(Lang::t('btn_save')) . '</div>');

        $tools = View::form('test_connection', 'settings', $this->link,
                '<p>' . View::e(Lang::t('help_test_connection')) . '</p>' . View::button(Lang::t('btn_test_connection'), 'secondary'))
            . '<hr class="wb-sep">'
            . View::form('test_send', 'settings', $this->link,
                View::field(Lang::t('set_test_phone'), View::input('test_phone', '', 'tel', ['placeholder' => '501234567', 'required' => true, 'maxlength' => '32']))
                . View::button(Lang::t('btn_send_test'), 'secondary'));

        $instTable = '';
        if ($instances) {
            $rows = [];
            foreach ($instances as $i) {
                $rows[] = [View::e($i['name']), View::e($i['phone']), View::badge($i['status'] === 'connected' ? 'sent' : 'pending') . ' ' . View::e($i['status']), '<code>' . View::e($i['id']) . '</code>'];
            }
            $instTable = View::table([Lang::t('col_name'), Lang::t('col_phone'), Lang::t('col_status'), 'ID'], $rows, '');
        }

        return '<div class="wb-grid-main"><div>' . $form . '</div><aside>'
            . View::card(Lang::t('sec_tools'), $tools . $instTable, 'wb-aside') . '</aside></div>';
    }

    private function pageEvents(): string
    {
        $open = $this->result['open_event'] ?? '';
        $html = '<p class="wb-lead">' . View::e(Lang::t('events_intro')) . '</p>';
        foreach (Events::grouped() as $group => $events) {
            $items = '';
            foreach ($events as $key => $e) {
                $inner = View::hidden('event', $key)
                    . '<div class="wb-row">'
                    . View::toggle('enabled', $e['enabled'], Lang::t('lbl_enabled'))
                    . ($e['audience'] === 'client' ? View::toggle('critical', $e['critical'], Lang::t('lbl_critical')) : View::hidden('critical', '1'))
                    . '</div>'
                    . '<div class="wb-grid-2">'
                    . View::field(Lang::t('lbl_body_en'), View::textarea('body_en', $e['body_en'], 8, ['dir' => 'ltr', 'maxlength' => '4000']))
                    . View::field(Lang::t('lbl_body_ar'), View::textarea('body_ar', $e['body_ar'], 8, ['dir' => 'rtl', 'lang' => 'ar', 'maxlength' => '4000']))
                    . '</div>'
                    . View::chips($e['fields'])
                    . '<div class="wb-grid-2">'
                    . '<div>'
                    . View::field(Lang::t('lbl_wa_template'), View::input('wa_template', $e['wa_template'], 'text', ['pattern' => '[a-z0-9_]{1,128}', 'placeholder' => 'invoice_created', 'dir' => 'ltr', 'id' => 'wb-tpl-' . $key]), Lang::t('help_wa_template'))
                    . View::field(Lang::t('lbl_wa_template_lang'), View::input('wa_template_lang', $e['wa_template_lang'], 'text', ['pattern' => '[a-z]{2,3}(_[A-Z]{2})?', 'placeholder' => 'ar / en_US', 'dir' => 'ltr', 'maxlength' => '16', 'id' => 'wb-tpl-lang-' . $key]), Lang::t('help_wa_template_lang'))
                    . '</div>'
                    . View::field(Lang::t('lbl_wa_template_params'), View::textarea('wa_template_params', $e['wa_template_params'], 4, ['dir' => 'ltr', 'placeholder' => "customer_name={first_name}\ninvoice_id={invoice_num}", 'id' => 'wb-tpl-params-' . $key]), Lang::t('help_wa_template_params'))
                    . '</div>'
                    . '<div class="wb-actions">' . View::toggle('reset', false, Lang::t('lbl_reset_default')) . View::button(Lang::t('btn_save')) . '</div>';
                $form = View::form('save_event', 'events', $this->link, $inner);
                $test = View::form('test_event', 'events', $this->link,
                    View::hidden('event', $key)
                    . '<div class="wb-inline">'
                    . View::input('test_phone', '', 'tel', ['placeholder' => Lang::t('set_test_phone'), 'required' => true, 'maxlength' => '32', 'id' => 'wb-test-' . $key])
                    . View::select('lang', ['en' => 'English', 'ar' => 'العربية'], 'en', false, ['id' => 'wb-lang-' . $key])
                    . View::button(Lang::t('btn_send_sample'), 'ghost') . '</div>', 'wb-test-form');
                $badges = ($e['enabled'] ? View::badge('enabled') : View::badge('disabled'))
                    . ($e['critical'] && $e['audience'] === 'client' ? ' ' . View::badge('critical') : '');
                $items .= '<details class="wb-event"' . ($open === $key ? ' open' : '') . '>'
                    . '<summary><span class="wb-event-title">' . View::e(Lang::t('event_' . $key)) . '</span>'
                    . '<span class="wb-event-hook">' . View::e($e['hook']) . '</span>' . $badges . '</summary>'
                    . '<div class="wb-event-body"><p class="wb-help">' . View::e(Lang::t('eventhelp_' . $key)) . '</p>' . $form . $test . '</div></details>';
            }
            $html .= View::card(Lang::t('group_' . $group), $items);
        }
        $html .= View::card(Lang::t('merge_fields'), '<p class="wb-help">' . View::e(Lang::t('help_merge_fields')) . '</p>' . View::chips(Renderer::ALL_FIELDS));
        return $html;
    }

    private function pageLog(): string
    {
        $status = Security::choice(Security::get('status', 12), Outbox::STATUSES, '');
        $eventKeys = array_merge(array_keys(Events::definitions()), ['manual', 'bulk', 'test']);
        $event = Security::choice(Security::get('event', 48), $eventKeys, '');
        $client = (int) Security::get('client', 10);
        $phone = preg_replace('/\D/', '', Security::get('phone', 20));
        $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', Security::get('from', 10)) ? Security::get('from', 10) : '';
        $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', Security::get('to', 10)) ? Security::get('to', 10) : '';
        $page = max(1, (int) Security::get('p', 6));

        $q = Capsule::table(Outbox::TABLE);
        if ($status !== '') {
            $q->where('status', $status);
        }
        if ($event !== '') {
            $q->where('event', $event);
        }
        if ($client > 0) {
            $q->where('client_id', $client);
        }
        if ($phone !== '') {
            $q->where('phone', 'like', '%' . $phone . '%');
        }
        if ($from !== '') {
            $q->where('created_at', '>=', $from . ' 00:00:00');
        }
        if ($to !== '') {
            $q->where('created_at', '<=', $to . ' 23:59:59');
        }
        $total = (clone $q)->count();
        $rows = $q->orderBy('id', 'desc')->offset(($page - 1) * self::PER_PAGE)->limit(self::PER_PAGE)->get();

        $statusOpts = ['' => Lang::t('all')];
        foreach (Outbox::STATUSES as $st) {
            $statusOpts[$st] = Lang::t('status_' . $st);
        }
        $eventOpts = ['' => Lang::t('all')];
        foreach ($eventKeys as $k) {
            $eventOpts[$k] = $this->eventLabel($k);
        }
        $filters = '<form method="get" action="addonmodules.php" class="wb-filters">'
            . View::hidden('module', 'wabek') . View::hidden('page', 'log')
            . View::field(Lang::t('col_status'), View::select('status', $statusOpts, $status))
            . View::field(Lang::t('col_event'), View::select('event', $eventOpts, $event))
            . View::field(Lang::t('col_client'), View::input('client', $client ?: '', 'number', ['min' => '1']))
            . View::field(Lang::t('col_phone'), View::input('phone', $phone, 'text', ['inputmode' => 'numeric']))
            . View::field(Lang::t('lbl_from'), View::input('from', $from, 'date'))
            . View::field(Lang::t('lbl_to'), View::input('to', $to, 'date'))
            . '<div class="wb-field wb-field-btn"><button class="wb-btn wb-btn-secondary" type="submit">' . View::e(Lang::t('btn_filter')) . '</button></div>'
            . '</form>';

        $tableRows = [];
        foreach ($rows as $r) {
            $actions = '';
            if ($r->status === 'pending') {
                $actions .= View::form('cancel', 'log', $this->link, View::hidden('id', $r->id) . View::button(Lang::t('btn_cancel'), 'ghost'), 'wb-inline-form');
            } elseif ($r->status !== 'sending' && (string) $r->message !== '' && (string) $r->phone !== '') {
                $actions .= View::form('resend', 'log', $this->link, View::hidden('id', $r->id) . View::button(Lang::t('btn_resend'), 'ghost'), 'wb-inline-form');
            }
            if ($r->status === 'sent' && (string) $r->remote_id !== '' && !in_array((string) ($r->delivery_status ?? ''), ['read', 'failed'], true)) {
                $actions .= ' ' . View::form('check_status', 'log', $this->link, View::hidden('id', $r->id) . View::button(Lang::t('btn_check_status'), 'ghost'), 'wb-inline-form');
            }
            $clientCell = $r->client_id
                ? '<a class="wb-link" href="clientssummary.php?userid=' . (int) $r->client_id . '">#' . (int) $r->client_id . '</a>'
                : View::e(Lang::t('audience_' . $r->audience));
            $detail = '<details class="wb-msg"><summary>' . View::e(Lang::t('view_message')) . '</summary><pre dir="auto">' . View::e($r->message) . '</pre>'
                . ($r->remote_id !== '' ? '<small>ID: ' . View::e($r->remote_id) . '</small>' : '') . '</details>';
            $tableRows[] = [
                '<span class="wb-mono">' . (int) $r->id . '</span>',
                View::e($r->created_at),
                View::e($this->eventLabel((string) $r->event)) . $detail,
                $clientCell,
                '<span class="wb-mono" dir="ltr">' . View::e($r->phone) . '</span>',
                View::badge((string) $r->status)
                    . ((string) ($r->delivery_status ?? '') !== '' ? ' ' . View::badge('delivery_' . $r->delivery_status) : '')
                    . ($r->critical ? ' ' . View::badge('critical') : ''),
                (int) $r->attempts . ($r->http_code ? ' · ' . (int) $r->http_code : ''),
                '<span class="wb-error">' . View::e($r->last_error) . '</span>',
                $actions,
            ];
        }
        $table = View::table([
            '#', Lang::t('col_date'), Lang::t('col_event'), Lang::t('col_client'), Lang::t('col_phone'),
            Lang::t('col_status'), Lang::t('col_attempts'), Lang::t('col_error'), '',
        ], $tableRows, Lang::t('empty_log'));

        $pages = (int) ceil($total / self::PER_PAGE);
        $pager = '';
        if ($pages > 1) {
            $qs = http_build_query(array_filter(['status' => $status, 'event' => $event, 'client' => $client ?: '', 'phone' => $phone, 'from' => $from, 'to' => $to]));
            $pager = '<nav class="wb-pager">';
            if ($page > 1) {
                $pager .= '<a class="wb-btn wb-btn-ghost" href="' . View::e($this->link . '&page=log&' . $qs . '&p=' . ($page - 1)) . '">' . View::e(Lang::t('prev')) . '</a>';
            }
            $pager .= '<span>' . View::e(Lang::t('page_x_of_y', ['{x}' => (string) $page, '{y}' => (string) $pages])) . '</span>';
            if ($page < $pages) {
                $pager .= '<a class="wb-btn wb-btn-ghost" href="' . View::e($this->link . '&page=log&' . $qs . '&p=' . ($page + 1)) . '">' . View::e(Lang::t('next')) . '</a>';
            }
            $pager .= '</nav>';
        }
        return View::card(Lang::t('tab_log'), $filters . '<p class="wb-help">' . View::e(Lang::t('log_total', ['{n}' => (string) $total])) . '</p>' . $table . $pager);
    }

    private function pageSend(): string
    {
        $prefill = (int) Security::get('client', 10);
        $inner = '<div class="wb-grid-2">'
            . View::field(Lang::t('lbl_client'), View::input('client', $prefill ?: Security::post('client', 190), 'text', ['placeholder' => Lang::t('placeholder_client')]), Lang::t('help_client'))
            . View::field(Lang::t('lbl_phone_override'), View::input('phone', '', 'tel', ['placeholder' => '501234567', 'maxlength' => '32']), Lang::t('help_phone_override'))
            . '</div>'
            . View::field(Lang::t('lbl_message'), View::textarea('message', Security::postText('message'), 7, ['required' => true, 'dir' => 'auto', 'maxlength' => '4000']))
            . View::chips(['client_name', 'first_name', 'company', 'email', 'client_id', 'client_area_url', 'system_name'])
            . '<div class="wb-row">'
            . View::select('mode', ['now' => Lang::t('mode_now'), 'queue' => Lang::t('mode_queue')], 'now')
            . View::toggle('transactional', false, Lang::t('lbl_transactional'))
            . '</div>'
            . '<small class="wb-help">' . View::e(Lang::t('help_transactional')) . '</small>'
            . '<div class="wb-actions">' . View::button(Lang::t('btn_send')) . '</div>';
        return View::card(Lang::t('tab_send'), View::form('manual_send', 'send', $this->link, $inner), '', Lang::t('send_intro'));
    }

    private function pageBulk(): string
    {
        $state = $this->result['bulk'] ?? null;
        $filters = $state['filters'] ?? ['product_ids' => [], 'service_status' => ['Active'], 'client_status' => ['Active']];

        $products = [];
        foreach (Capsule::table('tblproducts as p')->leftJoin('tblproductgroups as g', 'g.id', '=', 'p.gid')
            ->orderBy('g.order')->orderBy('p.order')->get(['p.id', 'p.name', 'g.name as groupname']) as $p) {
            $products[(string) $p->id] = ($p->groupname ? $p->groupname . ' — ' : '') . $p->name;
        }

        $preview = '';
        if (isset($this->result['bulk_preview'])) {
            $pv = $this->result['bulk_preview'];
            $preview = '<div class="wb-stats">'
                . View::stat(Lang::t('bulk_matched'), $pv['total'])
                . View::stat(Lang::t('bulk_sendable'), $pv['sendable'], 'is-good')
                . View::stat(Lang::t('bulk_no_phone'), $pv['no_phone'])
                . View::stat(Lang::t('bulk_no_consent'), $pv['no_consent'])
                . '</div>';
        }

        $inner = View::field(Lang::t('lbl_bulk_name'), View::input('name', $state['name'] ?? '', 'text', ['maxlength' => '150']))
            . View::field(Lang::t('lbl_products'), View::select('product_ids', $products, $filters['product_ids'], true, ['size' => '6']), Lang::t('help_products'))
            . View::field(Lang::t('lbl_service_status'), View::checkboxes('service_status', Bulk::SERVICE_STATUSES, $filters['service_status'], function ($v) {
                return Lang::t('svc_' . strtolower($v));
            }))
            . View::field(Lang::t('lbl_client_status'), View::checkboxes('client_status', Bulk::CLIENT_STATUSES, $filters['client_status'], function ($v) {
                return Lang::t('cli_' . strtolower($v));
            }))
            . View::field(Lang::t('lbl_message'), View::textarea('message', $state['message'] ?? '', 7, ['dir' => 'auto', 'maxlength' => '4000']))
            . View::chips(['client_name', 'first_name', 'company', 'service_name', 'domain', 'next_due_date', 'client_area_url', 'system_name'])
            . $preview
            . '<label class="wb-check"><input type="checkbox" name="confirm" value="yes"> ' . View::e(Lang::t('bulk_confirm')) . '</label>'
            . '<small class="wb-help">' . View::e(Lang::t('help_bulk', ['{n}' => Config::get('bulk_per_run')])) . '</small>'
            . '<div class="wb-actions">'
            . View::button(Lang::t('btn_preview'), 'secondary', 'wb_action', 'bulk_preview')
            . View::button(Lang::t('btn_queue_bulk'), 'primary', 'wb_action', 'bulk_queue')
            . '</div>';
        // The submit buttons carry wb_action; the form's own hidden field is a fallback (preview).
        $form = View::form('bulk_preview', 'bulk', $this->link, $inner);

        $rows = [];
        foreach (Bulk::recent() as $b) {
            $r = $b['row'];
            $c = $b['counts'];
            $progress = (int) ($c['sent'] ?? 0) . ' / ' . (int) $r->total;
            $act = $r->status === 'queued'
                ? View::form('bulk_cancel', 'bulk', $this->link, View::hidden('bulk_id', $r->id) . View::button(Lang::t('btn_cancel'), 'ghost'), 'wb-inline-form')
                : '';
            $rows[] = [
                View::e($r->created_at), View::e($r->name), View::badge($r->status === 'queued' ? 'pending' : ($r->status === 'done' ? 'sent' : 'cancelled')),
                View::e($progress), (int) ($c['failed'] ?? 0), (int) $r->skipped,
                '<a class="wb-link" href="' . View::e($this->link . '&page=log&event=bulk') . '">' . View::e(Lang::t('view_full_log')) . '</a>',
                $act,
            ];
        }
        $history = View::table([Lang::t('col_date'), Lang::t('col_name'), Lang::t('col_status'), Lang::t('col_sent'), Lang::t('status_failed'), Lang::t('status_skipped'), '', ''], $rows, Lang::t('empty_bulk'));

        return View::card(Lang::t('tab_bulk'), $form, '', Lang::t('bulk_intro')) . View::card(Lang::t('bulk_history'), $history);
    }

    private function pageConsent(): string
    {
        $page = max(1, (int) Security::get('p', 6));
        $q = Capsule::table('mod_wabek_consent as s')->leftJoin('tblclients as c', 'c.id', '=', 's.client_id');
        $total = (clone $q)->count();
        $rows = [];
        foreach ($q->orderBy('s.updated_at', 'desc')->offset(($page - 1) * self::PER_PAGE)->limit(self::PER_PAGE)
            ->get(['s.*', 'c.firstname', 'c.lastname', 'c.companyname']) as $r) {
            $rows[] = [
                '<a class="wb-link" href="clientssummary.php?userid=' . (int) $r->client_id . '">#' . (int) $r->client_id . '</a> ' . View::e(trim($r->firstname . ' ' . $r->lastname)),
                $r->opted_out ? View::badge('opted_out') : ($r->opted_in ? View::badge('opted_in') : View::badge('pending')),
                '<span dir="ltr">' . View::e($r->verified_phone) . '</span>',
                View::e($r->source), View::e($r->updated_at),
            ];
        }
        $form = View::form('set_consent', 'consent', $this->link,
            '<div class="wb-inline">'
            . View::input('client', '', 'text', ['placeholder' => Lang::t('placeholder_client'), 'required' => true])
            . View::select('consent', ['in' => Lang::t('consent_set_in'), 'out' => Lang::t('consent_set_out')], 'out')
            . View::button(Lang::t('btn_save')) . '</div>');
        $mode = Config::get('consent_mode') === 'opt_in' ? Lang::t('consent_opt_in') : Lang::t('consent_opt_out');
        return View::card(Lang::t('tab_consent'), '<p class="wb-lead">' . View::e(Lang::t('consent_intro', ['{mode}' => $mode])) . '</p>' . $form, '')
            . View::card(Lang::t('consent_list', ['{n}' => (string) $total]),
                View::table([Lang::t('col_client'), Lang::t('col_status'), Lang::t('col_verified_phone'), Lang::t('col_source'), Lang::t('col_date')], $rows, Lang::t('empty_consent')));
    }

    private function eventLabel(string $key): string
    {
        $label = Lang::t('event_' . $key);
        return $label === 'event_' . $key ? $key : $label;
    }
}
