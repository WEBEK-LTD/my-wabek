<?php
/**
 * WABEK — WhatsApp notifications for WHMCS.
 *
 * Addon module entry points. Business logic lives in lib/ (WABEK\ namespace).
 *
 * @copyright WEBEK LTD
 * @link      https://waabek.com
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

require_once __DIR__ . '/bootstrap.php';

use WABEK\Admin\AdminController;
use WABEK\Client\ClientController;
use WABEK\Schema;
use WHMCS\Database\Capsule;

function wabek_config()
{
    return [
        'name'        => 'WABEK WhatsApp',
        'description' => 'WhatsApp notifications, reminders, admin alerts, bulk messages and WhatsApp verification codes for WHMCS, powered by WABEK.'
            . ' / إشعارات واتساب وتذكيرات وتنبيهات للإدارة ورسائل جماعية ورموز تحقق عبر واتساب، بواسطة WABEK.',
        'version'     => WABEK_MODULE_VERSION,
        'author'      => 'WABEK',
        'language'    => 'english',
        'fields'      => [
            'purge_on_deactivate' => [
                'FriendlyName' => 'Delete data on deactivate',
                'Type'         => 'yesno',
                'Description'  => 'Drop all WABEK tables (settings, templates, send log, consent) when the module is deactivated. Leave unticked to keep data.',
            ],
        ],
    ];
}

function wabek_activate()
{
    try {
        Schema::install();
        return [
            'status'      => 'success',
            'description' => 'WABEK activated. Open Addons → WABEK WhatsApp to enter your API key.',
        ];
    } catch (\Throwable $e) {
        return ['status' => 'error', 'description' => 'WABEK could not create its tables: ' . $e->getMessage()];
    }
}

function wabek_deactivate()
{
    try {
        $purge = (string) Capsule::table('tbladdonmodules')
            ->where('module', 'wabek')->where('setting', 'purge_on_deactivate')->value('value');
        if ($purge === 'on') {
            Schema::uninstall();
            return ['status' => 'success', 'description' => 'WABEK deactivated and its data deleted.'];
        }
        return ['status' => 'success', 'description' => 'WABEK deactivated. Data was kept.'];
    } catch (\Throwable $e) {
        return ['status' => 'error', 'description' => 'WABEK deactivation failed: ' . $e->getMessage()];
    }
}

/** @param array $vars contains 'version' = the previously installed version */
function wabek_upgrade($vars)
{
    $from = isset($vars['version']) ? (string) $vars['version'] : '0';
    try {
        Schema::upgrade($from);
    } catch (\Throwable $e) {
        if (function_exists('logActivity')) {
            logActivity('WABEK upgrade from ' . $from . ' failed: ' . substr($e->getMessage(), 0, 300));
        }
    }
}

function wabek_output($vars)
{
    // WHMCS only routes admins with module access here; double-check the session.
    if (empty($_SESSION['adminid'])) {
        echo 'Access denied';
        return;
    }
    echo (new AdminController((array) $vars))->render();
}

function wabek_clientarea($vars)
{
    return (new ClientController((array) $vars))->handle();
}
