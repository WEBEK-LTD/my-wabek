<?php
/**
 * Consent & carts tab.
 *
 * Expects: $settings (array).
 *
 * @package Wabek\WhatsApp
 */

use Wabek\WhatsApp\Admin\Admin;
use Wabek\WhatsApp\Message_Builder;
use Wabek\WhatsApp\Settings;

defined( 'ABSPATH' ) || exit;
?>
<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="wabek-form">
	<input type="hidden" name="action" value="wabek_wa_save" />
	<input type="hidden" name="tab" value="checkout" />
	<?php wp_nonce_field( 'wabek_wa_save_checkout' ); ?>

	<section class="wabek-card">
		<h2 class="wabek-card__title"><?php esc_html_e( 'Customer consent', 'wabek-whatsapp' ); ?></h2>
		<?php
		Admin::toggle( 'consent_enabled', 'yes' === $settings['consent_enabled'], __( 'Show a WhatsApp consent checkbox at checkout', 'wabek-whatsapp' ), __( 'Works on the classic checkout and on the block checkout (WooCommerce 8.9 or later). The answer is saved on the order.', 'wabek-whatsapp' ) );
		Admin::toggle( 'consent_required', 'yes' === $settings['consent_required'], __( 'Only message customers who ticked the checkbox', 'wabek-whatsapp' ), __( 'When off, customers are messaged unless they untick the checkbox. Orders created without the checkbox (e.g. by an admin) count as not consented while this is on.', 'wabek-whatsapp' ) );
		?>
		<div class="wabek-field">
			<label for="wabek-consent-label"><?php esc_html_e( 'Checkbox text', 'wabek-whatsapp' ); ?></label>
			<input type="text" id="wabek-consent-label" name="consent_label" class="large-text" value="<?php echo esc_attr( $settings['consent_label'] ); ?>" placeholder="<?php echo esc_attr( __( 'I agree to receive order notifications via WhatsApp', 'wabek-whatsapp' ) ); ?>" />
		</div>
		<?php Admin::toggle( 'account_optout', 'yes' === $settings['account_optout'], __( 'Let customers opt out from My Account → Account details', 'wabek-whatsapp' ) ); ?>
	</section>

	<section class="wabek-card">
		<h2 class="wabek-card__title"><?php esc_html_e( 'Abandoned cart reminder', 'wabek-whatsapp' ); ?></h2>
		<p class="wabek-card__intro"><?php esc_html_e( 'When a shopper types a phone number at checkout but does not order, one WhatsApp reminder is sent after the delay below. Placing an order cancels it.', 'wabek-whatsapp' ); ?></p>
		<?php Admin::toggle( 'cart_enabled', 'yes' === $settings['cart_enabled'], __( 'Send abandoned cart reminders', 'wabek-whatsapp' ) ); ?>
		<div class="wabek-field">
			<label for="wabek-cart-delay"><?php esc_html_e( 'Delay (minutes)', 'wabek-whatsapp' ); ?></label>
			<input type="number" id="wabek-cart-delay" name="cart_delay" min="15" max="10080" step="1" class="small-text" value="<?php echo esc_attr( (string) $settings['cart_delay'] ); ?>" />
		</div>
		<div class="wabek-field">
			<label for="wabek-cart-message"><?php esc_html_e( 'Reminder message', 'wabek-whatsapp' ); ?></label>
			<textarea id="wabek-cart-message" name="cart_message" rows="6" class="large-text wabek-textarea"><?php echo esc_textarea( $settings['cart_message'] ); ?></textarea>
			<?php Admin::variable_chips( Message_Builder::cart_variables(), 'wabek-cart-message' ); ?>
		</div>
		<div class="wabek-grid">
			<div class="wabek-field">
				<label for="wabek-cart-template"><?php esc_html_e( 'Approved template (outside 24 hours)', 'wabek-whatsapp' ); ?></label>
				<input type="text" id="wabek-cart-template" name="cart_template" class="regular-text" dir="ltr" value="<?php echo esc_attr( $settings['cart_template'] ); ?>" placeholder="cart_reminder" />
			</div>
			<div class="wabek-field">
				<label for="wabek-cart-params"><?php esc_html_e( 'Template variables', 'wabek-whatsapp' ); ?></label>
				<input type="text" id="wabek-cart-params" name="cart_template_params" class="regular-text" dir="ltr" value="<?php echo esc_attr( $settings['cart_template_params'] ); ?>" placeholder="customer_name, cart_url" />
			</div>
		</div>
		<p class="wabek-help"><?php esc_html_e( 'Shoppers who did not consent (when consent is required) or who opted out are never reminded. On the block checkout, carts are only captured when consent is not required.', 'wabek-whatsapp' ); ?></p>
	</section>

	<p class="wabek-submit"><button type="submit" class="button button-primary wabek-btn"><?php esc_html_e( 'Save changes', 'wabek-whatsapp' ); ?></button></p>
</form>
