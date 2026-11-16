<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Work done by the WHMCS cron: queue worker (AfterCronJob, every run) and
 * daily reminders + log retention (DailyCronJob).
 */
final class Cron
{
    private const LOCK_TTL = 600;
    private const MAX_PER_RULE = 2000;

    /** AfterCronJob: send due queue items, never two workers at once. */
    public static function tick(): void
    {
        if (!self::lock()) {
            return;
        }
        try {
            Outbox::process();
        } finally {
            self::unlock();
        }
    }

    /** DailyCronJob: invoice and domain reminders, then log retention. */
    public static function daily(): void
    {
        $today = date('Y-m-d');

        if (Events::get('invoice_due_soon')['enabled']) {
            foreach (Config::intList('reminder_days_before') as $n) {
                self::invoiceRule('invoice_due_soon', date('Y-m-d', strtotime("+{$n} days")), $n);
            }
        }
        if (Config::bool('reminder_on_due') && Events::get('invoice_due_today')['enabled']) {
            self::invoiceRule('invoice_due_today', $today, 0);
        }
        if (Events::get('invoice_overdue')['enabled']) {
            foreach (Config::intList('reminder_days_after') as $n) {
                self::invoiceRule('invoice_overdue', date('Y-m-d', strtotime("-{$n} days")), $n);
            }
        }
        if (Events::get('domain_renewal')['enabled']) {
            foreach (Config::intList('domain_reminder_days') as $n) {
                self::domainRule(date('Y-m-d', strtotime("+{$n} days")), $n);
            }
        }

        Outbox::purge(Config::int('log_retention_days', 0, 3650));
        Capsule::table('mod_wabek_otp_requests')
            ->where('created_at', '<', date('Y-m-d H:i:s', time() - 30 * 86400))->delete();
    }

    private static function invoiceRule(string $event, string $dueDate, int $days): void
    {
        $ids = Capsule::table('tblinvoices')->where('status', 'Unpaid')->where('duedate', $dueDate)
            ->orderBy('id')->limit(self::MAX_PER_RULE)->pluck('id');
        foreach ($ids as $id) {
            try {
                $ctx = Context::invoice((int) $id);
                if (!$ctx) {
                    continue;
                }
                $ctx['days'] = (string) $days;
                Notifier::client($event, $ctx, 'invoice:' . (int) $id, $event . ':' . (int) $id . ':' . $dueDate . ':' . $days);
            } catch (\Throwable $e) {
                self::logError($event, $e);
            }
        }
    }

    private static function domainRule(string $expiry, int $days): void
    {
        $ids = Capsule::table('tbldomains')->where('status', 'Active')->where('expirydate', $expiry)
            ->orderBy('id')->limit(self::MAX_PER_RULE)->pluck('id');
        foreach ($ids as $id) {
            try {
                $ctx = Context::domain((int) $id);
                if (!$ctx) {
                    continue;
                }
                $ctx['days'] = (string) $days;
                Notifier::client('domain_renewal', $ctx, 'domain:' . (int) $id, 'domain_renewal:' . (int) $id . ':' . $expiry . ':' . $days);
            } catch (\Throwable $e) {
                self::logError('domain_renewal', $e);
            }
        }
    }

    private static function lock(): bool
    {
        $now = time();
        if (!Capsule::table(Config::TABLE)->where('setting', 'cron_lock')->exists()) {
            try {
                Capsule::table(Config::TABLE)->insert(['setting' => 'cron_lock', 'value' => '0']);
            } catch (\Throwable $e) {
                // created concurrently
            }
        }
        $got = Capsule::table(Config::TABLE)->where('setting', 'cron_lock')
            ->where('value', '<', (string) ($now - self::LOCK_TTL))
            ->update(['value' => (string) $now]);
        return $got > 0;
    }

    private static function unlock(): void
    {
        Capsule::table(Config::TABLE)->where('setting', 'cron_lock')->update(['value' => '0']);
    }

    public static function logError(string $where, \Throwable $e): void
    {
        if (function_exists('logActivity')) {
            logActivity('WABEK: ' . $where . ' failed: ' . substr($e->getMessage(), 0, 300));
        }
    }
}
