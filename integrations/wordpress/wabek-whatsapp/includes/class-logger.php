<?php
/**
 * Send log (custom table, capped to the most recent entries).
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Each row is one outgoing message and doubles as its queue payload.
 */
final class Logger {

	const KEEP = 200;

	/**
	 * Table name.
	 *
	 * @return string
	 */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'wabek_wa_log';
	}

	/**
	 * Inserts a queued message.
	 *
	 * @param array $row event, phone (E.164), message, order_id, template, template_params (array).
	 * @return int Row id (0 on failure).
	 */
	public static function insert( array $row ) {
		global $wpdb;
		$now = current_time( 'mysql', true );
		$ok  = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			self::table(),
			array(
				'created_at'      => $now,
				'updated_at'      => $now,
				'order_id'        => isset( $row['order_id'] ) ? absint( $row['order_id'] ) : 0,
				'event'           => substr( sanitize_key( (string) $row['event'] ), 0, 40 ),
				'phone'           => substr( (string) $row['phone'], 0, 32 ),
				'message'         => (string) $row['message'],
				'template'        => isset( $row['template'] ) ? substr( (string) $row['template'], 0, 128 ) : '',
				'template_params' => wp_json_encode( isset( $row['template_params'] ) ? (array) $row['template_params'] : array() ),
				'status'          => isset( $row['status'] ) ? (string) $row['status'] : 'queued',
				'attempts'        => 0,
				'http_code'       => 0,
				'error'           => isset( $row['error'] ) ? (string) $row['error'] : '',
				'message_id'      => '',
			),
			array( '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s' )
		);
		$id  = $ok ? (int) $wpdb->insert_id : 0;
		self::prune();
		return $id;
	}

	/**
	 * Fetches one row.
	 *
	 * @param int $id Row id.
	 * @return array|null
	 */
	public static function get( $id ) {
		global $wpdb;
		$table = self::table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! $row ) {
			return null;
		}
		$params                 = json_decode( (string) $row['template_params'], true );
		$row['template_params'] = is_array( $params ) ? $params : array();
		return $row;
	}

	/**
	 * Atomically moves a row from queued/retrying to sending.
	 *
	 * @param int $id Row id.
	 * @return bool true when this process owns the send.
	 */
	public static function claim( $id ) {
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'sending', attempts = attempts + 1, updated_at = %s WHERE id = %d AND status IN ('queued','retrying')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				current_time( 'mysql', true ),
				$id
			)
		);
		return 1 === (int) $rows;
	}

	/**
	 * Updates the outcome of a row.
	 *
	 * @param int   $id     Row id.
	 * @param array $fields status, http_code, error, message_id.
	 * @return void
	 */
	public static function update( $id, array $fields ) {
		global $wpdb;
		$allowed = array(
			'status'     => '%s',
			'http_code'  => '%d',
			'error'      => '%s',
			'message_id' => '%s',
			'delivery'   => '%s',
		);
		$data    = array( 'updated_at' => current_time( 'mysql', true ) );
		$formats = array( '%s' );
		foreach ( $allowed as $key => $format ) {
			if ( array_key_exists( $key, $fields ) ) {
				$data[ $key ] = 'error' === $key ? substr( (string) $fields[ $key ], 0, 1000 ) : $fields[ $key ];
				$formats[]    = $format;
			}
		}
		$wpdb->update( self::table(), $data, array( 'id' => (int) $id ), $formats, array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}

	/**
	 * Most recent rows for the log screen.
	 *
	 * @param string $status Optional status filter.
	 * @return array
	 */
	public static function recent( $status = '' ) {
		global $wpdb;
		$table = self::table();
		if ( '' !== $status ) {
			$sql = $wpdb->prepare( "SELECT id, created_at, order_id, event, phone, status, attempts, http_code, error, message_id, delivery FROM {$table} WHERE status = %s ORDER BY id DESC LIMIT %d", $status, self::KEEP ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		} else {
			$sql = $wpdb->prepare( "SELECT id, created_at, order_id, event, phone, status, attempts, http_code, error, message_id, delivery FROM {$table} ORDER BY id DESC LIMIT %d", self::KEEP ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		$rows = $wpdb->get_results( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.NotPrepared
		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Keeps only the most recent KEEP rows (rows still in flight are kept).
	 *
	 * @return void
	 */
	public static function prune() {
		global $wpdb;
		$table  = self::table();
		$cutoff = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} ORDER BY id DESC LIMIT 1 OFFSET %d", self::KEEP - 1 ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( $cutoff > 0 ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE id < %d AND status NOT IN ('queued','retrying','sending')", $cutoff ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
	}

	/**
	 * Deletes every row.
	 *
	 * @return void
	 */
	public static function clear() {
		global $wpdb;
		$table = self::table();
		$wpdb->query( "DELETE FROM {$table} WHERE status NOT IN ('queued','retrying','sending')" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * Writes a diagnostic line to the WooCommerce log (never the API key,
	 * phone numbers are masked by the caller).
	 *
	 * @param string $level   Level (info|warning|error).
	 * @param string $message Message.
	 * @return void
	 */
	public static function diagnostic( $level, $message ) {
		if ( function_exists( 'wc_get_logger' ) ) {
			wc_get_logger()->log( $level, $message, array( 'source' => 'wabek-whatsapp' ) );
		}
	}
}
