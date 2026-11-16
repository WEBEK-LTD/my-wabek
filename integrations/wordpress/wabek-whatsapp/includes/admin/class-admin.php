<?php
/**
 * Admin screens: settings tabs, send log, AJAX actions.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp\Admin;

use Wabek\WhatsApp\Api_Client;
use Wabek\WhatsApp\Logger;
use Wabek\WhatsApp\Message_Builder;
use Wabek\WhatsApp\Phone;
use Wabek\WhatsApp\Queue;
use Wabek\WhatsApp\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the WABEK menu and handles every admin form (admin-post) and
 * AJAX request. Every handler checks a capability and a nonce.
 */
final class Admin {

	const SLUG       = 'wabek-whatsapp';
	const LOG_SLUG   = 'wabek-whatsapp-log';
	const AJAX_NONCE = 'wabek_wa_admin';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'assets' ) );
		add_action( 'admin_post_wabek_wa_save', array( $this, 'save' ) );
		add_action( 'admin_post_wabek_wa_resend', array( $this, 'resend' ) );
		add_action( 'admin_post_wabek_wa_clear_log', array( $this, 'clear_log' ) );
		add_action( 'wp_ajax_wabek_wa_test_connection', array( $this, 'ajax_test_connection' ) );
		add_action( 'wp_ajax_wabek_wa_send_test', array( $this, 'ajax_send_test' ) );
		add_filter( 'plugin_action_links_' . WABEK_WA_BASENAME, array( $this, 'action_links' ) );
		add_action( 'admin_notices', array( $this, 'legacy_plugin_notice' ) );
	}

	/**
	 * Warns when the previous WABEK plugin is still active (it would send
	 * every notification a second time).
	 *
	 * @return void
	 */
	public function legacy_plugin_notice() {
		if ( ! current_user_can( 'activate_plugins' ) || ! function_exists( 'is_plugin_active' ) || ! is_plugin_active( 'waabek-woocommerce/waabek-woocommerce.php' ) ) {
			return;
		}
		echo '<div class="notice notice-warning"><p>' . esc_html__( 'The previous WABEK plugin (WAABEK for WooCommerce) is still active. Deactivate it so customers do not receive every WhatsApp notification twice.', 'wabek-whatsapp' ) . ' <a href="' . esc_url( admin_url( 'plugins.php' ) ) . '">' . esc_html__( 'Go to Plugins', 'wabek-whatsapp' ) . '</a></p></div>';
	}

	/**
	 * Tabs: key => [label, capability].
	 *
	 * @return array
	 */
	public static function tabs() {
		return array(
			'connection'    => array( __( 'Connection', 'wabek-whatsapp' ), 'manage_options' ),
			'notifications' => array( __( 'Order notifications', 'wabek-whatsapp' ), 'manage_woocommerce' ),
			'checkout'      => array( __( 'Consent & carts', 'wabek-whatsapp' ), 'manage_woocommerce' ),
			'otp'           => array( __( 'OTP login', 'wabek-whatsapp' ), 'manage_options' ),
		);
	}

	/**
	 * Tabs the current user may open.
	 *
	 * @return array
	 */
	private static function visible_tabs() {
		return array_filter(
			self::tabs(),
			static function ( $tab ) {
				return current_user_can( $tab[1] );
			}
		);
	}

	/**
	 * Admin menu.
	 *
	 * @return void
	 */
	public function menu() {
		add_menu_page(
			__( 'WABEK WhatsApp', 'wabek-whatsapp' ),
			__( 'WABEK', 'wabek-whatsapp' ),
			'manage_woocommerce',
			self::SLUG,
			array( $this, 'render_settings' ),
			WABEK_WA_URL . 'assets/images/menu-icon.png',
			56
		);
		add_submenu_page( self::SLUG, __( 'WABEK WhatsApp settings', 'wabek-whatsapp' ), __( 'Settings', 'wabek-whatsapp' ), 'manage_woocommerce', self::SLUG, array( $this, 'render_settings' ) );
		add_submenu_page( self::SLUG, __( 'WhatsApp send log', 'wabek-whatsapp' ), __( 'Send log', 'wabek-whatsapp' ), 'manage_woocommerce', self::LOG_SLUG, array( $this, 'render_log' ) );
	}

	/**
	 * Settings link on the Plugins screen.
	 *
	 * @param array $links Links.
	 * @return array
	 */
	public function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html__( 'Settings', 'wabek-whatsapp' ) . '</a>' );
		return $links;
	}

	/**
	 * Styles and scripts on the plugin screens only.
	 *
	 * @param string $hook Screen hook suffix.
	 * @return void
	 */
	public function assets( $hook ) {
		if ( false === strpos( (string) $hook, self::SLUG ) ) {
			return;
		}
		wp_enqueue_style( 'wabek-wa-admin', WABEK_WA_URL . 'assets/css/admin.css', array(), WABEK_WA_VERSION );
		if ( is_rtl() ) {
			wp_enqueue_style( 'wabek-wa-admin-rtl', WABEK_WA_URL . 'assets/css/admin-rtl.css', array( 'wabek-wa-admin' ), WABEK_WA_VERSION );
		}
		wp_enqueue_script( 'wabek-wa-admin', WABEK_WA_URL . 'assets/js/admin.js', array(), WABEK_WA_VERSION, true );
		wp_localize_script(
			'wabek-wa-admin',
			'wabekWaAdmin',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( self::AJAX_NONCE ),
				'i18n'    => array(
					'testing'   => __( 'Testing…', 'wabek-whatsapp' ),
					'sending'   => __( 'Sending…', 'wabek-whatsapp' ),
					'error'     => __( 'Request failed. Please try again.', 'wabek-whatsapp' ),
					'confirm'   => __( 'Delete all finished log entries?', 'wabek-whatsapp' ),
					'connected' => __( 'Connected', 'wabek-whatsapp' ),
					'failed'    => __( 'Not connected', 'wabek-whatsapp' ),
					'choose'    => __( '— Platform default —', 'wabek-whatsapp' ),
				),
			)
		);
	}

	/**
	 * Settings screen.
	 *
	 * @return void
	 */
	public function render_settings() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'wabek-whatsapp' ) );
		}
		$tabs    = self::visible_tabs();
		$current = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $tabs[ $current ] ) ) {
			$current = (string) key( $tabs );
		}
		$settings = Settings::all();

		include __DIR__ . '/views/header.php';
		echo '<div class="wabek-body">';
		include __DIR__ . '/views/tab-' . $current . '.php';
		echo '</div></div>';
	}

	/**
	 * Send log screen.
	 *
	 * @return void
	 */
	public function render_log() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'wabek-whatsapp' ) );
		}
		$tabs    = self::visible_tabs();
		$current = 'log';
		$filter  = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( $_GET['status'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$rows    = Logger::recent( in_array( $filter, self::statuses(), true ) ? $filter : '' );

		include __DIR__ . '/views/header.php';
		echo '<div class="wabek-body">';
		include __DIR__ . '/views/page-log.php';
		echo '</div></div>';
	}

	/**
	 * Log statuses.
	 *
	 * @return string[]
	 */
	public static function statuses() {
		return array( 'queued', 'sending', 'retrying', 'sent', 'failed', 'skipped' );
	}

	/**
	 * Translated status label.
	 *
	 * @param string $status Status.
	 * @return string
	 */
	public static function status_label( $status ) {
		$labels = array(
			'queued'   => __( 'Queued', 'wabek-whatsapp' ),
			'sending'  => __( 'Sending', 'wabek-whatsapp' ),
			'retrying' => __( 'Retrying', 'wabek-whatsapp' ),
			'sent'     => __( 'Sent', 'wabek-whatsapp' ),
			'failed'   => __( 'Failed', 'wabek-whatsapp' ),
			'skipped'  => __( 'Skipped', 'wabek-whatsapp' ),
		);
		return isset( $labels[ $status ] ) ? $labels[ $status ] : $status;
	}

	/**
	 * Handles every settings form (admin-post.php?action=wabek_wa_save).
	 *
	 * @return void
	 */
	public function save() {
		$tab  = isset( $_POST['tab'] ) ? sanitize_key( wp_unslash( $_POST['tab'] ) ) : '';
		$tabs = self::tabs();
		if ( ! isset( $tabs[ $tab ] ) ) {
			wp_die( esc_html__( 'Invalid request.', 'wabek-whatsapp' ) );
		}
		if ( ! current_user_can( $tabs[ $tab ][1] ) ) {
			wp_die( esc_html__( 'You do not have permission to change these settings.', 'wabek-whatsapp' ) );
		}
		check_admin_referer( 'wabek_wa_save_' . $tab );

		$notice = 'saved';
		switch ( $tab ) {
			case 'connection':
				$notice = $this->save_connection();
				break;
			case 'notifications':
				$this->save_notifications();
				break;
			case 'checkout':
				$this->save_checkout();
				break;
			case 'otp':
				$this->save_otp();
				break;
		}

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'         => self::SLUG,
					'tab'          => $tab,
					'wabek_notice' => $notice,
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Saves the Connection tab. Nonce verified in save().
	 *
	 * @return string Notice key.
	 */
	private function save_connection() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		$notice = 'saved';
		$values = array();

		$url = isset( $_POST['api_url'] ) ? esc_url_raw( trim( sanitize_text_field( wp_unslash( $_POST['api_url'] ) ) ) ) : '';
		if ( '' === $url ) {
			$url = Settings::DEFAULT_API_URL;
		}
		if ( Api_Client::is_allowed_base( $url ) ) {
			$values['api_url'] = untrailingslashit( $url );
			if ( Settings::api_url() !== $values['api_url'] ) {
				delete_option( Settings::CONNECTION );
				delete_option( Settings::INSTANCES );
			}
		} else {
			$notice = 'bad_url';
		}

		if ( ! empty( $_POST['remove_key'] ) ) {
			Settings::set_api_key( '' );
			delete_option( Settings::INSTANCES );
		} elseif ( isset( $_POST['api_key'] ) ) {
			$key = preg_replace( '/\s+/', '', sanitize_text_field( wp_unslash( $_POST['api_key'] ) ) );
			if ( '' !== $key && strlen( $key ) <= 256 ) {
				Settings::set_api_key( $key );
			}
		}

		$manual                = isset( $_POST['instance_manual'] ) ? sanitize_text_field( wp_unslash( $_POST['instance_manual'] ) ) : '';
		$selected              = isset( $_POST['instance_id'] ) ? sanitize_text_field( wp_unslash( $_POST['instance_id'] ) ) : '';
		$instance              = '' !== $manual ? $manual : $selected;
		$values['instance_id'] = preg_match( '/^[A-Za-z0-9_-]{0,64}$/', $instance ) ? $instance : '';

		$country                   = isset( $_POST['default_country'] ) ? strtoupper( sanitize_key( wp_unslash( $_POST['default_country'] ) ) ) : '';
		$valid                     = function_exists( 'WC' ) && WC()->countries ? WC()->countries->get_countries() : array();
		$values['default_country'] = isset( $valid[ $country ] ) ? $country : '';

		$admin_phone = isset( $_POST['admin_phone'] ) ? sanitize_text_field( wp_unslash( $_POST['admin_phone'] ) ) : '';
		if ( '' !== $admin_phone ) {
			$e164 = Phone::to_e164( $admin_phone, $values['default_country'] );
			if ( '' === $e164 ) {
				$notice = 'bad_phone';
			} else {
				$values['admin_phone'] = $e164;
			}
		} else {
			$values['admin_phone'] = '';
		}
		$values['admin_alert']   = ! empty( $_POST['admin_alert'] ) ? 'yes' : 'no';
		$values['admin_message'] = isset( $_POST['admin_message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['admin_message'] ) ) : '';
		// phpcs:enable

		Settings::update( $values );
		return $notice;
	}

	/**
	 * Saves the Notifications tab. Nonce verified in save().
	 *
	 * @return void
	 */
	private function save_notifications() {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- each field is sanitized below.
		$posted = isset( $_POST['events'] ) && is_array( $_POST['events'] ) ? wp_unslash( $_POST['events'] ) : array();
		$events = array();
		foreach ( array_keys( Settings::event_labels() ) as $event ) {
			$in               = isset( $posted[ $event ] ) && is_array( $posted[ $event ] ) ? $posted[ $event ] : array();
			$events[ $event ] = array(
				'enabled'         => ! empty( $in['enabled'] ) ? 'yes' : 'no',
				'message'         => isset( $in['message'] ) ? sanitize_textarea_field( $in['message'] ) : '',
				'template'        => isset( $in['template'] ) ? self::template_name( $in['template'] ) : '',
				'template_params' => isset( $in['template_params'] ) ? implode( ', ', Settings::parse_param_names( sanitize_text_field( $in['template_params'] ) ) ) : '',
			);
		}
		Settings::update_events( $events );
	}

	/**
	 * Saves the Consent & carts tab. Nonce verified in save().
	 *
	 * @return void
	 */
	private function save_checkout() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		Settings::update(
			array(
				'consent_enabled'      => ! empty( $_POST['consent_enabled'] ) ? 'yes' : 'no',
				'consent_required'     => ! empty( $_POST['consent_required'] ) ? 'yes' : 'no',
				'consent_label'        => isset( $_POST['consent_label'] ) ? sanitize_text_field( wp_unslash( $_POST['consent_label'] ) ) : '',
				'account_optout'       => ! empty( $_POST['account_optout'] ) ? 'yes' : 'no',
				'cart_enabled'         => ! empty( $_POST['cart_enabled'] ) ? 'yes' : 'no',
				'cart_delay'           => isset( $_POST['cart_delay'] ) ? min( 10080, max( 15, absint( $_POST['cart_delay'] ) ) ) : 60,
				'cart_message'         => isset( $_POST['cart_message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['cart_message'] ) ) : '',
				'cart_template'        => isset( $_POST['cart_template'] ) ? self::template_name( sanitize_text_field( wp_unslash( $_POST['cart_template'] ) ) ) : '',
				'cart_template_params' => isset( $_POST['cart_template_params'] ) ? implode( ', ', Settings::parse_param_names( sanitize_text_field( wp_unslash( $_POST['cart_template_params'] ) ) ) ) : '',
			)
		);
		// phpcs:enable
	}

	/**
	 * Saves the OTP tab. Nonce verified in save().
	 *
	 * @return void
	 */
	private function save_otp() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing
		Settings::update(
			array(
				'otp_login'       => ! empty( $_POST['otp_login'] ) ? 'yes' : 'no',
				'otp_register'    => ! empty( $_POST['otp_register'] ) ? 'yes' : 'no',
				'otp_phone_limit' => isset( $_POST['otp_phone_limit'] ) ? min( 20, max( 1, absint( $_POST['otp_phone_limit'] ) ) ) : 3,
				'otp_ip_limit'    => isset( $_POST['otp_ip_limit'] ) ? min( 100, max( 1, absint( $_POST['otp_ip_limit'] ) ) ) : 10,
			)
		);
		// phpcs:enable
	}

	/**
	 * WhatsApp template names: lowercase letters, digits and underscores.
	 *
	 * @param string $name Raw name.
	 * @return string
	 */
	private static function template_name( $name ) {
		$name = strtolower( trim( sanitize_text_field( (string) $name ) ) );
		return preg_match( '/^[a-z0-9_]{1,128}$/', $name ) ? $name : '';
	}

	/**
	 * AJAX: verify the API key and list instances.
	 *
	 * @return void
	 */
	public function ajax_test_connection() {
		check_ajax_referer( self::AJAX_NONCE, 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'You do not have permission to do this.', 'wabek-whatsapp' ) ), 403 );
		}
		if ( ! Settings::has_api_key() ) {
			wp_send_json_error( array( 'message' => __( 'Save your API key first.', 'wabek-whatsapp' ) ) );
		}

		$result = ( new Api_Client() )->list_instances();
		$status = array(
			'ok'         => (bool) $result['key_valid'],
			'checked_at' => time(),
		);

		if ( ! $result['key_valid'] ) {
			$status['message'] = 401 === $result['code'] || 403 === $result['code']
				? __( 'The API key was rejected. Check that you copied the full key from your WABEK dashboard.', 'wabek-whatsapp' )
				: $result['error'];
			update_option( Settings::CONNECTION, $status, false );
			wp_send_json_error( $status );
		}

		if ( is_array( $result['instances'] ) ) {
			update_option( Settings::INSTANCES, $result['instances'], false );
			$status['message'] = sprintf(
				/* translators: %d: number of WhatsApp numbers */
				_n( 'Connected. %d WhatsApp number found.', 'Connected. %d WhatsApp numbers found.', count( $result['instances'] ), 'wabek-whatsapp' ),
				count( $result['instances'] )
			);
			$status['instances'] = $result['instances'];
		} else {
			$status['message']   = __( 'Connected. Your API key is valid, but this WABEK server cannot list numbers by API key yet; enter the instance ID manually or leave it empty to use your first connected number.', 'wabek-whatsapp' );
			$status['instances'] = null;
		}
		update_option( Settings::CONNECTION, array_diff_key( $status, array( 'instances' => 1 ) ), false );
		wp_send_json_success( $status );
	}

	/**
	 * AJAX: send a test message right away (logged as "test").
	 *
	 * @return void
	 */
	public function ajax_send_test() {
		check_ajax_referer( self::AJAX_NONCE, 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'You do not have permission to do this.', 'wabek-whatsapp' ) ), 403 );
		}
		$raw   = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
		$phone = Phone::to_e164( $raw );
		if ( '' === $phone ) {
			wp_send_json_error( array( 'message' => __( 'Enter a valid WhatsApp number, including the country code.', 'wabek-whatsapp' ) ) );
		}
		$id = Logger::insert(
			array(
				'event'           => 'test',
				'phone'           => $phone,
				/* translators: %s: store name */
				'message'         => sprintf( __( '✅ Test message from %s. WhatsApp notifications are working.', 'wabek-whatsapp' ), Message_Builder::site_name() ),
				'template'        => '',
				'template_params' => array(),
			)
		);
		if ( ! $id || ! Logger::claim( $id ) ) {
			wp_send_json_error( array( 'message' => __( 'Could not write to the send log.', 'wabek-whatsapp' ) ) );
		}
		$row             = Logger::get( $id );
		$result          = Queue::send_row( $row );
		$row['attempts'] = 99; // Never retry a test message.
		Queue::record( $row, $result );

		if ( $result['ok'] ) {
			wp_send_json_success( array( 'message' => __( 'Test message sent.', 'wabek-whatsapp' ) ) );
		}
		/* translators: %s: error message */
		wp_send_json_error( array( 'message' => sprintf( __( 'Sending failed: %s', 'wabek-whatsapp' ), $result['error'] ) ) );
	}

	/**
	 * Re-queues a log entry (admin-post.php?action=wabek_wa_resend&id=…).
	 *
	 * @return void
	 */
	public function resend() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'wabek-whatsapp' ) );
		}
		$id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
		check_admin_referer( 'wabek_wa_resend_' . $id );
		$new = $id ? Queue::resend( $id ) : 0;
		wp_safe_redirect(
			add_query_arg(
				array(
					'page'         => self::LOG_SLUG,
					'wabek_notice' => $new ? 'resent' : 'resend_failed',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Clears finished log entries.
	 *
	 * @return void
	 */
	public function clear_log() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'wabek-whatsapp' ) );
		}
		check_admin_referer( 'wabek_wa_clear_log' );
		Logger::clear();
		wp_safe_redirect(
			add_query_arg(
				array(
					'page'         => self::LOG_SLUG,
					'wabek_notice' => 'cleared',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Notice messages keyed by the `wabek_notice` query arg.
	 *
	 * @return array key => [type, message]
	 */
	public static function notices() {
		return array(
			'saved'         => array( 'success', __( 'Settings saved.', 'wabek-whatsapp' ) ),
			'bad_url'       => array( 'error', __( 'The API URL must start with https://. The previous URL was kept.', 'wabek-whatsapp' ) ),
			'bad_phone'     => array( 'error', __( 'The admin WhatsApp number is not valid. Use the international format, e.g. +9665XXXXXXXX.', 'wabek-whatsapp' ) ),
			'resent'        => array( 'success', __( 'The message was queued again.', 'wabek-whatsapp' ) ),
			'resend_failed' => array( 'error', __( 'This entry cannot be resent.', 'wabek-whatsapp' ) ),
			'cleared'       => array( 'success', __( 'The send log was cleared.', 'wabek-whatsapp' ) ),
		);
	}

	/**
	 * Renders a toggle switch.
	 *
	 * @param string $name    Field name.
	 * @param bool   $checked Checked.
	 * @param string $label   Visible label.
	 * @param string $help    Optional help text.
	 * @return void
	 */
	public static function toggle( $name, $checked, $label, $help = '' ) {
		$id = 'wabek-' . preg_replace( '/[^a-z0-9_-]/i', '-', $name );
		echo '<div class="wabek-toggle-row"><label class="wabek-switch" for="' . esc_attr( $id ) . '">';
		echo '<input type="checkbox" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="yes" ' . checked( $checked, true, false ) . ' />';
		echo '<span class="wabek-switch__track" aria-hidden="true"></span>';
		echo '<span class="wabek-switch__label">' . esc_html( $label ) . '</span></label>';
		if ( '' !== $help ) {
			echo '<p class="wabek-help">' . esc_html( $help ) . '</p>';
		}
		echo '</div>';
	}

	/**
	 * Renders clickable variable chips that insert into a textarea.
	 *
	 * @param array  $variables name => description.
	 * @param string $target    Textarea id.
	 * @return void
	 */
	public static function variable_chips( array $variables, $target ) {
		echo '<div class="wabek-chips" data-target="' . esc_attr( $target ) . '">';
		foreach ( $variables as $name => $description ) {
			echo '<button type="button" class="wabek-chip" data-insert="' . esc_attr( '{' . $name . '}' ) . '" title="' . esc_attr( $description ) . '">{' . esc_html( $name ) . '}</button>';
		}
		echo '</div>';
	}
}
