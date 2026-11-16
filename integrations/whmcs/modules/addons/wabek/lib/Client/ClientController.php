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
 * (templates/bs3, templates/bs4 or templates/lagom2; see Theme).
 */
final class ClientController
{
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
            if (!Security::validPost(false)) {
                $this->flash('error', Lang::t('err_csrf'));
            } else {
                $this->post($clientId, Security::post('wb_action', 20));
            }
            $this->redirect('index.php?m=wabek' . ($action === 'verify' ? '&action=verify' : ''));
        }

        $flash = $_SESSION['wabek_flash'] ?? null;
        unset($_SESSION['wabek_flash']);

        $phone = $clientId > 0 ? Phone::forClient($clientId) : null;
        $state = $clientId > 0 ? Consent::state($clientId) : ['opted_in' => false, 'opted_out' => false, 'verified_phone' => '', 'verified_at' => ''];
        $subscribed = !$state['opted_out'] && (Config::get('consent_mode') !== 'opt_in' || $state['opted_in']);
        $verified = $phone !== null && $state['verified_phone'] === $phone;

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
            'phone_masked' => $phone !== null ? Phone::mask($phone) : '',
            'has_phone'    => $phone !== null,
            'subscribed'   => $subscribed,
            'verified'     => $verified,
            'otp_enabled'  => Otp::mode() !== 'off',
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
            // Relative to templates/: bs3/…, bs4/… or lagom2/….
            'templatefile' => $theme['variant'] . '/' . ($action === 'verify' ? 'verify' : 'preferences'),
            'requirelogin' => true,
            'forcessl'     => false,
            'vars'         => ['wabek' => $view, 'wl' => Lang::all()],
        ];
    }

    private function post(int $clientId, string $action): void
    {
        switch ($action) {
            case 'subscribe':
            case 'unsubscribe':
                Consent::set($clientId, $action === 'subscribe', 'client', Security::ip());
                $this->flash('success', Lang::t($action === 'subscribe' ? 'client_ok_subscribed' : 'client_ok_unsubscribed'));
                return;

            case 'otp_send':
                $r = Otp::request($clientId, Otp::loginPending() ? 'login' : 'verification', Security::ip());
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
                    unset($_SESSION['wabek_otp_request']);
                    if (Otp::loginPending()) {
                        Otp::clearLoginPending();
                        $this->flash('success', Lang::t('client_ok_login_verified'));
                        $this->redirect('clientarea.php');
                    }
                    $this->flash('success', Lang::t('client_ok_verified'));
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
