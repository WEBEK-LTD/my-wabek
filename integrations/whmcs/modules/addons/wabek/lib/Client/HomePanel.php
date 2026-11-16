<?php

namespace WABEK\Client;

use WABEK\Consent;
use WABEK\Lang;
use WABEK\Phone;
use WABEK\Security;
use WABEK\Theme;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * "WhatsApp notifications" panel on the client-area homepage
 * (ClientAreaHomepagePanels, menu API). Every theme — six, twenty-one,
 * Nexus, Lagom 1 and 2 — prints homepage panels itself; the body uses the
 * theme's own labels / badges and buttons for its variant, and carries a
 * one-click on/off form (POST + CSRF token, back to the homepage).
 */
final class HomePanel
{
    public const NAME = 'wabek-whatsapp';
    public const FLASH = 'wabek_hp_flash';

    /** @param object $panels WHMCS\View\Menu\Item */
    public static function add($panels, array $vars = []): void
    {
        $clientId = (int) ($_SESSION['uid'] ?? 0);
        if ($clientId <= 0 || !is_object($panels) || $panels->getChild(self::NAME)) {
            return;
        }
        Lang::initForSession(false);
        $theme = Theme::detect($vars);
        $phone = Phone::forClient($clientId);
        $state = Consent::state($clientId);
        $flash = $_SESSION[self::FLASH] ?? null;
        unset($_SESSION[self::FLASH]);

        $body = self::markup($theme['variant'], [
            'subscribed'   => Consent::isSubscribed($state),
            'has_phone'    => $phone !== null,
            'phone_masked' => $phone !== null ? Phone::mask($phone) : '',
            'verified'     => $phone !== null && $state['verified_phone'] === $phone,
            'token'        => Security::token(),
            'url_self'     => 'index.php?m=wabek',
            'flash'        => is_string($flash) ? $flash : '',
        ], Lang::all(), Lang::isRtl());

        $family = $theme['family'] === 'bs3' ? 'fa fa-' : 'fas fa-';
        $panels->addChild(self::NAME, [
            'label'    => Lang::t('client_nav'),
            'icon'     => Theme::brandIcon('whatsapp', $vars),
            'order'    => 250,
            'extras'   => [
                'color'    => 'green',
                'btn-link' => 'index.php?m=wabek',
                'btn-text' => Lang::t('client_hp_manage'),
                'btn-icon' => $family . 'cog',
            ],
            'bodyHtml' => $body,
        ]);
    }

    /**
     * Panel body (pure; also used by the render tests).
     *
     * @param array{subscribed:bool,has_phone:bool,phone_masked:string,verified:bool,token:string,url_self:string,flash:string} $d
     * @param array<string,string> $t lang strings
     */
    public static function markup(string $variant, array $d, array $t, bool $rtl): string
    {
        $variant = in_array($variant, Theme::VARIANTS, true) ? $variant : 'bs4';
        $e = [Security::class, 'e'];
        $on = (bool) $d['subscribed'];

        if ($variant === 'bs3') {
            $badgeOn = 'label label-success';
            $badgeOff = 'label label-default';
            $btnOff = 'btn btn-default btn-sm';
            $muted = 'help-block';
        } else {
            $badgeOn = $variant === 'lagom2' ? 'label label-success badge badge-success' : 'badge badge-success bg-success';
            $badgeOff = $variant === 'lagom2' ? 'label label-default badge badge-secondary' : 'badge badge-secondary bg-secondary';
            $btnOff = 'btn btn-sm btn-outline-danger';
            $muted = 'small text-muted';
        }
        $verified = $d['verified'] ? ' <span class="' . $badgeOn . '">' . $e($t['client_verified_badge'] ?? '') . '</span>' : '';

        return '<div class="wabek-ca wabek-hp wabek-v-' . $variant . '" dir="' . ($rtl ? 'rtl' : 'ltr') . '">'
            . ($d['flash'] !== '' ? '<div class="alert alert-success" role="status">' . $e($d['flash']) . '</div>' : '')
            . '<p class="wabek-state"><span class="' . ($on ? $badgeOn : $badgeOff) . '">' . $e($t[$on ? 'client_state_on' : 'client_state_off'] ?? '') . '</span> '
            . '<span class="wabek-state-text">' . $e($t[$on ? 'client_state_line_on' : 'client_state_line_off'] ?? '') . '</span></p>'
            . ($d['has_phone']
                ? '<p class="' . $muted . ' wabek-sent-to">' . $e($t['client_sent_to'] ?? '') . ' <bdi class="wabek-phone" dir="ltr">' . $e($d['phone_masked']) . '</bdi>' . $verified . '</p>'
                : '<p class="' . $muted . ' wabek-sent-to">' . $e($t['client_no_phone'] ?? '') . '</p>')
            . '<form method="post" action="' . $e($d['url_self']) . '" class="wabek-actions">'
            . '<input type="hidden" name="token" value="' . $e($d['token']) . '">'
            . '<input type="hidden" name="wb_action" value="' . ($on ? 'unsubscribe' : 'subscribe') . '">'
            . '<input type="hidden" name="return" value="home">'
            . '<button type="submit" class="' . ($on ? $btnOff : 'btn btn-primary btn-sm') . '">'
            . $e($t[$on ? 'client_btn_unsubscribe' : 'client_btn_subscribe'] ?? '') . '</button>'
            . '</form></div>';
    }
}
