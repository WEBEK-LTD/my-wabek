<?php
/**
 * OTP login tab.
 *
 * Expects: $settings (array).
 *
 * @package Wabek\WhatsApp
 */

use Wabek\WhatsApp\Admin\Admin;

defined( 'ABSPATH' ) || exit;
?>
<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="wabek-form">
	<input type="hidden" name="action" value="wabek_wa_save" />
	<input type="hidden" name="tab" value="otp" />
	<?php wp_nonce_field( 'wabek_wa_save_otp' ); ?>

	<section class="wabek-card">
		<h2 class="wabek-card__title"><?php esc_html_e( 'WhatsApp verification codes', 'wabek-whatsapp' ); ?></h2>
		<p class="wabek-card__intro"><?php esc_html_e( 'Codes are generated, sent and checked by WABEK through your approved WhatsApp Authentication template (set it in WABEK under Settings → Security & OTP).', 'wabek-whatsapp' ); ?></p>
		<?php
		Admin::toggle( 'otp_login', 'yes' === $settings['otp_login'], __( 'Allow customers to log in with a WhatsApp code', 'wabek-whatsapp' ), __( 'Adds “Log in with WhatsApp” to the WooCommerce login form. Staff accounts (shop managers, editors, administrators) can never log in this way.', 'wabek-whatsapp' ) );
		Admin::toggle( 'otp_register', 'yes' === $settings['otp_register'], __( 'Require WhatsApp number verification at registration', 'wabek-whatsapp' ), __( 'Adds a WhatsApp number field to the WooCommerce registration form; the account is created only after the code is confirmed.', 'wabek-whatsapp' ) );
		?>
	</section>

	<section class="wabek-card">
		<h2 class="wabek-card__title"><?php esc_html_e( 'Abuse protection', 'wabek-whatsapp' ); ?></h2>
		<div class="wabek-grid">
			<div class="wabek-field">
				<label for="wabek-otp-phone"><?php esc_html_e( 'Codes per number every 15 minutes', 'wabek-whatsapp' ); ?></label>
				<input type="number" id="wabek-otp-phone" name="otp_phone_limit" min="1" max="20" class="small-text" value="<?php echo esc_attr( (string) $settings['otp_phone_limit'] ); ?>" />
			</div>
			<div class="wabek-field">
				<label for="wabek-otp-ip"><?php esc_html_e( 'Codes per IP address every hour', 'wabek-whatsapp' ); ?></label>
				<input type="number" id="wabek-otp-ip" name="otp_ip_limit" min="1" max="100" class="small-text" value="<?php echo esc_attr( (string) $settings['otp_ip_limit'] ); ?>" />
			</div>
		</div>
		<p class="wabek-help"><?php esc_html_e( 'A number can request one code per minute, and each code allows 5 attempts and expires after 10 minutes.', 'wabek-whatsapp' ); ?></p>
	</section>

	<p class="wabek-submit"><button type="submit" class="button button-primary wabek-btn"><?php esc_html_e( 'Save changes', 'wabek-whatsapp' ); ?></button></p>
</form>
