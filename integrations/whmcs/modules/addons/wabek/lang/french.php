<?php
/**
 * WABEK for WHMCS — French strings (client area and checkout only; everything else falls back to English).
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

$_ADDONLANG = [
    '_language' => 'french',
    '_dir' => 'ltr',

    'err_csrf' => 'Votre jeton de session est invalide ou a expiré. Rechargez la page et réessayez.',
    'err_unknown_action' => 'Action inconnue.',

    'otp_disabled' => 'La vérification WhatsApp n’est pas activée.',
    'otp_no_phone' => 'Votre profil ne contient pas de numéro WhatsApp valide.',
    'otp_rate_limited' => 'Trop de codes ont été demandés. Veuillez réessayer plus tard.',
    'otp_too_soon' => 'Veuillez patienter {seconds} secondes avant de demander un nouveau code.',
    'otp_send_failed' => 'Nous n’avons pas pu envoyer le code. Veuillez réessayer plus tard.',
    'otp_invalid' => 'Le code est incorrect.',
    'otp_expired' => 'Le code a expiré. Demandez-en un nouveau.',
    'otp_too_many' => 'Trop de tentatives incorrectes. Demandez un nouveau code.',
    'otp_service_down' => 'La vérification est momentanément indisponible. Veuillez réessayer dans un instant.',

    'client_nav' => 'Notifications WhatsApp',
    'client_nav_prefs' => 'Préférences',
    'client_prefs_title' => 'Notifications WhatsApp',
    'client_prefs_intro' => 'Indiquez si nous pouvons vous contacter sur WhatsApp.',
    'client_number' => 'Votre numéro WhatsApp',
    'client_number_help' => 'Nous utilisons le numéro de téléphone de votre profil.',
    'client_no_phone' => 'Votre profil ne contient pas de numéro de téléphone valide avec l’indicatif du pays.',
    'client_edit_profile' => 'Mettre à jour votre profil',
    'client_notifications' => 'Notifications',
    'client_state_on' => 'Activées',
    'client_state_off' => 'Désactivées',
    'client_subscribed' => 'Vous recevez les notifications WhatsApp',
    'client_unsubscribed' => 'Vous ne recevez pas les notifications WhatsApp',
    'client_critical_note' => 'Les avis essentiels concernant votre compte et votre facturation peuvent toujours être envoyés.',
    'client_btn_subscribe' => 'Activer les notifications WhatsApp',
    'client_btn_unsubscribe' => 'Arrêter les notifications WhatsApp',
    'client_ok_subscribed' => 'Les notifications WhatsApp sont activées.',
    'client_ok_unsubscribed' => 'Les notifications WhatsApp sont désactivées.',
    'client_verify_title' => 'Vérifier votre numéro WhatsApp',
    'client_verify_intro' => 'Nous allons envoyer un code à usage unique sur votre WhatsApp.',
    'client_login_gate' => 'Pour votre sécurité, saisissez le code que nous envoyons sur votre WhatsApp pour continuer.',
    'client_btn_verify' => 'Vérifier le numéro',
    'client_code_to' => 'Le code sera envoyé au',
    'client_code_label' => 'Code de vérification',
    'client_btn_send_code' => 'Envoyer le code',
    'client_btn_resend' => 'Envoyer un nouveau code',
    'client_btn_confirm' => 'Confirmer',
    'client_ok_code_sent' => 'Un code a été envoyé au {phone}.',
    'client_ok_verified' => 'Votre numéro WhatsApp est vérifié.',
    'client_ok_login_verified' => 'Vérifié. Bon retour parmi nous !',
    'client_verified_badge' => 'Vérifié',
    'client_back' => 'Retour',
    'client_logout' => 'Se déconnecter',

    'checkout_consent_label' => 'Envoyez-moi les informations sur mes commandes, ma facturation et le support sur WhatsApp',
    'checkout_consent_help' => 'Vous pouvez modifier ce choix à tout moment dans Compte → Notifications WhatsApp.',
];
