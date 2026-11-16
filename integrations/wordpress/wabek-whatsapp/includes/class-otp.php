<?php
/**
 * WhatsApp OTP login and registration verification.
 *
 * @package Wabek\WhatsApp
 */

namespace Wabek\WhatsApp;

defined( 'ABSPATH' ) || exit;

/**
 * Optional module: "Log in with WhatsApp" on the WooCommerce login form and
 * WhatsApp number verification on the WooCommerce registration form, using
 * the platform's /api/v1/otp and /api/v1/otp-verify endpoints.
 *
 * The platform's OTP id never reaches the browser: the browser only gets a
 * random token pointing at a short-lived server-side transient.
 */
final class Otp {

	const NONCE         = 'wabek_wa_otp';
	const TTL           = 600;
	const MAX_ATTEMPTS  = 5;
	const COOLDOWN      = 60;
	const PHONE_META    = 'wabek_wa_phone_e164';
	const VERIFIED_META = 'wabek_wa_phone_verified';

	/**
	 * Token validated during registration, used once the customer exists.
	 *
	 * @var string
	 */
	private $registration_token = '';

	/**
	 * Registers hooks.
	 *
	 * @return void
	 */
	public function register() {
		$login    = Settings::is_on( 'otp_login' );
		$register = Settings::is_on( 'otp_register' );
		if ( ! $login && ! $register ) {
			return;
		}
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'wp_ajax_nopriv_wabek_wa_otp_send', array( $this, 'ajax_send' ) );
		add_action( 'wp_ajax_wabek_wa_otp_send', array( $this, 'ajax_send' ) );
		add_action( 'wp_ajax_nopriv_wabek_wa_otp_verify', array( $this, 'ajax_verify' ) );
		add_action( 'wp_ajax_wabek_wa_otp_verify', array( $this, 'ajax_verify' ) );

		if ( $login ) {
			add_action( 'woocommerce_login_form_end', array( $this, 'render_login' ) );
		}
		if ( $register ) {
			add_action( 'woocommerce_register_form', array( $this, 'render_register' ) );
			add_filter( 'woocommerce_process_registration_errors', array( $this, 'validate_registration' ), 10, 1 );
			add_action( 'woocommerce_created_customer', array( $this, 'on_customer_created' ), 10, 1 );
		}
	}

	/**
	 * Front-end assets on My Account and checkout (both can show the forms).
	 *
	 * @return void
	 */
	public function enqueue() {
		if ( is_user_logged_in() || ! function_exists( 'is_account_page' ) || ! ( is_account_page() || is_checkout() ) ) {
			return;
		}
		wp_enqueue_style( 'wabek-wa-front', WABEK_WA_URL . 'assets/css/frontend.css', array(), WABEK_WA_VERSION );
		wp_enqueue_script( 'wabek-wa-otp', WABEK_WA_URL . 'assets/js/otp.js', array(), WABEK_WA_VERSION, true );
		wp_localize_script(
			'wabek-wa-otp',
			'wabekWaOtp',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( self::NONCE ),
				'i18n'    => array(
					'sending'   => __( 'Sending…', 'wabek-whatsapp' ),
					'verifying' => __( 'Verifying…', 'wabek-whatsapp' ),
					'resend'    => __( 'Resend code', 'wabek-whatsapp' ),
					'error'     => __( 'Something went wrong. Please try again.', 'wabek-whatsapp' ),
				),
			)
		);
	}

	/**
	 * "Log in with WhatsApp" block inside the WooCommerce login form.
	 *
	 * @return void
	 */
	public function render_login() {
		if ( is_user_logged_in() ) {
			return;
		}
		$this->render_widget( 'login' );
	}

	/**
	 * WhatsApp number + verification inside the registration form.
	 *
	 * @return void
	 */
	public function render_register() {
		$this->render_widget( 'register' );
	}

	/**
	 * Shared markup.
	 *
	 * @param string $purpose login|register.
	 * @return void
	 */
	private function render_widget( $purpose ) {
		$id       = 'wabek-wa-' . $purpose;
		$is_login = 'login' === $purpose;
		// Value re-filled after a failed registration submit (WooCommerce verified its nonce).
		$phone = $is_login || empty( $_POST['wabek_wa_phone'] ) ? '' : sanitize_text_field( wp_unslash( $_POST['wabek_wa_phone'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		?>
		<div class="wabek-wa-otp" data-purpose="<?php echo esc_attr( $purpose ); ?>">
			<?php if ( $is_login ) : ?>
				<p class="wabek-wa-otp__divider"><span><?php esc_html_e( 'or', 'wabek-whatsapp' ); ?></span></p>
				<p class="wabek-wa-otp__title"><?php esc_html_e( 'Log in with a code sent to your WhatsApp', 'wabek-whatsapp' ); ?></p>
			<?php endif; ?>
			<p class="form-row form-row-wide">
				<label for="<?php echo esc_attr( $id ); ?>-phone"><?php esc_html_e( 'WhatsApp number', 'wabek-whatsapp' ); ?><?php echo $is_login ? '' : '&nbsp;<span class="required" aria-hidden="true">*</span>'; ?></label>
				<input type="tel" class="input-text wabek-wa-otp__phone" id="<?php echo esc_attr( $id ); ?>-phone" <?php echo $is_login ? '' : 'name="wabek_wa_phone" required'; ?> value="<?php echo esc_attr( $phone ); ?>" autocomplete="tel" dir="ltr" placeholder="+966 5X XXX XXXX" />
			</p>
			<p class="form-row form-row-wide wabek-wa-otp__code-row" hidden>
				<label for="<?php echo esc_attr( $id ); ?>-code"><?php esc_html_e( 'Verification code', 'wabek-whatsapp' ); ?></label>
				<input type="text" class="input-text wabek-wa-otp__code" id="<?php echo esc_attr( $id ); ?>-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" dir="ltr" />
			</p>
			<?php if ( ! $is_login ) : ?>
				<input type="hidden" name="wabek_wa_otp_token" class="wabek-wa-otp__token" value="" />
			<?php endif; ?>
			<p class="wabek-wa-otp__actions">
				<button type="button" class="button wabek-wa-otp__send"><?php esc_html_e( 'Send code via WhatsApp', 'wabek-whatsapp' ); ?></button>
				<button type="button" class="button wabek-wa-otp__verify" hidden><?php echo $is_login ? esc_html__( 'Verify and log in', 'wabek-whatsapp' ) : esc_html__( 'Verify number', 'wabek-whatsapp' ); ?></button>
			</p>
			<p class="wabek-wa-otp__msg" role="status" aria-live="polite"></p>
		</div>
		<?php
	}

	/**
	 * AJAX: request a code.
	 *
	 * @return void
	 */
	public function ajax_send() {
		check_ajax_referer( self::NONCE, 'nonce' );

		$purpose = isset( $_POST['purpose'] ) ? sanitize_key( wp_unslash( $_POST['purpose'] ) ) : '';
		$raw     = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
		if ( ! $this->purpose_enabled( $purpose ) ) {
			self::fail( __( 'This feature is not available.', 'wabek-whatsapp' ) );
		}
		if ( 'login' === $purpose && is_user_logged_in() ) {
			self::fail( __( 'You are already logged in.', 'wabek-whatsapp' ) );
		}

		$phone = Phone::to_e164( $raw );
		if ( '' === $phone ) {
			self::fail( __( 'Enter a valid WhatsApp number, including the country code.', 'wabek-whatsapp' ) );
		}

		$ip = Rate_Limiter::ip();
		if ( ! Rate_Limiter::hit( 'otp_cd|' . $phone, 1, self::COOLDOWN ) ) {
			self::fail( __( 'Please wait a minute before requesting another code.', 'wabek-whatsapp' ) );
		}
		if ( ! Rate_Limiter::hit( 'otp_ph|' . $phone, max( 1, (int) Settings::get( 'otp_phone_limit' ) ), 15 * MINUTE_IN_SECONDS )
			|| ! Rate_Limiter::hit( 'otp_ip|' . $ip, max( 1, (int) Settings::get( 'otp_ip_limit' ) ), HOUR_IN_SECONDS ) ) {
			self::fail( __( 'Too many code requests. Please try again later.', 'wabek-whatsapp' ) );
		}

		$state = array(
			'otp_id'   => '',
			'phone'    => $phone,
			'purpose'  => $purpose,
			'user_id'  => 0,
			'attempts' => 0,
			'verified' => false,
		);

		if ( 'login' === $purpose ) {
			$user_id = self::find_user( $phone );
			if ( $user_id && self::login_allowed( $user_id ) ) {
				$state['user_id'] = $user_id;
			}
		} elseif ( self::find_user( $phone, true ) ) {
			self::fail( __( 'This number is already linked to an account. Please log in instead.', 'wabek-whatsapp' ) );
		}

		// For an unknown number the response is identical but nothing is sent (no account enumeration).
		if ( 'register' === $purpose || $state['user_id'] ) {
			$result = ( new Api_Client() )->otp_send( Phone::digits( $phone ), 'login' === $purpose ? 'login' : 'verification' );
			$otp_id = isset( $result['data']['otpId'] ) ? (string) $result['data']['otpId'] : ( isset( $result['data']['otp_id'] ) ? (string) $result['data']['otp_id'] : '' );
			if ( ! $result['ok'] || '' === $otp_id ) {
				Logger::diagnostic( 'warning', sprintf( 'OTP send to %s failed: HTTP %d %s', Phone::mask( $phone ), (int) $result['code'], (string) $result['error'] ) );
				self::fail( __( 'We could not send the code right now. Please try again later.', 'wabek-whatsapp' ) );
			}
			$state['otp_id'] = $otp_id;
		}

		$token = wp_generate_password( 32, false, false );
		set_transient( 'wabek_wa_otp_' . $token, $state, self::TTL );

		wp_send_json_success(
			array(
				'token'   => $token,
				/* translators: %s: masked phone number */
				'message' => sprintf( __( 'If this number can receive codes, a verification code was sent to %s on WhatsApp.', 'wabek-whatsapp' ), Phone::mask( $phone ) ),
			)
		);
	}

	/**
	 * AJAX: verify a code (logs in, or marks the registration number verified).
	 *
	 * @return void
	 */
	public function ajax_verify() {
		check_ajax_referer( self::NONCE, 'nonce' );

		$token = isset( $_POST['token'] ) ? preg_replace( '/[^A-Za-z0-9]/', '', sanitize_text_field( wp_unslash( $_POST['token'] ) ) ) : '';
		$code  = isset( $_POST['code'] ) ? preg_replace( '/\D/', '', sanitize_text_field( wp_unslash( $_POST['code'] ) ) ) : '';
		$key   = 'wabek_wa_otp_' . $token;
		$state = '' !== $token ? get_transient( $key ) : false;

		if ( ! is_array( $state ) ) {
			self::fail( __( 'The code has expired. Please request a new one.', 'wabek-whatsapp' ) );
		}
		if ( ! $this->purpose_enabled( $state['purpose'] ) ) {
			self::fail( __( 'This feature is not available.', 'wabek-whatsapp' ) );
		}
		if ( strlen( $code ) < 4 || strlen( $code ) > 8 ) {
			self::fail( __( 'Enter the code you received on WhatsApp.', 'wabek-whatsapp' ) );
		}

		++$state['attempts'];
		if ( $state['attempts'] > self::MAX_ATTEMPTS ) {
			delete_transient( $key );
			self::fail( __( 'Too many attempts. Please request a new code.', 'wabek-whatsapp' ) );
		}
		set_transient( $key, $state, self::TTL );

		$valid = false;
		if ( '' !== $state['otp_id'] ) {
			$result = ( new Api_Client() )->otp_verify( $state['otp_id'], $code );
			if ( ! $result['ok'] ) {
				self::fail( __( 'We could not verify the code right now. Please try again.', 'wabek-whatsapp' ) );
			}
			$valid = ! empty( $result['data']['valid'] );
		}
		if ( ! $valid ) {
			self::fail( __( 'The code is incorrect.', 'wabek-whatsapp' ) );
		}

		if ( 'login' === $state['purpose'] ) {
			delete_transient( $key );
			$user_id = (int) $state['user_id'];
			$user    = $user_id ? get_user_by( 'id', $user_id ) : false;
			if ( ! $user || ! self::login_allowed( $user_id ) ) {
				self::fail( __( 'The code is incorrect.', 'wabek-whatsapp' ) );
			}
			wp_clear_auth_cookie();
			wp_set_current_user( $user_id );
			wp_set_auth_cookie( $user_id, true, is_ssl() );
			update_user_meta( $user_id, self::PHONE_META, $state['phone'] );
			do_action( 'wp_login', $user->user_login, $user ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

			$redirect = isset( $_POST['redirect'] ) ? wp_validate_redirect( esc_url_raw( wp_unslash( $_POST['redirect'] ) ), '' ) : '';
			wp_send_json_success(
				array(
					'message'  => __( 'Verified. Logging you in…', 'wabek-whatsapp' ),
					'redirect' => '' !== $redirect ? $redirect : wc_get_page_permalink( 'myaccount' ),
				)
			);
		}

		$state['verified'] = true;
		set_transient( $key, $state, self::TTL );
		wp_send_json_success( array( 'message' => __( 'Your WhatsApp number is verified.', 'wabek-whatsapp' ) ) );
	}

	/**
	 * Blocks registration until the WhatsApp number is verified.
	 * WooCommerce has verified the registration nonce before this filter.
	 *
	 * @param \WP_Error $errors Validation errors.
	 * @return \WP_Error
	 */
	public function validate_registration( $errors ) {
		$raw   = isset( $_POST['wabek_wa_phone'] ) ? sanitize_text_field( wp_unslash( $_POST['wabek_wa_phone'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$token = isset( $_POST['wabek_wa_otp_token'] ) ? preg_replace( '/[^A-Za-z0-9]/', '', sanitize_text_field( wp_unslash( $_POST['wabek_wa_otp_token'] ) ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$state = '' !== $token ? get_transient( 'wabek_wa_otp_' . $token ) : false;
		$phone = Phone::to_e164( $raw );

		if ( ! is_array( $state ) || empty( $state['verified'] ) || 'register' !== $state['purpose'] || '' === $phone || $state['phone'] !== $phone ) {
			$errors->add( 'wabek_wa_phone', __( 'Please verify your WhatsApp number with the code we send you.', 'wabek-whatsapp' ) );
		} else {
			$this->registration_token = $token;
		}
		return $errors;
	}

	/**
	 * Saves the verified number on the new customer.
	 *
	 * @param int $customer_id New user id.
	 * @return void
	 */
	public function on_customer_created( $customer_id ) {
		if ( '' === $this->registration_token ) {
			return;
		}
		$key   = 'wabek_wa_otp_' . $this->registration_token;
		$state = get_transient( $key );
		delete_transient( $key );
		$this->registration_token = '';
		if ( ! is_array( $state ) || empty( $state['verified'] ) ) {
			return;
		}
		update_user_meta( $customer_id, self::PHONE_META, $state['phone'] );
		update_user_meta( $customer_id, self::VERIFIED_META, time() );
		update_user_meta( $customer_id, 'billing_phone', $state['phone'] );
	}

	/**
	 * Whether a module purpose is switched on.
	 *
	 * @param string $purpose login|register.
	 * @return bool
	 */
	private function purpose_enabled( $purpose ) {
		return ( 'login' === $purpose && Settings::is_on( 'otp_login' ) ) || ( 'register' === $purpose && Settings::is_on( 'otp_register' ) );
	}

	/**
	 * Finds exactly one user by phone (verified number first, then billing phone).
	 *
	 * @param string $e164          E.164 number.
	 * @param bool   $verified_only Only look at verified numbers.
	 * @return int User id, 0 when none or ambiguous.
	 */
	private static function find_user( $e164, $verified_only = false ) {
		$ids = get_users(
			array(
				'meta_key'   => self::PHONE_META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'meta_value' => $e164, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
				'number'     => 2,
				'fields'     => 'ID',
			)
		);
		if ( count( $ids ) || $verified_only ) {
			return 1 === count( $ids ) ? (int) $ids[0] : 0;
		}
		$ids = get_users(
			array(
				'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					array(
						'key'     => 'billing_phone',
						'value'   => Phone::variants( $e164 ),
						'compare' => 'IN',
					),
				),
				'number'     => 2,
				'fields'     => 'ID',
			)
		);
		return 1 === count( $ids ) ? (int) $ids[0] : 0;
	}

	/**
	 * Staff accounts never log in by WhatsApp code.
	 *
	 * @param int $user_id User id.
	 * @return bool
	 */
	private static function login_allowed( $user_id ) {
		$allowed = ! user_can( $user_id, 'edit_posts' ) && ! user_can( $user_id, 'manage_woocommerce' ) && ! user_can( $user_id, 'manage_options' );
		/**
		 * Filters whether a user may log in with a WhatsApp code.
		 *
		 * @param bool $allowed Allowed.
		 * @param int  $user_id User id.
		 */
		return (bool) apply_filters( 'wabek_whatsapp_otp_login_allowed', $allowed, $user_id );
	}

	/**
	 * Sends a JSON error and stops.
	 *
	 * @param string $message Message.
	 * @return void
	 */
	private static function fail( $message ) {
		wp_send_json_error( array( 'message' => $message ), 400 );
	}
}
