<?php

namespace WABEK;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Merge-field rendering: {field} placeholders in plain-text WhatsApp
 * messages. Plain string replacement only (no eval, no regex built from
 * input). Unknown {words} are left as written.
 */
final class Renderer
{
    public const MAX_LENGTH = 4000;

    /** Every merge field the module can fill, for the admin help list. */
    public const ALL_FIELDS = [
        'client_name', 'first_name', 'last_name', 'company', 'email', 'client_id', 'client_area_url',
        'system_name', 'system_url', 'date',
        'invoice_id', 'invoice_num', 'invoice_total', 'invoice_balance', 'invoice_status', 'due_date', 'invoice_url', 'days',
        'service_id', 'service_name', 'service_label', 'product_group', 'domain', 'billing_cycle', 'next_due_date',
        'amount', 'service_url', 'credentials', 'suspend_reason',
        'ticket_id', 'ticket_subject', 'ticket_status', 'ticket_department', 'ticket_url',
        'order_id', 'order_number', 'order_total', 'expiry_date', 'renew_url', 'admin_url',
    ];

    public static function render(string $template, array $context): string
    {
        $replace = [];
        foreach (self::ALL_FIELDS as $field) {
            $replace['{' . $field . '}'] = '';
        }
        foreach ($context as $key => $value) {
            if (is_scalar($value) || $value === null) {
                $replace['{' . $key . '}'] = self::clean((string) $value);
            }
        }
        $text = strtr($template, $replace);
        return self::finish($text);
    }

    /** Remove control characters (keep \n and \t) from a merged value. */
    public static function clean(string $value): string
    {
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
        return $value === null ? '' : $value;
    }

    /** Normalise whitespace and cap the length of a final message. */
    public static function finish(string $text): string
    {
        $text = self::clean($text);
        $text = preg_replace("/[ \t]+\n/", "\n", $text);
        $text = preg_replace("/\n{3,}/", "\n\n", (string) $text);
        $text = trim((string) $text);
        if (function_exists('mb_substr')) {
            return mb_substr($text, 0, self::MAX_LENGTH, 'UTF-8');
        }
        return substr($text, 0, self::MAX_LENGTH);
    }
}
