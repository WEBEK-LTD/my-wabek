<?php
/**
 * Customer consent and opt-out.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Checkout consent checkbox (classic + block checkout), My Account opt-out
 * and the rule that decides whether a customer may be messaged.
 */
final class Consent {

	const FIELD       = 'wabek_wa_consent';
	const BLOCK_FIELD = 'wabek-whatsapp/consent';
	const ORDER_META  = '_wabek_wa_consent';
	const PHONE_META  = '_wabek_wa_phone';
	const USER_OPTOUT = 'wabek_wa_optout';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register() {
		if ( Settings::is_on( 'consent_enabled' ) ) {
			add_action( 'woocommerce_after_checkout_billing_form', array( $this, 'render_checkout_field' ) );
			add_action( 'woocommerce_init', array( $this, 'register_block_field' ) );
		}
		add_action( 'woocommerce_checkout_create_order', array( $this, 'save_classic' ), 10, 1 );
		add_action( 'woocommerce_store_api_checkout_update_order_from_request', array( $this, 'save_block' ), 20, 1 );
		add_action( 'woocommerce_admin_order_data_after_billing_address', array( $this, 'render_admin_order' ) );

		if ( Settings::is_on( 'account_optout' ) ) {
			add_action( 'woocommerce_edit_account_form', array( $this, 'render_account_field' ) );
			add_action( 'woocommerce_save_account_details', array( $this, 'save_account_field' ) );
		}
	}

	/**
	 * Classic checkout checkbox.
	 *
	 * @return void
	 */
	public function render_checkout_field() {
		$checked = 0;
		if ( is_user_logged_in() && 'yes' !== get_user_meta( get_current_user_id(), self::USER_OPTOUT, true ) && 'yes' === get_user_meta( get_current_user_id(), self::FIELD, true ) ) {
			$checked = 1;
		}
		woocommerce_form_field(
			self::FIELD,
			array(
				'type'     => 'checkbox',
				'class'    => array( 'form-row-wide', 'wabek-wa-consent' ),
				'label'    => esc_html( Settings::consent_label() ),
				'required' => false,
			),
			$checked
		);
	}

	/**
	 * Block checkout checkbox (WooCommerce 8.9+ additional checkout fields).
	 *
	 * @return void
	 */
	public function register_block_field() {
		if ( ! function_exists( 'woocommerce_register_additional_checkout_field' ) ) {
			return;
		}
		try {
			woocommerce_register_additional_checkout_field(
				array(
					'id'       => self::BLOCK_FIELD,
					'label'    => Settings::consent_label(),
					'location' => 'order',
					'type'     => 'checkbox',
				)
			);
		} catch ( \Throwable $e ) {
			Logger::diagnostic( 'warning', 'Could not register the block checkout consent field: ' . $e->getMessage() );
		}
	}

	/**
	 * Saves consent + normalized phone from the classic checkout.
	 * WooCommerce has already verified the checkout nonce at this point.
	 *
	 * @param \WC_Order $order Order being created.
	 * @return void
	 */
	public function save_classic( $order ) {
		$consent = ! empty( $_POST[ self::FIELD ] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$this->store( $order, Settings::is_on( 'consent_enabled' ) ? ( $consent ? 'yes' : 'no' ) : '' );
	}

	/**
	 * Saves consent + normalized phone from the block checkout.
	 *
	 * @param \WC_Order $order Order.
	 * @return void
	 */
	public function save_block( $order ) {
		$value = '';
		if ( Settings::is_on( 'consent_enabled' ) && function_exists( 'woocommerce_register_additional_checkout_field' ) ) {
			$raw   = $order->get_meta( '_wc_other/' . self::BLOCK_FIELD );
			$value = in_array( $raw, array( true, 1, '1', 'yes', 'true' ), true ) ? 'yes' : 'no';
		}
		$this->store( $order, $value );
	}

	/**
	 * Writes consent + phone meta (the caller / WooCommerce saves the order).
	 *
	 * @param \WC_Order $order   Order.
	 * @param string    $consent yes|no|'' (checkbox disabled).
	 * @return void
	 */
	private function store( $order, $consent ) {
		if ( '' !== $consent ) {
			$order->update_meta_data( self::ORDER_META, $consent );
			$user_id = $order->get_customer_id();
			if ( $user_id ) {
				update_user_meta( $user_id, self::FIELD, $consent );
				if ( 'yes' === $consent ) {
					delete_user_meta( $user_id, self::USER_OPTOUT );
				}
			}
		}
		$e164 = Phone::to_e164( $order->get_billing_phone(), $order->get_billing_country() );
		if ( '' !== $e164 ) {
			$order->update_meta_data( self::PHONE_META, $e164 );
		}
	}

	/**
	 * Whether the order's customer may receive WhatsApp notifications.
	 *
	 * @param \WC_Order $order Order.
	 * @return bool
	 */
	public static function allows( $order ) {
		$user_id = $order->get_customer_id();
		if ( $user_id && 'yes' === get_user_meta( $user_id, self::USER_OPTOUT, true ) ) {
			$allowed = false;
		} elseif ( Settings::is_on( 'consent_enabled' ) && Settings::is_on( 'consent_required' ) ) {
			$allowed = 'yes' === self::value( $order );
		} else {
			$allowed = 'no' !== self::value( $order ) || ! Settings::is_on( 'consent_enabled' );
		}

		/**
		 * Filters whether a customer may be messaged about an order.
		 *
		 * @param bool      $allowed Allowed.
		 * @param \WC_Order $order   Order.
		 */
		return (bool) apply_filters( 'wabek_whatsapp_customer_allowed', $allowed, $order );
	}

	/**
	 * Recorded consent: yes|no|'' (not recorded). Reads the block checkout
	 * field directly when our own meta was not written yet.
	 *
	 * @param \WC_Order $order Order.
	 * @return string
	 */
	public static function value( $order ) {
		$value = (string) $order->get_meta( self::ORDER_META );
		if ( '' === $value ) {
			$raw = $order->get_meta( '_wc_other/' . self::BLOCK_FIELD );
			if ( '' !== $raw && null !== $raw ) {
				$value = in_array( $raw, array( true, 1, '1', 'yes', 'true' ), true ) ? 'yes' : 'no';
			}
		}
		return $value;
	}

	/**
	 * Normalized customer phone for an order ('' when invalid).
	 *
	 * @param \WC_Order $order Order.
	 * @return string
	 */
	public static function order_phone( $order ) {
		$e164 = Phone::to_e164( $order->get_billing_phone(), $order->get_billing_country() );
		return '' !== $e164 ? $e164 : (string) $order->get_meta( self::PHONE_META );
	}

	/**
	 * Shows consent status on the order edit screen.
	 *
	 * @param \WC_Order $order Order.
	 * @return void
	 */
	public function render_admin_order( $order ) {
		$value = self::value( $order );
		if ( 'yes' === $value ) {
			$label = __( 'Yes', 'wabek-whatsapp' );
		} elseif ( 'no' === $value ) {
			$label = __( 'No', 'wabek-whatsapp' );
		} else {
			$label = __( 'Not recorded', 'wabek-whatsapp' );
		}
		echo '<p><strong>' . esc_html__( 'WhatsApp notifications consent:', 'wabek-whatsapp' ) . '</strong> ' . esc_html( $label ) . '</p>';
	}

	/**
	 * Opt-out checkbox on My Account → Account details.
	 *
	 * @return void
	 */
	public function render_account_field() {
		$optout = 'yes' === get_user_meta( get_current_user_id(), self::USER_OPTOUT, true );
		echo '<fieldset class="wabek-wa-optout"><legend>' . esc_html__( 'WhatsApp notifications', 'wabek-whatsapp' ) . '</legend>';
		echo '<p class="form-row form-row-wide"><label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">';
		echo '<input type="checkbox" class="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox" name="wabek_wa_optout" value="1" ' . checked( $optout, true, false ) . ' /> ';
		echo '<span>' . esc_html__( 'Do not send me WhatsApp notifications', 'wabek-whatsapp' ) . '</span></label></p></fieldset>';
	}

	/**
	 * Saves the opt-out. WooCommerce verified the account-details nonce before this hook.
	 *
	 * @param int $user_id User id.
	 * @return void
	 */
	public function save_account_field( $user_id ) {
		if ( ! empty( $_POST['wabek_wa_optout'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			update_user_meta( $user_id, self::USER_OPTOUT, 'yes' );
		} else {
			delete_user_meta( $user_id, self::USER_OPTOUT );
		}
	}
}
