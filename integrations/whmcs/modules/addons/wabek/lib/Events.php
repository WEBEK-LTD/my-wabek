<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Registry of notification events: defaults (shipped templates in English
 * and Modern Standard Arabic) merged with the admin's saved settings.
 */
final class Events
{
    public const TABLE = 'mod_wabek_events';

    private const F_CLIENT  = ['client_name', 'first_name', 'last_name', 'company', 'email', 'client_id', 'client_area_url', 'system_name', 'system_url', 'date'];
    private const F_INVOICE = ['invoice_id', 'invoice_num', 'invoice_total', 'invoice_balance', 'invoice_status', 'due_date', 'invoice_url'];
    private const F_SERVICE = ['service_id', 'service_name', 'service_label', 'product_group', 'domain', 'billing_cycle', 'next_due_date', 'amount', 'service_url'];
    private const F_TICKET  = ['ticket_id', 'ticket_subject', 'ticket_status', 'ticket_department', 'ticket_url'];
    private const F_ORDER   = ['order_id', 'order_number', 'order_total', 'invoice_id'];

    /** @var array<string,array>|null */
    private static $rows = null;

    /**
     * key => [audience, group, hook, enabled, critical, fields, en, ar]
     */
    public static function definitions(): array
    {
        $c = self::F_CLIENT;
        return [
            'client_welcome' => ['client', 'account', 'ClientAdd', true, false, $c,
                "Hello {client_name},\n\nWelcome to {system_name}! Your account has been created successfully.\n\nClient area: {client_area_url}",
                "مرحبًا {client_name}،\n\nأهلًا بك في {system_name}! تم إنشاء حسابك بنجاح.\n\nمنطقة العملاء: {client_area_url}"],

            'invoice_created' => ['client', 'billing', 'InvoiceCreated', true, true, array_merge($c, self::F_INVOICE),
                "*New invoice #{invoice_num}*\n\nHello {client_name},\nA new invoice has been issued for your account.\n\nAmount: {invoice_total}\nDue date: {due_date}\n\nView and pay: {invoice_url}",
                "*فاتورة جديدة رقم {invoice_num}*\n\nمرحبًا {client_name}،\nصدرت فاتورة جديدة على حسابك.\n\nالمبلغ: {invoice_total}\nتاريخ الاستحقاق: {due_date}\n\nللاطلاع والدفع: {invoice_url}"],

            'invoice_reminder' => ['client', 'billing', 'InvoicePaymentReminder', false, false, array_merge($c, self::F_INVOICE),
                "*Payment reminder*\n\nHello {client_name},\nThis is a reminder that invoice #{invoice_num} ({invoice_balance}) is due on {due_date}.\n\nPay now: {invoice_url}",
                "*تذكير بالدفع*\n\nمرحبًا {client_name}،\nنذكّرك بأن الفاتورة رقم {invoice_num} بمبلغ {invoice_balance} مستحقة في {due_date}.\n\nادفع الآن: {invoice_url}"],

            'invoice_due_soon' => ['client', 'billing', 'DailyCronJob', true, false, array_merge($c, self::F_INVOICE, ['days']),
                "Hello {client_name},\nInvoice #{invoice_num} for {invoice_balance} is due in {days} day(s), on {due_date}.\n\nPay now: {invoice_url}",
                "مرحبًا {client_name}،\nتستحق الفاتورة رقم {invoice_num} بمبلغ {invoice_balance} بعد {days} يوم/أيام، في {due_date}.\n\nادفع الآن: {invoice_url}"],

            'invoice_due_today' => ['client', 'billing', 'DailyCronJob', true, false, array_merge($c, self::F_INVOICE),
                "Hello {client_name},\nInvoice #{invoice_num} for {invoice_balance} is due today.\n\nPlease pay now to avoid any interruption: {invoice_url}",
                "مرحبًا {client_name}،\nتستحق اليوم الفاتورة رقم {invoice_num} بمبلغ {invoice_balance}.\n\nيُرجى الدفع الآن لتجنّب انقطاع الخدمة: {invoice_url}"],

            'invoice_overdue' => ['client', 'billing', 'DailyCronJob', true, false, array_merge($c, self::F_INVOICE, ['days']),
                "*Overdue invoice*\n\nHello {client_name},\nInvoice #{invoice_num} for {invoice_balance} is {days} day(s) overdue (due {due_date}).\n\nPlease pay as soon as possible: {invoice_url}",
                "*فاتورة متأخرة السداد*\n\nمرحبًا {client_name}،\nتأخّر سداد الفاتورة رقم {invoice_num} بمبلغ {invoice_balance} مدة {days} يوم/أيام (تاريخ الاستحقاق {due_date}).\n\nيُرجى الدفع في أقرب وقت: {invoice_url}"],

            'invoice_paid' => ['client', 'billing', 'InvoicePaid', true, true, array_merge($c, self::F_INVOICE),
                "*Payment received*\n\nHello {client_name},\nThank you! We have received payment for invoice #{invoice_num} ({invoice_total}).\n\n{invoice_url}",
                "*تم استلام الدفعة*\n\nمرحبًا {client_name}،\nشكرًا لك! استلمنا دفعة الفاتورة رقم {invoice_num} بمبلغ {invoice_total}.\n\n{invoice_url}"],

            'invoice_cancelled' => ['client', 'billing', 'InvoiceCancelled', false, false, array_merge($c, self::F_INVOICE),
                "Hello {client_name},\nInvoice #{invoice_num} has been cancelled. No payment is required.",
                "مرحبًا {client_name}،\nأُلغيت الفاتورة رقم {invoice_num}، ولا يلزمك سدادها."],

            'order_accepted' => ['client', 'orders', 'AcceptOrder', true, true, array_merge($c, self::F_ORDER),
                "*Order confirmed*\n\nHello {client_name},\nYour order #{order_number} has been accepted and is being processed.\n\n{client_area_url}",
                "*تأكيد الطلب*\n\nمرحبًا {client_name}،\nتم قبول طلبك رقم {order_number} وجارٍ تنفيذه.\n\n{client_area_url}"],

            'service_activated' => ['client', 'services', 'AfterModuleCreate', true, true, array_merge($c, self::F_SERVICE, ['credentials']),
                "*Service activated*\n\nHello {client_name},\nYour service {service_label} is now active.\n{credentials}\nManage it: {service_url}",
                "*تفعيل الخدمة*\n\nمرحبًا {client_name}،\nأصبحت خدمتك {service_label} مفعّلة الآن.\n{credentials}\nلإدارة الخدمة: {service_url}"],

            'service_suspended' => ['client', 'services', 'AfterModuleSuspend', true, true, array_merge($c, self::F_SERVICE, ['suspend_reason']),
                "Hello {client_name},\nYour service {service_label} has been suspended.\n\nPlease settle any outstanding invoices or contact support: {client_area_url}",
                "مرحبًا {client_name}،\nعُلّقت خدمتك {service_label}.\n\nيُرجى سداد الفواتير المستحقة أو التواصل مع الدعم الفني: {client_area_url}"],

            'service_unsuspended' => ['client', 'services', 'AfterModuleUnsuspend', true, true, array_merge($c, self::F_SERVICE),
                "Hello {client_name},\nGood news! Your service {service_label} has been reactivated.",
                "مرحبًا {client_name}،\nيسعدنا إبلاغك بأن خدمتك {service_label} أُعيد تفعيلها."],

            'service_terminated' => ['client', 'services', 'AfterModuleTerminate', true, true, array_merge($c, self::F_SERVICE),
                "Hello {client_name},\nYour service {service_label} has been terminated. If you believe this is a mistake, please contact us.",
                "مرحبًا {client_name}،\nأُنهيت خدمتك {service_label}. إن كنت ترى أن ذلك حدث عن طريق الخطأ، فيُرجى التواصل معنا."],

            'ticket_opened' => ['client', 'support', 'TicketOpen', true, false, array_merge($c, self::F_TICKET),
                "Hello {client_name},\nWe have received your support ticket #{ticket_id}: {ticket_subject}\nOur team will reply soon.\n\n{ticket_url}",
                "مرحبًا {client_name}،\nاستلمنا تذكرة الدعم رقم {ticket_id}: {ticket_subject}\nسيردّ عليك فريقنا قريبًا.\n\n{ticket_url}"],

            'ticket_reply' => ['client', 'support', 'TicketAdminReply', true, false, array_merge($c, self::F_TICKET),
                "Hello {client_name},\nThere is a new reply on your ticket #{ticket_id}: {ticket_subject}\n\nView it: {ticket_url}",
                "مرحبًا {client_name}،\nوصل ردّ جديد على تذكرتك رقم {ticket_id}: {ticket_subject}\n\nللاطلاع على الرد: {ticket_url}"],

            'ticket_status' => ['client', 'support', 'TicketStatusChange', false, false, array_merge($c, self::F_TICKET),
                "Hello {client_name},\nThe status of ticket #{ticket_id} is now: {ticket_status}\n\n{ticket_url}",
                "مرحبًا {client_name}،\nتغيّرت حالة التذكرة رقم {ticket_id} إلى: {ticket_status}\n\n{ticket_url}"],

            'domain_renewal' => ['client', 'domains', 'DailyCronJob', true, false, array_merge($c, ['domain', 'expiry_date', 'days', 'renew_url']),
                "Hello {client_name},\nYour domain {domain} expires on {expiry_date} ({days} day(s) left).\n\nRenew it now to keep it: {renew_url}",
                "مرحبًا {client_name}،\nينتهي نطاقك {domain} في {expiry_date} (متبقٍّ {days} يوم/أيام).\n\nجدّده الآن للاحتفاظ به: {renew_url}"],

            'password_changed' => ['client', 'account', 'ClientChangePassword', false, true, $c,
                "Hello {client_name},\nThe password for your {system_name} account was just changed. If this wasn't you, reset your password and contact us immediately: {client_area_url}",
                "مرحبًا {client_name}،\nتم تغيير كلمة مرور حسابك لدى {system_name} للتو. إن لم تكن أنت من قام بذلك، فأعد تعيين كلمة المرور وتواصل معنا فورًا: {client_area_url}"],

            'admin_new_order' => ['admin', 'admin', 'AfterShoppingCartCheckout', true, true, array_merge($c, self::F_ORDER, ['admin_url']),
                "*New order #{order_number}*\nClient: {client_name} (#{client_id})\nTotal: {order_total}\n{admin_url}",
                "*طلب جديد رقم {order_number}*\nالعميل: {client_name} (#{client_id})\nالإجمالي: {order_total}\n{admin_url}"],

            'admin_new_ticket' => ['admin', 'admin', 'TicketOpen', true, true, array_merge($c, self::F_TICKET, ['admin_url']),
                "*New ticket #{ticket_id}*\nFrom: {client_name}\nDepartment: {ticket_department}\nSubject: {ticket_subject}\n{admin_url}",
                "*تذكرة جديدة رقم {ticket_id}*\nمن: {client_name}\nالقسم: {ticket_department}\nالموضوع: {ticket_subject}\n{admin_url}"],

            'admin_payment' => ['admin', 'admin', 'InvoicePaid', true, true, array_merge($c, self::F_INVOICE, ['admin_url']),
                "*Payment received*\nInvoice #{invoice_num} — {invoice_total}\nClient: {client_name} (#{client_id})\n{admin_url}",
                "*دفعة جديدة*\nالفاتورة رقم {invoice_num} — {invoice_total}\nالعميل: {client_name} (#{client_id})\n{admin_url}"],
        ];
    }

    public static function exists(string $key): bool
    {
        return isset(self::definitions()[$key]);
    }

    /** Insert default rows for events that have none yet. */
    public static function seed(): void
    {
        $existing = Capsule::table(self::TABLE)->pluck('event');
        $existing = is_array($existing) ? $existing : $existing->toArray();
        $now = date('Y-m-d H:i:s');
        foreach (self::definitions() as $key => $d) {
            if (in_array($key, $existing, true)) {
                continue;
            }
            Capsule::table(self::TABLE)->insert([
                'event'              => $key,
                'enabled'            => $d[3] ? 1 : 0,
                'critical'           => $d[4] ? 1 : 0,
                'body_en'            => $d[6],
                'body_ar'            => $d[7],
                'wa_template'        => '',
                'wa_template_params' => '',
                'updated_at'         => $now,
            ]);
        }
        self::$rows = null;
    }

    /** Effective configuration of one event (defaults + saved row). */
    public static function get(string $key): ?array
    {
        $defs = self::definitions();
        if (!isset($defs[$key])) {
            return null;
        }
        $d = $defs[$key];
        if (self::$rows === null) {
            self::$rows = [];
            try {
                foreach (Capsule::table(self::TABLE)->get() as $r) {
                    self::$rows[$r->event] = (array) $r;
                }
            } catch (\Throwable $e) {
                self::$rows = [];
            }
        }
        $row = self::$rows[$key] ?? [];
        return [
            'key'                => $key,
            'audience'           => $d[0],
            'group'              => $d[1],
            'hook'               => $d[2],
            'fields'             => $d[5],
            'enabled'            => isset($row['enabled']) ? (bool) $row['enabled'] : $d[3],
            'critical'           => isset($row['critical']) ? (bool) $row['critical'] : $d[4],
            'body_en'            => isset($row['body_en']) && $row['body_en'] !== '' ? (string) $row['body_en'] : $d[6],
            'body_ar'            => isset($row['body_ar']) && $row['body_ar'] !== '' ? (string) $row['body_ar'] : $d[7],
            'default_en'         => $d[6],
            'default_ar'         => $d[7],
            'wa_template'        => (string) ($row['wa_template'] ?? ''),
            'wa_template_params' => (string) ($row['wa_template_params'] ?? ''),
        ];
    }

    /** @return array<string,array> grouped by group key */
    public static function grouped(): array
    {
        $out = [];
        foreach (array_keys(self::definitions()) as $key) {
            $e = self::get($key);
            $out[$e['group']][$key] = $e;
        }
        return $out;
    }

    public static function save(string $key, array $data): void
    {
        if (!self::exists($key)) {
            return;
        }
        Capsule::table(self::TABLE)->updateOrInsert(['event' => $key], [
            'enabled'            => !empty($data['enabled']) ? 1 : 0,
            'critical'           => !empty($data['critical']) ? 1 : 0,
            'body_en'            => (string) ($data['body_en'] ?? ''),
            'body_ar'            => (string) ($data['body_ar'] ?? ''),
            'wa_template'        => (string) ($data['wa_template'] ?? ''),
            'wa_template_params' => (string) ($data['wa_template_params'] ?? ''),
            'updated_at'         => date('Y-m-d H:i:s'),
        ]);
        self::$rows = null;
    }

    /**
     * Parse "param=value" lines of an event's approved-template parameters.
     * @return array<string,string>
     */
    public static function parseTemplateParams(string $raw): array
    {
        $out = [];
        foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '=') === false) {
                continue;
            }
            [$name, $value] = array_map('trim', explode('=', $line, 2));
            if (preg_match('/^[a-z0-9_]{1,40}$/', $name)) {
                $out[$name] = $value;
            }
            if (count($out) >= 10) {
                break;
            }
        }
        return $out;
    }
}
