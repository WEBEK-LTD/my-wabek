<?php
/**
 * Phone number normalization (E.164).
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Converts free-form phone numbers to E.164 ("+9665XXXXXXXX").
 */
final class Phone {

	/**
	 * Fallback calling codes, used only if WooCommerce cannot provide one.
	 *
	 * @var array
	 */
	private static $fallback_codes = array(
		'SA' => '966',
		'AE' => '971',
		'KW' => '965',
		'QA' => '974',
		'BH' => '973',
		'OM' => '968',
		'EG' => '20',
		'JO' => '962',
		'IQ' => '964',
		'LB' => '961',
		'SY' => '963',
		'PS' => '970',
		'YE' => '967',
		'MA' => '212',
		'DZ' => '213',
		'TN' => '216',
		'LY' => '218',
		'SD' => '249',
		'TR' => '90',
		'GB' => '44',
		'US' => '1',
		'FR' => '33',
		'DE' => '49',
	);

	/**
	 * Normalizes a phone number to E.164.
	 *
	 * @param string $raw     Number as typed by the customer.
	 * @param string $country ISO 3166-1 alpha-2 country (billing country); the store base country is used when empty.
	 * @return string E.164 number with leading "+", or '' when the number is not valid.
	 */
	public static function to_e164( $raw, $country = '' ) {
		$raw = trim( (string) $raw );
		if ( '' === $raw ) {
			return '';
		}
		// Arabic-Indic (U+0660..) and Extended Arabic-Indic (U+06F0..) digits -> ASCII.
		$map = array();
		foreach ( array( 0x0660, 0x06F0 ) as $first ) {
			for ( $i = 0; $i < 10; $i++ ) {
				$cp           = $first + $i;
				$char         = chr( 0xC0 | ( $cp >> 6 ) ) . chr( 0x80 | ( $cp & 0x3F ) );
				$map[ $char ] = (string) $i;
			}
		}
		$raw = strtr( $raw, $map );

		$international = ( 0 === strpos( $raw, '+' ) );
		$digits        = preg_replace( '/\D+/', '', $raw );
		if ( '' === $digits ) {
			return '';
		}

		if ( ! $international && 0 === strpos( $digits, '00' ) ) {
			$digits        = substr( $digits, 2 );
			$international = true;
		}

		if ( ! $international ) {
			$code = self::calling_code( $country );
			if ( '' === $code ) {
				return '';
			}
			$national = ltrim( $digits, '0' );
			// Already written with the country code but without "+" (e.g. 9665XXXXXXXX).
			if ( 0 === strpos( $digits, $code ) && strlen( $digits ) - strlen( $code ) >= 8 && strlen( $digits ) <= 15 ) {
				$national = substr( $digits, strlen( $code ) );
			}
			$digits = $code . $national;
		}

		$digits = ltrim( $digits, '0' );
		if ( strlen( $digits ) < 8 || strlen( $digits ) > 15 ) {
			return '';
		}

		/**
		 * Filters the normalized E.164 number (return '' to skip sending).
		 *
		 * @param string $e164    Normalized number.
		 * @param string $raw     Original input.
		 * @param string $country Country used.
		 */
		return (string) apply_filters( 'wabek_whatsapp_normalize_phone', '+' . $digits, $raw, $country );
	}

	/**
	 * E.164 number without "+" (what the WABEK API expects in `to`).
	 *
	 * @param string $e164 E.164 number.
	 * @return string
	 */
	public static function digits( $e164 ) {
		return preg_replace( '/\D+/', '', (string) $e164 );
	}

	/**
	 * Masks a number for display: +9665••••5678.
	 *
	 * @param string $phone Phone number.
	 * @return string
	 */
	public static function mask( $phone ) {
		$digits = self::digits( $phone );
		$len    = strlen( $digits );
		if ( $len < 7 ) {
			return $len ? str_repeat( '•', $len ) : '';
		}
		return '+' . substr( $digits, 0, 4 ) . str_repeat( '•', $len - 8 > 0 ? $len - 8 : 1 ) . substr( $digits, -4 );
	}

	/**
	 * Calling code for a country (store base country when empty).
	 *
	 * @param string $country ISO alpha-2 code.
	 * @return string Digits only, or ''.
	 */
	public static function calling_code( $country = '' ) {
		$country = strtoupper( (string) $country );
		if ( '' === $country ) {
			$country = strtoupper( (string) Settings::get( 'default_country' ) );
		}
		if ( '' === $country && function_exists( 'WC' ) && WC()->countries ) {
			$country = WC()->countries->get_base_country();
		}
		if ( '' === $country ) {
			return '';
		}
		$code = '';
		if ( function_exists( 'WC' ) && WC()->countries && method_exists( WC()->countries, 'get_country_calling_code' ) ) {
			$code = WC()->countries->get_country_calling_code( $country );
			if ( is_array( $code ) ) {
				$code = reset( $code );
			}
		}
		if ( '' === (string) $code && isset( self::$fallback_codes[ $country ] ) ) {
			$code = self::$fallback_codes[ $country ];
		}
		return preg_replace( '/\D+/', '', (string) $code );
	}

	/**
	 * Common stored spellings of a number, used to find a user by phone.
	 *
	 * @param string $e164 E.164 number.
	 * @return string[]
	 */
	public static function variants( $e164 ) {
		$digits   = self::digits( $e164 );
		$variants = array( '+' . $digits, $digits, '00' . $digits );
		$code     = self::calling_code();
		if ( '' !== $code && 0 === strpos( $digits, $code ) ) {
			$national   = substr( $digits, strlen( $code ) );
			$variants[] = $national;
			$variants[] = '0' . $national;
		}
		return array_values( array_unique( $variants ) );
	}
}
