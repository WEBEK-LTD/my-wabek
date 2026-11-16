<?php
/**
 * Uninstall: removes every option, table, scheduled job and transient the
 * plugin created (on every site of a multisite network).
 *
 * @package Wabek\WhatsApp
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Cleans one site. Prefixed to avoid global collisions.
 *
 * @return void
 */
function wabek_whatsapp_uninstall_site() {
	global $wpdb;

	foreach ( array(
		'wabek_whatsapp_settings',
		'wabek_whatsapp_events',
		'wabek_whatsapp_api_key',
		'wabek_whatsapp_instances',
		'wabek_whatsapp_connection',
		'wabek_whatsapp_db_version',
		'wabek_whatsapp_legacy_imported',
		'wabek_whatsapp_site_key',
	) as $option ) {
		delete_option( $option );
	}

	wp_clear_scheduled_hook( 'wabek_whatsapp_daily' );
	wp_clear_scheduled_hook( 'wabek_whatsapp_send' );
	wp_clear_scheduled_hook( 'wabek_whatsapp_abandoned_cart' );
	wp_clear_scheduled_hook( 'wabek_whatsapp_sync_optout' );
	if ( function_exists( 'as_unschedule_all_actions' ) ) {
		as_unschedule_all_actions( '', array(), 'wabek-whatsapp' );
	}

	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}wabek_wa_log" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}wabek_wa_carts" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared

	// Rate-limit, OTP and de-duplication transients.
	$like_value   = $wpdb->esc_like( '_transient_wabek_wa_' ) . '%';
	$like_timeout = $wpdb->esc_like( '_transient_timeout_wabek_wa_' ) . '%';
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", $like_value, $like_timeout ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

	// Per-user preferences.
	foreach ( array( 'wabek_wa_optout', 'wabek_wa_consent', 'wabek_wa_phone_e164', 'wabek_wa_phone_verified' ) as $meta_key ) {
		delete_metadata( 'user', 0, $meta_key, '', true );
	}
}

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids' ) ) as $wabek_wa_site_id ) {
		switch_to_blog( $wabek_wa_site_id );
		wabek_whatsapp_uninstall_site();
		restore_current_blog();
	}
} else {
	wabek_whatsapp_uninstall_site();
}
