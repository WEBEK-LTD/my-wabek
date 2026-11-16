<?php
/**
 * Abandoned cart reminders.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Captures the billing phone typed at checkout, schedules ONE reminder after
 * the configured delay and cancels it when the customer orders. Respects
 * consent and the My Account opt-out. Off by default.
 */
final class Abandoned_Cart {

	const HOOK   = 'wabek_whatsapp_abandoned_cart';
	const ACTION = 'wabek_wa_capture_cart';

	/**
	 * Table name.
	 *
	 * @return string
	 */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'wabek_wa_carts';
	}

	/**
	 * Registers hooks. The worker and the recovery link stay active even when
	 * the feature is switched off, so links already sent keep working.
	 *
	 * @return void
	 */
	public function register() {
		add_action( self::HOOK, array( __CLASS__, 'send_reminder' ), 10, 1 );
		add_action( 'wp_loaded', array( $this, 'maybe_restore' ), 20 );

		if ( ! Settings::is_on( 'cart_enabled' ) ) {
			return;
		}
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'wp_ajax_' . self::ACTION, array( $this, 'ajax_capture' ) );
		add_action( 'wp_ajax_nopriv_' . self::ACTION, array( $this, 'ajax_capture' ) );
		add_action( 'woocommerce_store_api_cart_update_customer_from_request', array( $this, 'capture_from_store_api' ), 20, 1 );
	}

	/**
	 * Loads the capture script on the classic checkout.
	 *
	 * @return void
	 */
	public function enqueue() {
		if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || is_order_received_page() ) {
			return;
		}
		wp_enqueue_script( 'wabek-wa-checkout', WABEK_WA_URL . 'assets/js/checkout.js', array(), WABEK_WA_VERSION, true );
		wp_localize_script(
			'wabek-wa-checkout',
			'wabekWaCheckout',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'action'  => self::ACTION,
				'nonce'   => wp_create_nonce( self::ACTION ),
				'consent' => Consent::FIELD,
			)
		);
	}

	/**
	 * AJAX: capture from the classic checkout.
	 *
	 * @return void
	 */
	public function ajax_capture() {
		check_ajax_referer( self::ACTION, 'nonce' );
		$phone   = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
		$country = isset( $_POST['country'] ) ? strtoupper( sanitize_key( wp_unslash( $_POST['country'] ) ) ) : '';
		$name    = isset( $_POST['first_name'] ) ? sanitize_text_field( wp_unslash( $_POST['first_name'] ) ) : '';
		$consent = isset( $_POST['consent'] ) && '1' === sanitize_text_field( wp_unslash( $_POST['consent'] ) );
		self::capture( $phone, $country, $name, $consent );
		wp_send_json_success();
	}

	/**
	 * Store API (block checkout) customer update. The block consent field is
	 * only known at order time, so blocks are captured only when consent is
	 * not required.
	 *
	 * @param \WC_Customer $customer Customer.
	 * @return void
	 */
	public function capture_from_store_api( $customer ) {
		if ( self::consent_required() || ! is_object( $customer ) ) {
			return;
		}
		self::capture( (string) $customer->get_billing_phone(), (string) $customer->get_billing_country(), (string) $customer->get_billing_first_name(), true );
	}

	/**
	 * Whether consent is required before messaging.
	 *
	 * @return bool
	 */
	private static function consent_required() {
		return Settings::is_on( 'consent_enabled' ) && Settings::is_on( 'consent_required' );
	}

	/**
	 * Stores the cart and (re)schedules the reminder.
	 *
	 * @param string $phone_raw  Phone as typed.
	 * @param string $country    Billing country.
	 * @param string $first_name First name.
	 * @param bool   $consent    Consent checkbox state.
	 * @return void
	 */
	public static function capture( $phone_raw, $country, $first_name, $consent ) {
		try {
			if ( ! function_exists( 'WC' ) || ! WC()->session || ! WC()->cart || WC()->cart->is_empty() ) {
				return;
			}
			global $wpdb;
			$table       = self::table();
			$session_key = (string) WC()->session->get_customer_id();
			if ( '' === $session_key ) {
				return;
			}
			$existing = $wpdb->get_row( $wpdb->prepare( "SELECT id FROM {$table} WHERE session_key = %s AND status = 'pending' ORDER BY id DESC LIMIT 1", $session_key ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared

			$user_id = get_current_user_id();
			$optout  = $user_id && 'yes' === get_user_meta( $user_id, Consent::USER_OPTOUT, true );
			$e164    = Phone::to_e164( $phone_raw, $country );

			if ( '' === $e164 || $optout || ( self::consent_required() && ! $consent ) ) {
				if ( $existing ) {
					self::set_status( (int) $existing['id'], 'cancelled' );
				}
				return;
			}

			$items = array();
			foreach ( WC()->cart->get_cart() as $item ) {
				$product = isset( $item['data'] ) ? $item['data'] : null;
				$items[] = array(
					'product_id'   => (int) $item['product_id'],
					'variation_id' => isset( $item['variation_id'] ) ? (int) $item['variation_id'] : 0,
					'quantity'     => (int) $item['quantity'],
					'variation'    => isset( $item['variation'] ) && is_array( $item['variation'] ) ? array_map( 'sanitize_text_field', $item['variation'] ) : array(),
					'name'         => $product ? wp_specialchars_decode( $product->get_name(), ENT_QUOTES ) : '',
				);
			}

			$now  = current_time( 'mysql', true );
			$data = array(
				'updated_at' => $now,
				'user_id'    => $user_id,
				'phone'      => $e164,
				'first_name' => substr( $first_name, 0, 100 ),
				'cart'       => wp_json_encode( $items ),
				'cart_total' => substr( Message_Builder::plain( WC()->cart->get_total() ), 0, 64 ),
			);

			if ( $existing ) {
				$id = (int) $existing['id'];
				$wpdb->update( $table, $data, array( 'id' => $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			} else {
				$data['created_at']  = $now;
				$data['session_key'] = $session_key;
				$data['token']       = wp_generate_password( 32, false, false );
				$data['status']      = 'pending';
				$wpdb->insert( $table, $data ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$id = (int) $wpdb->insert_id;
			}
			if ( $id ) {
				self::reschedule( $id );
			}
		} catch ( \Throwable $e ) {
			Logger::diagnostic( 'error', 'Abandoned cart capture failed: ' . $e->getMessage() );
		}
	}

	/**
	 * (Re)schedules the reminder for a cart, delay counted from the last activity.
	 *
	 * @param int $id Cart id.
	 * @return void
	 */
	private static function reschedule( $id ) {
		$delay = max( 15, (int) Settings::get( 'cart_delay' ) ) * MINUTE_IN_SECONDS;
		$args  = array( (int) $id );
		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_unschedule_all_actions( self::HOOK, $args, Queue::GROUP );
			as_schedule_single_action( time() + $delay, self::HOOK, $args, Queue::GROUP );
		} else {
			wp_clear_scheduled_hook( self::HOOK, $args );
			wp_schedule_single_event( time() + $delay, self::HOOK, $args );
		}
	}

	/**
	 * Worker: sends the single reminder.
	 *
	 * @param int $id Cart id.
	 * @return void
	 */
	public static function send_reminder( $id ) {
		global $wpdb;
		$table = self::table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! $row || 'pending' !== $row['status'] ) {
			return;
		}
		if ( ! Settings::is_on( 'cart_enabled' ) || ! Settings::has_api_key() ) {
			self::set_status( (int) $id, 'cancelled' );
			return;
		}
		if ( $row['user_id'] && 'yes' === get_user_meta( (int) $row['user_id'], Consent::USER_OPTOUT, true ) ) {
			self::set_status( (int) $id, 'cancelled' );
			return;
		}

		$items = json_decode( (string) $row['cart'], true );
		$lines = array();
		foreach ( is_array( $items ) ? $items : array() as $item ) {
			$lines[] = '• ' . (int) $item['quantity'] . ' × ' . ( isset( $item['name'] ) ? $item['name'] : '' );
		}
		$values   = array(
			'customer_name' => '' !== $row['first_name'] ? $row['first_name'] : __( 'Customer', 'wabek-whatsapp' ),
			'cart_items'    => implode( "\n", $lines ),
			'cart_total'    => $row['cart_total'],
			'cart_url'      => add_query_arg(
				array(
					'wabek_wa_cart' => (int) $row['id'],
					'k'             => $row['token'],
				),
				wc_get_cart_url()
			),
			'site_name'     => Message_Builder::site_name(),
		);
		$template = (string) Settings::get( 'cart_message' );
		if ( '' === trim( $template ) ) {
			$template = Settings::default_cart_message();
		}

		// Claim before queueing so a duplicate job cannot send twice.
		$claimed = $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'reminded', updated_at = %s WHERE id = %d AND status = 'pending'", current_time( 'mysql', true ), $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( 1 !== (int) $claimed ) {
			return;
		}
		Queue::enqueue(
			array(
				'event'           => 'abandoned_cart',
				'order_id'        => 0,
				'phone'           => $row['phone'],
				'message'         => Message_Builder::render( $template, $values ),
				'template'        => (string) Settings::get( 'cart_template' ),
				'template_params' => Message_Builder::template_params( (string) Settings::get( 'cart_template_params' ), $values ),
			)
		);
	}

	/**
	 * Marks carts of this session / phone as recovered when an order is placed.
	 *
	 * @param \WC_Order $order Order.
	 * @return void
	 */
	public static function mark_recovered( $order ) {
		global $wpdb;
		$table = self::table();
		$now   = current_time( 'mysql', true );
		if ( function_exists( 'WC' ) && WC()->session ) {
			$session_key = (string) WC()->session->get_customer_id();
			if ( '' !== $session_key ) {
				$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'recovered', updated_at = %s WHERE session_key = %s AND status IN ('pending','reminded')", $now, $session_key ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			}
		}
		$phone = Phone::to_e164( $order->get_billing_phone(), $order->get_billing_country() );
		if ( '' !== $phone ) {
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'recovered', updated_at = %s WHERE phone = %s AND status IN ('pending','reminded')", $now, $phone ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
	}

	/**
	 * Restores a cart from the reminder link (?wabek_wa_cart=ID&k=TOKEN).
	 * The random per-cart token authorizes the link; no nonce is possible here.
	 *
	 * @return void
	 */
	public function maybe_restore() {
		if ( empty( $_GET['wabek_wa_cart'] ) || empty( $_GET['k'] ) || is_admin() || wp_doing_ajax() ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		$id    = absint( $_GET['wabek_wa_cart'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$token = sanitize_text_field( wp_unslash( $_GET['k'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		global $wpdb;
		$table = self::table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT id, token, cart, status FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! $row || '' === $row['token'] || ! hash_equals( (string) $row['token'], $token ) ) {
			return;
		}
		if ( function_exists( 'wc_load_cart' ) && ( ! WC()->cart ) ) {
			wc_load_cart();
		}
		if ( WC()->cart && WC()->cart->is_empty() && 'recovered' !== $row['status'] ) {
			$items = json_decode( (string) $row['cart'], true );
			foreach ( is_array( $items ) ? $items : array() as $item ) {
				WC()->cart->add_to_cart( (int) $item['product_id'], max( 1, (int) $item['quantity'] ), (int) $item['variation_id'], is_array( $item['variation'] ) ? $item['variation'] : array() );
			}
		}
		wp_safe_redirect( wc_get_checkout_url() );
		exit;
	}

	/**
	 * Updates a cart status.
	 *
	 * @param int    $id     Cart id.
	 * @param string $status Status.
	 * @return void
	 */
	private static function set_status( $id, $status ) {
		global $wpdb;
		$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			self::table(),
			array(
				'status'     => $status,
				'updated_at' => current_time( 'mysql', true ),
			),
			array( 'id' => $id )
		);
	}

	/**
	 * Daily cleanup: removes carts older than 30 days.
	 *
	 * @return void
	 */
	public static function prune() {
		global $wpdb;
		$table = self::table();
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE updated_at < %s", gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}
}
