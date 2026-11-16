<?php
/**
 * Plugin Name:          WABEK WhatsApp for WooCommerce
 * Plugin URI:           https://waabek.com
 * Description:          WhatsApp order notifications, abandoned-cart reminders and WhatsApp OTP login for WooCommerce, powered by the WABEK WhatsApp Business platform.
 * Version:              1.0.0
 * Requires at least:    6.0
 * Requires PHP:         7.4
 * Requires Plugins:     woocommerce
 * Author:               webek.org
 * Author URI:           https://webek.org
 * License:              Proprietary
 * License URI:          https://waabek.com/legal/terms
 * Text Domain:          wabek-whatsapp
 * Domain Path:          /languages
 * WC requires at least: 7.0
 * WC tested up to:      10.3
 *
 * @package Wabek\WhatsApp
 */

defined( 'ABSPATH' ) || exit;

define( 'WABEK_WA_VERSION', '1.0.0' );
define( 'WABEK_WA_FILE', __FILE__ );
define( 'WABEK_WA_DIR', plugin_dir_path( __FILE__ ) );
define( 'WABEK_WA_URL', plugin_dir_url( __FILE__ ) );
define( 'WABEK_WA_BASENAME', plugin_basename( __FILE__ ) );

/*
 * PSR-4-style autoloader for the Wabek\WhatsApp namespace.
 * Wabek\WhatsApp\Admin\Admin_Page -> includes/admin/class-admin-page.php
 */
spl_autoload_register(
	static function ( $class_name ) {
		$prefix = 'Wabek\\WhatsApp\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}
		$relative = substr( $class_name, strlen( $prefix ) );
		$parts    = explode( '\\', $relative );
		$class    = array_pop( $parts );
		$dir      = $parts ? strtolower( implode( '/', $parts ) ) . '/' : '';
		$file     = WABEK_WA_DIR . 'includes/' . $dir . 'class-' . strtolower( str_replace( '_', '-', $class ) ) . '.php';
		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
);

register_activation_hook( __FILE__, array( 'Wabek\\WhatsApp\\Installer', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Wabek\\WhatsApp\\Installer', 'deactivate' ) );

// Declare compatibility with WooCommerce HPOS (custom order tables) and the Cart & Checkout blocks.
add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', WABEK_WA_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', WABEK_WA_FILE, true );
		}
	}
);

add_action( 'plugins_loaded', array( 'Wabek\\WhatsApp\\Plugin', 'instance' ), 20 );
