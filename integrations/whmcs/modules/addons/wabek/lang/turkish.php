<?php
/**
 * WABEK for WHMCS — Turkish strings (client area and checkout only; everything else falls back to English).
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

$_ADDONLANG = [
    '_language' => 'turkish',
    '_dir' => 'ltr',

    'err_csrf' => 'Oturum anahtarınız geçersiz veya süresi dolmuş. Sayfayı yenileyip tekrar deneyin.',
    'err_unknown_action' => 'Bilinmeyen işlem.',

    'otp_disabled' => 'WhatsApp doğrulaması etkin değil.',
    'otp_no_phone' => 'Profilinizde geçerli bir WhatsApp numarası yok.',
    'otp_rate_limited' => 'Çok fazla kod istendi. Lütfen daha sonra tekrar deneyin.',
    'otp_too_soon' => 'Yeni bir kod istemeden önce lütfen {seconds} saniye bekleyin.',
    'otp_send_failed' => 'Kod gönderilemedi. Lütfen daha sonra tekrar deneyin.',
    'otp_invalid' => 'Kod hatalı.',
    'otp_expired' => 'Kodun süresi doldu. Yeni bir kod isteyin.',
    'otp_too_many' => 'Çok fazla hatalı deneme. Yeni bir kod isteyin.',
    'otp_service_down' => 'Doğrulama geçici olarak kullanılamıyor. Lütfen birazdan tekrar deneyin.',

    'client_nav' => 'WhatsApp bildirimleri',
    'client_nav_prefs' => 'Tercihler',
    'client_prefs_title' => 'WhatsApp bildirimleri',
    'client_prefs_intro' => 'Sizinle WhatsApp üzerinden iletişim kurup kuramayacağımızı seçin.',
    'client_number' => 'WhatsApp numaranız',
    'client_number_help' => 'Profilinizdeki telefon numarasını kullanıyoruz.',
    'client_no_phone' => 'Profilinizde ülke koduyla birlikte geçerli bir telefon numarası yok.',
    'client_edit_profile' => 'Profilinizi güncelleyin',
    'client_notifications' => 'Bildirimler',
    'client_state_on' => 'Açık',
    'client_state_off' => 'Kapalı',
    'client_subscribed' => 'WhatsApp bildirimleri alıyorsunuz',
    'client_unsubscribed' => 'WhatsApp bildirimleri almıyorsunuz',
    'client_critical_note' => 'Hesabınız ve faturalarınızla ilgili temel bildirimler yine de gönderilebilir.',
    'client_btn_subscribe' => 'WhatsApp bildirimlerini aç',
    'client_btn_unsubscribe' => 'WhatsApp bildirimlerini durdur',
    'client_ok_subscribed' => 'WhatsApp bildirimleri açıldı.',
    'client_ok_unsubscribed' => 'WhatsApp bildirimleri kapatıldı.',
    'client_verify_title' => 'WhatsApp numaranızı doğrulayın',
    'client_verify_intro' => 'WhatsApp numaranıza tek kullanımlık bir kod göndereceğiz.',
    'client_login_gate' => 'Güvenliğiniz için devam etmek üzere WhatsApp’a gönderdiğimiz kodu girin.',
    'client_btn_verify' => 'Numarayı doğrula',
    'client_code_to' => 'Kodun gönderileceği numara:',
    'client_code_label' => 'Doğrulama kodu',
    'client_btn_send_code' => 'Kodu gönder',
    'client_btn_resend' => 'Yeni kod gönder',
    'client_btn_confirm' => 'Onayla',
    'client_ok_code_sent' => '{phone} numarasına bir kod gönderildi.',
    'client_ok_verified' => 'WhatsApp numaranız doğrulandı.',
    'client_ok_login_verified' => 'Doğrulandı. Tekrar hoş geldiniz!',
    'client_verified_badge' => 'Doğrulandı',
    'client_back' => 'Geri',
    'client_logout' => 'Çıkış yap',

    'checkout_consent_label' => 'Sipariş, fatura ve destek bilgilendirmelerini WhatsApp üzerinden almak istiyorum',
    'checkout_consent_help' => 'Bunu istediğiniz zaman Hesap → WhatsApp bildirimleri bölümünden değiştirebilirsiniz.',
];
