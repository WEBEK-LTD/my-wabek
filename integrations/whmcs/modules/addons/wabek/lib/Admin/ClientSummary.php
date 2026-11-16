<?php

namespace WABEK\Admin;

use WABEK\Config;
use WABEK\Consent;
use WABEK\Lang;
use WABEK\Outbox;
use WABEK\Phone;
use WABEK\Security;
use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Admin client summary (clientssummary.php): the WhatsApp box printed by the
 * AdminAreaClientSummaryPage hook and the links of
 * AdminAreaClientSummaryActionLinks.
 *
 * Every lookup is guarded on its own: a failing part is logged
 * ("WABEK: …" in the activity log) and the box still renders with what is
 * known, so the box can never silently disappear.
 */
final class ClientSummary
{
    public const FLASH = 'wabek_cs_flash';

    /** AdminAreaClientSummaryPage */
    public static function render(int $clientId): string
    {
        if ($clientId <= 0) {
            return '';
        }
        $failed = [];
        self::guard('language', $clientId, $failed, function () {
            Lang::initForSession(true);
        });

        $data = [
            'client_id'    => $clientId,
            'phone'        => null,
            'phone_source' => '',
            'state'        => '',
            'subscribed'   => null,
            'verified'     => false,
            'login_code'   => null,
            'last'         => null,
            'token'        => '',
            'flash'        => '',
            'partial'      => false,
        ];
        self::guard('phone', $clientId, $failed, function () use ($clientId, &$data) {
            $p = Phone::lookup($clientId);
            $data['phone'] = $p['phone'];
            $data['phone_source'] = $p['source'];
        });
        self::guard('consent', $clientId, $failed, function () use ($clientId, &$data) {
            $state = Consent::state($clientId);
            $data['subscribed'] = Consent::isSubscribed($state);
            $data['state'] = self::stateKey($state, Config::get('consent_mode') === 'opt_in');
            $data['verified'] = $data['phone'] !== null && $state['verified_phone'] === $data['phone'];
            if (in_array(\WABEK\Otp::mode(), ['optional', 'login'], true)) {
                $data['login_code'] = \WABEK\Otp::loginRequiredFor($clientId);
            }
        });
        self::guard('last message', $clientId, $failed, function () use ($clientId, &$data) {
            $row = Capsule::table(Outbox::TABLE)->where('client_id', $clientId)->where('audience', '!=', 'admin')
                ->orderBy('id', 'desc')->first(['event', 'status', 'delivery_status', 'created_at', 'sent_at']);
            if ($row) {
                $data['last'] = [
                    'when'     => (string) ($row->sent_at ?: $row->created_at),
                    'status'   => (string) $row->status,
                    'delivery' => (string) $row->delivery_status,
                    'event'    => (string) $row->event,
                ];
            }
        });
        self::guard('token', $clientId, $failed, function () use (&$data) {
            $data['token'] = Security::token();
        });
        $flash = $_SESSION[self::FLASH] ?? null;
        if (is_array($flash) && (int) ($flash[0] ?? 0) === $clientId) {
            $data['flash'] = (string) ($flash[1] ?? '');
            unset($_SESSION[self::FLASH]);
        }
        $data['partial'] = $failed !== [];

        try {
            return self::markup($data, self::texts(), Lang::isRtl());
        } catch (\Throwable $e) {
            self::log($clientId, 'render', $e);
            return '<div class="alert alert-warning">WABEK WhatsApp: ' . Security::e(Lang::t('cs_unavailable')) . '</div>';
        }
    }

    /** AdminAreaClientSummaryActionLinks @return string[] */
    public static function actionLinks(int $clientId): array
    {
        if ($clientId <= 0) {
            return [];
        }
        Lang::initForSession(true);
        $icon = '<i class="fab fa-whatsapp fa-fw" aria-hidden="true"></i> ';
        return [
            '<a href="' . Security::e(self::url('send', $clientId)) . '">' . $icon . Security::e(Lang::t('al_send')) . '</a>',
            '<a href="' . Security::e(self::url('log', $clientId)) . '">' . $icon . Security::e(Lang::t('al_log')) . '</a>',
        ];
    }

    /** Admin toggle posted from the box (AdminController, action client_toggle). */
    public static function toggle(int $clientId, bool $on, int $adminId): bool
    {
        if ($clientId <= 0 || !Capsule::table('tblclients')->where('id', $clientId)->exists()) {
            return false;
        }
        Consent::set($clientId, $on, 'admin', Security::ip());
        $_SESSION[self::FLASH] = [$clientId, $on ? 'cs_ok_on' : 'cs_ok_off'];
        if (function_exists('logActivity')) {
            logActivity('WABEK: WhatsApp notifications turned ' . ($on ? 'on' : 'off') . ' by admin #' . $adminId . ' - User ID: ' . $clientId);
        }
        return true;
    }

    /**
     * Pure markup (WHMCS admin, Bootstrap 3), also used by the render tests.
     *
     * @param array{client_id:int,phone:?string,phone_source:string,state:string,subscribed:?bool,verified:bool,
     *              last:?array{when:string,status:string,delivery:string,event:string},token:string,flash:string,partial:bool} $d
     * @param array<string,string> $t texts (see texts())
     */
    public static function markup(array $d, array $t, bool $rtl): string
    {
        $e = [Security::class, 'e'];
        $id = (int) $d['client_id'];
        $on = $d['subscribed'];

        $stateLabel = $on === null
            ? '<span class="label label-default">?</span>'
            : '<span class="label ' . ($on ? 'label-success' : 'label-danger') . '">' . $e($on ? $t['cs_on'] : $t['cs_off']) . '</span>';
        $stateText = $d['state'] !== '' && isset($t['cs_state_' . $d['state']]) ? ' <span class="text-muted">' . $e($t['cs_state_' . $d['state']]) . '</span>' : '';

        if ($d['phone'] !== null) {
            $phone = '<bdi dir="ltr">' . $e($d['phone']) . '</bdi> '
                . ($d['verified'] ? '<span class="label label-success">' . $e($t['client_verified_badge']) . '</span>'
                    : '<span class="label label-default">' . $e($t['cs_not_verified']) . '</span>')
                . (isset($t['cs_source_' . $d['phone_source']]) ? '<br><small class="text-muted">' . $e($t['cs_source_' . $d['phone_source']]) . '</small>' : '')
                . (isset($d['login_code']) && is_bool($d['login_code'])
                    ? '<br><small class="text-muted">' . $e($t['cs_login_code'] ?? '') . ': ' . $e($d['login_code'] ? ($t['cs_login_code_on'] ?? '') : ($t['cs_login_code_off'] ?? '')) . '</small>'
                    : '');
        } else {
            $phone = '<span class="text-danger">' . $e($t['err_phone']) . '</span>';
        }

        if (is_array($d['last'])) {
            $l = $d['last'];
            $status = $l['delivery'] !== '' ? 'delivery_' . $l['delivery'] : 'status_' . $l['status'];
            $tone = in_array($l['status'], ['failed'], true) || $l['delivery'] === 'failed' ? 'label-danger'
                : ($l['status'] === 'sent' ? 'label-success' : 'label-default');
            $event = $t['event_' . $l['event']] ?? $l['event'];
            $last = '<span>' . $e(substr($l['when'], 0, 16)) . '</span> '
                . '<span class="label ' . $tone . '">' . $e($t[$status] ?? $l['status']) . '</span>'
                . '<br><small class="text-muted">' . $e($event) . '</small>';
        } else {
            $last = '<span class="text-muted">' . $e($t['cs_none']) . '</span>';
        }

        $cell = function (string $label, string $html, string $cols) use ($e): string {
            return '<div class="' . $cols . '"><small class="text-muted">' . $e($label) . '</small><div>' . $html . '</div></div>';
        };

        $toggle = '';
        if ($on !== null) {
            $toggle = '<form method="post" action="' . $e('addonmodules.php?module=wabek&page=consent') . '" class="wabek-cs-form" style="display:inline-block;margin:0">'
                . '<input type="hidden" name="token" value="' . $e($d['token']) . '">'
                . '<input type="hidden" name="wb_action" value="client_toggle">'
                . '<input type="hidden" name="client" value="' . $id . '">'
                . '<input type="hidden" name="consent" value="' . ($on ? 'out' : 'in') . '">'
                . '<input type="hidden" name="return" value="summary">'
                . '<button type="submit" class="btn btn-sm ' . ($on ? 'btn-danger' : 'btn-success') . '">'
                . '<i class="fas fa-' . ($on ? 'bell-slash' : 'bell') . ' fa-fw" aria-hidden="true"></i> '
                . $e($on ? $t['cs_btn_turn_off'] : $t['cs_btn_turn_on']) . '</button></form> ';
        }

        return '<div class="panel panel-default wabek-cs" id="wabekClientSummary" dir="' . ($rtl ? 'rtl' : 'ltr') . '"'
            . ' style="border-inline-start:4px solid #25d366;text-align:start">'
            . '<div class="panel-heading"><h3 class="panel-title"><i class="fab fa-whatsapp fa-fw" aria-hidden="true"></i> '
            . $e($t['cs_title']) . ' ' . $stateLabel . '</h3></div>'
            . '<div class="panel-body" style="padding:10px 15px">'
            . ($d['flash'] !== '' && isset($t[$d['flash']]) ? '<div class="alert alert-success" role="status" style="padding:6px 10px;margin-bottom:10px">' . $e($t[$d['flash']]) . '</div>' : '')
            . ($d['partial'] ? '<div class="alert alert-warning" role="alert" style="padding:6px 10px;margin-bottom:10px">' . $e($t['cs_unavailable']) . '</div>' : '')
            . '<div class="row">'
            . $cell($t['cs_number'], $phone, 'col-sm-4 col-xs-12')
            . $cell($t['cs_consent'], $stateLabel . $stateText, 'col-sm-4 col-xs-12')
            . $cell($t['cs_last_message'], $last, 'col-sm-4 col-xs-12')
            . '</div>'
            . '<div class="wabek-cs-actions" style="margin-top:10px">'
            . $toggle
            . '<a class="btn btn-sm btn-default" href="' . $e(self::url('send', $id)) . '"><i class="fas fa-paper-plane fa-fw" aria-hidden="true"></i> ' . $e($t['cs_btn_send']) . '</a> '
            . '<a class="btn btn-sm btn-default" href="' . $e(self::url('log', $id)) . '"><i class="fas fa-list fa-fw" aria-hidden="true"></i> ' . $e($t['cs_btn_log']) . '</a>'
            . '</div></div></div>';
    }

    /** Texts used by markup(), from the active language. @return array<string,string> */
    public static function texts(): array
    {
        $t = [];
        foreach (Lang::all() as $k => $v) {
            if (is_string($v) && preg_match('/^(cs_|status_|delivery_|event_|client_verified_badge$|err_phone$)/', (string) $k)) {
                $t[$k] = $v;
            }
        }
        return $t;
    }

    /** opted_in | opted_out | default_on | default_off */
    public static function stateKey(array $state, bool $optInMode): string
    {
        if ($state['opted_out']) {
            return 'opted_out';
        }
        if ($state['opted_in']) {
            return 'opted_in';
        }
        return $optInMode ? 'default_off' : 'default_on';
    }

    private static function url(string $page, int $clientId): string
    {
        return 'addonmodules.php?module=wabek&page=' . $page . '&client=' . $clientId;
    }

    /** @param string[] $failed */
    private static function guard(string $part, int $clientId, array &$failed, callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            $failed[] = $part;
            self::log($clientId, $part, $e);
        }
    }

    private static function log(int $clientId, string $part, \Throwable $e): void
    {
        if (function_exists('logActivity')) {
            logActivity('WABEK: client summary box (' . $part . ') failed: ' . substr($e->getMessage(), 0, 250)
                . ($clientId > 0 ? ' - User ID: ' . $clientId : ''));
        }
    }
}
