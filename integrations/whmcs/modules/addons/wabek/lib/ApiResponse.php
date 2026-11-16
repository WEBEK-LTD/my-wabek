<?php

namespace WABEK;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/** Result of one WABEK API call. */
final class ApiResponse
{
    /** @var int HTTP status, 0 for network errors */
    public $status;
    /** @var array decoded JSON body */
    public $data;
    /** @var string */
    public $error;
    /** @var bool 5xx / 429 / network: may be retried */
    public $retryable;
    /** @var int seconds from a Retry-After header */
    public $retryAfter;

    public function __construct(int $status, array $data, string $error, bool $retryable, int $retryAfter = 0)
    {
        $this->status = $status;
        $this->data = $data;
        $this->error = $error;
        $this->retryable = $retryable;
        $this->retryAfter = $retryAfter;
    }

    public function ok(): bool
    {
        return $this->status >= 200 && $this->status < 300 && $this->error === '';
    }

    public function messageId(): string
    {
        $id = $this->data['message_id'] ?? $this->data['messageId'] ?? '';
        return is_scalar($id) ? substr((string) $id, 0, 128) : '';
    }
}
