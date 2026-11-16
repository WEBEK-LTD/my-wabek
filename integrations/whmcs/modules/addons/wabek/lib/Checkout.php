<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Optional WhatsApp consent checkbox at checkout (setting checkout_consent).
 *
 * Rendered through ShoppingCartCheckoutOutput, which every order form
 * (standard_cart, the comparison/slider/boxes forms, Lagom, Lagom One Step,
 * Nexus) prints inside its checkout form. The box shows the client's current
 * choice and, when the order is placed, a changed choice is recorded with
 * source "checkout":
 *   - new clients: in ClientAdd, before the welcome message is queued;
 *   - existing clients: in AfterShoppingCartCheckout.
 * A hidden "shown" field distinguishes "unticked" from "not rendered", so an
 * order form that drops hook output never opts anyone out.
 */
final class Checkout
{
    public const FIELD = 'wabek_wa_consent';
    public const SHOWN = 'wabek_wa_consent_shown';
    private const SESSION = 'wabek_checkout_consent';

    /** @var int[] clients already handled in this request */
    private static $applied = [];

    public static function enabled(): bool
    {
        return Config::bool('checkout_consent');
    }

    /** ShoppingCartCheckoutOutput */
    public static function output(array $vars): string
    {
        if (!self::enabled()) {
            return '';
        }
        $clientId = (int) ($_SESSION['uid'] ?? 0);
        // New accounts already get the native "Receive WhatsApp notifications" field from the order form.
        if ($clientId <= 0 && ConsentField::onOrderForm()) {
            return '';
        }
        Lang::initForSession(false);
        $checked = $clientId > 0 ? self::subscribed($clientId) : Config::get('consent_mode') !== 'opt_in';
        // A re-displayed form (validation error) keeps what the client ticked.
        if (isset($_POST[self::SHOWN])) {
            $checked = self::postedValue();
        }
        return self::markup(Theme::variant($vars), $checked, Lang::isRtl(), [
            'label' => Lang::t('checkout_consent_label'),
            'help'  => Lang::t('checkout_consent_help'),
        ]);
    }

    /**
     * Theme-native checkbox markup (pure, also used by the render tests).
     *
     * @param array{label:string,help:string} $text
     */
    public static function markup(string $variant, bool $checked, bool $rtl, array $text): string
    {
        $id = 'wabekWaConsent';
        $dir = $rtl ? 'rtl' : 'ltr';
        $input = '<input type="checkbox" name="' . self::FIELD . '" id="' . $id . '" value="1"'
            . ($checked ? ' checked' : '');
        $label = Security::e($text['label']);
        $help = $text['help'] !== '' ? Security::e($text['help']) : '';

        if ($variant === 'bs3') {
            // Bootstrap 3 (six, Lagom 1): .checkbox > label > input; standard_cart restyles it with iCheck.
            $html = '<div class="checkbox wabek-co-check">'
                . '<label for="' . $id . '">' . $input . '> ' . $label . '</label>'
                . '</div>'
                . ($help !== '' ? '<p class="help-block wabek-co-help">' . $help . '</p>' : '');
        } else {
            // Bootstrap 4/5 (twenty-one, Nexus, Lagom 2): .form-check.
            $html = '<div class="form-check wabek-co-check">'
                . $input . ' class="form-check-input' . ($variant === 'lagom2' ? ' icheck-control' : '') . '">'
                . '<label class="form-check-label" for="' . $id . '">' . $label . '</label>'
                . ($help !== '' ? '<small class="form-text text-muted wabek-co-help">' . $help . '</small>' : '')
                . '</div>';
        }
        return '<div class="wabek-co wabek-v-' . Security::e($variant) . '" dir="' . $dir . '">'
            . '<input type="hidden" name="' . self::SHOWN . '" value="1">'
            . $html . '</div>';
    }

    /** ShoppingCartValidateCheckout / PreShoppingCartCheckout: remember the posted choice. */
    public static function capture(): void
    {
        if (!self::enabled() || !isset($_POST[self::SHOWN])) {
            return;
        }
        $_SESSION[self::SESSION] = ['value' => self::postedValue() ? 1 : 0, 'at' => time()];
    }

    /** ClientAdd during checkout: record the choice before any welcome message is queued. */
    public static function applyForNewClient(int $clientId): void
    {
        if ($clientId > 0 && self::enabled() && isset($_POST[self::SHOWN])) {
            self::capture();
            self::apply($clientId);
        }
    }

    /** AfterShoppingCartCheckout */
    public static function applyForOrder(int $orderId): void
    {
        if ($orderId <= 0 || !self::enabled()) {
            return;
        }
        $clientId = (int) Capsule::table('tblorders')->where('id', $orderId)->value('userid');
        if ($clientId > 0) {
            self::apply($clientId);
        }
        unset($_SESSION[self::SESSION]);
    }

    private static function apply(int $clientId): void
    {
        if (in_array($clientId, self::$applied, true)) {
            return;
        }
        $choice = $_SESSION[self::SESSION] ?? null;
        if (!is_array($choice) && isset($_POST[self::SHOWN])) {
            $choice = ['value' => self::postedValue() ? 1 : 0, 'at' => time()];
        }
        // Only a choice made in this checkout (not a stale one from an abandoned cart).
        if (!is_array($choice) || (int) ($choice['at'] ?? 0) < time() - 3600) {
            return;
        }
        self::$applied[] = $clientId;
        $want = (int) $choice['value'] === 1;
        $state = Consent::state($clientId);
        if ($want && !$state['opted_in']) {
            Consent::set($clientId, true, 'checkout', Security::ip());
        } elseif (!$want && self::subscribed($clientId)) {
            Consent::set($clientId, false, 'checkout', Security::ip());
        }
    }

    private static function subscribed(int $clientId): bool
    {
        return Consent::subscribed($clientId);
    }

    private static function postedValue(): bool
    {
        $v = $_POST[self::FIELD] ?? '';
        return is_string($v) && $v === '1';
    }
}
