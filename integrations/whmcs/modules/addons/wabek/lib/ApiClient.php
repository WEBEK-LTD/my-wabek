<?php

namespace WABEK;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/**
 * HTTPS client for the WABEK public API.
 *
 * - The API key travels only in the X-API-Key header (never the query string).
 * - TLS verification is always on; HTTPS only; no redirects (so the key is
 *   never replayed to another host).
 * - Calls are written to the WHMCS module log with the key redacted.
 */
final class ApiClient
{
    private const CONNECT_TIMEOUT = 5;
    private const TIMEOUT = 15;

    /** @var string */
    private $baseUrl;
    /** @var string */
    private $apiKey;

    public function __construct(?string $baseUrl = null, ?string $apiKey = null)
    {
        $this->baseUrl = rtrim($baseUrl ?? Config::apiBaseUrl(), '/');
        $this->apiKey = $apiKey ?? Config::apiKey();
    }

    public static function make(): self
    {
        return new self();
    }

    public function configured(): bool
    {
        return $this->apiKey !== '' && Config::isValidBaseUrl($this->baseUrl);
    }

    /**
     * POST /api/v1/send — always type "notification" (codes go through otpSend()).
     *
     * @param array $templateParams named (object) or positional (list) parameters of the approved template
     */
    public function send(string $toDigits, string $message, string $instanceId = '', string $template = '', array $templateParams = [], string $customerName = '', string $templateLanguage = '', string $idempotencyKey = ''): ApiResponse
    {
        $body = ['to' => $toDigits, 'message' => $message, 'type' => 'notification'];
        if ($instanceId !== '') {
            $body['instance_id'] = $instanceId;
        }
        if ($template !== '') {
            // Used by the platform only when the recipient is outside the 24h window.
            $body['template'] = $template;
            if ($templateLanguage !== '') {
                $body['template_language'] = $templateLanguage;
            }
            if ($templateParams) {
                // A PHP list encodes as a JSON array (positional {{1}}, {{2}}), a map as an object (named).
                $body['template_params'] = $templateParams;
            }
        }
        if ($customerName !== '') {
            $body['customer_name'] = $customerName;
        }
        $headers = [];
        if (preg_match('/^[A-Za-z0-9._:-]{8,100}$/', $idempotencyKey)) {
            // Same key on every retry of one outbox row: a replay returns the first result.
            $headers[] = 'Idempotency-Key: ' . $idempotencyKey;
        }
        return $this->request('POST', '/api/v1/send', $body, 'send', [], $headers);
    }

    /** POST /api/v1/contacts-opt-out {phone, opted_out} → {success, opted_out} */
    public function contactOptOut(string $toDigits, bool $optedOut): ApiResponse
    {
        return $this->request('POST', '/api/v1/contacts-opt-out', ['phone' => $toDigits, 'opted_out' => $optedOut], 'contacts-opt-out');
    }

    /** GET /api/v1/message-status?id= → {id, status: sent|delivered|read|failed, error} */
    public function messageStatus(string $messageId): ApiResponse
    {
        return $this->request('GET', '/api/v1/message-status?id=' . rawurlencode($messageId), null, 'message-status');
    }

    /**
     * POST /api/v1/otp → { success, otpId }; failures are
     * { success:false, error, code: no_instance|template_failed|outside_window|send_failed|internal }.
     */
    public function otpSend(string $toDigits, string $purpose, string $instanceId = '', string $brandName = ''): ApiResponse
    {
        $body = ['phone' => $toDigits, 'purpose' => $purpose];
        if ($instanceId !== '') {
            $body['instance_id'] = $instanceId;
        }
        if ($brandName !== '') {
            $body['brand_name'] = $brandName;
        }
        return $this->request('POST', '/api/v1/otp', $body, 'otp');
    }

    /** POST /api/v1/otp-verify → { valid, reason? } */
    public function otpVerify(string $otpId, string $code): ApiResponse
    {
        return $this->request('POST', '/api/v1/otp-verify', ['otp_id' => $otpId, 'otp' => $code], 'otp-verify', ['otp']);
    }

    /**
     * GET /api/v1/instances → { instances: [{ id, display_name, phone_number,
     * status, instance_type, is_default, created_at }] }. Older platform
     * versions answer 404 "Unknown action" (after authentication, so the key
     * is still proven valid).
     */
    public function instances(): ApiResponse
    {
        return $this->request('GET', '/api/v1/instances', null, 'instances');
    }

    /**
     * @param array|null $body JSON body for POST
     * @param string[]   $redactFields body fields hidden from the module log
     */
    public function request(string $method, string $path, ?array $body, string $action, array $redactFields = [], array $extraHeaders = []): ApiResponse
    {
        if (!$this->configured()) {
            return new ApiResponse(0, [], 'WABEK API is not configured', false);
        }
        if (!function_exists('curl_init')) {
            return new ApiResponse(0, [], 'PHP cURL extension is missing', false);
        }

        $url = $this->baseUrl . $path;
        $headers = [
            'Accept: application/json',
            'X-API-Key: ' . $this->apiKey,
            'User-Agent: WABEK-WHMCS/' . (defined('WABEK_MODULE_VERSION') ? WABEK_MODULE_VERSION : '4'),
            // Identifies the addon and its version to the platform (usage stats).
            'X-WABEK-Client: whmcs/' . (defined('WABEK_MODULE_VERSION') ? WABEK_MODULE_VERSION : '4'),
        ];
        $site = self::siteHost();
        if ($site !== '') {
            $headers[] = 'X-WABEK-Site: ' . $site;
        }
        foreach ($extraHeaders as $h) {
            $headers[] = $h;
        }
        $json = null;
        if ($body !== null) {
            $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $headers[] = 'Content-Type: application/json; charset=utf-8';
        }

        $ch = curl_init();
        $opts = [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT        => self::TIMEOUT,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_CUSTOMREQUEST  => $method,
        ];
        if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
            $opts[CURLOPT_PROTOCOLS] = CURLPROTO_HTTPS;
        }
        if ($json !== null) {
            $opts[CURLOPT_POSTFIELDS] = $json;
        }
        $retryAfter = 0;
        $opts[CURLOPT_HEADERFUNCTION] = static function ($handle, $line) use (&$retryAfter) {
            if (stripos($line, 'retry-after:') === 0) {
                $retryAfter = max(0, min(3600, (int) trim(substr($line, 12))));
            }
            return strlen($line);
        };
        curl_setopt_array($ch, $opts);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno = curl_errno($ch);
        $cerr = $errno ? curl_error($ch) : '';
        curl_close($ch);

        $data = [];
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            $data = is_array($decoded) ? $decoded : [];
        }

        if ($errno) {
            $response = new ApiResponse(0, [], 'Network error: ' . $cerr, true);
        } else {
            $error = '';
            if ($status < 200 || $status >= 300) {
                $error = trim((string) ($data['error'] ?? ('HTTP ' . $status)));
                if (!empty($data['code']) && is_string($data['code']) && preg_match('/^[a-z_]{1,40}$/', $data['code'])) {
                    $error .= ' [' . $data['code'] . ']';
                }
                if (!empty($data['detail']) && is_string($data['detail'])) {
                    $error .= ' — ' . $data['detail'];
                }
            }
            // 5xx, 429 and an idempotent request still in progress are transient; every other 4xx is final.
            $retryable = $status >= 500 || $status === 429
                || ($status === 409 && ($data['code'] ?? '') === 'idempotency_in_progress');
            $response = new ApiResponse($status, $data, $error, $retryable, $retryAfter);
        }

        $this->log($action, $method, $url, $body, $redactFields, is_string($raw) ? $raw : '', $response);
        return $response;
    }

    private function log(string $action, string $method, string $url, ?array $body, array $redactFields, string $raw, ApiResponse $response): void
    {
        if (!function_exists('logModuleCall')) {
            return;
        }
        $request = ['method' => $method, 'url' => $url, 'body' => $body ?? []];
        foreach ($redactFields as $f) {
            if (isset($request['body'][$f])) {
                $request['body'][$f] = '***';
            }
        }
        $replace = $this->apiKey !== '' ? [$this->apiKey] : [];
        try {
            logModuleCall('wabek', $action, $request, substr($raw, 0, 4000), [
                'status' => $response->status,
                'ok'     => $response->ok(),
                'error'  => $response->error,
            ], $replace);
        } catch (\Throwable $e) {
            // logging must never break a send
        }
    }

    /** Host of this WHMCS install (for the platform's add-on usage list). */
    private static function siteHost(): string
    {
        try {
            $url = '';
            if (class_exists('\\WHMCS\\Config\\Setting')) {
                $url = (string) \WHMCS\Config\Setting::getValue('SystemURL');
            }
            if ($url === '' && isset($GLOBALS['CONFIG']['SystemURL'])) {
                $url = (string) $GLOBALS['CONFIG']['SystemURL'];
            }
            $host = (string) parse_url($url, PHP_URL_HOST);
            return preg_match('/^[A-Za-z0-9.-]{1,253}$/', $host) ? strtolower($host) : '';
        } catch (\Throwable $e) {
            return '';
        }
    }
}
