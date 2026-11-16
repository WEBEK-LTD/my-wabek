<?php
/**
 * WABEK for WHMCS — German strings (client area and checkout only; everything else falls back to English).
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

$_ADDONLANG = [
    '_language' => 'german',
    '_dir' => 'ltr',

    'err_csrf' => 'Ihr Sitzungstoken ist ungültig oder abgelaufen. Laden Sie die Seite neu und versuchen Sie es erneut.',
    'err_unknown_action' => 'Unbekannte Aktion.',

    'otp_disabled' => 'Die WhatsApp-Verifizierung ist nicht aktiviert.',
    'otp_no_phone' => 'Ihr Profil enthält keine gültige WhatsApp-Nummer.',
    'otp_rate_limited' => 'Es wurden zu viele Codes angefordert. Bitte versuchen Sie es später erneut.',
    'otp_too_soon' => 'Bitte warten Sie {seconds} Sekunden, bevor Sie einen neuen Code anfordern.',
    'otp_send_failed' => 'Der Code konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
    'otp_invalid' => 'Der Code ist nicht korrekt.',
    'otp_expired' => 'Der Code ist abgelaufen. Fordern Sie einen neuen an.',
    'otp_too_many' => 'Zu viele Fehlversuche. Fordern Sie einen neuen Code an.',
    'otp_service_down' => 'Die Verifizierung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es gleich noch einmal.',

    'client_nav' => 'WhatsApp-Benachrichtigungen',
    'client_nav_prefs' => 'Einstellungen',
    'client_prefs_title' => 'WhatsApp-Benachrichtigungen',
    'client_prefs_intro' => 'Legen Sie fest, ob wir Sie über WhatsApp kontaktieren dürfen.',
    'client_number' => 'Ihre WhatsApp-Nummer',
    'client_number_help' => 'Wir verwenden die Telefonnummer aus Ihrem Profil.',
    'client_no_phone' => 'Ihr Profil enthält keine gültige Telefonnummer mit Ländervorwahl.',
    'client_edit_profile' => 'Profil aktualisieren',
    'client_notifications' => 'Benachrichtigungen',
    'client_state_on' => 'Aktiv',
    'client_state_off' => 'Aus',
    'client_subscribed' => 'Sie erhalten WhatsApp-Benachrichtigungen',
    'client_unsubscribed' => 'Sie erhalten keine WhatsApp-Benachrichtigungen',
    'client_critical_note' => 'Wichtige Hinweise zu Ihrem Konto und zur Abrechnung können weiterhin gesendet werden.',
    'client_btn_subscribe' => 'WhatsApp-Benachrichtigungen aktivieren',
    'client_btn_unsubscribe' => 'WhatsApp-Benachrichtigungen beenden',
    'client_ok_subscribed' => 'WhatsApp-Benachrichtigungen sind aktiviert.',
    'client_ok_unsubscribed' => 'WhatsApp-Benachrichtigungen sind deaktiviert.',
    'client_verify_title' => 'WhatsApp-Nummer bestätigen',
    'client_verify_intro' => 'Wir senden Ihnen einen Einmalcode per WhatsApp.',
    'client_login_gate' => 'Geben Sie zu Ihrer Sicherheit den Code ein, den wir Ihnen per WhatsApp senden, um fortzufahren.',
    'client_btn_verify' => 'Nummer bestätigen',
    'client_code_to' => 'Der Code wird gesendet an',
    'client_code_label' => 'Bestätigungscode',
    'client_btn_send_code' => 'Code senden',
    'client_btn_resend' => 'Neuen Code senden',
    'client_btn_confirm' => 'Bestätigen',
    'client_ok_code_sent' => 'Ein Code wurde an {phone} gesendet.',
    'client_ok_verified' => 'Ihre WhatsApp-Nummer ist bestätigt.',
    'client_ok_login_verified' => 'Bestätigt. Willkommen zurück!',
    'client_verified_badge' => 'Bestätigt',
    'client_back' => 'Zurück',
    'client_logout' => 'Abmelden',

    'checkout_consent_label' => 'Informationen zu Bestellungen, Rechnungen und Support per WhatsApp erhalten',
    'checkout_consent_help' => 'Sie können dies jederzeit unter Konto → WhatsApp-Benachrichtigungen ändern.',

    // Natives benutzerdefiniertes Feld
    'cf_consent_name' => 'WhatsApp-Benachrichtigungen erhalten',
    'cf_consent_desc' => 'Bestell-, Rechnungs- und Support-Updates per WhatsApp. Wichtige Hinweise zu Ihrem Konto können weiterhin gesendet werden.',
];
