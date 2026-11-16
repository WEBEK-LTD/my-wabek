<?php

namespace WABEK;

use Illuminate\Database\Schema\Blueprint;
use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Table creation (activate) and versioned migrations (upgrade).
 *
 * Table names deliberately differ from the 3.x addon (mod_wabek_queue,
 * mod_wabek_otp, ...) so a leftover 3.x install can never clash with this
 * schema; 3.x data that still matters is imported once by importLegacy().
 */
final class Schema
{
    public const TABLES = [
        'mod_wabek_config',
        'mod_wabek_events',
        'mod_wabek_outbox',
        'mod_wabek_consent',
        'mod_wabek_otp_requests',
        'mod_wabek_bulk',
    ];

    public static function install(): void
    {
        $schema = Capsule::schema();

        if (!$schema->hasTable('mod_wabek_config')) {
            $schema->create('mod_wabek_config', function (Blueprint $t) {
                $t->string('setting', 64)->primary();
                $t->text('value')->nullable();
            });
        }

        if (!$schema->hasTable('mod_wabek_events')) {
            $schema->create('mod_wabek_events', function (Blueprint $t) {
                $t->string('event', 48)->primary();
                $t->boolean('enabled')->default(false);
                $t->boolean('critical')->default(false);
                $t->text('body_en')->nullable();
                $t->text('body_ar')->nullable();
                $t->string('wa_template', 128)->default('');
                $t->text('wa_template_params')->nullable();
                $t->dateTime('updated_at')->nullable();
            });
        }

        if (!$schema->hasTable('mod_wabek_outbox')) {
            $schema->create('mod_wabek_outbox', function (Blueprint $t) {
                $t->bigIncrements('id');
                $t->string('event', 48)->index();
                $t->string('audience', 10)->default('client');
                $t->unsignedInteger('client_id')->nullable()->index();
                $t->string('phone', 20)->index();
                $t->text('message');
                $t->string('wa_template', 128)->default('');
                $t->text('wa_template_params')->nullable();
                $t->boolean('critical')->default(false);
                $t->unsignedTinyInteger('priority')->default(5);
                $t->string('status', 12)->default('pending')->index();
                $t->unsignedTinyInteger('attempts')->default(0);
                $t->dateTime('next_attempt_at')->nullable()->index();
                $t->string('last_error', 500)->default('');
                $t->unsignedSmallInteger('http_code')->default(0);
                $t->string('remote_id', 128)->default('');
                $t->unsignedInteger('bulk_id')->nullable()->index();
                $t->string('related_id', 64)->default('');
                $t->string('dedupe_key', 160)->nullable()->unique();
                $t->unsignedInteger('admin_id')->nullable();
                $t->dateTime('created_at')->nullable()->index();
                $t->dateTime('updated_at')->nullable();
                $t->dateTime('sent_at')->nullable();
            });
        }

        if (!$schema->hasTable('mod_wabek_consent')) {
            $schema->create('mod_wabek_consent', function (Blueprint $t) {
                $t->unsignedInteger('client_id')->primary();
                $t->boolean('opted_out')->default(false);
                $t->boolean('opted_in')->default(false);
                $t->dateTime('opted_in_at')->nullable();
                $t->dateTime('opted_out_at')->nullable();
                $t->string('verified_phone', 20)->default('');
                $t->dateTime('verified_at')->nullable();
                $t->string('updated_ip', 45)->default('');
                $t->string('source', 16)->default('');
                $t->dateTime('updated_at')->nullable();
            });
        }

        if (!$schema->hasTable('mod_wabek_otp_requests')) {
            $schema->create('mod_wabek_otp_requests', function (Blueprint $t) {
                $t->increments('id');
                $t->unsignedInteger('client_id')->index();
                $t->string('phone', 20);
                $t->string('purpose', 16);
                $t->string('remote_id', 128)->default('');
                $t->unsignedTinyInteger('attempts')->default(0);
                $t->string('status', 12)->default('sent');
                $t->string('ip', 45)->default('');
                $t->dateTime('created_at')->nullable()->index();
                $t->dateTime('expires_at')->nullable();
            });
        }

        if (!$schema->hasTable('mod_wabek_bulk')) {
            $schema->create('mod_wabek_bulk', function (Blueprint $t) {
                $t->increments('id');
                $t->string('name', 150);
                $t->text('message');
                $t->text('filters')->nullable();
                $t->unsignedInteger('total')->default(0);
                $t->unsignedInteger('skipped')->default(0);
                $t->string('status', 12)->default('queued');
                $t->unsignedInteger('admin_id')->nullable();
                $t->dateTime('created_at')->nullable();
                $t->dateTime('updated_at')->nullable();
            });
        }

        Events::seed();
    }

    /**
     * Run migrations from $fromVersion (the version WHMCS had installed) to
     * the current one. Every step is idempotent.
     */
    public static function upgrade(string $fromVersion): void
    {
        // < 4.0.0 is the legacy 3.x addon: create the new schema and import.
        if (version_compare($fromVersion, '4.0.0', '<')) {
            self::install();
            self::importLegacy();
        }

        // Future migrations go here, e.g.:
        // if (version_compare($fromVersion, '4.1.0', '<')) { ... hasColumn() guarded ... }

        // Always make sure new events get their default rows.
        Events::seed();
    }

    public static function uninstall(): void
    {
        foreach (self::TABLES as $table) {
            Capsule::schema()->dropIfExists($table);
        }
    }

    /**
     * Import what is worth keeping from the 3.x addon: API settings (the key
     * re-encrypted under our own storage) and the opt-out list.
     */
    public static function importLegacy(): void
    {
        try {
            $old = Capsule::table('tbladdonmodules')->where('module', 'wabek')
                ->whereIn('setting', ['api_key', 'api_url', 'instance_id', 'default_country_code'])
                ->pluck('value', 'setting');
            $old = is_array($old) ? $old : $old->toArray();

            if (!empty($old['api_key']) && Config::apiKey() === '') {
                $raw = (string) $old['api_key'];
                $plain = function_exists('decrypt') ? trim((string) decrypt($raw)) : '';
                $key = $plain !== '' ? $plain : $raw;
                if (preg_match('/^[\x21-\x7e]{8,256}$/', $key)) {
                    Config::setApiKey($key);
                }
            }
            if (!empty($old['api_url']) && Config::isValidBaseUrl(rtrim((string) $old['api_url'], '/'))) {
                Config::set('api_base_url', rtrim((string) $old['api_url'], '/'));
            }
            if (!empty($old['instance_id']) && preg_match('/^[A-Za-z0-9_-]{1,64}$/', (string) $old['instance_id'])) {
                Config::set('default_instance', (string) $old['instance_id']);
            }
            if (!empty($old['default_country_code']) && preg_match('/^\d{1,4}$/', (string) $old['default_country_code'])) {
                Config::set('default_country_code', (string) $old['default_country_code']);
            }
            // The plaintext key must not linger in tbladdonmodules.
            Capsule::table('tbladdonmodules')->where('module', 'wabek')->where('setting', 'api_key')->delete();
        } catch (\Throwable $e) {
            // Non-fatal: settings can be entered again.
        }

        try {
            if (Capsule::schema()->hasTable('mod_wabek_optout')) {
                $now = date('Y-m-d H:i:s');
                foreach (Capsule::table('mod_wabek_optout')->pluck('client_id') as $clientId) {
                    $clientId = (int) $clientId;
                    if ($clientId > 0) {
                        Capsule::table('mod_wabek_consent')->updateOrInsert(
                            ['client_id' => $clientId],
                            ['opted_out' => 1, 'opted_out_at' => $now, 'source' => 'legacy', 'updated_at' => $now]
                        );
                    }
                }
            }
        } catch (\Throwable $e) {
            // Non-fatal.
        }
    }
}
