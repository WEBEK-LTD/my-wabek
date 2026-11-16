<?php

namespace WABEK;

use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * Client phone numbers → E.164.
 *
 * WHMCS 8 stores tblclients.phonenumber as "+CC.NUMBER" when international
 * phone numbers are enabled, or a bare national number otherwise; the
 * country is the client's ISO-3166 code (tblclients.country).
 */
final class Phone
{
    private const DIAL = 'AD376 AE971 AF93 AG1 AI1 AL355 AM374 AO244 AR54 AS1 AT43 AU61 AW297 AX358 AZ994 BA387 BB1 BD880 BE32 BF226 BG359 BH973 BI257 BJ229 BL590 BM1 BN673 BO591 BQ599 BR55 BS1 BT975 BW267 BY375 BZ501 CA1 CD243 CF236 CG242 CH41 CI225 CK682 CL56 CM237 CN86 CO57 CR506 CU53 CV238 CW599 CY357 CZ420 DE49 DJ253 DK45 DM1 DO1 DZ213 EC593 EE372 EG20 EH212 ER291 ES34 ET251 FI358 FJ679 FK500 FM691 FO298 FR33 GA241 GB44 GD1 GE995 GF594 GG44 GH233 GI350 GL299 GM220 GN224 GP590 GQ240 GR30 GT502 GU1 GW245 GY592 HK852 HN504 HR385 HT509 HU36 ID62 IE353 IL972 IM44 IN91 IQ964 IR98 IS354 IT39 JE44 JM1 JO962 JP81 KE254 KG996 KH855 KI686 KM269 KN1 KP850 KR82 KW965 KY1 KZ7 LA856 LB961 LC1 LI423 LK94 LR231 LS266 LT370 LU352 LV371 LY218 MA212 MC377 MD373 ME382 MF590 MG261 MH692 MK389 ML223 MM95 MN976 MO853 MP1 MQ596 MR222 MS1 MT356 MU230 MV960 MW265 MX52 MY60 MZ258 NA264 NC687 NE227 NG234 NI505 NL31 NO47 NP977 NR674 NZ64 OM968 PA507 PE51 PF689 PG675 PH63 PK92 PL48 PM508 PR1 PS970 PT351 PW680 PY595 QA974 RE262 RO40 RS381 RU7 RW250 SA966 SB677 SC248 SD249 SE46 SG65 SI386 SK421 SL232 SM378 SN221 SO252 SR597 SS211 ST239 SV503 SX1 SY963 SZ268 TC1 TD235 TG228 TH66 TJ992 TL670 TM993 TN216 TO676 TR90 TT1 TV688 TW886 TZ255 UA380 UG256 US1 UY598 UZ998 VA39 VC1 VE58 VG1 VI1 VN84 VU678 WS685 XK383 YE967 YT262 ZA27 ZM260 ZW263';

    public static function dialCode(string $iso2): string
    {
        static $map = null;
        if ($map === null) {
            $map = [];
            foreach (explode(' ', self::DIAL) as $pair) {
                $map[substr($pair, 0, 2)] = substr($pair, 2);
            }
        }
        return $map[strtoupper(trim($iso2))] ?? '';
    }

    /**
     * Normalise to E.164 ("+905551234567") or return null when the number
     * cannot be trusted.
     */
    public static function toE164(string $raw, string $countryIso = '', string $ccHint = ''): ?string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return null;
        }
        $digits = '';
        if ($raw[0] === '+' && strpos($raw, '.') !== false) {
            // WHMCS "+CC.NUMBER"
            [$cc, $national] = explode('.', substr($raw, 1), 2);
            $cc = preg_replace('/\D/', '', $cc);
            $national = ltrim((string) preg_replace('/\D/', '', $national), '0');
            $digits = $cc . $national;
        } elseif ($raw[0] === '+') {
            $digits = (string) preg_replace('/\D/', '', $raw);
        } else {
            $digits = (string) preg_replace('/\D/', '', $raw);
            if (strncmp($digits, '00', 2) === 0) {
                $digits = substr($digits, 2);
            } else {
                $cc = preg_replace('/\D/', '', $ccHint);
                if ($cc === '') {
                    $cc = self::dialCode($countryIso);
                }
                if ($cc === '') {
                    $cc = preg_replace('/\D/', '', Config::get('default_country_code'));
                }
                if ($cc === '') {
                    return null;
                }
                // Already international without the "+"? (e.g. 9665XXXXXXXX)
                if (strncmp($digits, $cc, strlen($cc)) === 0 && strlen($digits) >= 11) {
                    // keep as is
                } else {
                    $digits = $cc . ltrim($digits, '0');
                }
            }
        }
        return self::valid($digits) ? '+' . $digits : null;
    }

    public static function valid(string $digits): bool
    {
        $len = strlen($digits);
        if ($len < 8 || $len > 15 || !ctype_digit($digits) || $digits[0] === '0') {
            return false;
        }
        // Placeholders such as 11111111 or 12345678...
        if (count(array_unique(str_split(substr($digits, -7)))) <= 1) {
            return false;
        }
        return strpos('1234567890123456', substr($digits, -8)) === false;
    }

    /** Parse an admin-entered list of phones (comma/newline separated). */
    public static function parseList(string $raw): array
    {
        $out = [];
        foreach (preg_split('/[\s,;]+/', $raw) as $p) {
            $p = trim($p);
            if ($p === '') {
                continue;
            }
            $e = self::toE164($p[0] === '+' ? $p : '+' . ltrim($p, '+'));
            if ($e !== null) {
                $out[$e] = $e;
            }
        }
        return array_values($out);
    }

    /** Digits only, as sent to the WABEK API. */
    public static function apiFormat(string $e164): string
    {
        return (string) preg_replace('/\D/', '', $e164);
    }

    /**
     * The WhatsApp number of a client: the optional custom field override
     * first, then the profile phone number + country.
     */
    public static function forClient(int $clientId): ?string
    {
        if ($clientId <= 0) {
            return null;
        }
        $client = Capsule::table('tblclients')->where('id', $clientId)->first(['phonenumber', 'country']);
        if (!$client) {
            return null;
        }
        $country = (string) $client->country;

        $fieldId = Config::int('phone_field_id');
        if ($fieldId > 0) {
            $override = (string) Capsule::table('tblcustomfieldsvalues')
                ->where('fieldid', $fieldId)->where('relid', $clientId)->value('value');
            $e = self::toE164($override, $country);
            if ($e !== null) {
                return $e;
            }
        }
        return self::toE164((string) $client->phonenumber, $country);
    }

    public static function mask(string $e164): string
    {
        $len = strlen($e164);
        if ($len <= 6) {
            return $e164;
        }
        return substr($e164, 0, 4) . str_repeat('•', $len - 7) . substr($e164, -3);
    }
}
