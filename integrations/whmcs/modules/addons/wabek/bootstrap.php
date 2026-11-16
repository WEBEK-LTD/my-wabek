<?php
/**
 * WABEK for WHMCS — PSR-4 autoloader for the WABEK\ namespace (lib/).
 *
 * Included by wabek.php and hooks.php. Safe to include more than once.
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

if (!defined('WABEK_MODULE_DIR')) {
    define('WABEK_MODULE_DIR', __DIR__);
    define('WABEK_MODULE_VERSION', '4.1.0');

    spl_autoload_register(static function ($class) {
        $prefix = 'WABEK\\';
        if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
            return;
        }
        $relative = substr($class, strlen($prefix));
        // Only plain class names: no traversal, no odd characters.
        if (!preg_match('/^[A-Za-z0-9_\\\\]+$/', $relative)) {
            return;
        }
        $file = WABEK_MODULE_DIR . '/lib/' . str_replace('\\', '/', $relative) . '.php';
        if (is_file($file)) {
            require_once $file;
        }
    });
}
