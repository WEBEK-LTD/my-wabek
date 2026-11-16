<?php
/**
 * WABEK for WHMCS — Spanish strings (client area and checkout only; everything else falls back to English).
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

$_ADDONLANG = [
    '_language' => 'spanish',
    '_dir' => 'ltr',

    'err_csrf' => 'Su token de sesión no es válido o ha caducado. Recargue la página e inténtelo de nuevo.',
    'err_unknown_action' => 'Acción desconocida.',

    'otp_disabled' => 'La verificación por WhatsApp no está activada.',
    'otp_no_phone' => 'Su perfil no tiene un número de WhatsApp válido.',
    'otp_rate_limited' => 'Se han solicitado demasiados códigos. Inténtelo de nuevo más tarde.',
    'otp_too_soon' => 'Espere {seconds} segundos antes de solicitar un código nuevo.',
    'otp_send_failed' => 'No pudimos enviar el código. Inténtelo de nuevo más tarde.',
    'otp_invalid' => 'El código no es correcto.',
    'otp_expired' => 'El código ha caducado. Solicite uno nuevo.',
    'otp_too_many' => 'Demasiados intentos fallidos. Solicite un código nuevo.',
    'otp_service_down' => 'La verificación no está disponible en este momento. Inténtelo de nuevo en breve.',

    'client_nav' => 'Notificaciones de WhatsApp',
    'client_nav_prefs' => 'Preferencias',
    'client_prefs_title' => 'Notificaciones de WhatsApp',
    'client_prefs_intro' => 'Elija si podemos contactarle por WhatsApp.',
    'client_number' => 'Su número de WhatsApp',
    'client_number_help' => 'Utilizamos el número de teléfono de su perfil.',
    'client_no_phone' => 'Su perfil no tiene un número de teléfono válido con el prefijo del país.',
    'client_edit_profile' => 'Actualizar su perfil',
    'client_notifications' => 'Notificaciones',
    'client_state_on' => 'Activadas',
    'client_state_off' => 'Desactivadas',
    'client_subscribed' => 'Recibe notificaciones de WhatsApp',
    'client_unsubscribed' => 'No recibe notificaciones de WhatsApp',
    'client_critical_note' => 'Es posible que sigamos enviándole avisos esenciales sobre su cuenta y su facturación.',
    'client_btn_subscribe' => 'Activar las notificaciones de WhatsApp',
    'client_btn_unsubscribe' => 'Dejar de recibir notificaciones de WhatsApp',
    'client_ok_subscribed' => 'Las notificaciones de WhatsApp están activadas.',
    'client_ok_unsubscribed' => 'Las notificaciones de WhatsApp están desactivadas.',
    'client_verify_title' => 'Verifique su número de WhatsApp',
    'client_verify_intro' => 'Le enviaremos un código de un solo uso por WhatsApp.',
    'client_login_gate' => 'Por su seguridad, introduzca el código que le enviamos por WhatsApp para continuar.',
    'client_btn_verify' => 'Verificar número',
    'client_code_to' => 'El código se enviará al',
    'client_code_label' => 'Código de verificación',
    'client_btn_send_code' => 'Enviar código',
    'client_btn_resend' => 'Enviar un código nuevo',
    'client_btn_confirm' => 'Confirmar',
    'client_ok_code_sent' => 'Se ha enviado un código al {phone}.',
    'client_ok_verified' => 'Su número de WhatsApp está verificado.',
    'client_ok_login_verified' => 'Verificado. ¡Bienvenido de nuevo!',
    'client_verified_badge' => 'Verificado',
    'client_back' => 'Volver',
    'client_logout' => 'Cerrar sesión',

    'checkout_consent_label' => 'Quiero recibir avisos sobre pedidos, facturación y soporte por WhatsApp',
    'checkout_consent_help' => 'Puede cambiarlo en cualquier momento en Cuenta → Notificaciones de WhatsApp.',

    // Campo personalizado nativo
    'cf_consent_name' => 'Recibir notificaciones por WhatsApp',
    'cf_consent_desc' => 'Novedades de pedidos, facturación y soporte por WhatsApp. Es posible que se sigan enviando avisos esenciales de su cuenta.',
    'client_state_line_on' => 'Las notificaciones por WhatsApp están activadas para su cuenta',
    'client_state_line_off' => 'Las notificaciones por WhatsApp están desactivadas para su cuenta',
    'client_sent_to' => 'Los mensajes se envían al',
    'client_hp_manage' => 'Gestionar preferencias',
];
