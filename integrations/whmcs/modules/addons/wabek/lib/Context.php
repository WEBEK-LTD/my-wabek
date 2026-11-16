<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Builds merge-field values from WHMCS records (read via Capsule, the
 * query builder binds every value).
 */
final class Context
{
    public static function base(): array
    {
        $url = Config::systemUrl();
        return [
            'system_name'     => Config::companyName(),
            'system_url'      => $url,
            'client_area_url' => $url . 'clientarea.php',
            'admin_url'       => $url . self::adminFolder() . '/',
            'date'            => self::date(date('Y-m-d')),
        ];
    }

    public static function client(int $clientId): ?array
    {
        $c = Capsule::table('tblclients')->where('id', $clientId)
            ->first(['id', 'firstname', 'lastname', 'companyname', 'email', 'language', 'currency', 'status']);
        if (!$c) {
            return null;
        }
        $name = trim($c->firstname . ' ' . $c->lastname);
        return array_merge(self::base(), [
            'client_id'    => (string) $c->id,
            'client_name'  => $name !== '' ? $name : (string) $c->companyname,
            'first_name'   => (string) $c->firstname,
            'last_name'    => (string) $c->lastname,
            'company'      => (string) $c->companyname,
            'email'        => (string) $c->email,
            '_language'    => strtolower((string) $c->language),
            '_currency'    => (int) $c->currency,
        ]);
    }

    public static function invoice(int $invoiceId): ?array
    {
        $inv = Capsule::table('tblinvoices')->where('id', $invoiceId)
            ->first(['id', 'invoicenum', 'userid', 'total', 'credit', 'status', 'duedate']);
        if (!$inv) {
            return null;
        }
        $client = self::client((int) $inv->userid);
        if (!$client) {
            return null;
        }
        $paid = (float) Capsule::table('tblaccounts')->where('invoiceid', $invoiceId)->sum('amountin')
            - (float) Capsule::table('tblaccounts')->where('invoiceid', $invoiceId)->sum('amountout');
        $balance = max(0, round((float) $inv->total - $paid, 2));
        return array_merge($client, [
            'invoice_id'      => (string) $inv->id,
            'invoice_num'     => (string) ($inv->invoicenum !== '' && $inv->invoicenum !== null ? $inv->invoicenum : $inv->id),
            'invoice_total'   => self::money((float) $inv->total, $client['_currency']),
            'invoice_balance' => self::money($balance, $client['_currency']),
            'invoice_status'  => (string) $inv->status,
            'due_date'        => self::date((string) $inv->duedate),
            'invoice_url'     => Config::systemUrl() . 'viewinvoice.php?id=' . (int) $inv->id,
            '_due_raw'        => (string) $inv->duedate,
        ]);
    }

    public static function service(int $serviceId, bool $withCredentials = false): ?array
    {
        $s = Capsule::table('tblhosting as h')
            ->leftJoin('tblproducts as p', 'p.id', '=', 'h.packageid')
            ->leftJoin('tblproductgroups as g', 'g.id', '=', 'p.gid')
            ->where('h.id', $serviceId)
            ->first(['h.id', 'h.userid', 'h.domain', 'h.username', 'h.password', 'h.billingcycle',
                'h.nextduedate', 'h.amount', 'h.dedicatedip', 'h.suspendreason', 'p.name as product', 'g.name as groupname']);
        if (!$s) {
            return null;
        }
        $client = self::client((int) $s->userid);
        if (!$client) {
            return null;
        }
        $name = (string) $s->product;
        $label = $s->domain !== '' && $s->domain !== null ? $name . ' (' . $s->domain . ')' : $name;
        $credentials = '';
        if ($withCredentials && Config::bool('include_credentials')) {
            $password = function_exists('decrypt') ? (string) decrypt((string) $s->password) : '';
            $lines = [];
            if ((string) $s->username !== '') {
                $lines[] = (self::isArabic($client) ? 'اسم المستخدم: ' : 'Username: ') . $s->username;
            }
            if ($password !== '') {
                $lines[] = (self::isArabic($client) ? 'كلمة المرور: ' : 'Password: ') . $password;
            }
            if ((string) $s->dedicatedip !== '') {
                $lines[] = 'IP: ' . $s->dedicatedip;
            }
            $credentials = implode("\n", $lines);
        }
        return array_merge($client, [
            'service_id'     => (string) $s->id,
            'service_name'   => $name,
            'service_label'  => $label,
            'product_group'  => (string) $s->groupname,
            'domain'         => (string) $s->domain,
            'billing_cycle'  => (string) $s->billingcycle,
            'next_due_date'  => self::date((string) $s->nextduedate),
            'amount'         => self::money((float) $s->amount, $client['_currency']),
            'service_url'    => Config::systemUrl() . 'clientarea.php?action=productdetails&id=' . (int) $s->id,
            'credentials'    => $credentials,
            'suspend_reason' => (string) $s->suspendreason,
        ]);
    }

    public static function ticket(int $ticketId): ?array
    {
        $t = Capsule::table('tbltickets as t')
            ->leftJoin('tblticketdepartments as d', 'd.id', '=', 't.did')
            ->where('t.id', $ticketId)
            ->first(['t.id', 't.tid', 't.c', 't.userid', 't.title', 't.status', 't.name', 'd.name as department']);
        if (!$t) {
            return null;
        }
        $client = (int) $t->userid > 0 ? self::client((int) $t->userid) : null;
        $base = $client ?: array_merge(self::base(), ['client_name' => (string) $t->name, 'client_id' => '0']);
        return array_merge($base, [
            'ticket_id'         => (string) $t->tid,
            'ticket_subject'    => (string) $t->title,
            'ticket_status'     => (string) $t->status,
            'ticket_department' => (string) $t->department,
            'ticket_url'        => Config::systemUrl() . 'viewticket.php?tid=' . rawurlencode((string) $t->tid) . '&c=' . rawurlencode((string) $t->c),
            '_client_id'        => (int) $t->userid,
            '_ticket_db_id'     => (int) $t->id,
        ]);
    }

    public static function domain(int $domainId): ?array
    {
        $d = Capsule::table('tbldomains')->where('id', $domainId)->first(['id', 'userid', 'domain', 'expirydate']);
        if (!$d) {
            return null;
        }
        $client = self::client((int) $d->userid);
        if (!$client) {
            return null;
        }
        return array_merge($client, [
            'domain'      => (string) $d->domain,
            'expiry_date' => self::date((string) $d->expirydate),
            'renew_url'   => Config::systemUrl() . 'clientarea.php?action=domaindetails&id=' . (int) $d->id,
        ]);
    }

    public static function order(int $orderId): ?array
    {
        $o = Capsule::table('tblorders')->where('id', $orderId)->first(['id', 'ordernum', 'userid', 'amount', 'invoiceid']);
        if (!$o) {
            return null;
        }
        $client = self::client((int) $o->userid);
        if (!$client) {
            return null;
        }
        return array_merge($client, [
            'order_id'     => (string) $o->id,
            'order_number' => (string) $o->ordernum,
            'order_total'  => self::money((float) $o->amount, $client['_currency']),
            'invoice_id'   => (string) $o->invoiceid,
        ]);
    }

    /** Language of messages to this client: "arabic" or "english". */
    public static function isArabic(array $ctx): bool
    {
        $mode = Config::get('message_language');
        if ($mode === 'arabic') {
            return true;
        }
        if ($mode === 'english') {
            return false;
        }
        $lang = (string) ($ctx['_language'] ?? '');
        if ($lang === '') {
            $lang = Config::systemLanguage();
        }
        return $lang === 'arabic';
    }

    public static function money(float $amount, int $currencyId): string
    {
        if (function_exists('formatCurrency')) {
            try {
                return trim(strip_tags((string) formatCurrency($amount, $currencyId ?: false)));
            } catch (\Throwable $e) {
                // fall through
            }
        }
        $code = '';
        try {
            $code = (string) Capsule::table('tblcurrencies')->where('id', $currencyId)->value('code');
        } catch (\Throwable $e) {
            $code = '';
        }
        return trim(number_format($amount, 2, '.', ',') . ' ' . $code);
    }

    public static function date(string $mysqlDate): string
    {
        if ($mysqlDate === '' || strpos($mysqlDate, '0000-00-00') === 0) {
            return '';
        }
        if (function_exists('fromMySQLDate')) {
            try {
                return (string) fromMySQLDate($mysqlDate);
            } catch (\Throwable $e) {
                // fall through
            }
        }
        return substr($mysqlDate, 0, 10);
    }

    private static function adminFolder(): string
    {
        try {
            if (class_exists('\\App') && method_exists('\\App', 'get_admin_folder_name')) {
                $f = (string) \App::get_admin_folder_name();
                if (preg_match('/^[A-Za-z0-9_-]+$/', $f)) {
                    return $f;
                }
            }
        } catch (\Throwable $e) {
            // fall through
        }
        return 'admin';
    }
}
