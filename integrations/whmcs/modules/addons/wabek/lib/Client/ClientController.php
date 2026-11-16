<?php

namespace WABEK\Client;

use WABEK\Config;
use WABEK\Consent;
use WABEK\Lang;
use WABEK\Otp;
use WABEK\Phone;
use WABEK\Security;
use WABEK\Theme;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Client area: index.php?m=wabek (WhatsApp preferences) and
 * index.php?m=wabek&action=verify (WhatsApp code). State changes are POST
 * with the WHMCS CSRF token, followed by a redirect (PRG).
 *
 * The page is rendered with the template set that matches the active theme
 * (templates/bs3, templates/bs4 or templates/lagom2; see Theme): WHMCS loads
 * the plain templates/preferences.tpl / verify.tpl, which include the variant
 * from the absolute path in $wabekTplDir.
 */
final class ClientController
{
    /** Allowed "return" targets of a posted toggle. */
    private const RETURNS = ['home' => 'clientarea.php'];

    /** @var array */
    private $vars;

    public function __construct(array $vars)
    {
        $this->vars = $vars;
        Lang::init($vars);
    }

    public function handle(): array
    {
        $clientId = (int) ($_SESSION['uid'] ?? 0);
        $action = Security::choice(Security::get('action', 20), ['preferences', 'verify'], 'preferences');
        if ($action === 'verify' && Otp::mode() === 'off') {
            $action = 'preferences';
        }

        if ($clientId > 0 && Security::isPost()) {
            // One-click toggle from the homepage panel / account pages: back to where it was clicked (allow-list).
            $return = self::RETURNS[Security::post('return', 10)] ?? '';
            if (!Security::validPost(false)) {
                $this->flash('error', Lang::t('err_csrf'));
                $return = '';
            } else {
                $this->post($clientId, Security::post('wb_action', 20));
            }
            if ($return !== '') {
                $flash = $_SESSION['wabek_flash'] ?? null;
                unset($_SESSION['wabek_flash']);
                if (is_array($flash) && $flash[0] === 'success') {
                    $_SESSION[HomePanel::FLASH] = (string) $flash[1];
                }
                $this->redirect($return);
            }
            $this->redirect('index.php?m=wabek' . ($action === 'verify' ? '&action=verify' : ''));
        }

        $flash = $_SESSION['wabek_flash'] ?? null;
        unset($_SESSION['wabek_flash']);

        // Leaving the code page drops a pending number change, so "Verify number" always means the current number.
        if ($action !== 'verify' && isset($_SESSION['wabek_otp_target'])) {
            unset($_SESSION['wabek_otp_target'], $_SESSION['wabek_otp_request']);
        }

        $lookup = $clientId > 0 ? Phone::lookup($clientId) : ['phone' => null, 'source' => ''];
        $phone = $lookup['phone'];
        $state = $clientId > 0 ? Consent::state($clientId) : ['opted_in' => false, 'opted_out' => false, 'verified_phone' => '', 'verified_at' => ''];
        $subscribed = $clientId > 0 && Consent::isSubscribed($state);
        $verified = $phone !== null && $state['verified_phone'] === $phone;
        $mode = Otp::mode();
        $profile = $clientId > 0 ? Phone::profileNumber($clientId) : null;
        // A new number waiting for its code (index.php?m=wabek&action=verify shows it instead of the current one).
        $target = is_string($_SESSION['wabek_otp_target'] ?? null) ? (string) $_SESSION['wabek_otp_target'] : '';
        $changing = $target !== '' && $action === 'verify';

        $pending = (int) ($_SESSION['wabek_otp_request'] ?? 0) > 0;
        $theme = Theme::detect($this->vars);
        $view = [
            'action'       => $action,
            'token'        => Security::token(),
            'dir'          => Lang::isRtl() ? 'rtl' : 'ltr',
            'theme'        => $theme['name'],
            'variant'      => $theme['variant'],
            'family'       => $theme['family'],
            'lagom'        => $theme['lagom'],
            'phone_masked' => $changing ? Phone::mask($target) : ($phone !== null ? Phone::mask($phone) : ''),
            'has_phone'    => $phone !== null || $changing,
            'subscribed'   => $subscribed,
            'verified'     => $verified && !$changing,
            'changing'     => $changing,
            'otp_enabled'  => $mode !== 'off',
            'otp_mode'     => $mode,
            'login_code'   => $clientId > 0 && Otp::loginRequiredFor($clientId),
            'login_forced' => $mode === 'login',
            'login_choice' => $mode === 'optional',
            'phone_source' => (string) $lookup['source'],
            'can_reset'    => $lookup['source'] === 'override' && $profile !== null && $profile !== $phone,
            'profile_masked' => $profile !== null ? Phone::mask($profile) : '',
            'verified_at'  => $verified && !empty($state['verified_at']) ? substr((string) $state['verified_at'], 0, 10) : '',
            'login_gate'   => Otp::loginPending(),
            'code_sent'    => $pending,
            'flash_type'   => is_array($flash) ? (string) $flash[0] : '',
            'flash_text'   => is_array($flash) ? (string) $flash[1] : '',
            'company'      => Config::companyName(),
            'url_self'     => 'index.php?m=wabek',
            'url_verify'   => 'index.php?m=wabek&action=verify',
            'url_profile'  => 'clientarea.php?action=details',
            'url_logout'   => 'logout.php',
        ];

        $breadcrumb = ['index.php?m=wabek' => Lang::t('client_prefs_title')];
        if ($action === 'verify') {
            $breadcrumb['index.php?m=wabek&action=verify'] = Lang::t('client_verify_title');
        }
        $title = $action === 'verify' ? Lang::t('client_verify_title') : Lang::t('client_prefs_title');
        return [
            'pagetitle'    => $title,
            'breadcrumb'   => $breadcrumb,
            // templates/preferences.tpl and templates/verify.tpl are shims that include
            // the theme's variant from $wabekTplDir (templates/bs3, bs4 or lagom2).
            'templatefile' => $action === 'verify' ? 'verify' : 'preferences',
            'requirelogin' => true,
            'forcessl'     => false,
            'vars'         => ['wabek' => $view, 'wl' => Lang::all(), 'wabekTplDir' => self::variantDir($theme['variant'])],
        ];
    }

    /** Absolute path of the template set for a variant (allow-listed; bs4 when unknown or missing). */
    public static function variantDir(string $variant): string
    {
        $variant = in_array($variant, Theme::VARIANTS, true) ? $variant : 'bs4';
        $dir = WABEK_MODULE_DIR . '/templates/' . $variant;
        if (!is_file($dir . '/preferences.tpl')) {
            $dir = WABEK_MODULE_DIR . '/templates/bs4';
        }
        return str_replace('\\', '/', $dir);
    }

    private function post(int $clientId, string $action): void
    {
        switch ($action) {
            case 'subscribe':
            case 'unsubscribe':
                Consent::set($clientId, $action === 'subscribe', 'client', Security::ip());
                $this->flash('success', Lang::t($action === 'subscribe' ? 'client_ok_subscribed' : 'client_ok_unsubscribed'));
                return;

            case 'otp_change':
                // The client types a new WhatsApp number; it is saved only after the code sent to it is confirmed.
                $new = Phone::fromPost('new_phone', Phone::clientCountry($clientId));
                if ($new === null) {
                    $this->flash('error', Lang::t('client_err_new_phone'));
                    return;
                }
                $state = Consent::state($clientId, false);
                if ($new === Phone::forClient($clientId) && $state['verified_phone'] === $new) {
                    $this->flash('success', Lang::t('client_ok_verified'));
                    return;
                }
                $r = Otp::request($clientId, 'change', Security::ip(), $new);
                if ($r['ok']) {
                    $_SESSION['wabek_otp_request'] = (int) $r['request_id'];
                    $_SESSION['wabek_otp_target'] = $new;
                    $this->flash('success', Lang::t('client_ok_code_sent', ['{phone}' => Phone::mask($new)]));
                    $this->redirect('index.php?m=wabek&action=verify');
                }
                $this->flash('error', Lang::t($r['error'], ['{seconds}' => (string) ($r['wait'] ?? 0)]));
                return;

            case 'otp_change_cancel':
                unset($_SESSION['wabek_otp_request'], $_SESSION['wabek_otp_target']);
                return;

            case 'use_profile':
                // Back to the profile phone number (drops a number chosen here or set on the admin profile tab).
                if (Phone::profileNumber($clientId) !== null) {
                    Phone::setOverride($clientId, '');
                    Consent::resyncPlatform($clientId);
                    $this->flash('success', Lang::t('client_ok_number_reset'));
                }
                return;

            case 'login_code_on':
            case 'login_code_off':
                if (Otp::mode() !== 'optional') {
                    $this->flash('error', Lang::t('otp_disabled'));
                    return;
                }
                $on = $action === 'login_code_on';
                $phone = Phone::forClient($clientId);
                if ($on && ($phone === null || Consent::state($clientId, false)['verified_phone'] !== $phone)) {
                    $this->flash('error', Lang::t('client_err_verify_first'));
                    return;
                }
                Otp::setClientLoginChoice($clientId, $on);
                $this->flash('success', Lang::t($on ? 'client_ok_login_code_on' : 'client_ok_login_code_off'));
                return;

            case 'otp_send':
                $target = is_string($_SESSION['wabek_otp_target'] ?? null) ? (string) $_SESSION['wabek_otp_target'] : '';
                $r = $target !== '' && !Otp::loginPending()
                    ? Otp::request($clientId, 'change', Security::ip(), $target)
                    : Otp::request($clientId, Otp::loginPending() ? 'login' : 'verification', Security::ip());
                if ($r['ok']) {
                    $_SESSION['wabek_otp_request'] = (int) $r['request_id'];
                    $this->flash('success', Lang::t('client_ok_code_sent', ['{phone}' => Phone::mask((string) $r['phone'])]));
                } else {
                    $this->flash('error', Lang::t($r['error'], ['{seconds}' => (string) ($r['wait'] ?? 0)]));
                }
                return;

            case 'otp_verify':
                $requestId = (int) ($_SESSION['wabek_otp_request'] ?? 0);
                $r = Otp::verify($clientId, $requestId, Security::post('code', 12));
                if ($r['ok']) {
                    $changed = isset($_SESSION['wabek_otp_target']);
                    unset($_SESSION['wabek_otp_request'], $_SESSION['wabek_otp_target']);
                    if (Otp::loginPending()) {
                        Otp::clearLoginPending();
                        $this->flash('success', Lang::t('client_ok_login_verified'));
                        $this->redirect('clientarea.php');
                    }
                    $this->flash('success', Lang::t($changed ? 'client_ok_number_changed' : 'client_ok_verified'));
                    $this->redirect('index.php?m=wabek');
                } else {
                    if (in_array($r['error'], ['otp_expired', 'otp_too_many'], true)) {
                        unset($_SESSION['wabek_otp_request']);
                    }
                    $this->flash('error', Lang::t($r['error']));
                }
                return;

            default:
                $this->flash('error', Lang::t('err_unknown_action'));
        }
    }

    private function flash(string $type, string $text): void
    {
        $_SESSION['wabek_flash'] = [$type, $text];
    }

    /** Same-site relative redirect only. */
    private function redirect(string $path): void
    {
        header('Location: ' . Config::systemUrl() . ltrim($path, '/'), true, 303);
        exit;
    }
}
