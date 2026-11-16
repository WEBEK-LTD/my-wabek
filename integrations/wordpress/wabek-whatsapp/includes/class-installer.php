<?php
/**
 * Activation, deactivation and schema upgrades.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Creates the plugin tables with dbDelta and schedules housekeeping.
 */
final class Installer {

	const DB_VERSION        = '1.0.0';
	const DB_VERSION_OPTION = 'wabek_whatsapp_db_version';
	const DAILY_HOOK        = 'wabek_whatsapp_daily';

	/**
	 * Activation hook.
	 *
	 * @return void
	 */
	public static function activate() {
		self::install();
		self::import_legacy_settings();
		if ( ! wp_next_scheduled( self::DAILY_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::DAILY_HOOK );
		}
	}

	/**
	 * One-time import of the connection settings of the previous WABEK plugin
	 * (waabek-woocommerce), so upgrading users do not need to paste the key again.
	 * Only runs when this plugin has no API key yet.
	 *
	 * @return void
	 */
	private static function import_legacy_settings() {
		if ( Settings::has_api_key() || get_option( 'wabek_whatsapp_legacy_imported' ) ) {
			return;
		}
		update_option( 'wabek_whatsapp_legacy_imported', 1, false );

		$key = trim( (string) get_option( 'waabek_api_key', '' ) );
		if ( '' === $key || strlen( $key ) > 256 ) {
			return;
		}
		Settings::set_api_key( preg_replace( '/\s+/', '', sanitize_text_field( $key ) ) );

		$values = array();
		$url    = esc_url_raw( (string) get_option( 'waabek_api_url', '' ) );
		if ( '' !== $url && Api_Client::is_allowed_base( $url ) ) {
			$values['api_url'] = untrailingslashit( $url );
		}
		$instance = sanitize_text_field( (string) get_option( 'waabek_instance_id', '' ) );
		if ( preg_match( '/^[A-Za-z0-9_-]{1,64}$/', $instance ) ) {
			$values['instance_id'] = $instance;
		}
		$admin_phone = Phone::to_e164( sanitize_text_field( (string) get_option( 'waabek_admin_phone', '' ) ) );
		if ( '' !== $admin_phone ) {
			$values['admin_phone'] = $admin_phone;
			$values['admin_alert'] = '1' === (string) get_option( 'waabek_admin_notify', '0' ) ? 'yes' : 'no';
		}
		if ( $values ) {
			Settings::update( $values );
		}
	}

	/**
	 * Deactivation hook: removes scheduled jobs (data is kept until uninstall).
	 *
	 * @return void
	 */
	public static function deactivate() {
		wp_clear_scheduled_hook( self::DAILY_HOOK );
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( '', array(), Queue::GROUP );
		}
		wp_clear_scheduled_hook( Queue::SEND_HOOK );
		wp_clear_scheduled_hook( Abandoned_Cart::HOOK );
	}

	/**
	 * Runs the installer when the stored schema version is older (covers
	 * updates and multisite sites activated network-wide).
	 *
	 * @return void
	 */
	public static function maybe_upgrade() {
		if ( get_option( self::DB_VERSION_OPTION ) !== self::DB_VERSION ) {
			self::install();
		}
		if ( ! wp_next_scheduled( self::DAILY_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::DAILY_HOOK );
		}
	}

	/**
	 * Creates or updates the custom tables.
	 *
	 * @return void
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$log     = Logger::table();
		$carts   = Abandoned_Cart::table();

		dbDelta(
			"CREATE TABLE {$log} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				order_id bigint(20) unsigned NOT NULL DEFAULT 0,
				event varchar(40) NOT NULL DEFAULT '',
				phone varchar(32) NOT NULL DEFAULT '',
				message longtext NOT NULL,
				template varchar(128) NOT NULL DEFAULT '',
				template_params text NOT NULL,
				status varchar(20) NOT NULL DEFAULT 'queued',
				attempts tinyint(3) unsigned NOT NULL DEFAULT 0,
				http_code smallint(5) unsigned NOT NULL DEFAULT 0,
				error text NOT NULL,
				message_id varchar(191) NOT NULL DEFAULT '',
				PRIMARY KEY  (id),
				KEY order_id (order_id),
				KEY status (status)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$carts} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				session_key varchar(191) NOT NULL DEFAULT '',
				user_id bigint(20) unsigned NOT NULL DEFAULT 0,
				phone varchar(32) NOT NULL DEFAULT '',
				first_name varchar(100) NOT NULL DEFAULT '',
				cart longtext NOT NULL,
				cart_total varchar(64) NOT NULL DEFAULT '',
				token varchar(64) NOT NULL DEFAULT '',
				status varchar(20) NOT NULL DEFAULT 'pending',
				PRIMARY KEY  (id),
				KEY session_key (session_key),
				KEY phone (phone),
				KEY status (status)
			) {$charset};"
		);

		update_option( self::DB_VERSION_OPTION, self::DB_VERSION, true ); // Autoloaded: read on every request.
	}
}
