<?php

namespace WABEK\Admin;

use WABEK\Lang;
use WABEK\Security;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

/** Small HTML builders for the admin pages. Every dynamic value is escaped here. */
final class View
{
    public const ASSETS = '../modules/addons/wabek/assets/';

    public static function e($v): string
    {
        return Security::e($v);
    }

    /** @param array<string,string> $tabs page => label */
    public static function layout(string $moduleLink, string $current, array $tabs, string $body, array $flash): string
    {
        $dir = Lang::isRtl() ? 'rtl' : 'ltr';
        $nav = '';
        foreach ($tabs as $page => $label) {
            $nav .= '<a class="wb-tab' . ($page === $current ? ' is-active' : '') . '" href="'
                . self::e($moduleLink . '&page=' . $page) . '">' . self::e($label) . '</a>';
        }
        $alerts = '';
        foreach ($flash as $f) {
            $alerts .= self::alert($f[0], $f[1]);
        }
        return '<link rel="stylesheet" href="' . self::ASSETS . 'admin.css?v=' . self::e(WABEK_MODULE_VERSION) . '">'
            . '<div class="wabek" dir="' . $dir . '" lang="' . (Lang::isRtl() ? 'ar' : 'en') . '">'
            . '<header class="wb-hero"><div class="wb-brand">'
            . '<img src="' . self::ASSETS . 'logo-mark.png" alt="" width="44" height="44">'
            . '<div><h1>' . self::e(Lang::t('module_title')) . '</h1><p>' . self::e(Lang::t('module_tagline')) . '</p></div>'
            . '</div><span class="wb-version">v' . self::e(WABEK_MODULE_VERSION) . '</span></header>'
            . '<nav class="wb-tabs">' . $nav . '</nav>'
            . $alerts
            . '<main class="wb-main">' . $body . '</main>'
            . '</div>';
    }

    public static function alert(string $type, string $message): string
    {
        $type = in_array($type, ['success', 'error', 'warning', 'info'], true) ? $type : 'info';
        return '<div class="wb-alert wb-alert-' . $type . '" role="' . ($type === 'error' ? 'alert' : 'status') . '">' . self::e($message) . '</div>';
    }

    public static function card(string $title, string $body, string $extraClass = '', string $subtitle = ''): string
    {
        return '<section class="wb-card ' . self::e($extraClass) . '">'
            . ($title !== '' ? '<div class="wb-card-head"><h2>' . self::e($title) . '</h2>'
                . ($subtitle !== '' ? '<p>' . self::e($subtitle) . '</p>' : '') . '</div>' : '')
            . '<div class="wb-card-body">' . $body . '</div></section>';
    }

    public static function form(string $action, string $page, string $moduleLink, string $inner, string $class = ''): string
    {
        return '<form method="post" action="' . self::e($moduleLink . '&page=' . $page) . '" class="wb-form ' . self::e($class) . '">'
            . Security::tokenField()
            . '<input type="hidden" name="wb_action" value="' . self::e($action) . '">'
            . $inner . '</form>';
    }

    public static function hidden(string $name, $value): string
    {
        return '<input type="hidden" name="' . self::e($name) . '" value="' . self::e($value) . '">';
    }

    public static function field(string $label, string $control, string $help = '', string $for = ''): string
    {
        return '<div class="wb-field"><label' . ($for !== '' ? ' for="' . self::e($for) . '"' : '') . '>' . self::e($label) . '</label>'
            . $control . ($help !== '' ? '<small class="wb-help">' . self::e($help) . '</small>' : '') . '</div>';
    }

    public static function input(string $name, $value, string $type = 'text', array $attrs = []): string
    {
        $a = '';
        $attrs += ['id' => 'wb-' . preg_replace('/[^a-z0-9_-]/i', '-', $name)];
        foreach ($attrs as $k => $v) {
            $a .= ' ' . self::e($k) . ($v === true ? '' : '="' . self::e($v) . '"');
        }
        return '<input class="wb-input" type="' . self::e($type) . '" name="' . self::e($name) . '" value="' . self::e($value) . '"' . $a . '>';
    }

    public static function textarea(string $name, $value, int $rows = 5, array $attrs = []): string
    {
        $a = '';
        foreach ($attrs as $k => $v) {
            $a .= ' ' . self::e($k) . ($v === true ? '' : '="' . self::e($v) . '"');
        }
        return '<textarea class="wb-input" name="' . self::e($name) . '" rows="' . $rows . '"' . $a . '>' . self::e($value) . '</textarea>';
    }

    /** @param array<string,string> $options value => label */
    public static function select(string $name, array $options, $selected, bool $multiple = false, array $attrs = []): string
    {
        $sel = is_array($selected) ? array_map('strval', $selected) : [(string) $selected];
        $a = '';
        foreach ($attrs as $k => $v) {
            $a .= ' ' . self::e($k) . ($v === true ? '' : '="' . self::e($v) . '"');
        }
        $html = '<select class="wb-input" name="' . self::e($name) . ($multiple ? '[]" multiple' : '"') . $a . '>';
        foreach ($options as $value => $label) {
            $html .= '<option value="' . self::e($value) . '"' . (in_array((string) $value, $sel, true) ? ' selected' : '') . '>' . self::e($label) . '</option>';
        }
        return $html . '</select>';
    }

    public static function toggle(string $name, bool $checked, string $label): string
    {
        return '<label class="wb-switch"><input type="hidden" name="' . self::e($name) . '" value="0">'
            . '<input type="checkbox" name="' . self::e($name) . '" value="1"' . ($checked ? ' checked' : '') . '>'
            . '<span class="wb-slider" aria-hidden="true"></span><span class="wb-switch-label">' . self::e($label) . '</span></label>';
    }

    /** @param string[] $values @param string[] $checked */
    public static function checkboxes(string $name, array $values, array $checked, callable $label): string
    {
        $html = '<div class="wb-checks">';
        foreach ($values as $v) {
            $html .= '<label class="wb-check"><input type="checkbox" name="' . self::e($name) . '[]" value="' . self::e($v) . '"'
                . (in_array($v, $checked, true) ? ' checked' : '') . '> ' . self::e($label($v)) . '</label>';
        }
        return $html . '</div>';
    }

    public static function button(string $label, string $variant = 'primary', string $name = '', string $value = ''): string
    {
        return '<button type="submit" class="wb-btn wb-btn-' . self::e($variant) . '"'
            . ($name !== '' ? ' name="' . self::e($name) . '" value="' . self::e($value) . '"' : '') . '>' . self::e($label) . '</button>';
    }

    public static function badge(string $status): string
    {
        $key = 'status_' . $status;
        $label = Lang::t($key);
        return '<span class="wb-badge wb-badge-' . self::e(preg_replace('/[^a-z_]/', '', $status)) . '">' . self::e($label === $key ? $status : $label) . '</span>';
    }

    public static function stat(string $label, $value, string $tone = ''): string
    {
        return '<div class="wb-stat ' . self::e($tone) . '"><span class="wb-stat-value">' . self::e($value) . '</span><span class="wb-stat-label">' . self::e($label) . '</span></div>';
    }

    /** @param string[] $fields */
    public static function chips(array $fields): string
    {
        $html = '<div class="wb-chips">';
        foreach ($fields as $f) {
            $html .= '<code class="wb-chip">{' . self::e($f) . '}</code>';
        }
        return $html . '</div>';
    }

    public static function table(array $headers, array $rows, string $empty): string
    {
        if (!$rows) {
            return '<div class="wb-empty">' . self::e($empty) . '</div>';
        }
        $html = '<div class="wb-table-wrap"><table class="wb-table"><thead><tr>';
        foreach ($headers as $h) {
            $html .= '<th>' . self::e($h) . '</th>';
        }
        $html .= '</tr></thead><tbody>';
        foreach ($rows as $cells) {
            // Cells are pre-escaped HTML fragments built by the controller.
            $html .= '<tr><td>' . implode('</td><td>', $cells) . '</td></tr>';
        }
        return $html . '</tbody></table></div>';
    }
}
