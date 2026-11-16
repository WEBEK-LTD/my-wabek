<?php
/**
 * Send log: the most recent 200 messages.
 *
 * Expects: $rows (array), $filter (string).
 *
 * @package Wabek\WhatsApp
 */

use Wabek\WhatsApp\Admin\Admin;
use Wabek\WhatsApp\Logger;
use Wabek\WhatsApp\Phone;
use Wabek\WhatsApp\Settings;

defined( 'ABSPATH' ) || exit;

$wabek_wa_events = Settings::log_event_labels();
?>
<section class="wabek-card">
	<div class="wabek-log-toolbar">
		<form method="get" class="wabek-inline">
			<input type="hidden" name="page" value="<?php echo esc_attr( Admin::LOG_SLUG ); ?>" />
			<label for="wabek-log-status" class="screen-reader-text"><?php esc_html_e( 'Status', 'wabek-whatsapp' ); ?></label>
			<select id="wabek-log-status" name="status">
				<option value=""><?php esc_html_e( 'All statuses', 'wabek-whatsapp' ); ?></option>
				<?php foreach ( Admin::statuses() as $wabek_wa_status ) : ?>
					<option value="<?php echo esc_attr( $wabek_wa_status ); ?>" <?php selected( $filter, $wabek_wa_status ); ?>><?php echo esc_html( Admin::status_label( $wabek_wa_status ) ); ?></option>
				<?php endforeach; ?>
			</select>
			<button type="submit" class="button"><?php esc_html_e( 'Filter', 'wabek-whatsapp' ); ?></button>
		</form>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="wabek-clear-log">
			<input type="hidden" name="action" value="wabek_wa_clear_log" />
			<?php wp_nonce_field( 'wabek_wa_clear_log' ); ?>
			<button type="submit" class="button wabek-btn--danger"><?php esc_html_e( 'Clear log', 'wabek-whatsapp' ); ?></button>
		</form>
	</div>

	<p class="wabek-help">
		<?php
		/* translators: %d: number of entries kept */
		echo esc_html( sprintf( __( 'The latest %d messages are kept. Phone numbers are partly hidden.', 'wabek-whatsapp' ), Logger::KEEP ) );
		?>
	</p>

	<?php if ( empty( $rows ) ) : ?>
		<div class="wabek-empty">
			<img src="<?php echo esc_url( WABEK_WA_URL . 'assets/images/logo-mark.png' ); ?>" alt="" width="56" height="56" />
			<p><?php esc_html_e( 'No messages yet. They will appear here as soon as orders come in.', 'wabek-whatsapp' ); ?></p>
		</div>
	<?php else : ?>
		<div class="wabek-table-wrap">
			<table class="widefat striped wabek-table">
				<thead>
					<tr>
						<th scope="col"><?php esc_html_e( 'Time', 'wabek-whatsapp' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Order', 'wabek-whatsapp' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Phone', 'wabek-whatsapp' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Event', 'wabek-whatsapp' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Status', 'wabek-whatsapp' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Error', 'wabek-whatsapp' ); ?></th>
						<th scope="col"><span class="screen-reader-text"><?php esc_html_e( 'Actions', 'wabek-whatsapp' ); ?></span></th>
					</tr>
				</thead>
				<tbody>
				<?php foreach ( $rows as $wabek_wa_row ) : ?>
					<?php
					$wabek_wa_ts    = strtotime( $wabek_wa_row['created_at'] . ' UTC' );
					$wabek_wa_order = (int) $wabek_wa_row['order_id'] && function_exists( 'wc_get_order' ) ? wc_get_order( (int) $wabek_wa_row['order_id'] ) : null;
					$wabek_wa_final = in_array( $wabek_wa_row['status'], array( 'sent', 'failed', 'skipped' ), true );
					?>
					<tr>
						<td><?php echo esc_html( $wabek_wa_ts ? wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $wabek_wa_ts ) : '' ); ?></td>
						<td>
							<?php if ( $wabek_wa_order ) : ?>
								<a href="<?php echo esc_url( $wabek_wa_order->get_edit_order_url() ); ?>">#<?php echo esc_html( $wabek_wa_order->get_order_number() ); ?></a>
							<?php elseif ( (int) $wabek_wa_row['order_id'] ) : ?>
								#<?php echo esc_html( (string) (int) $wabek_wa_row['order_id'] ); ?>
							<?php else : ?>
								—
							<?php endif; ?>
						</td>
						<td dir="ltr" class="wabek-mono"><?php echo esc_html( Phone::mask( $wabek_wa_row['phone'] ) ); ?></td>
						<td><?php echo esc_html( isset( $wabek_wa_events[ $wabek_wa_row['event'] ] ) ? $wabek_wa_events[ $wabek_wa_row['event'] ] : $wabek_wa_row['event'] ); ?></td>
						<td>
							<span class="wabek-status wabek-status--<?php echo esc_attr( $wabek_wa_row['status'] ); ?>"><?php echo esc_html( Admin::status_label( $wabek_wa_row['status'] ) ); ?></span>
							<?php if ( '' !== $wabek_wa_row['delivery'] ) : ?>
								<span class="wabek-delivery wabek-delivery--<?php echo esc_attr( $wabek_wa_row['delivery'] ); ?>"><?php echo esc_html( Admin::delivery_label( $wabek_wa_row['delivery'] ) ); ?></span>
							<?php endif; ?>
							<?php if ( (int) $wabek_wa_row['attempts'] > 1 ) : ?>
								<span class="wabek-attempts">
									<?php
									/* translators: %d: number of attempts */
									echo esc_html( sprintf( __( '%d attempts', 'wabek-whatsapp' ), (int) $wabek_wa_row['attempts'] ) );
									?>
								</span>
							<?php endif; ?>
						</td>
						<td class="wabek-error">
							<?php if ( '' !== $wabek_wa_row['error'] ) : ?>
								<?php if ( (int) $wabek_wa_row['http_code'] ) : ?>
									<code><?php echo esc_html( (string) (int) $wabek_wa_row['http_code'] ); ?></code>
								<?php endif; ?>
								<?php echo esc_html( wp_html_excerpt( $wabek_wa_row['error'], 220, '…' ) ); ?>
							<?php endif; ?>
						</td>
						<td>
							<?php if ( 'sent' === $wabek_wa_row['status'] && '' !== $wabek_wa_row['message_id'] && ! in_array( $wabek_wa_row['delivery'], array( 'read', 'failed' ), true ) ) : ?>
								<button type="button" class="button button-small wabek-check-delivery" data-id="<?php echo esc_attr( (string) (int) $wabek_wa_row['id'] ); ?>"><?php esc_html_e( 'Check delivery', 'wabek-whatsapp' ); ?></button>
							<?php endif; ?>
							<?php if ( $wabek_wa_final && '' !== $wabek_wa_row['phone'] ) : ?>
								<a class="button button-small" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=wabek_wa_resend&id=' . (int) $wabek_wa_row['id'] ), 'wabek_wa_resend_' . (int) $wabek_wa_row['id'] ) ); ?>"><?php esc_html_e( 'Resend', 'wabek-whatsapp' ); ?></a>
							<?php endif; ?>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		</div>
	<?php endif; ?>
</section>
