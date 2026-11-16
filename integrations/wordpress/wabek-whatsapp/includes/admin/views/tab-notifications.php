<?php
/**
 * Order notifications tab: per-event toggle, message and template fallback.
 *
 * @package Wabek\WhatsApp
 */

use Wabek\WhatsApp\Admin\Admin;
use Wabek\WhatsApp\Message_Builder;
use Wabek\WhatsApp\Settings;

defined( 'ABSPATH' ) || exit;

$wabek_wa_events    = Settings::events();
$wabek_wa_labels    = Settings::event_labels();
$wabek_wa_variables = Message_Builder::order_variables();
?>
<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="wabek-form">
	<input type="hidden" name="action" value="wabek_wa_save" />
	<input type="hidden" name="tab" value="notifications" />
	<?php wp_nonce_field( 'wabek_wa_save_notifications' ); ?>

	<section class="wabek-card wabek-card--info">
		<h2 class="wabek-card__title"><?php esc_html_e( 'How delivery works', 'wabek-whatsapp' ); ?></h2>
		<p><?php esc_html_e( 'Messages are queued in the background and never slow down checkout. If the customer messaged your business number in the last 24 hours, the text below is delivered as written. Otherwise WhatsApp only allows approved templates: enter the name of an approved template and the variables it uses, or WABEK falls back to your account’s default template.', 'wabek-whatsapp' ); ?></p>
	</section>

	<?php foreach ( $wabek_wa_labels as $wabek_wa_event => $wabek_wa_label ) : ?>
		<?php
		$wabek_wa_cfg  = $wabek_wa_events[ $wabek_wa_event ];
		$wabek_wa_base = 'events[' . $wabek_wa_event . ']';
		$wabek_wa_id   = 'wabek-msg-' . $wabek_wa_event;
		?>
		<details class="wabek-card wabek-event" <?php echo 'yes' === $wabek_wa_cfg['enabled'] ? 'open' : ''; ?>>
			<summary class="wabek-event__summary">
				<span class="wabek-event__name"><?php echo esc_html( $wabek_wa_label ); ?></span>
				<span class="wabek-pill wabek-pill--<?php echo 'yes' === $wabek_wa_cfg['enabled'] ? 'ok' : 'muted'; ?>"><?php echo 'yes' === $wabek_wa_cfg['enabled'] ? esc_html__( 'On', 'wabek-whatsapp' ) : esc_html__( 'Off', 'wabek-whatsapp' ); ?></span>
			</summary>
			<?php Admin::toggle( $wabek_wa_base . '[enabled]', 'yes' === $wabek_wa_cfg['enabled'], __( 'Send this message to the customer', 'wabek-whatsapp' ) ); ?>
			<div class="wabek-field">
				<label for="<?php echo esc_attr( $wabek_wa_id ); ?>"><?php esc_html_e( 'Message', 'wabek-whatsapp' ); ?></label>
				<textarea id="<?php echo esc_attr( $wabek_wa_id ); ?>" name="<?php echo esc_attr( $wabek_wa_base . '[message]' ); ?>" rows="7" class="large-text wabek-textarea"><?php echo esc_textarea( $wabek_wa_cfg['message'] ); ?></textarea>
				<?php Admin::variable_chips( $wabek_wa_variables, $wabek_wa_id ); ?>
			</div>
			<div class="wabek-grid">
				<div class="wabek-field">
					<label for="<?php echo esc_attr( $wabek_wa_id . '-tpl' ); ?>"><?php esc_html_e( 'Approved template (outside 24 hours)', 'wabek-whatsapp' ); ?></label>
					<input type="text" id="<?php echo esc_attr( $wabek_wa_id . '-tpl' ); ?>" name="<?php echo esc_attr( $wabek_wa_base . '[template]' ); ?>" class="regular-text" dir="ltr" value="<?php echo esc_attr( $wabek_wa_cfg['template'] ); ?>" placeholder="order_update" />
				</div>
				<div class="wabek-field">
					<label for="<?php echo esc_attr( $wabek_wa_id . '-params' ); ?>"><?php esc_html_e( 'Template variables', 'wabek-whatsapp' ); ?></label>
					<input type="text" id="<?php echo esc_attr( $wabek_wa_id . '-params' ); ?>" name="<?php echo esc_attr( $wabek_wa_base . '[template_params]' ); ?>" class="regular-text" dir="ltr" value="<?php echo esc_attr( $wabek_wa_cfg['template_params'] ); ?>" placeholder="customer_name, order_id" />
				</div>
			</div>
			<p class="wabek-help"><?php esc_html_e( 'Template variables are the named parameters of the approved template, separated by commas, using the variable names above (e.g. customer_name, order_id, order_total).', 'wabek-whatsapp' ); ?></p>
		</details>
	<?php endforeach; ?>

	<p class="wabek-submit"><button type="submit" class="button button-primary wabek-btn"><?php esc_html_e( 'Save changes', 'wabek-whatsapp' ); ?></button></p>
</form>
