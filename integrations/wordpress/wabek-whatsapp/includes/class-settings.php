<?php
/**
 * Option storage and defaults.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Reads and writes the plugin options.
 *
 * Options:
 * - wabek_whatsapp_settings   General / checkout / cart / OTP settings (array).
 * - wabek_whatsapp_events     Per-event notification settings (array).
 * - wabek_whatsapp_api_key    The WABEK API key (never autoloaded, never printed in full).
 * - wabek_whatsapp_instances  Instances returned by the last connection test.
 * - wabek_whatsapp_connection Result of the last connection test.
 */
final class Settings {

	const OPTION          = 'wabek_whatsapp_settings';
	const EVENTS_OPTION   = 'wabek_whatsapp_events';
	const KEY_OPTION      = 'wabek_whatsapp_api_key';
	const INSTANCES       = 'wabek_whatsapp_instances';
	const CONNECTION      = 'wabek_whatsapp_connection';
	const DEFAULT_API_URL = 'https://waabek.com';

	/**
	 * Request-level cache of the merged settings.
	 *
	 * @var array|null
	 */
	private static $cache = null;

	/**
	 * Default general settings.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'api_url'              => self::DEFAULT_API_URL,
			'instance_id'          => '',
			'default_country'      => '',
			'admin_phone'          => '',
			'admin_alert'          => 'yes',
			'admin_message'        => self::default_admin_message(),
			'consent_enabled'      => 'yes',
			'consent_required'     => 'yes',
			'consent_label'        => '',
			'account_optout'       => 'yes',
			'cart_enabled'         => 'no',
			'cart_delay'           => 60,
			'cart_message'         => self::default_cart_message(),
			'cart_template'        => '',
			'cart_template_params' => 'customer_name',
			'template_language'    => 'ar',
			'template_style'       => 'named',
			'otp_login'            => 'no',
			'otp_register'         => 'no',
			'otp_phone_limit'      => 3,
			'otp_ip_limit'         => 10,
		);
	}

	/**
	 * Returns all general settings merged with defaults.
	 *
	 * @return array
	 */
	public static function all() {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION, array() );
			self::$cache = wp_parse_args( is_array( $stored ) ? $stored : array(), self::defaults() );
		}
		return self::$cache;
	}

	/**
	 * Returns one general setting.
	 *
	 * @param string $key Setting key.
	 * @return mixed
	 */
	public static function get( $key ) {
		$all = self::all();
		return isset( $all[ $key ] ) ? $all[ $key ] : null;
	}

	/**
	 * Whether a yes/no setting is on.
	 *
	 * @param string $key Setting key.
	 * @return bool
	 */
	public static function is_on( $key ) {
		return 'yes' === self::get( $key );
	}

	/**
	 * Merges and saves general settings.
	 *
	 * @param array $values Sanitized values.
	 * @return void
	 */
	public static function update( array $values ) {
		$stored = get_option( self::OPTION, array() );
		$stored = array_merge( is_array( $stored ) ? $stored : array(), $values );
		update_option( self::OPTION, $stored, true );
		self::$cache = null;
	}

	/**
	 * API base URL without trailing slash.
	 *
	 * @return string
	 */
	public static function api_url() {
		$url = untrailingslashit( (string) self::get( 'api_url' ) );
		return '' !== $url ? $url : self::DEFAULT_API_URL;
	}

	/**
	 * The stored API key (raw). Only the API client should use this.
	 *
	 * @return string
	 */
	public static function api_key() {
		return (string) get_option( self::KEY_OPTION, '' );
	}

	/**
	 * Whether an API key is configured.
	 *
	 * @return bool
	 */
	public static function has_api_key() {
		return '' !== self::api_key();
	}

	/**
	 * Masked API key for display, e.g. "wbk_••••••••3f9a".
	 *
	 * @return string
	 */
	public static function masked_api_key() {
		$key = self::api_key();
		if ( '' === $key ) {
			return '';
		}
		$len = strlen( $key );
		if ( $len <= 8 ) {
			return str_repeat( '•', 8 );
		}
		$prefix = '';
		$pos    = strpos( $key, '_' );
		if ( false !== $pos && $pos <= 6 ) {
			$prefix = substr( $key, 0, $pos + 1 );
		}
		return $prefix . str_repeat( '•', 8 ) . substr( $key, -4 );
	}

	/**
	 * Stores (or clears) the API key.
	 *
	 * @param string $key Sanitized key; empty string removes it.
	 * @return void
	 */
	public static function set_api_key( $key ) {
		if ( '' === $key ) {
			delete_option( self::KEY_OPTION );
		} else {
			update_option( self::KEY_OPTION, $key, false );
		}
		delete_option( self::CONNECTION );
	}

	/**
	 * The checkout consent label (custom or translated default).
	 *
	 * @return string
	 */
	public static function consent_label() {
		$label = (string) self::get( 'consent_label' );
		return '' !== $label ? $label : __( 'I agree to receive order notifications via WhatsApp', 'wabek-whatsapp' );
	}

	/**
	 * Customer notification events: key => label.
	 *
	 * @return array
	 */
	public static function event_labels() {
		return array(
			'new_order'     => __( 'New order', 'wabek-whatsapp' ),
			'processing'    => __( 'Processing', 'wabek-whatsapp' ),
			'completed'     => __( 'Completed', 'wabek-whatsapp' ),
			'cancelled'     => __( 'Cancelled', 'wabek-whatsapp' ),
			'refunded'      => __( 'Refunded', 'wabek-whatsapp' ),
			'on_hold'       => __( 'On hold', 'wabek-whatsapp' ),
			'failed'        => __( 'Failed', 'wabek-whatsapp' ),
			'customer_note' => __( 'Note to customer', 'wabek-whatsapp' ),
		);
	}

	/**
	 * Labels for every event that can appear in the send log.
	 *
	 * @return array
	 */
	public static function log_event_labels() {
		return self::event_labels() + array(
			'admin_new_order' => __( 'Admin alert: new order', 'wabek-whatsapp' ),
			'abandoned_cart'  => __( 'Abandoned cart', 'wabek-whatsapp' ),
			'test'            => __( 'Test message', 'wabek-whatsapp' ),
		);
	}

	/**
	 * Default per-event settings.
	 *
	 * @return array
	 */
	public static function event_defaults() {
		$enabled  = array(
			'new_order'     => 'yes',
			'processing'    => 'no',
			'completed'     => 'yes',
			'cancelled'     => 'yes',
			'refunded'      => 'yes',
			'on_hold'       => 'no',
			'failed'        => 'no',
			'customer_note' => 'yes',
		);
		$messages = self::default_messages();
		$out      = array();
		foreach ( $enabled as $event => $on ) {
			$out[ $event ] = array(
				'enabled'         => $on,
				'message'         => $messages[ $event ],
				'template'        => '',
				'template_params' => 'customer_name',
			);
		}
		return $out;
	}

	/**
	 * All per-event settings merged with defaults.
	 *
	 * @return array
	 */
	public static function events() {
		$stored   = get_option( self::EVENTS_OPTION, array() );
		$stored   = is_array( $stored ) ? $stored : array();
		$defaults = self::event_defaults();
		$out      = array();
		foreach ( $defaults as $event => $config ) {
			$saved         = isset( $stored[ $event ] ) && is_array( $stored[ $event ] ) ? $stored[ $event ] : array();
			$out[ $event ] = wp_parse_args( $saved, $config );
			if ( '' === trim( (string) $out[ $event ]['message'] ) ) {
				$out[ $event ]['message'] = $config['message'];
			}
		}
		return $out;
	}

	/**
	 * Settings for one event, or null when unknown.
	 *
	 * @param string $event Event key.
	 * @return array|null
	 */
	public static function event( $event ) {
		$events = self::events();
		return isset( $events[ $event ] ) ? $events[ $event ] : null;
	}

	/**
	 * Saves per-event settings.
	 *
	 * @param array $events Sanitized events.
	 * @return void
	 */
	public static function update_events( array $events ) {
		update_option( self::EVENTS_OPTION, $events, false );
	}

	/**
	 * Translatable default message bodies (WhatsApp *bold* formatting).
	 *
	 * @return array
	 */
	public static function default_messages() {
		return array(
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'new_order'     => __( "Hello {customer_name} 👋\nThank you for your order *#{order_id}* from {site_name}.\n\nItems:\n{order_items}\n\nTotal: *{order_total}*\nWe will let you know as soon as it ships.", 'wabek-whatsapp' ),
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'processing'    => __( "Hello {customer_name},\nYour order *#{order_id}* is now being processed. We will notify you when it ships.\n{site_name}", 'wabek-whatsapp' ),
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'completed'     => __( "Hello {customer_name} 🎉\nYour order *#{order_id}* has been completed.\n{tracking_url}\nThank you for shopping with {site_name}.", 'wabek-whatsapp' ),
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'cancelled'     => __( "Hello {customer_name},\nYour order *#{order_id}* has been cancelled. If this is unexpected, please reply to this message.\n{site_name}", 'wabek-whatsapp' ),
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'refunded'      => __( "Hello {customer_name},\nYour order *#{order_id}* has been refunded ({order_total}).\n{site_name}", 'wabek-whatsapp' ),
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'on_hold'       => __( "Hello {customer_name},\nYour order *#{order_id}* is on hold until we confirm your payment.\n{site_name}", 'wabek-whatsapp' ),
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'failed'        => __( "Hello {customer_name},\nThe payment for your order *#{order_id}* did not go through. You can try again here:\n{payment_url}\n{site_name}", 'wabek-whatsapp' ),
			/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
			'customer_note' => __( "Hello {customer_name},\nA new note was added to your order *#{order_id}*:\n\n{customer_note}\n\n{site_name}", 'wabek-whatsapp' ),
		);
	}

	/**
	 * Default admin alert.
	 *
	 * @return string
	 */
	public static function default_admin_message() {
		/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
		return __( "🛒 New order *#{order_id}* on {site_name}\nCustomer: {customer_name} ({customer_phone})\nTotal: *{order_total}*\n\n{order_items}", 'wabek-whatsapp' );
	}

	/**
	 * Default abandoned-cart reminder.
	 *
	 * @return string
	 */
	public static function default_cart_message() {
		/* translators: Default WhatsApp message. Keep the {placeholders} unchanged. */
		return __( "Hello {customer_name} 👋\nYou left some items in your cart at {site_name}:\n{cart_items}\n\nComplete your order here:\n{cart_url}", 'wabek-whatsapp' );
	}

	/**
	 * Parses a comma-separated list of template parameter names.
	 *
	 * @param string $raw Raw list, e.g. "customer_name, order_id".
	 * @return string[]
	 */
	public static function parse_param_names( $raw ) {
		$names = array();
		foreach ( explode( ',', (string) $raw ) as $name ) {
			$name = strtolower( trim( $name, " \t\n\r\0\x0B{}" ) );
			if ( '' !== $name && preg_match( '/^[a-z0-9_]{1,64}$/', $name ) ) {
				$names[] = $name;
			}
		}
		return array_values( array_unique( $names ) );
	}
}
