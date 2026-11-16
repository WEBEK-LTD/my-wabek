<?php
/**
 * WooCommerce order notifications.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Queues customer messages on order events and the admin new-order alert.
 * Hooks only build the message and queue it; nothing here calls the API.
 */
final class Notifications {

	/**
	 * Order status slug => event key.
	 *
	 * @var array
	 */
	private static $status_events = array(
		'processing' => 'processing',
		'completed'  => 'completed',
		'cancelled'  => 'cancelled',
		'refunded'   => 'refunded',
		'on-hold'    => 'on_hold',
		'failed'     => 'failed',
	);

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'woocommerce_checkout_order_processed', array( $this, 'on_classic_checkout' ), 20, 3 );
		add_action( 'woocommerce_store_api_checkout_order_processed', array( $this, 'on_block_checkout' ), 20, 1 );
		foreach ( self::$status_events as $status => $event ) {
			add_action(
				'woocommerce_order_status_' . $status,
				function ( $order_id, $order = null ) use ( $event ) {
					$this->dispatch( $order ? $order : $order_id, $event );
				},
				20,
				2
			);
		}
		add_action( 'woocommerce_new_customer_note', array( $this, 'on_customer_note' ), 20, 1 );
	}

	/**
	 * Classic checkout.
	 *
	 * @param int            $order_id Order id.
	 * @param array          $posted   Posted data.
	 * @param \WC_Order|null $order    Order.
	 * @return void
	 */
	public function on_classic_checkout( $order_id, $posted = array(), $order = null ) {
		$this->on_new_order( $order ? $order : $order_id );
	}

	/**
	 * Block (Store API) checkout.
	 *
	 * @param \WC_Order $order Order.
	 * @return void
	 */
	public function on_block_checkout( $order ) {
		$this->on_new_order( $order );
	}

	/**
	 * New order: customer message + admin alert, once per order.
	 *
	 * @param \WC_Order|int $order Order or id.
	 * @return void
	 */
	private function on_new_order( $order ) {
		$order = wc_get_order( $order );
		if ( ! $order || $order->get_meta( '_wabek_wa_new_order_queued' ) ) {
			return;
		}
		$order->update_meta_data( '_wabek_wa_new_order_queued', time() );
		$order->save_meta_data();

		$this->dispatch( $order, 'new_order' );
		$this->admin_alert( $order );
		Abandoned_Cart::mark_recovered( $order );
	}

	/**
	 * Note to customer.
	 *
	 * @param array $args order_id, customer_note.
	 * @return void
	 */
	public function on_customer_note( $args ) {
		if ( empty( $args['order_id'] ) ) {
			return;
		}
		$note = isset( $args['customer_note'] ) ? Message_Builder::plain( (string) $args['customer_note'] ) : '';
		$this->dispatch( $args['order_id'], 'customer_note', array( 'customer_note' => $note ), false );
	}

	/**
	 * Builds and queues a customer message. Never throws (checkout must not break).
	 *
	 * @param \WC_Order|int $order  Order or id.
	 * @param string        $event  Event key.
	 * @param array         $extra  Extra variables.
	 * @param bool          $dedupe Skip if the same event was queued for this order in the last minute.
	 * @return void
	 */
	public function dispatch( $order, $event, array $extra = array(), $dedupe = true ) {
		try {
			$order  = wc_get_order( $order );
			$config = Settings::event( $event );
			if ( ! $order || ! $config || 'yes' !== $config['enabled'] || ! Settings::has_api_key() ) {
				return;
			}
			if ( $order instanceof \WC_Order_Refund ) {
				return;
			}

			/**
			 * Filters whether to send an order event message.
			 *
			 * @param bool      $send  Send.
			 * @param string    $event Event key.
			 * @param \WC_Order $order Order.
			 */
			if ( ! apply_filters( 'wabek_whatsapp_send_event', true, $event, $order ) ) {
				return;
			}

			if ( $dedupe ) {
				$lock = 'wabek_wa_d_' . $order->get_id() . '_' . $event;
				if ( get_transient( $lock ) ) {
					return;
				}
				set_transient( $lock, 1, MINUTE_IN_SECONDS );
			}

			$values  = Message_Builder::order_values( $order, $extra );
			$message = Message_Builder::render( $config['message'], $values );
			$phone   = Consent::order_phone( $order );
			$row     = array(
				'event'           => $event,
				'order_id'        => $order->get_id(),
				'phone'           => $phone,
				'message'         => $message,
				'template'        => $config['template'],
				'template_params' => Message_Builder::template_params( $config['template_params'], $values ),
			);

			if ( ! Consent::allows( $order ) ) {
				self::skip( $row, __( 'No WhatsApp consent, or the customer opted out.', 'wabek-whatsapp' ) );
				return;
			}
			if ( '' === $phone ) {
				self::skip( $row, __( 'Missing or invalid phone number.', 'wabek-whatsapp' ) );
				return;
			}
			if ( '' === $message ) {
				return;
			}
			Queue::enqueue( $row );
		} catch ( \Throwable $e ) {
			Logger::diagnostic( 'error', 'Could not queue ' . $event . ': ' . $e->getMessage() );
		}
	}

	/**
	 * Logs a message that was not sent, with the reason.
	 *
	 * @param array  $row    Log row.
	 * @param string $reason Reason shown in the send log.
	 * @return void
	 */
	private static function skip( array $row, $reason ) {
		$row['status'] = 'skipped';
		$row['error']  = $reason;
		Logger::insert( $row );
	}

	/**
	 * Admin WhatsApp alert for a new order.
	 *
	 * @param \WC_Order $order Order.
	 * @return void
	 */
	private function admin_alert( $order ) {
		try {
			if ( ! Settings::is_on( 'admin_alert' ) || ! Settings::has_api_key() ) {
				return;
			}
			$phone = Phone::to_e164( (string) Settings::get( 'admin_phone' ) );
			if ( '' === $phone ) {
				return;
			}
			$template = (string) Settings::get( 'admin_message' );
			if ( '' === trim( $template ) ) {
				$template = Settings::default_admin_message();
			}
			$values = Message_Builder::order_values( $order );
			Queue::enqueue(
				array(
					'event'           => 'admin_new_order',
					'order_id'        => $order->get_id(),
					'phone'           => $phone,
					'message'         => Message_Builder::render( $template, $values ),
					'template'        => '',
					'template_params' => Message_Builder::template_params( '', $values ),
				)
			);
		} catch ( \Throwable $e ) {
			Logger::diagnostic( 'error', 'Could not queue the admin alert: ' . $e->getMessage() );
		}
	}
}
