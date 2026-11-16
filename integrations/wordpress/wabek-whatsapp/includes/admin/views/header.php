<?php
/**
 * Shared admin header: brand bar, connection status, tabs and notices.
 *
 * Expects: $tabs (array), $current (string).
 *
 * @package Wabek\WhatsApp
 */

use Wabek\WhatsApp\Admin\Admin;
use Wabek\WhatsApp\Settings;

defined( 'ABSPATH' ) || exit;

$wabek_wa_connection = get_option( Settings::CONNECTION, array() );
$wabek_wa_has_key    = Settings::has_api_key();
if ( ! $wabek_wa_has_key ) {
	$wabek_wa_pill = array( 'muted', __( 'No API key', 'wabek-whatsapp' ) );
} elseif ( isset( $wabek_wa_connection['ok'] ) && $wabek_wa_connection['ok'] ) {
	$wabek_wa_pill = array( 'ok', __( 'Connected', 'wabek-whatsapp' ) );
} elseif ( isset( $wabek_wa_connection['ok'] ) ) {
	$wabek_wa_pill = array( 'bad', __( 'Not connected', 'wabek-whatsapp' ) );
} else {
	$wabek_wa_pill = array( 'muted', __( 'Not tested', 'wabek-whatsapp' ) );
}
$wabek_wa_notice_key = isset( $_GET['wabek_notice'] ) ? sanitize_key( wp_unslash( $_GET['wabek_notice'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
$wabek_wa_notices    = Admin::notices();
?>
<div class="wrap wabek-wrap">
	<h1 class="screen-reader-text"><?php esc_html_e( 'WABEK WhatsApp', 'wabek-whatsapp' ); ?></h1>
	<header class="wabek-hero">
		<div class="wabek-hero__brand">
			<img src="<?php echo esc_url( WABEK_WA_URL . 'assets/images/logo-mark.png' ); ?>" alt="" width="48" height="48" class="wabek-hero__logo" />
			<div>
				<p class="wabek-hero__title"><?php esc_html_e( 'WABEK WhatsApp', 'wabek-whatsapp' ); ?></p>
				<p class="wabek-hero__subtitle"><?php esc_html_e( 'Order notifications, cart reminders and OTP login for WooCommerce', 'wabek-whatsapp' ); ?></p>
			</div>
		</div>
		<span class="wabek-pill wabek-pill--<?php echo esc_attr( $wabek_wa_pill[0] ); ?>" id="wabek-connection-pill"><span class="wabek-pill__dot" aria-hidden="true"></span><?php echo esc_html( $wabek_wa_pill[1] ); ?></span>
	</header>

	<nav class="wabek-tabs" aria-label="<?php esc_attr_e( 'WABEK sections', 'wabek-whatsapp' ); ?>">
		<?php foreach ( $tabs as $wabek_wa_key => $wabek_wa_tab ) : ?>
			<a class="wabek-tab<?php echo $wabek_wa_key === $current ? ' is-active' : ''; ?>" href="<?php echo esc_url( admin_url( 'admin.php?page=' . Admin::SLUG . '&tab=' . $wabek_wa_key ) ); ?>"<?php echo $wabek_wa_key === $current ? ' aria-current="page"' : ''; ?>><?php echo esc_html( $wabek_wa_tab[0] ); ?></a>
		<?php endforeach; ?>
		<a class="wabek-tab<?php echo 'log' === $current ? ' is-active' : ''; ?>" href="<?php echo esc_url( admin_url( 'admin.php?page=' . Admin::LOG_SLUG ) ); ?>"<?php echo 'log' === $current ? ' aria-current="page"' : ''; ?>><?php esc_html_e( 'Send log', 'wabek-whatsapp' ); ?></a>
	</nav>

	<?php if ( isset( $wabek_wa_notices[ $wabek_wa_notice_key ] ) ) : ?>
		<div class="notice notice-<?php echo esc_attr( $wabek_wa_notices[ $wabek_wa_notice_key ][0] ); ?> is-dismissible wabek-notice"><p><?php echo esc_html( $wabek_wa_notices[ $wabek_wa_notice_key ][1] ); ?></p></div>
	<?php endif; ?>
	<?php if ( ! $wabek_wa_has_key && 'connection' !== $current && current_user_can( 'manage_options' ) ) : ?>
		<div class="notice notice-warning wabek-notice"><p>
			<?php esc_html_e( 'Add your WABEK API key to start sending WhatsApp messages.', 'wabek-whatsapp' ); ?>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=' . Admin::SLUG . '&tab=connection' ) ); ?>"><?php esc_html_e( 'Open connection settings', 'wabek-whatsapp' ); ?></a>
		</p></div>
	<?php endif; ?>
