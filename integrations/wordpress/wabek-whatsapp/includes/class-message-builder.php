<?php
/**
 * Message variables and rendering.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Builds the variable map for an order and renders message templates.
 */
final class Message_Builder {

	/**
	 * Variables available in order messages: name => description.
	 *
	 * @return array
	 */
	public static function order_variables() {
		return array(
			'customer_name'    => __( 'Customer first name', 'wabek-whatsapp' ),
			'order_id'         => __( 'Order number', 'wabek-whatsapp' ),
			'order_total'      => __( 'Order total', 'wabek-whatsapp' ),
			'order_status'     => __( 'Order status', 'wabek-whatsapp' ),
			'order_items'      => __( 'Item list', 'wabek-whatsapp' ),
			'shipping_address' => __( 'Shipping address', 'wabek-whatsapp' ),
			'tracking_url'     => __( 'Tracking link', 'wabek-whatsapp' ),
			'site_name'        => __( 'Store name', 'wabek-whatsapp' ),
			'payment_url'      => __( 'Payment link', 'wabek-whatsapp' ),
			'customer_note'    => __( 'Note to customer', 'wabek-whatsapp' ),
			'customer_phone'   => __( 'Customer phone', 'wabek-whatsapp' ),
		);
	}

	/**
	 * Variables available in the abandoned-cart reminder.
	 *
	 * @return array
	 */
	public static function cart_variables() {
		return array(
			'customer_name' => __( 'Customer first name', 'wabek-whatsapp' ),
			'cart_items'    => __( 'Item list', 'wabek-whatsapp' ),
			'cart_total'    => __( 'Cart total', 'wabek-whatsapp' ),
			'cart_url'      => __( 'Cart recovery link', 'wabek-whatsapp' ),
			'site_name'     => __( 'Store name', 'wabek-whatsapp' ),
		);
	}

	/**
	 * Values of all order variables.
	 *
	 * @param \WC_Order $order Order.
	 * @param array     $extra Additional variables (e.g. customer_note).
	 * @return array name => plain-text value
	 */
	public static function order_values( $order, array $extra = array() ) {
		$name = trim( (string) $order->get_billing_first_name() );
		if ( '' === $name ) {
			$name = trim( (string) $order->get_shipping_first_name() );
		}
		if ( '' === $name ) {
			$name = __( 'Customer', 'wabek-whatsapp' );
		}

		$values = array(
			'customer_name'    => $name,
			'order_id'         => (string) $order->get_order_number(),
			'order_total'      => self::plain( $order->get_formatted_order_total() ),
			'order_status'     => wc_get_order_status_name( $order->get_status() ),
			'order_items'      => self::order_items( $order ),
			'shipping_address' => self::plain( str_replace( array( '<br/>', '<br>', '<br />' ), "\n", (string) $order->get_formatted_shipping_address() ) ),
			'tracking_url'     => self::tracking_url( $order ),
			'site_name'        => self::site_name(),
			'payment_url'      => $order->needs_payment() ? $order->get_checkout_payment_url() : '',
			'customer_note'    => '',
			'customer_phone'   => (string) $order->get_billing_phone(),
		);

		$values = array_merge( $values, $extra );

		/**
		 * Filters the variables used in an order message.
		 *
		 * @param array     $values Variables.
		 * @param \WC_Order $order  Order.
		 */
		return (array) apply_filters( 'wabek_whatsapp_order_variables', $values, $order );
	}

	/**
	 * Replaces {variables} in a template. Unknown variables are left as-is;
	 * lines that end up empty after replacing an empty variable are removed.
	 *
	 * @param string $template Message template.
	 * @param array  $values   Variables.
	 * @return string
	 */
	public static function render( $template, array $values ) {
		$map = array();
		foreach ( $values as $key => $value ) {
			$map[ '{' . $key . '}' ] = (string) $value;
		}
		$lines = explode( "\n", str_replace( "\r\n", "\n", (string) $template ) );
		$out   = array();
		foreach ( $lines as $line ) {
			$rendered = strtr( $line, $map );
			if ( '' !== trim( $line ) && '' === trim( $rendered ) ) {
				continue;
			}
			$out[] = $rendered;
		}
		return trim( preg_replace( "/\n{3,}/", "\n\n", implode( "\n", $out ) ) );
	}

	/**
	 * Template parameters for an approved WhatsApp template.
	 *
	 * @param string $names  Comma-separated variable names.
	 * @param array  $values Variables.
	 * @return array name => value (always includes customer_name).
	 */
	public static function template_params( $names, array $values ) {
		$params = array();
		foreach ( Settings::parse_param_names( $names ) as $name ) {
			$value = isset( $values[ $name ] ) ? (string) $values[ $name ] : '';
			// Meta rejects newlines/tabs and long runs of spaces in parameters.
			$value           = trim( preg_replace( '/\s{2,}|[\r\n\t]+/', ' ', $value ) );
			$params[ $name ] = '' !== $value ? $value : '-';
		}
		if ( ! isset( $params['customer_name'] ) && ! empty( $values['customer_name'] ) ) {
			$params['customer_name'] = (string) $values['customer_name'];
		}
		return $params;
	}

	/**
	 * Store name as plain text.
	 *
	 * @return string
	 */
	public static function site_name() {
		return wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES );
	}

	/**
	 * Converts HTML (prices, addresses) to plain text.
	 *
	 * @param string $html HTML.
	 * @return string
	 */
	public static function plain( $html ) {
		$text = html_entity_decode( wp_strip_all_tags( (string) $html ), ENT_QUOTES, 'UTF-8' );
		return trim( preg_replace( '/[ \t]+/', ' ', $text ) );
	}

	/**
	 * "• 2 × Product" lines.
	 *
	 * @param \WC_Order $order Order.
	 * @return string
	 */
	private static function order_items( $order ) {
		$lines = array();
		foreach ( $order->get_items() as $item ) {
			$lines[] = '• ' . $item->get_quantity() . ' × ' . wp_specialchars_decode( $item->get_name(), ENT_QUOTES );
		}
		return implode( "\n", $lines );
	}

	/**
	 * Tracking link from common shipment-tracking plugins.
	 *
	 * @param \WC_Order $order Order.
	 * @return string
	 */
	private static function tracking_url( $order ) {
		$url = (string) $order->get_meta( '_wabek_tracking_url' );

		if ( '' === $url ) {
			// WooCommerce Shipment Tracking / Advanced Shipment Tracking.
			$items = $order->get_meta( '_wc_shipment_tracking_items' );
			if ( is_array( $items ) ) {
				foreach ( array_reverse( $items ) as $item ) {
					if ( ! empty( $item['custom_tracking_link'] ) ) {
						$url = (string) $item['custom_tracking_link'];
						break;
					}
					if ( ! empty( $item['formatted_tracking_link'] ) ) {
						$url = (string) $item['formatted_tracking_link'];
						break;
					}
				}
			}
		}

		/**
		 * Filters the tracking URL used in messages.
		 *
		 * @param string    $url   Tracking URL ('' when unknown).
		 * @param \WC_Order $order Order.
		 */
		$url = (string) apply_filters( 'wabek_whatsapp_tracking_url', $url, $order );
		return '' !== $url ? esc_url_raw( $url ) : '';
	}
}
