<?php
/**
 * Transient-based fixed-window rate limiter.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Counts hits per bucket (phone, IP, ...) inside a time window.
 */
final class Rate_Limiter {

	/**
	 * Records a hit if the bucket is under its limit.
	 *
	 * @param string $bucket Bucket name (hashed before use).
	 * @param int    $limit  Max hits per window.
	 * @param int    $window Window length in seconds.
	 * @return bool true when allowed (the hit was counted), false when limited.
	 */
	public static function hit( $bucket, $limit, $window ) {
		$key   = 'wabek_wa_rl_' . md5( $bucket );
		$now   = time();
		$state = get_transient( $key );
		if ( ! is_array( $state ) || empty( $state['reset'] ) || $state['reset'] <= $now ) {
			$state = array(
				'count' => 0,
				'reset' => $now + $window,
			);
		}
		if ( $state['count'] >= $limit ) {
			return false;
		}
		++$state['count'];
		set_transient( $key, $state, max( 1, $state['reset'] - $now ) );
		return true;
	}

	/**
	 * Client IP (REMOTE_ADDR only; forwarded headers are spoofable).
	 *
	 * @return string
	 */
	public static function ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		/**
		 * Filters the client IP used for rate limiting (e.g. behind a trusted proxy).
		 *
		 * @param string $ip IP address.
		 */
		$ip = (string) apply_filters( 'wabek_whatsapp_client_ip', $ip );
		return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '0.0.0.0';
	}
}
