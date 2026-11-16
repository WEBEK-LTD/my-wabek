<?php
/**
 * HTTP client for the WABEK platform API.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Talks to the WABEK API. The key is sent only in the `X-API-Key` header,
 * TLS is always verified, redirects are not followed (so the key can never be
 * forwarded to another host) and the key is never logged.
 *
 * Every method returns a normalized result array:
 *   ok        bool   2xx response.
 *   code      int    HTTP status (0 for network errors / timeouts).
 *   data      array  Decoded JSON body (empty when not JSON).
 *   error     string Human readable error ('' when ok).
 *   retryable bool   true for timeouts, network errors and 5xx; never for 4xx.
 */
final class Api_Client {

	const TIMEOUT = 15;

	/**
	 * Sends a WhatsApp message: POST /api/v1/send.
	 *
	 * Outside WhatsApp's 24-hour window the platform needs an approved
	 * template; `template` + `template_params` (named body parameters) are
	 * passed when configured, otherwise the platform applies its own fallback.
	 *
	 * @param string $to_digits Recipient, E.164 digits without "+".
	 * @param string $message   Message text.
	 * @param array  $args      Optional: instance_id, template, template_params (array name => value).
	 * @return array
	 */
	public function send_message( $to_digits, $message, array $args = array() ) {
		$body     = array(
			'to'      => $to_digits,
			'message' => $message,
			// Marks this as a notification (not an OTP code) for the platform.
			'type'    => 'notification',
		);
		$instance = isset( $args['instance_id'] ) ? (string) $args['instance_id'] : (string) Settings::get( 'instance_id' );
		if ( '' !== $instance ) {
			$body['instance_id'] = $instance;
		}
		if ( ! empty( $args['template'] ) ) {
			$body['template'] = (string) $args['template'];
			if ( ! empty( $args['template_params'] ) && is_array( $args['template_params'] ) ) {
				$body['template_params'] = $args['template_params'];
			}
		}
		if ( ! empty( $args['template_params']['customer_name'] ) ) {
			$body['customer_name'] = (string) $args['template_params']['customer_name'];
		}
		return $this->request( 'POST', '/api/v1/send', $body );
	}

	/**
	 * Lists the account's WhatsApp instances.
	 *
	 * Tries GET /api/v1/instances, then GET /api/whatsapp/instances (both with
	 * the API key header). A 404 "Unknown action" from /api/v1 still proves the
	 * key is valid, because /api/v1 authenticates before routing.
	 *
	 * @return array Result plus `key_valid` (bool) and `instances` (array|null; null = listing unsupported).
	 */
	public function list_instances() {
		$result = $this->request( 'GET', '/api/v1/instances' );
		if ( $result['ok'] && isset( $result['data']['instances'] ) && is_array( $result['data']['instances'] ) ) {
			return $result + array(
				'key_valid' => true,
				'instances' => self::clean_instances( $result['data']['instances'] ),
			);
		}
		if ( 401 === $result['code'] || 403 === $result['code'] ) {
			return $result + array(
				'key_valid' => false,
				'instances' => null,
			);
		}
		if ( 404 !== $result['code'] ) {
			// Network error / 5xx: the key could not be checked.
			return $result + array(
				'key_valid' => false,
				'instances' => null,
			);
		}

		$fallback = $this->request( 'GET', '/api/whatsapp/instances' );
		if ( $fallback['ok'] && isset( $fallback['data']['instances'] ) && is_array( $fallback['data']['instances'] ) ) {
			return $fallback + array(
				'key_valid' => true,
				'instances' => self::clean_instances( $fallback['data']['instances'] ),
			);
		}
		return array(
			'ok'        => true,
			'code'      => 200,
			'data'      => array(),
			'error'     => '',
			'retryable' => false,
			'key_valid' => true,
			'instances' => null,
		);
	}

	/**
	 * Requests a WhatsApp OTP: POST /api/v1/otp.
	 *
	 * @param string $to_digits Recipient digits.
	 * @param string $purpose   login|verification.
	 * @return array Result; data.otpId on success.
	 */
	public function otp_send( $to_digits, $purpose ) {
		return $this->request(
			'POST',
			'/api/v1/otp',
			array(
				'phone'   => $to_digits,
				'purpose' => $purpose,
			)
		);
	}

	/**
	 * Verifies an OTP: POST /api/v1/otp-verify.
	 *
	 * @param string $otp_id OTP id returned by otp_send.
	 * @param string $code   Code typed by the customer.
	 * @return array Result; data.valid bool.
	 */
	public function otp_verify( $otp_id, $code ) {
		return $this->request(
			'POST',
			'/api/v1/otp-verify',
			array(
				'otp_id' => $otp_id,
				'otp'    => $code,
			)
		);
	}

	/**
	 * Performs a request.
	 *
	 * @param string     $method HTTP method.
	 * @param string     $path   Path beginning with "/".
	 * @param array|null $body   JSON body.
	 * @return array
	 */
	private function request( $method, $path, $body = null ) {
		$key = Settings::api_key();
		if ( '' === $key ) {
			return self::result( false, 0, array(), __( 'The API key is not configured.', 'wabek-whatsapp' ), false );
		}
		$base = Settings::api_url();
		if ( ! self::is_allowed_base( $base ) ) {
			return self::result( false, 0, array(), __( 'The API URL must use HTTPS.', 'wabek-whatsapp' ), false );
		}

		$args = array(
			'method'      => $method,
			'timeout'     => (int) apply_filters( 'wabek_whatsapp_api_timeout', self::TIMEOUT ),
			'redirection' => 0,
			'sslverify'   => true,
			'user-agent'  => 'WABEK-WhatsApp-WordPress/' . WABEK_WA_VERSION,
			'headers'     => array(
				'X-API-Key' => $key,
				'Accept'    => 'application/json',
			),
		);
		if ( null !== $body ) {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body']                    = wp_json_encode( $body );
		}

		$response = wp_remote_request( $base . $path, $args );

		if ( is_wp_error( $response ) ) {
			/* translators: %s: network error message */
			return self::result( false, 0, array(), sprintf( __( 'Could not reach the WABEK API: %s', 'wabek-whatsapp' ), $response->get_error_message() ), true );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		$data = is_array( $data ) ? $data : array();

		if ( $code >= 200 && $code < 300 ) {
			return self::result( true, $code, $data, '', false );
		}
		if ( $code >= 300 && $code < 400 ) {
			return self::result( false, $code, $data, __( 'The API URL redirects to another address. Enter the final URL in the settings.', 'wabek-whatsapp' ), false );
		}

		$error = isset( $data['error'] ) && is_string( $data['error'] ) ? $data['error'] : '';
		if ( isset( $data['detail'] ) && is_string( $data['detail'] ) ) {
			$error .= ( '' !== $error ? ' — ' : '' ) . $data['detail'];
		}
		if ( '' === $error ) {
			/* translators: %d: HTTP status code */
			$error = sprintf( __( 'HTTP error %d', 'wabek-whatsapp' ), $code );
		}
		$error = function_exists( 'mb_substr' ) ? mb_substr( $error, 0, 500 ) : substr( $error, 0, 500 );

		return self::result( false, $code, $data, $error, $code >= 500 );
	}

	/**
	 * Builds a result array.
	 *
	 * @param bool   $ok        Success.
	 * @param int    $code      HTTP code.
	 * @param array  $data      Body.
	 * @param string $error     Error.
	 * @param bool   $retryable Retry allowed.
	 * @return array
	 */
	private static function result( $ok, $code, array $data, $error, $retryable ) {
		return array(
			'ok'        => $ok,
			'code'      => $code,
			'data'      => $data,
			'error'     => $error,
			'retryable' => $retryable,
		);
	}

	/**
	 * Only HTTPS base URLs are accepted (http://localhost can be allowed for
	 * development with the `wabek_whatsapp_allow_insecure_api` filter).
	 *
	 * @param string $url Base URL.
	 * @return bool
	 */
	public static function is_allowed_base( $url ) {
		$scheme = wp_parse_url( $url, PHP_URL_SCHEME );
		if ( 'https' === $scheme ) {
			return true;
		}
		return 'http' === $scheme && (bool) apply_filters( 'wabek_whatsapp_allow_insecure_api', false, $url );
	}

	/**
	 * Keeps only the instance fields the plugin needs.
	 *
	 * @param array $rows Instances from the API.
	 * @return array
	 */
	private static function clean_instances( array $rows ) {
		$out = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) || empty( $row['id'] ) ) {
				continue;
			}
			$type  = isset( $row['instance_type'] ) ? $row['instance_type'] : ( isset( $row['type'] ) ? $row['type'] : '' );
			$out[] = array(
				'id'     => sanitize_text_field( (string) $row['id'] ),
				'name'   => sanitize_text_field( (string) ( ! empty( $row['display_name'] ) ? $row['display_name'] : ( isset( $row['name'] ) ? $row['name'] : '' ) ) ),
				'phone'  => sanitize_text_field( (string) ( isset( $row['phone_number'] ) ? $row['phone_number'] : '' ) ),
				'status' => sanitize_key( (string) ( isset( $row['status'] ) ? $row['status'] : '' ) ),
				'type'   => sanitize_key( (string) $type ),
			);
		}
		return $out;
	}
}
