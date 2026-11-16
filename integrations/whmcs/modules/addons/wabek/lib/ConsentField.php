<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * The native WHMCS client custom field (tickbox) that mirrors the WhatsApp
 * consent, so the choice is visible and editable on the registration form,
 * the checkout of new accounts, the client's "Account details" page and the
 * admin client profile in every theme — themes render client custom fields
 * themselves, no template edits are needed.
 *
 * mod_wabek_consent stays the source of truth; the field is kept in two-way
 * sync with it:
 *   - field → consent: ClientAdd / ClientEdit read the submitted (or stored)
 *     value and call Consent::set() when it differs from the recorded choice;
 *   - consent → field: Consent::set() (client page, homepage panel, admin
 *     toggle, checkout box, consent tab) writes the field value.
 *
 * Meaning of a ticked box (setting consent_field_meaning):
 *   receive  ticked = receive WhatsApp notifications (the field this addon creates);
 *   opt_out  ticked = no WhatsApp (the optional field of 4.0 / 4.1, kept as is).
 */
final class ConsentField
{
    public const RECEIVE = 'receive';
    public const OPT_OUT = 'opt_out';

    private const VALUES = 'tblcustomfieldsvalues';
    private const FIELDS = 'tblcustomfields';

    /** @var array<int,object|null> */
    private static $rows = [];
    /** @var array<string,bool> */
    private static $columns = [];

    // ── Configuration ──────────────────────────────────────────────────

    /** Id of the active consent field (0 when none is configured or it was deleted). */
    public static function id(): int
    {
        $id = Config::int('consent_field_id');
        return $id > 0 && self::row($id) !== null ? $id : 0;
    }

    public static function meaning(): string
    {
        return Config::get('consent_field_meaning') === self::RECEIVE ? self::RECEIVE : self::OPT_OUT;
    }

    /** Name of the active field as stored in WHMCS ('' when none). */
    public static function name(): string
    {
        $id = self::id();
        return $id > 0 ? (string) self::row($id)->fieldname : '';
    }

    /** True when the field is printed on the registration form / checkout of new accounts. */
    public static function onOrderForm(): bool
    {
        $id = self::id();
        if ($id <= 0) {
            return false;
        }
        $row = self::row($id);
        return (string) $row->adminonly !== 'on' && (string) $row->showorder === 'on';
    }

    /**
     * Create the field once (or re-attach the one created earlier) and make
     * it visible to clients. A field configured by hand in 4.0 / 4.1 is
     * reused as it is — never a second one. Returns the field id.
     */
    public static function ensure(): int
    {
        $configured = Config::int('consent_field_id');
        $created = Config::int('consent_field_created');
        if ($configured > 0 && self::row($configured) !== null) {
            if ($configured === $created) {
                self::setAdminOnly($configured, false);
            } else {
                // A field chosen by hand (or from 4.0 / 4.1): store its meaning explicitly so a later
                // default never flips it, and never show the addon's own field next to it.
                Config::set('consent_field_meaning', self::meaning());
                if ($created > 0 && self::row($created) !== null) {
                    self::setAdminOnly($created, true);
                }
                if (self::meaning() === self::OPT_OUT) {
                    self::resyncAll();
                }
            }
            return $configured;
        }

        $id = $created > 0 && self::row($created) !== null ? $created : self::findOwn();
        if ($id <= 0) {
            $id = self::create();
        }
        Config::set('consent_field_id', (string) $id);
        Config::set('consent_field_meaning', self::RECEIVE);
        Config::set('consent_field_created', (string) $id);
        self::$rows = [];
        self::setAdminOnly($id, false);
        self::translate($id);
        self::resyncAll();
        return $id;
    }

    /** Setting turned off: hide the addon's own field from clients (values and admin view are kept). */
    public static function retire(): void
    {
        $created = Config::int('consent_field_created');
        if ($created > 0 && $created === Config::int('consent_field_id') && self::row($created) !== null) {
            self::setAdminOnly($created, true);
        }
    }

    // ── Values ─────────────────────────────────────────────────────────

    /** Stored value ('on' / '') for a subscribed / unsubscribed client under the active meaning. */
    public static function valueFor(bool $subscribed): string
    {
        return (self::meaning() === self::RECEIVE) === $subscribed ? 'on' : '';
    }

    /** Subscribed according to a field value under the active meaning. */
    public static function subscribedFromValue(string $value): bool
    {
        $ticked = in_array(strtolower(trim($value)), ['on', 'yes', '1', 'true'], true);
        return self::meaning() === self::RECEIVE ? $ticked : !$ticked;
    }

    /** Stored value of the field for a client, null when it has no row. */
    public static function stored(int $clientId): ?string
    {
        $id = self::id();
        if ($id <= 0 || $clientId <= 0) {
            return null;
        }
        $v = Capsule::table(self::VALUES)->where('fieldid', $id)->where('relid', $clientId)->value('value');
        return $v === null ? null : (string) $v;
    }

    /** consent → field */
    public static function write(int $clientId, bool $subscribed): void
    {
        $id = self::id();
        if ($id <= 0 || $clientId <= 0) {
            return;
        }
        $data = ['value' => self::valueFor($subscribed)];
        if (self::hasColumn(self::VALUES, 'updated_at')) {
            $data['updated_at'] = date('Y-m-d H:i:s');
        }
        $exists = Capsule::table(self::VALUES)->where('fieldid', $id)->where('relid', $clientId)->exists();
        if ($exists) {
            Capsule::table(self::VALUES)->where('fieldid', $id)->where('relid', $clientId)->update($data);
            return;
        }
        if (self::hasColumn(self::VALUES, 'created_at')) {
            $data['created_at'] = date('Y-m-d H:i:s');
        }
        Capsule::table(self::VALUES)->insert(['fieldid' => $id, 'relid' => $clientId] + $data);
    }

    /**
     * What the client (or admin) chose in the field during this request:
     * the posted form value when the form carried custom fields, else the
     * stored value; null when nothing can be told (field not shown, no row).
     */
    public static function submitted(int $clientId, bool $newClient): ?bool
    {
        $id = self::id();
        if ($id <= 0 || $clientId <= 0) {
            return null;
        }
        $posted = $_POST['customfield'] ?? null;
        if (is_array($posted)) {
            if (array_key_exists($id, $posted)) {
                return self::subscribedFromValue(is_string($posted[$id]) ? $posted[$id] : '');
            }
            // An unticked checkbox is not posted: "missing" means unticked only where the form printed the field.
            return self::shownOnForm($newClient) ? self::subscribedFromValue('') : null;
        }
        $stored = self::stored($clientId);
        return $stored === null ? null : self::subscribedFromValue($stored);
    }

    /**
     * field → consent (ClientAdd / ClientEdit). A different choice is
     * recorded through Consent::set() (queue clean-up + WABEK opt-out sync);
     * otherwise the field is only normalised to the recorded choice.
     */
    public static function syncFromSubmission(int $clientId, bool $newClient, string $source): void
    {
        if ($clientId <= 0 || self::id() <= 0) {
            return;
        }
        $want = self::submitted($clientId, $newClient);
        $current = Consent::subscribed($clientId, false);
        if ($want !== null && $want !== $current) {
            Consent::set($clientId, $want, $source, Security::ip());
            return;
        }
        if ($want === null && !$newClient) {
            return;
        }
        self::write($clientId, $current);
    }

    /**
     * Rewrite every client's value from the recorded choices and the consent
     * mode (after creating the field or changing the mode / field / meaning).
     * Opt-out fields only get their recorded opt-outs ticked.
     */
    public static function resyncAll(): void
    {
        $id = self::id();
        if ($id <= 0) {
            return;
        }
        if (self::meaning() !== self::RECEIVE) {
            // Opt-out field of 4.0 / 4.1: only make sure every recorded opt-out is ticked (never subscribes anyone).
            $last = 0;
            do {
                $ids = Capsule::table(Consent::TABLE)->where('opted_out', 1)->where('client_id', '>', $last)
                    ->orderBy('client_id')->limit(500)->pluck('client_id');
                $ids = is_array($ids) ? $ids : $ids->toArray();
                foreach ($ids as $clientId) {
                    self::write((int) $clientId, false);
                    $last = (int) $clientId;
                }
            } while (count($ids) === 500);
            return;
        }
        $optIn = Config::get('consent_mode') === 'opt_in';
        $default = $optIn ? '' : 'on';
        $now = date('Y-m-d H:i:s');
        $stamp = self::hasColumn(self::VALUES, 'updated_at') ? ['updated_at' => $now] : [];

        Capsule::table(self::VALUES)->where('fieldid', $id)->update(['value' => $default] + $stamp);

        // Clients without a row yet, in id order (keyset pages stay correct while rows are added).
        $created = self::hasColumn(self::VALUES, 'created_at') ? ['created_at' => $now] : [];
        $last = 0;
        do {
            $ids = Capsule::table('tblclients')->where('id', '>', $last)
                ->whereNotIn('id', function ($q) use ($id) {
                    $q->select('relid')->from(self::VALUES)->where('fieldid', $id);
                })
                ->orderBy('id')->limit(500)->pluck('id');
            $ids = is_array($ids) ? $ids : $ids->toArray();
            if ($ids) {
                $rows = [];
                foreach ($ids as $clientId) {
                    $rows[] = ['fieldid' => $id, 'relid' => (int) $clientId, 'value' => $default] + $created + $stamp;
                }
                Capsule::table(self::VALUES)->insert($rows);
                $last = (int) end($ids);
            }
        } while (count($ids) === 500);

        // Recorded choices win over the default.
        Capsule::table(self::VALUES)->where('fieldid', $id)
            ->whereIn('relid', function ($q) {
                $q->select('client_id')->from(Consent::TABLE)->where('opted_out', 1);
            })->update(['value' => ''] + $stamp);
        if ($optIn) {
            Capsule::table(self::VALUES)->where('fieldid', $id)
                ->whereIn('relid', function ($q) {
                    $q->select('client_id')->from(Consent::TABLE)->where('opted_in', 1)->where('opted_out', 0);
                })->update(['value' => 'on'] + $stamp);
        }
    }

    /**
     * Footer script for the registration form / checkout of new accounts in
     * opt-out mode: the box starts ticked, matching the default (WHMCS has no
     * "ticked by default" option for tickbox fields). Never on a re-displayed
     * form, so the visitor's own choice is kept. iCheck (standard_cart, Lagom)
     * is refreshed when present.
     */
    public static function prefillScript(string $filename, bool $loggedIn): string
    {
        if ($loggedIn || Security::isPost() || self::meaning() !== self::RECEIVE || !self::onOrderForm()
            || Config::get('consent_mode') === 'opt_in') {
            return '';
        }
        $step = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : '';
        if (!in_array($filename, ['register', 'cart'], true) || ($filename === 'cart' && !in_array($step, ['checkout', 'view'], true))) {
            return '';
        }
        $name = json_encode('customfield[' . self::id() . ']');
        return '<script>(function(){var n=' . $name . ';function run(){var els=document.getElementsByName(n);'
            . 'for(var i=0;i<els.length;i++){var el=els[i];if(el.type!=="checkbox"||el.getAttribute("data-wabek")){continue;}'
            . 'el.setAttribute("data-wabek","1");if(!el.checked){el.checked=true;'
            . 'if(window.jQuery&&jQuery.fn&&jQuery.fn.iCheck){try{jQuery(el).iCheck("update");}catch(e){}}}}}'
            . 'if(window.jQuery){jQuery(run);}else if(document.readyState!=="loading"){run();}else{document.addEventListener("DOMContentLoaded",run);}})();</script>';
    }

    // ── Internals ──────────────────────────────────────────────────────

    /** Field name from the lang files: "<system language> / English" (English alone on English systems). */
    public static function fieldName(string $language = ''): string
    {
        $language = $language !== '' ? $language : Config::systemLanguage();
        $en = Lang::tIn('english', 'cf_consent_name');
        $local = Lang::tIn($language, 'cf_consent_name');
        return $local === $en ? $en : $local . ' / ' . $en;
    }

    public static function fieldDescription(string $language = ''): string
    {
        return Lang::tIn($language !== '' ? $language : Config::systemLanguage(), 'cf_consent_desc');
    }

    private static function findOwn(): int
    {
        $names = [Lang::tIn('english', 'cf_consent_name')];
        foreach (Lang::SUPPORTED as $l) {
            $names[] = self::fieldName($l);
            $names[] = Lang::tIn($l, 'cf_consent_name');
        }
        return (int) Capsule::table(self::FIELDS)->where('type', 'client')->where('fieldtype', 'tickbox')
            ->whereIn('fieldname', array_values(array_unique($names)))->orderBy('id')->value('id');
    }

    private static function create(): int
    {
        $row = [
            'type'         => 'client',
            'relid'        => 0,
            'fieldname'    => self::fieldName(),
            'fieldtype'    => 'tickbox',
            'description'  => self::fieldDescription(),
            'fieldoptions' => '',
            'regexpr'      => '',
            'adminonly'    => '',
            'required'     => '',
            'showorder'    => 'on',
            'showinvoice'  => '',
            'sortorder'    => 0,
        ];
        $now = date('Y-m-d H:i:s');
        foreach (['created_at', 'updated_at'] as $c) {
            if (self::hasColumn(self::FIELDS, $c)) {
                $row[$c] = $now;
            }
        }
        $id = (int) Capsule::table(self::FIELDS)->insertGetId($row);
        if (function_exists('logActivity')) {
            logActivity('WABEK: created the client custom field "' . $row['fieldname'] . '" (#' . $id . ') for WhatsApp notifications');
        }
        return $id;
    }

    private static function setAdminOnly(int $id, bool $adminOnly): void
    {
        $row = self::row($id);
        if ($row !== null && ((string) $row->adminonly === 'on') !== $adminOnly) {
            Capsule::table(self::FIELDS)->where('id', $id)->update(['adminonly' => $adminOnly ? 'on' : '']);
            self::$rows = [];
        }
    }

    /** Per-language names for WHMCS "Enable Translations" (never overwrites an admin's own translation). */
    private static function translate(int $id): void
    {
        try {
            if (!Capsule::schema()->hasTable('tbldynamic_translations')) {
                return;
            }
            $now = date('Y-m-d H:i:s');
            foreach (Lang::SUPPORTED as $l) {
                foreach (['name' => Lang::tIn($l, 'cf_consent_name'), 'description' => Lang::tIn($l, 'cf_consent_desc')] as $part => $text) {
                    $key = ['related_type' => 'custom_field.' . $id . '.' . $part, 'related_id' => $id, 'language' => $l];
                    if (!Capsule::table('tbldynamic_translations')->where($key)->exists()) {
                        Capsule::table('tbldynamic_translations')->insert($key + [
                            'translation' => $text,
                            'input_type'  => $part === 'name' ? 'text' : 'textarea',
                            'created_at'  => $now,
                            'updated_at'  => $now,
                        ]);
                    }
                }
            }
        } catch (\Throwable $e) {
            // Optional: the field name itself is bilingual.
        }
    }

    private static function shownOnForm(bool $newClient): bool
    {
        $row = self::row(self::id());
        if ($row === null) {
            return false;
        }
        if (defined('ADMINAREA')) {
            return true;
        }
        if ((string) $row->adminonly === 'on') {
            return false;
        }
        return !$newClient || (string) $row->showorder === 'on';
    }

    private static function row(int $id): ?object
    {
        if ($id <= 0) {
            return null;
        }
        if (!array_key_exists($id, self::$rows)) {
            $row = Capsule::table(self::FIELDS)->where('id', $id)->where('type', 'client')->where('fieldtype', 'tickbox')
                ->first(['id', 'fieldname', 'adminonly', 'showorder']);
            self::$rows[$id] = $row ?: null;
        }
        return self::$rows[$id];
    }

    private static function hasColumn(string $table, string $column): bool
    {
        $k = $table . '.' . $column;
        if (!isset(self::$columns[$k])) {
            try {
                self::$columns[$k] = Capsule::schema()->hasColumn($table, $column);
            } catch (\Throwable $e) {
                self::$columns[$k] = false;
            }
        }
        return self::$columns[$k];
    }

    /** For tests and after settings changes. */
    public static function flush(): void
    {
        self::$rows = [];
    }
}
