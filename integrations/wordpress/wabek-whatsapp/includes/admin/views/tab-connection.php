<?php
/**
 * Connection tab: API URL, API key, test, default number, admin alerts.
 *
 * Expects: $settings (array).
 *
 * @package Wabek\WhatsApp
 */

use Wabek\WhatsApp\Admin\Admin;
use Wabek\WhatsApp\Message_Builder;
use Wabek\WhatsApp\Settings;

defined( 'ABSPATH' ) || exit;

$wabek_wa_instances = get_option( Settings::INSTANCES, array() );
$wabek_wa_instances = is_array( $wabek_wa_instances ) ? $wabek_wa_instances : array();
$wabek_wa_known     = wp_list_pluck( $wabek_wa_instances, 'id' );
$wabek_wa_manual    = ( '' !== $settings['instance_id'] && ! in_array( $settings['instance_id'], $wabek_wa_known, true ) ) ? $settings['instance_id'] : '';
$wabek_wa_masked    = Settings::masked_api_key();
$wabek_wa_countries = function_exists( 'WC' ) && WC()->countries ? WC()->countries->get_countries() : array();
$wabek_wa_base      = function_exists( 'WC' ) && WC()->countries ? WC()->countries->get_base_country() : '';
?>
<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="wabek-form">
	<input type="hidden" name="action" value="wabek_wa_save" />
	<input type="hidden" name="tab" value="connection" />
	<?php wp_nonce_field( 'wabek_wa_save_connection' ); ?>

	<section class="wabek-card">
		<h2 class="wabek-card__title"><?php esc_html_e( 'API connection', 'wabek-whatsapp' ); ?></h2>
		<p class="wabek-card__intro"><?php esc_html_e( 'Create an API key in your WABEK dashboard (Dashboard → API Keys) and paste it here. The key is stored on your server and sent only in the X-API-Key header over HTTPS.', 'wabek-whatsapp' ); ?></p>

		<div class="wabek-field">
			<label for="wabek-api-url"><?php esc_html_e( 'API base URL', 'wabek-whatsapp' ); ?></label>
			<input type="url" id="wabek-api-url" name="api_url" class="regular-text" dir="ltr" value="<?php echo esc_attr( $settings['api_url'] ); ?>" placeholder="<?php echo esc_attr( Settings::DEFAULT_API_URL ); ?>" required />
		</div>

		<div class="wabek-field">
			<label for="wabek-api-key"><?php esc_html_e( 'API key', 'wabek-whatsapp' ); ?></label>
			<input type="password" id="wabek-api-key" name="api_key" class="regular-text" dir="ltr" value="" autocomplete="new-password" spellcheck="false"
				placeholder="<?php echo esc_attr( '' !== $wabek_wa_masked ? $wabek_wa_masked : __( 'Paste your API key', 'wabek-whatsapp' ) ); ?>" />
			<?php if ( '' !== $wabek_wa_masked ) : ?>
				<p class="wabek-help">
					<?php
					/* translators: %s: masked API key */
					echo esc_html( sprintf( __( 'Saved key: %s. Leave the field empty to keep it.', 'wabek-whatsapp' ), $wabek_wa_masked ) );
					?>
				</p>
				<label class="wabek-inline-check"><input type="checkbox" name="remove_key" value="1" /> <?php esc_html_e( 'Remove the saved key', 'wabek-whatsapp' ); ?></label>
			<?php endif; ?>
		</div>

		<div class="wabek-actions">
			<button type="button" class="button wabek-btn wabek-btn--ghost" id="wabek-test-connection" <?php disabled( ! Settings::has_api_key() ); ?>><?php esc_html_e( 'Test connection', 'wabek-whatsapp' ); ?></button>
			<span class="wabek-result" id="wabek-test-result" role="status" aria-live="polite"></span>
		</div>
	</section>

	<section class="wabek-card">
		<h2 class="wabek-card__title"><?php esc_html_e( 'Sending number', 'wabek-whatsapp' ); ?></h2>
		<div class="wabek-field">
			<label for="wabek-instance"><?php esc_html_e( 'Default WhatsApp number', 'wabek-whatsapp' ); ?></label>
			<select id="wabek-instance" name="instance_id">
				<option value=""><?php esc_html_e( '— Platform default —', 'wabek-whatsapp' ); ?></option>
				<?php foreach ( $wabek_wa_instances as $wabek_wa_instance ) : ?>
					<option value="<?php echo esc_attr( $wabek_wa_instance['id'] ); ?>" <?php selected( $settings['instance_id'], $wabek_wa_instance['id'] ); ?>>
						<?php echo esc_html( trim( $wabek_wa_instance['name'] . ' ' . $wabek_wa_instance['phone'] ) . ' (' . $wabek_wa_instance['status'] . ')' ); ?>
					</option>
				<?php endforeach; ?>
			</select>
			<p class="wabek-help"><?php esc_html_e( 'Run “Test connection” to load your numbers. With no choice, WABEK uses your first connected number.', 'wabek-whatsapp' ); ?></p>
		</div>
		<div class="wabek-field">
			<label for="wabek-instance-manual"><?php esc_html_e( 'Or enter an instance ID', 'wabek-whatsapp' ); ?></label>
			<input type="text" id="wabek-instance-manual" name="instance_manual" class="regular-text" dir="ltr" value="<?php echo esc_attr( $wabek_wa_manual ); ?>" />
		</div>
		<div class="wabek-field">
			<label for="wabek-country"><?php esc_html_e( 'Default country for phone numbers', 'wabek-whatsapp' ); ?></label>
			<select id="wabek-country" name="default_country">
				<option value="">
					<?php
					/* translators: %s: store base country code */
					echo esc_html( sprintf( __( 'Store base country (%s)', 'wabek-whatsapp' ), $wabek_wa_base ) );
					?>
				</option>
				<?php foreach ( $wabek_wa_countries as $wabek_wa_code => $wabek_wa_name ) : ?>
					<option value="<?php echo esc_attr( $wabek_wa_code ); ?>" <?php selected( $settings['default_country'], $wabek_wa_code ); ?>><?php echo esc_html( html_entity_decode( $wabek_wa_name, ENT_QUOTES, 'UTF-8' ) ); ?></option>
				<?php endforeach; ?>
			</select>
			<p class="wabek-help"><?php esc_html_e( 'Numbers typed without a country code use the billing country, then this country. Invalid numbers are skipped.', 'wabek-whatsapp' ); ?></p>
		</div>
	</section>

	<section class="wabek-card">
		<h2 class="wabek-card__title"><?php esc_html_e( 'Store owner alerts', 'wabek-whatsapp' ); ?></h2>
		<?php Admin::toggle( 'admin_alert', 'yes' === $settings['admin_alert'], __( 'Send me a WhatsApp alert for every new order', 'wabek-whatsapp' ) ); ?>
		<div class="wabek-field">
			<label for="wabek-admin-phone"><?php esc_html_e( 'Admin WhatsApp number', 'wabek-whatsapp' ); ?></label>
			<input type="tel" id="wabek-admin-phone" name="admin_phone" class="regular-text" dir="ltr" value="<?php echo esc_attr( $settings['admin_phone'] ); ?>" placeholder="+9665XXXXXXXX" />
		</div>
		<div class="wabek-field">
			<label for="wabek-admin-message"><?php esc_html_e( 'Alert message', 'wabek-whatsapp' ); ?></label>
			<textarea id="wabek-admin-message" name="admin_message" rows="6" class="large-text wabek-textarea"><?php echo esc_textarea( $settings['admin_message'] ); ?></textarea>
			<?php Admin::variable_chips( Message_Builder::order_variables(), 'wabek-admin-message' ); ?>
		</div>
	</section>

	<p class="wabek-submit"><button type="submit" class="button button-primary wabek-btn"><?php esc_html_e( 'Save changes', 'wabek-whatsapp' ); ?></button></p>
</form>

<section class="wabek-card">
	<h2 class="wabek-card__title"><?php esc_html_e( 'Send a test message', 'wabek-whatsapp' ); ?></h2>
	<div class="wabek-inline">
		<label class="screen-reader-text" for="wabek-test-phone"><?php esc_html_e( 'WhatsApp number', 'wabek-whatsapp' ); ?></label>
		<input type="tel" id="wabek-test-phone" class="regular-text" dir="ltr" value="<?php echo esc_attr( $settings['admin_phone'] ); ?>" placeholder="+9665XXXXXXXX" />
		<button type="button" class="button wabek-btn wabek-btn--ghost" id="wabek-send-test" <?php disabled( ! Settings::has_api_key() ); ?>><?php esc_html_e( 'Send test', 'wabek-whatsapp' ); ?></button>
		<span class="wabek-result" id="wabek-send-result" role="status" aria-live="polite"></span>
	</div>
	<p class="wabek-help"><?php esc_html_e( 'Outside the 24-hour WhatsApp window, plain text needs an approved template. Message the business number from this phone first to open the window.', 'wabek-whatsapp' ); ?></p>
</section>
