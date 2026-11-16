<?php
/**
 * Asynchronous sending with retries.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Queues messages through Action Scheduler (bundled with WooCommerce; WP-Cron
 * fallback) so checkout and admin screens never wait on the API.
 *
 * Retry policy: timeouts, network errors and HTTP 5xx are retried with
 * backoff (1, 5, 15 minutes); HTTP 4xx is never retried.
 */
final class Queue {

	const SEND_HOOK = 'wabek_whatsapp_send';
	const GROUP     = 'wabek-whatsapp';

	/**
	 * Delays (seconds) before retry 1, 2, 3.
	 *
	 * @var int[]
	 */
	private static $backoff = array( 60, 300, 900 );

	/**
	 * Registers the worker.
	 *
	 * @return void
	 */
	public function register() {
		add_action( self::SEND_HOOK, array( __CLASS__, 'process' ), 10, 1 );
	}

	/**
	 * Logs and queues a message.
	 *
	 * @param array $row event, phone (E.164), message, order_id, template, template_params.
	 * @return int Log id (0 on failure).
	 */
	public static function enqueue( array $row ) {
		$id = Logger::insert( $row );
		if ( $id ) {
			self::schedule( $id, 0 );
		}
		return $id;
	}

	/**
	 * Schedules a send job.
	 *
	 * @param int $log_id Log id.
	 * @param int $delay  Seconds from now.
	 * @return void
	 */
	public static function schedule( $log_id, $delay ) {
		$args = array( (int) $log_id );
		if ( $delay <= 0 && function_exists( 'as_enqueue_async_action' ) ) {
			as_enqueue_async_action( self::SEND_HOOK, $args, self::GROUP );
		} elseif ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action( time() + max( 0, (int) $delay ), self::SEND_HOOK, $args, self::GROUP );
		} else {
			wp_schedule_single_event( time() + max( 0, (int) $delay ), self::SEND_HOOK, $args );
		}
	}

	/**
	 * Worker: sends one queued message.
	 *
	 * @param int $log_id Log id.
	 * @return void
	 */
	public static function process( $log_id ) {
		$log_id = (int) $log_id;
		if ( ! Logger::claim( $log_id ) ) {
			return; // Already sent, cancelled or picked up by another worker.
		}
		$row = Logger::get( $log_id );
		if ( ! $row ) {
			return;
		}
		$result = self::send_row( $row );
		self::record( $row, $result );
	}

	/**
	 * Sends a row immediately (used by the worker and the admin test button).
	 *
	 * @param array $row Log row.
	 * @return array API result.
	 */
	public static function send_row( array $row ) {
		$client = new Api_Client();
		return $client->send_message(
			Phone::digits( $row['phone'] ),
			(string) $row['message'],
			array(
				'template'        => (string) $row['template'],
				'template_params' => is_array( $row['template_params'] ) ? $row['template_params'] : array(),
			)
		);
	}

	/**
	 * Stores the outcome and schedules a retry when allowed.
	 *
	 * @param array $row    Log row, read after claim() (attempts includes this one).
	 * @param array $result API result.
	 * @return void
	 */
	public static function record( array $row, array $result ) {
		$id       = (int) $row['id'];
		$attempts = (int) $row['attempts']; // Already incremented by claim().

		if ( $result['ok'] ) {
			Logger::update(
				$id,
				array(
					'status'     => 'sent',
					'http_code'  => (int) $result['code'],
					'error'      => '',
					'message_id' => isset( $result['data']['message_id'] ) ? sanitize_text_field( (string) $result['data']['message_id'] ) : '',
				)
			);
			return;
		}

		$retry = $result['retryable'] && $attempts <= count( self::$backoff );
		Logger::update(
			$id,
			array(
				'status'    => $retry ? 'retrying' : 'failed',
				'http_code' => (int) $result['code'],
				'error'     => (string) $result['error'],
			)
		);
		if ( $retry ) {
			self::schedule( $id, self::$backoff[ max( 0, $attempts - 1 ) ] );
		} else {
			Logger::diagnostic( 'warning', sprintf( 'Send #%d (%s to %s) failed: HTTP %d %s', $id, $row['event'], Phone::mask( $row['phone'] ), (int) $result['code'], (string) $result['error'] ) );
		}
	}

	/**
	 * Re-queues a copy of a log row (the "Resend" action).
	 *
	 * @param int $log_id Log id.
	 * @return int New log id (0 on failure).
	 */
	public static function resend( $log_id ) {
		$row = Logger::get( $log_id );
		if ( ! $row || '' === $row['phone'] || '' === $row['message'] ) {
			return 0;
		}
		return self::enqueue(
			array(
				'event'           => $row['event'],
				'order_id'        => (int) $row['order_id'],
				'phone'           => $row['phone'],
				'message'         => $row['message'],
				'template'        => $row['template'],
				'template_params' => $row['template_params'],
			)
		);
	}
}
