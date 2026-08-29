<?php

declare(strict_types=1);

if ($argc !== 2) {
    fwrite(STDERR, "Usage: php rest-session-cookie-guard-harness.php <scenario>\n");
    exit(2);
}

$scenario = (string) $argv[1];
$allowed = [ 'forwarded-https', 'production', 'http-development', 'native-ssl' ];
if (! in_array($scenario, $allowed, true)) {
    fwrite(STDERR, "Unknown scenario\n");
    exit(2);
}

define('ABSPATH', __DIR__ . DIRECTORY_SEPARATOR);
$GLOBALS['tbl_test_actions'] = [];
$GLOBALS['tbl_test_filters'] = [];
$GLOBALS['tbl_test_is_ssl'] = $scenario === 'native-ssl';
$GLOBALS['tbl_test_environment'] = $scenario === 'production' ? 'production' : 'development';

$_SERVER['HTTPS'] = 'off';
$_SERVER['SERVER_PORT'] = '80';
unset($_SERVER['HTTP_X_FORWARDED_PROTO']);
if ($scenario === 'forwarded-https') {
    $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https, http';
}

function is_ssl(): bool {
    return (bool) $GLOBALS['tbl_test_is_ssl'];
}

function wp_get_environment_type(): string {
    return (string) $GLOBALS['tbl_test_environment'];
}

function add_action($hook, $callback, $priority = 10, $accepted_args = 1): void {
    $GLOBALS['tbl_test_actions'][] = [ $hook, $callback, $priority, $accepted_args ];
}

function add_filter($hook, $callback, $priority = 10, $accepted_args = 1): void {
    $GLOBALS['tbl_test_filters'][] = [ $hook, $callback, $priority, $accepted_args ];
}

require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'scripts' . DIRECTORY_SEPARATOR . 'tbl-rest-security-hardening.php';

$params = session_get_cookie_params();
$expected_secure = $scenario !== 'http-development';
$tickera_hook = array_values(array_filter(
    $GLOBALS['tbl_test_actions'],
    static fn(array $action): bool => $action[0] === 'tickera_before_session_start'
));

$checks = [
    'session_not_started' => session_status() === PHP_SESSION_NONE,
    'secure' => (bool) $params['secure'] === $expected_secure,
    'httponly' => (bool) $params['httponly'] === true,
    'samesite' => ($params['samesite'] ?? '') === 'Lax',
    'path' => ($params['path'] ?? '') === '/',
    'lifetime' => (int) ($params['lifetime'] ?? -1) === 0,
    'strict_mode' => ini_get('session.use_strict_mode') === '1',
    'cookies_only' => ini_get('session.use_only_cookies') === '1',
    'tickera_hook' => count($tickera_hook) === 1
        && $tickera_hook[0][1] === 'tbl_rest_harden_php_session_cookie'
        && $tickera_hook[0][2] === PHP_INT_MIN,
];

$failed = array_keys(array_filter($checks, static fn(bool $passed): bool => ! $passed));
if ($failed !== []) {
    fwrite(STDERR, $scenario . ' FAIL: ' . implode(', ', $failed) . "\n");
    exit(1);
}

echo $scenario . " PASS session_start=0 provider_calls=0 writes=0\n";
