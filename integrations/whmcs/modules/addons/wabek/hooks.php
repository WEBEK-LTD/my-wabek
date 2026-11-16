<?php
/**
 * WABEK — WHMCS hooks. Loaded by WHMCS only while the addon is active.
 *
 * Every hook body runs inside wabek_safe(): a WABEK failure is logged and
 * never interrupts WHMCS (checkout, invoicing, module commands, cron).
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

require_once __DIR__ . '/bootstrap.php';

use WABEK\Checkout;
use WABEK\Config;
use WABEK\Consent;
use WABEK\Context;
use WABEK\Cron;
use WABEK\Lang;
use WABEK\Notifier;
use WABEK\Otp;
use WABEK\Phone;
use WABEK\Security;
use WABEK\Theme;
use WHMCS\Database\Capsule;

if (!function_exists('wabek_safe')) {
    function wabek_safe(string $hook, callable $fn)
    {
        try {
            return $fn();
        } catch (\Throwable $e) {
            if (function_exists('logActivity')) {
                logActivity('WABEK hook ' . $hook . ' failed: ' . substr($e->getMessage(), 0, 300));
            }
            return null;
        }
    }
}

// ── Accounts ───────────────────────────────────────────────────────────

add_hook('ClientAdd', 1, function ($vars) {
    wabek_safe('ClientAdd', function () use ($vars) {
        $id = (int) ($vars['client_id'] ?? $vars['userid'] ?? 0);
        if ($id > 0) {
            // Account created during checkout: record the WhatsApp checkbox before the welcome is queued.
            wabek_safe('ClientAdd checkout consent', function () use ($id) {
                Checkout::applyForNewClient($id);
            });
            Notifier::client('client_welcome', Context::client($id), 'client:' . $id, 'client_welcome:' . $id);
        }
    });
});

$wabekPasswordChanged = function (array $clientIds) {
    foreach (array_unique(array_filter(array_map('intval', $clientIds))) as $clientId) {
        Notifier::client('password_changed', Context::client($clientId), 'client:' . $clientId,
            'password_changed:' . $clientId . ':' . date('YmdHi'));
    }
};

add_hook('ClientChangePassword', 1, function ($vars) use ($wabekPasswordChanged) {
    wabek_safe('ClientChangePassword', function () use ($vars, $wabekPasswordChanged) {
        $wabekPasswordChanged([(int) ($vars['userid'] ?? 0)]);
    });
});

// WHMCS 8 users (logins) are separate from client accounts: alert the accounts this user owns.
add_hook('UserChangePassword', 1, function ($vars) use ($wabekPasswordChanged) {
    wabek_safe('UserChangePassword', function () use ($vars, $wabekPasswordChanged) {
        $userId = (int) ($vars['userid'] ?? 0);
        if ($userId <= 0 || !Capsule::schema()->hasTable('tblusers_clients')) {
            return;
        }
        $ids = Capsule::table('tblusers_clients')->where('auth_user_id', $userId)->where('owner', 1)->pluck('client_id');
        $wabekPasswordChanged(is_array($ids) ? $ids : $ids->toArray());
    });
});

// ── Billing ────────────────────────────────────────────────────────────

add_hook('InvoiceCreated', 1, function ($vars) {
    wabek_safe('InvoiceCreated', function () use ($vars) {
        $id = (int) ($vars['invoiceid'] ?? 0);
        $ctx = $id > 0 ? Context::invoice($id) : null;
        if ($ctx && $ctx['invoice_status'] !== 'Draft') {
            Notifier::client('invoice_created', $ctx, 'invoice:' . $id, 'invoice_created:' . $id);
        }
    });
});

add_hook('InvoicePaymentReminder', 1, function ($vars) {
    wabek_safe('InvoicePaymentReminder', function () use ($vars) {
        $id = (int) ($vars['invoiceid'] ?? 0);
        $type = preg_replace('/[^a-z]/', '', strtolower((string) ($vars['type'] ?? 'reminder')));
        if ($id > 0) {
            Notifier::client('invoice_reminder', Context::invoice($id), 'invoice:' . $id,
                'invoice_reminder:' . $id . ':' . $type . ':' . date('Y-m-d'));
        }
    });
});

add_hook('InvoicePaid', 1, function ($vars) {
    wabek_safe('InvoicePaid', function () use ($vars) {
        $id = (int) ($vars['invoiceid'] ?? 0);
        if ($id <= 0) {
            return;
        }
        $ctx = Context::invoice($id);
        Notifier::client('invoice_paid', $ctx, 'invoice:' . $id, 'invoice_paid:' . $id);
        Notifier::admins('admin_payment', $ctx, 'invoice:' . $id);
    });
});

add_hook('InvoiceCancelled', 1, function ($vars) {
    wabek_safe('InvoiceCancelled', function () use ($vars) {
        $id = (int) ($vars['invoiceid'] ?? 0);
        if ($id > 0) {
            Notifier::client('invoice_cancelled', Context::invoice($id), 'invoice:' . $id, 'invoice_cancelled:' . $id);
        }
    });
});

// ── Orders ─────────────────────────────────────────────────────────────

add_hook('AcceptOrder', 1, function ($vars) {
    wabek_safe('AcceptOrder', function () use ($vars) {
        $id = (int) ($vars['orderid'] ?? 0);
        if ($id > 0) {
            Notifier::client('order_accepted', Context::order($id), 'order:' . $id, 'order_accepted:' . $id);
        }
    });
});

add_hook('AfterShoppingCartCheckout', 1, function ($vars) {
    wabek_safe('AfterShoppingCartCheckout', function () use ($vars) {
        $id = (int) ($vars['OrderID'] ?? $vars['orderid'] ?? 0);
        if ($id > 0) {
            wabek_safe('AfterShoppingCartCheckout consent', function () use ($id) {
                Checkout::applyForOrder($id);
            });
            Notifier::admins('admin_new_order', Context::order($id), 'order:' . $id);
        }
    });
});

// ── Checkout: optional WhatsApp consent checkbox (setting checkout_consent) ──
// ShoppingCartCheckoutOutput is printed inside the checkout form by every
// order form, so the box works with standard_cart, the comparison / slider /
// boxes forms, Lagom, Lagom One Step and Nexus without template edits.

add_hook('ShoppingCartCheckoutOutput', 1, function ($vars) {
    return (string) wabek_safe('ShoppingCartCheckoutOutput', function () use ($vars) {
        return Checkout::output(is_array($vars) ? $vars : []);
    });
});

add_hook('ShoppingCartValidateCheckout', 1, function ($vars) {
    wabek_safe('ShoppingCartValidateCheckout', function () {
        Checkout::capture();
    });
    return [];
});

add_hook('PreShoppingCartCheckout', 1, function ($vars) {
    wabek_safe('PreShoppingCartCheckout', function () {
        Checkout::capture();
    });
});

// ── Services (provisioning module commands) ────────────────────────────

$wabekService = function (string $event, $vars, bool $credentials = false) {
    $p = isset($vars['params']) && is_array($vars['params']) ? $vars['params'] : [];
    if (!empty($p['addonId'])) {
        return; // product addons are not reported as services
    }
    $id = (int) ($p['serviceid'] ?? 0);
    if ($id > 0) {
        Notifier::client($event, Context::service($id, $credentials), 'service:' . $id);
    }
};

add_hook('AfterModuleCreate', 1, function ($vars) use ($wabekService) {
    wabek_safe('AfterModuleCreate', function () use ($vars, $wabekService) {
        $wabekService('service_activated', $vars, true);
    });
});
add_hook('AfterModuleSuspend', 1, function ($vars) use ($wabekService) {
    wabek_safe('AfterModuleSuspend', function () use ($vars, $wabekService) {
        $wabekService('service_suspended', $vars);
    });
});
add_hook('AfterModuleUnsuspend', 1, function ($vars) use ($wabekService) {
    wabek_safe('AfterModuleUnsuspend', function () use ($vars, $wabekService) {
        $wabekService('service_unsuspended', $vars);
    });
});
add_hook('AfterModuleTerminate', 1, function ($vars) use ($wabekService) {
    wabek_safe('AfterModuleTerminate', function () use ($vars, $wabekService) {
        $wabekService('service_terminated', $vars);
    });
});

// ── Support ────────────────────────────────────────────────────────────

add_hook('TicketOpen', 1, function ($vars) {
    wabek_safe('TicketOpen', function () use ($vars) {
        $id = (int) ($vars['ticketid'] ?? 0);
        if ($id <= 0) {
            return;
        }
        $ctx = Context::ticket($id);
        Notifier::client('ticket_opened', $ctx, 'ticket:' . $id, 'ticket_opened:' . $id);
        Notifier::admins('admin_new_ticket', $ctx, 'ticket:' . $id);
    });
});

add_hook('TicketAdminReply', 1, function ($vars) {
    wabek_safe('TicketAdminReply', function () use ($vars) {
        $id = (int) ($vars['ticketid'] ?? 0);
        $replyId = (int) ($vars['replyid'] ?? 0);
        if ($id > 0) {
            Notifier::client('ticket_reply', Context::ticket($id), 'ticket:' . $id,
                $replyId > 0 ? 'ticket_reply:' . $id . ':' . $replyId : null);
        }
    });
});

add_hook('TicketStatusChange', 1, function ($vars) {
    wabek_safe('TicketStatusChange', function () use ($vars) {
        $id = (int) ($vars['ticketid'] ?? 0);
        if ($id > 0 && (int) ($vars['adminid'] ?? 0) > 0) {
            $ctx = Context::ticket($id);
            if ($ctx && isset($vars['status']) && is_string($vars['status'])) {
                $ctx['ticket_status'] = $vars['status'];
            }
            Notifier::client('ticket_status', $ctx, 'ticket:' . $id);
        }
    });
});

// ── Cron ───────────────────────────────────────────────────────────────

add_hook('DailyCronJob', 1, function () {
    wabek_safe('DailyCronJob', function () {
        Cron::daily();
    });
});

add_hook('AfterCronJob', 1, function () {
    wabek_safe('AfterCronJob', function () {
        Cron::tick();
    });
});

// ── WhatsApp code after client login (otp_mode = login) ────────────────

add_hook('UserLogin', 1, function ($vars) {
    wabek_safe('UserLogin', function () {
        Otp::markLoginPending();
    });
});

add_hook('ClientLogin', 1, function ($vars) {
    wabek_safe('ClientLogin', function () {
        Otp::markLoginPending();
    });
});

add_hook('ClientLogout', 1, function ($vars) {
    wabek_safe('ClientLogout', function () {
        Otp::clearLoginPending();
    });
});

add_hook('ClientAreaPage', 1, function ($vars) {
    wabek_safe('ClientAreaPage', function () use ($vars) {
        if (!Otp::loginPending()) {
            return;
        }
        $clientId = (int) ($_SESSION['uid'] ?? 0);
        if ($clientId <= 0) {
            return;
        }
        $file = (string) ($vars['filename'] ?? '');
        $onVerify = ($_GET['m'] ?? '') === 'wabek' && ($_GET['action'] ?? '') === 'verify';
        // Never interfere with the theme's login / logout / password-reset pages.
        if (in_array($file, ['logout', 'login', 'pwreset', 'password-reset'], true) || $onVerify) {
            return;
        }
        if (Phone::forClient($clientId) === null && Config::bool('otp_skip_no_phone')) {
            Otp::clearLoginPending();
            return;
        }
        header('Location: ' . Config::systemUrl() . 'index.php?m=wabek&action=verify', true, 302);
        exit;
    });
});

// ── Navigation, client-area styles & admin panels ─────────────────────

// Account dropdown (six, twenty-one, Nexus, Lagom 1/2 all build it from this menu).
add_hook('ClientAreaSecondaryNavbar', 1, function ($navbar) {
    wabek_safe('ClientAreaSecondaryNavbar', function () use ($navbar) {
        if (empty($_SESSION['uid']) || !is_object($navbar)) {
            return;
        }
        $account = $navbar->getChild('Account');
        if ($account && !$account->getChild('wabek-whatsapp')) {
            Lang::initForSession(false);
            $account->addChild('wabek-whatsapp', [
                'label' => Lang::t('client_nav'),
                'uri'   => 'index.php?m=wabek',
                'icon'  => Theme::brandIcon('whatsapp'),
                'order' => 75,
            ]);
        }
    });
});

// Sidebar panel on the module's own pages, through the menu API (no raw HTML).
add_hook('ClientAreaPrimarySidebar', 1, function ($sidebar) {
    wabek_safe('ClientAreaPrimarySidebar', function () use ($sidebar) {
        if (empty($_SESSION['uid']) || !is_object($sidebar) || ($_GET['m'] ?? '') !== 'wabek'
            || Otp::loginPending() || $sidebar->getChild('wabek-whatsapp')) {
            return;
        }
        Lang::initForSession(false);
        $verify = ($_GET['action'] ?? '') === 'verify' && Otp::mode() !== 'off';
        $panel = $sidebar->addChild('wabek-whatsapp', [
            'label' => Lang::t('client_nav'),
            'icon'  => Theme::brandIcon('whatsapp'),
            'order' => 10,
        ]);
        $panel->addChild('wabek-preferences', [
            'label'   => Lang::t('client_nav_prefs'),
            'uri'     => 'index.php?m=wabek',
            'order'   => 10,
            'current' => !$verify,
        ]);
        if (Otp::mode() !== 'off') {
            $panel->addChild('wabek-verify', [
                'label'   => Lang::t('client_btn_verify'),
                'uri'     => 'index.php?m=wabek&action=verify',
                'order'   => 20,
                'current' => $verify,
            ]);
        }
        $panel->addChild('wabek-profile', [
            'label' => Lang::t('client_edit_profile'),
            'uri'   => 'clientarea.php?action=details',
            'order' => 30,
        ]);
    });
});

// Scoped stylesheet, only on index.php?m=wabek and the checkout step.
add_hook('ClientAreaHeadOutput', 1, function ($vars) {
    return (string) wabek_safe('ClientAreaHeadOutput', function () use ($vars) {
        $file = (string) ($vars['filename'] ?? '');
        $module = isset($_GET['m']) && is_string($_GET['m']) ? $_GET['m'] : '';
        $step = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : '';
        $onModule = $module === 'wabek';
        $onCheckout = $file === 'cart' && in_array($step, ['view', 'checkout'], true) && Checkout::enabled();
        if (!$onModule && !$onCheckout) {
            return '';
        }
        $root = isset($vars['WEB_ROOT']) && is_string($vars['WEB_ROOT']) ? rtrim($vars['WEB_ROOT'], '/') . '/' : '';
        $href = $root . 'modules/addons/wabek/assets/client.css?v=' . rawurlencode(WABEK_MODULE_VERSION);
        return '<link rel="stylesheet" href="' . Security::e($href) . '">';
    });
});

add_hook('AdminAreaClientSummaryPage', 1, function ($vars) {
    return (string) wabek_safe('AdminAreaClientSummaryPage', function () use ($vars) {
        $clientId = (int) ($vars['userid'] ?? 0);
        if ($clientId <= 0) {
            return '';
        }
        Lang::initForSession(true);
        $phone = Phone::forClient($clientId);
        $state = Consent::state($clientId);
        $consent = $state['opted_out'] ? Lang::t('status_opted_out')
            : ($state['opted_in'] ? Lang::t('status_opted_in') : Lang::t('consent_default'));
        return '<div class="alert alert-info" style="border-inline-start:4px solid #12B5BE">'
            . '<strong>WABEK WhatsApp:</strong> '
            . Security::e($phone !== null ? $phone : Lang::t('err_phone')) . ' · ' . Security::e($consent)
            . ($state['verified_phone'] !== '' && $state['verified_phone'] === $phone ? ' · ' . Security::e(Lang::t('client_verified_badge')) : '')
            . ' · <a href="addonmodules.php?module=wabek&page=send&client=' . $clientId . '">' . Security::e(Lang::t('btn_send')) . '</a>'
            . ' · <a href="addonmodules.php?module=wabek&page=log&client=' . $clientId . '">' . Security::e(Lang::t('tab_log')) . '</a>'
            . '</div>';
    });
});
