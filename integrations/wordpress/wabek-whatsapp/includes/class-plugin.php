<?php
/**
 * Plugin bootstrap.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Wires every module into WordPress. Loaded on `plugins_loaded`.
 */
final class Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Returns (and on first call boots) the plugin.
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
			self::$instance->boot();
		}
		return self::$instance;
	}

	/**
	 * Registers hooks for all modules.
	 *
	 * @return void
	 */
	private function boot() {
		add_action( 'init', array( $this, 'load_textdomain' ) );

		Installer::maybe_upgrade();

		if ( is_admin() ) {
			( new Admin\Admin() )->register();
		}

		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', array( $this, 'notice_missing_woocommerce' ) );
			return;
		}

		( new Queue() )->register();
		( new Consent() )->register();
		( new Notifications() )->register();
		( new Abandoned_Cart() )->register();
		( new Otp() )->register();

		add_action( Installer::DAILY_HOOK, array( 'Wabek\\WhatsApp\\Abandoned_Cart', 'prune' ) );
	}

	/**
	 * Loads translations from the plugin's languages directory.
	 *
	 * @return void
	 */
	public function load_textdomain() {
		load_plugin_textdomain( 'wabek-whatsapp', false, dirname( WABEK_WA_BASENAME ) . '/languages' );
	}

	/**
	 * Admin notice shown when WooCommerce is not active.
	 *
	 * @return void
	 */
	public function notice_missing_woocommerce() {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}
		echo '<div class="notice notice-error"><p>' . esc_html__( 'WABEK WhatsApp requires WooCommerce to be installed and active.', 'wabek-whatsapp' ) . '</p></div>';
	}
}
