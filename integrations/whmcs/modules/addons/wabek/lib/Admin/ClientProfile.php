<?php

namespace WABEK\Admin;

use WABEK\Config;
use WABEK\Consent;
use WABEK\ConsentField;
use WABEK\Lang;
use WABEK\Phone;
use WABEK\Security;
use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Admin client profile tab (clientsprofile.php): AdminClientProfileTabFields
 * and AdminClientProfileTabFieldsSave.
 *
 * "Receive WhatsApp notifications": while the native consent custom field
 * is active, WHMCS already prints it on this tab (and saves it; ClientEdit
 * syncs it), so only the current status is shown here — two controls for one
 * value would overwrite each other. Without that field a Yes/No select is
 * shown and saved through Consent::set().
 *
 * "WhatsApp number": an optional override, unless a phone custom field is
 * configured (that field is then printed by WHMCS itself).
 */
final class ClientProfile
{
    private const MARKER = 'wabek_profile';

    /** @return array<string,string> label => control HTML */
    public static function fields(int $clientId): array
    {
        if ($clientId <= 0) {
            return [];
        }
        Lang::initForSession(true);
        $e = [Security::class, 'e'];
        $state = Consent::state($clientId);
        $on = Consent::isSubscribed($state);
        $lookup = Phone::lookup($clientId);
        $badge = '<span class="label ' . ($on ? 'label-success' : 'label-danger') . '">' . $e(Lang::t($on ? 'cs_on' : 'cs_off')) . '</span> '
            . '<span class="text-muted">' . $e(Lang::t('cs_state_' . ClientSummary::stateKey($state, Config::get('consent_mode') === 'opt_in'))) . '</span>';

        $out = [];
        $fieldName = ConsentField::name();
        if ($fieldName !== '') {
            $out[Lang::t('cf_consent_name')] = $badge
                . '<input type="hidden" name="' . self::MARKER . '" value="1">'
                . '<br><small class="text-muted">' . $e(Lang::t('pf_consent_field_note', ['{name}' => $fieldName])) . '</small>';
        } else {
            $out[Lang::t('cf_consent_name')] = '<input type="hidden" name="' . self::MARKER . '" value="1">'
                . '<input type="hidden" name="wabek_consent_was" value="' . ($on ? '1' : '0') . '">'
                . '<select name="wabek_consent" class="form-control select-inline">'
                . '<option value="1"' . ($on ? ' selected' : '') . '>' . $e(Lang::t('pf_yes')) . '</option>'
                . '<option value="0"' . (!$on ? ' selected' : '') . '>' . $e(Lang::t('pf_no')) . '</option>'
                . '</select> ' . $badge;
        }

        $phoneFieldId = Config::int('phone_field_id');
        $phoneField = $phoneFieldId > 0
            ? (string) Capsule::table('tblcustomfields')->where('id', $phoneFieldId)->where('type', 'client')->value('fieldname')
            : '';
        $current = $lookup['phone'] !== null
            ? '<bdi dir="ltr">' . $e($lookup['phone']) . '</bdi> <small class="text-muted">' . $e(Lang::t('cs_source_' . $lookup['source'])) . '</small>'
            : '<span class="text-danger">' . $e(Lang::t('err_phone')) . '</span>';
        if ($phoneField !== '') {
            $out[Lang::t('pf_phone')] = $current . '<br><small class="text-muted">' . $e(Lang::t('pf_phone_field_note', ['{name}' => $phoneField])) . '</small>';
        } else {
            $out[Lang::t('pf_phone')] = '<input type="tel" name="wabek_phone_override" class="form-control input-250" dir="ltr" maxlength="32"'
                . ' value="' . $e(Phone::override($clientId)) . '" placeholder="+966500000000" autocomplete="off"> '
                . $current . '<br><small class="text-muted">' . $e(Lang::t('pf_phone_help')) . '</small>';
        }
        return $out;
    }

    /** AdminClientProfileTabFieldsSave */
    public static function save(array $vars): void
    {
        if (empty($_POST[self::MARKER])) {
            return; // our fields were not on the submitted form
        }
        $clientId = (int) ($vars['userid'] ?? $vars['id'] ?? $_POST['userid'] ?? 0);
        if ($clientId <= 0) {
            return;
        }

        if (array_key_exists('wabek_phone_override', $_POST) && Config::int('phone_field_id') <= 0) {
            $raw = Security::post('wabek_phone_override', 32);
            $country = (string) Capsule::table('tblclients')->where('id', $clientId)->value('country');
            $new = $raw === '' ? '' : (string) Phone::toE164($raw, $country);
            if ($raw !== '' && $new === '') {
                if (function_exists('logActivity')) {
                    logActivity('WABEK: ignored an invalid WhatsApp number entered on the client profile - User ID: ' . $clientId);
                }
            } elseif ($new !== Phone::override($clientId)) {
                Phone::setOverride($clientId, $new);
                if (!Consent::subscribed($clientId)) {
                    Consent::resyncPlatform($clientId); // the opt-out follows the new number
                }
            }
        }

        if (isset($_POST['wabek_consent'], $_POST['wabek_consent_was']) && ConsentField::id() <= 0) {
            $want = Security::post('wabek_consent', 1) === '1';
            $was = Security::post('wabek_consent_was', 1) === '1';
            if ($want !== $was) {
                Consent::set($clientId, $want, 'admin', Security::ip());
            }
        }
    }
}
