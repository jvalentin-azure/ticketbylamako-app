<?php

declare(strict_types=1);

require_once __DIR__ . '/validate-tickera-stateless-rest-runtime.php';

const TBL_TICKERA_RUNTIME_SOURCE_STAGING_ROOT = '/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html';

function tbl_tickera_runtime_probe_sanitize_stack_path(string $path): string {
    $normalized = str_replace('\\', '/', $path);
    $wp_root    = str_replace(
        '\\',
        '/',
        (string) ($GLOBALS['tbl_tickera_runtime_probe_state']['runtime']['wpRoot'] ?? '')
    );
    $probe_root = str_replace('\\', '/', __DIR__);

    if ($wp_root !== '' && ($normalized === $wp_root || str_starts_with($normalized, $wp_root . '/'))) {
        return '<WP_ROOT>' . substr($normalized, strlen($wp_root));
    }
    if ($normalized === $probe_root || str_starts_with($normalized, $probe_root . '/')) {
        return '<PROBE_ROOT>' . substr($normalized, strlen($probe_root));
    }

    return '<EXTERNAL>/' . basename($normalized);
}

/**
 * Capture only code locations and callable names. Arguments, session IDs,
 * cookies and values are deliberately excluded from the report.
 *
 * @return list<array{file?: string, line?: int, function?: string, class?: string, type?: string}>
 */
function tbl_tickera_runtime_probe_safe_stack(): array {
    $safe = [];
    foreach (debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 16) as $frame) {
        $entry = [];
        if (isset($frame['file']) && is_string($frame['file'])) {
            $entry['file'] = tbl_tickera_runtime_probe_sanitize_stack_path($frame['file']);
        }
        if (isset($frame['line'])) {
            $entry['line'] = (int) $frame['line'];
        }
        foreach (['function', 'class', 'type'] as $key) {
            if (isset($frame[$key]) && is_string($frame[$key])) {
                $entry[$key] = $frame[$key];
            }
        }
        if ($entry !== []) {
            $safe[] = $entry;
        }
    }
    return $safe;
}

final class TBL_Tickera_No_Persist_Session_Handler extends SessionHandler implements SessionUpdateTimestampHandlerInterface {
    private function count(string $operation): void {
        $state = &$GLOBALS['tbl_tickera_runtime_probe_state']['session'];
        $state[$operation]++;
        if (($state['firstEvent'] ?? null) === null) {
            $state['firstEvent'] = $operation;
            $state['firstEventStack'] = tbl_tickera_runtime_probe_safe_stack();
        }
    }

    public function open(string $path, string $name): bool {
        $this->count('open');
        return true;
    }

    public function close(): bool {
        $this->count('close');
        return true;
    }

    public function read(string $id): string|false {
        $this->count('read');
        return '';
    }

    public function write(string $id, string $data): bool {
        $this->count('write');
        return true;
    }

    public function destroy(string $id): bool {
        $this->count('destroy');
        return true;
    }

    public function gc(int $max_lifetime): int|false {
        $this->count('gc');
        return 0;
    }

    public function create_sid(): string {
        $this->count('createSid');
        return bin2hex(random_bytes(16));
    }

    public function validateId(string $id): bool {
        unset($id);
        $this->count('validateId');
        return false;
    }

    public function updateTimestamp(string $id, string $data): bool {
        unset($id, $data);
        $this->count('updateTimestamp');
        return true;
    }
}

final class TBL_Tickera_Runtime_Probe_Reporter {
    public function __destruct() {
        if (! empty($GLOBALS['tbl_tickera_runtime_probe_state']['reportEmitted'])) {
            return;
        }
        $exit_code = tbl_tickera_runtime_probe_emit($GLOBALS['tbl_tickera_runtime_probe_state']);
        if ($exit_code !== 0) {
            exit($exit_code);
        }
    }
}

/**
 * @return array{method: string, route: string, get: array<string, string>, urlForm: string, rawQuery: string}|null
 */
function tbl_tickera_runtime_probe_parse_request(string $method, string $uri): ?array {
    if (! in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return null;
    }
    if (
        $uri === ''
        || $uri[0] !== '/'
        || str_contains($uri, '#')
        || preg_match('/[\x00-\x20\x7f]/', $uri)
    ) {
        return null;
    }

    $parts = explode('?', $uri, 2);
    $path  = $parts[0];
    if (str_contains($path, '%') || str_contains($path, '\\') || str_contains($path, '//')) {
        return null;
    }
    $raw_query = $parts[1] ?? '';
    if (str_contains($raw_query, ';')) {
        return null;
    }

    $url_form = '';
    $route    = '';
    if (str_starts_with($path, '/wp-json/')) {
        $url_form = 'PRETTY';
        $route    = substr($path, strlen('/wp-json'));
    } elseif ($path === '/' || $path === '/index.php') {
        $url_form = 'REST_ROUTE';
    } else {
        return null;
    }

    $raw_values = [];
    foreach ($raw_query === '' ? [] : explode('&', $raw_query) as $pair) {
        if ($pair === '') {
            return null;
        }
        $pair_parts = explode('=', $pair, 2);
        $key        = $pair_parts[0];
        $raw_value  = $pair_parts[1] ?? '';
        if (
            $key === ''
            || ! preg_match('/^[a-z0-9_-]+$/D', $key)
            || array_key_exists($key, $raw_values)
            || str_contains($raw_value, '%')
            || str_contains($raw_value, '+')
            || preg_match('/[\x00-\x20\x7f]/', $raw_value)
        ) {
            return null;
        }
        $raw_values[$key] = $raw_value;
    }

    if ($url_form === 'REST_ROUTE') {
        if (! isset($raw_values['rest_route'])) {
            return null;
        }
        $route = $raw_values['rest_route'];
    } elseif (isset($raw_values['rest_route'])) {
        return null;
    }

    if (
        ! preg_match(
            '#^/lamako-mobile/v2/(?:rewards/config|web-session|public/(?:home-data|events-data|shop-data|events/[0-9]+|products/[0-9]+))$#D',
            $route
        )
        || str_contains($route, '%')
        || str_contains($route, '\\')
        || str_contains($route, '//')
    ) {
        return null;
    }

    $allowed_keys = $url_form === 'REST_ROUTE' ? ['rest_route'] : [];
    if ($route === '/lamako-mobile/v2/public/home-data') {
        $allowed_keys = array_merge($allowed_keys, ['summary', 'events_limit', 'products_limit']);
    } elseif ($route === '/lamako-mobile/v2/public/events-data') {
        $allowed_keys = array_merge($allowed_keys, ['summary', 'limit']);
    } elseif ($route === '/lamako-mobile/v2/public/shop-data') {
        $allowed_keys[] = 'limit';
    }

    $get = [];
    foreach ($raw_values as $key => $raw_value) {
        if (! in_array($key, $allowed_keys, true)) {
            return null;
        }
        if ($key === 'rest_route') {
            if ($raw_value !== $route) {
                return null;
            }
            $get[$key] = $raw_value;
            continue;
        }

        $value_is_valid = $key === 'summary'
            ? in_array($raw_value, ['0', '1', 'false', 'true'], true)
            : (bool) preg_match('/^[0-9]{1,3}$/D', $raw_value);
        if (! $value_is_valid) {
            return null;
        }
        $get[$key] = $raw_value;
    }

    return [
        'method'   => $method,
        'route'    => $route,
        'get'      => $get,
        'urlForm'  => $url_form,
        'rawQuery' => $raw_query,
    ];
}

function tbl_tickera_runtime_probe_clone_host_is_safe(string $host): bool {
    $host = strtolower($host);
    return (bool) preg_match('/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/D', $host)
        && ! in_array($host, ['ticketbylamako.com', 'www.ticketbylamako.com', 'staging.ticketbylamako.com'], true)
        && ! str_ends_with($host, '.ticketbylamako.com');
}

/**
 * @param array<string, mixed> $proof
 * @param array<string, mixed> $context
 * @return list<string>
 */
function tbl_tickera_runtime_probe_validate_isolation_proof(array $proof, array $context): array {
    $failures = [];
    $expect   = static function (bool $condition, string $code) use (&$failures): void {
        if (! $condition) {
            $failures[] = $code;
        }
    };

    $expect(($proof['schemaVersion'] ?? null) === 2, 'schema');
    $expect(($proof['phase'] ?? null) === 'S', 'phase');
    $expect(($proof['environment'] ?? null) === 'isolated-clone', 'environment');
    $expect(($proof['sourceEnvironment'] ?? null) === 'staging', 'source_environment');
    $expect(($proof['cloneOnly'] ?? null) === true, 'clone_only');
    $expect(($proof['publicAccessRestricted'] ?? null) === true, 'public_access');
    $expect(($proof['wpRoot'] ?? null) === ($context['wpRoot'] ?? null), 'wp_root');
    $expect(($proof['wpRoot'] ?? null) !== TBL_TICKERA_RUNTIME_SOURCE_STAGING_ROOT, 'source_staging_root_forbidden');
    $expect(($proof['wpConfigSha256'] ?? null) === ($context['wpConfigSha256'] ?? null), 'wp_config_hash');
    $expect(($proof['runnerSha256'] ?? null) === ($context['runnerSha256'] ?? null), 'runner_hash');
    $expect(($proof['validatorSha256'] ?? null) === ($context['validatorSha256'] ?? null), 'validator_hash');
    $expect(($proof['invocationIdSha256'] ?? null) === ($context['invocationIdSha256'] ?? null), 'invocation_hash');
    $expect(($proof['requestFingerprintSha256'] ?? null) === ($context['requestFingerprintSha256'] ?? null), 'request_hash');
    $expect(($proof['method'] ?? null) === ($context['method'] ?? null), 'method');
    $expect(($proof['urlForm'] ?? null) === ($context['urlForm'] ?? null), 'url_form');
    $expect(($proof['webSessionMode'] ?? null) === ($context['webSessionMode'] ?? null), 'web_session_mode');
    $expect(($proof['cachePreflightState'] ?? null) === ($context['cachePreflightState'] ?? null), 'cache_preflight');
    $clone_host = is_string($proof['cloneHost'] ?? null) ? strtolower((string) $proof['cloneHost']) : '';
    $expect(tbl_tickera_runtime_probe_clone_host_is_safe($clone_host), 'clone_host');
    foreach (
        [
            'databaseTargetFingerprintSha256',
            'objectCacheTargetFingerprintSha256',
            'databaseReadOnlyEnforced',
            'databaseCanaryWriteRejected',
            'objectCacheWritesBlocked',
            'directNetworkEgressBlocked',
            'filesystemWritesDeniedOrEphemeral',
            'productionCredentialsUnavailable',
            'cronDisabled',
            'queueWorkersDisabled',
            'mailDeliveryDisabled',
            'providerCallbacksDisabled',
        ] as $gate
    ) {
        if (str_ends_with($gate, 'Sha256')) {
            $expect(
                is_string($proof[$gate] ?? null)
                    && (bool) preg_match('/^[a-f0-9]{64}$/D', (string) $proof[$gate]),
                $gate
            );
            continue;
        }
        $expect(($proof[$gate] ?? null) === true, $gate);
    }
    $expect(($proof['databaseControl'] ?? null) === 'CLONE_SELECT_ONLY_CREDENTIAL', 'database_control');
    $expect(($proof['objectCacheControl'] ?? null) === 'CLONE_EPHEMERAL_OR_WRITE_DENIED', 'object_cache_control');
    $expect(($proof['networkControl'] ?? null) === 'PROCESS_EGRESS_DENY', 'network_control');
    $expect(($proof['filesystemControl'] ?? null) === 'READ_ONLY_ROOT_EPHEMERAL_TMP', 'filesystem_control');
    $expect(
        is_string($proof['activePluginFingerprintSha256'] ?? null)
            && (bool) preg_match('/^[a-f0-9]{64}$/D', (string) $proof['activePluginFingerprintSha256']),
        'active_plugin_fingerprint'
    );
    $expect(
        is_string($proof['evidenceManifestSha256'] ?? null)
            && (bool) preg_match('/^[a-f0-9]{64}$/D', (string) $proof['evidenceManifestSha256']),
        'evidence_manifest_hash'
    );

    $timezone = new DateTimeZone('UTC');
    $issued_text = is_string($proof['issuedAtUtc'] ?? null) ? (string) $proof['issuedAtUtc'] : '';
    $expiry_text = is_string($proof['expiresAtUtc'] ?? null) ? (string) $proof['expiresAtUtc'] : '';
    $issued_at = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $issued_text, $timezone);
    $expires_at = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $expiry_text, $timezone);
    $now = new DateTimeImmutable('now', $timezone);
    $expect(
        $issued_at instanceof DateTimeImmutable && $issued_at->format('Y-m-d\TH:i:s\Z') === $issued_text,
        'proof_issued_at'
    );
    $expect(
        $expires_at instanceof DateTimeImmutable && $expires_at->format('Y-m-d\TH:i:s\Z') === $expiry_text,
        'proof_expires_at'
    );
    $expect(
        $issued_at instanceof DateTimeImmutable && $issued_at <= $now && $issued_at >= $now->modify('-5 minutes'),
        'proof_not_fresh'
    );
    $expect(
        $expires_at instanceof DateTimeImmutable
            && $issued_at instanceof DateTimeImmutable
            && $expires_at > $issued_at
            && $expires_at > $now,
        'proof_expired'
    );
    $expect(
        $expires_at instanceof DateTimeImmutable && $expires_at <= $now->modify('+1 hour'),
        'proof_window_too_long'
    );

    return array_values(array_unique($failures));
}

function tbl_tickera_runtime_probe_add_hook(string $tag, callable $callback, int $priority, int $accepted_args): void {
    if (! isset($GLOBALS['wp_filter'])) {
        $GLOBALS['wp_filter'] = [];
    }
    if (! is_array($GLOBALS['wp_filter'])) {
        throw new RuntimeException('WordPress hook registry already initialized');
    }

    $GLOBALS['wp_filter'][$tag][$priority][] = [
        'function'      => $callback,
        'accepted_args' => $accepted_args,
    ];
}

/**
 * @return string|null
 */
function tbl_tickera_runtime_probe_catalog_key(string $route) {
    if (! function_exists('lamako_mobile_v2_catalog_cache_key')) {
        return null;
    }

    if ($route === '/lamako-mobile/v2/public/home-data') {
        $include_details = ! rest_sanitize_boolean($_GET['summary'] ?? null);
        $events_limit    = min(max(absint($_GET['events_limit'] ?? 50), 1), 100);
        $products_limit  = min(max(absint($_GET['products_limit'] ?? 12), 1), 100);
        return lamako_mobile_v2_catalog_cache_key('home', [
            'include_details' => $include_details,
            'events_limit'    => $events_limit,
            'products_limit'  => $products_limit,
        ]);
    }
    if ($route === '/lamako-mobile/v2/public/events-data') {
        $include_details = ! rest_sanitize_boolean($_GET['summary'] ?? null);
        $limit           = min(max(absint($_GET['limit'] ?? 50), 1), 100);
        return lamako_mobile_v2_catalog_cache_key('events', [
            'include_details' => $include_details,
            'limit'           => $limit,
        ]);
    }
    if ($route === '/lamako-mobile/v2/public/shop-data') {
        $limit = min(max(absint($_GET['limit'] ?? 100), 1), 100);
        return lamako_mobile_v2_catalog_cache_key('shop', ['limit' => $limit]);
    }
    if (preg_match('#/public/events/([0-9]+)$#D', $route, $matches)) {
        return lamako_mobile_v2_catalog_cache_key('event-detail', ['event_id' => absint($matches[1])]);
    }
    if (preg_match('#/public/products/([0-9]+)$#D', $route, $matches)) {
        return lamako_mobile_v2_catalog_cache_key('product-detail', ['product_id' => absint($matches[1])]);
    }

    return null;
}

function tbl_tickera_runtime_probe_session_module(): string {
    $module = session_module_name();
    return is_string($module) ? $module : '';
}

/**
 * @return list<array{class: string, method: string, priority: int, isGlobalTc: bool, sourceSha256: string}>
 */
function tbl_tickera_runtime_probe_tickera_inventory(): array {
    $registry = $GLOBALS['wp_filter']['wp_loaded'] ?? null;
    if ($registry instanceof WP_Hook) {
        $callbacks = $registry->callbacks;
    } elseif (is_array($registry)) {
        $callbacks = $registry;
    } else {
        return [];
    }

    $global_tc = $GLOBALS['tc'] ?? null;
    $inventory = [];
    foreach ($callbacks as $priority => $entries) {
        if (! is_array($entries)) {
            continue;
        }
        foreach ($entries as $entry) {
            $callback = is_array($entry) && array_key_exists('function', $entry)
                ? $entry['function']
                : null;
            if (
                ! is_array($callback)
                || count($callback) !== 2
                || ! is_object($callback[0])
                || ! ($callback[0] instanceof \Tickera\TC)
                || (string) $callback[1] !== 'update_cart'
            ) {
                continue;
            }

            $reflection = new ReflectionClass($callback[0]);
            $source     = $reflection->getFileName();
            $inventory[] = [
                'class'        => get_class($callback[0]),
                'method'       => 'update_cart',
                'priority'     => (int) $priority,
                'isGlobalTc'   => $callback[0] === $global_tc,
                'sourceSha256' => is_string($source) && is_readable($source)
                    ? strtolower((string) hash_file('sha256', $source))
                    : '',
            ];
        }
    }

    usort($inventory, static function (array $left, array $right): int {
        return [$left['priority'], $left['class'], $left['method']]
            <=> [$right['priority'], $right['class'], $right['method']];
    });
    return $inventory;
}

/**
 * @return array<string, bool>
 */
function tbl_tickera_runtime_probe_filter_health(): array {
    $callbacks = $GLOBALS['tbl_tickera_runtime_probe_callbacks'] ?? [];
    return [
        'queryEarly' => isset($callbacks['queryEarly'])
            && has_filter('query', $callbacks['queryEarly']) === PHP_INT_MIN,
        'queryFinal' => isset($callbacks['queryFinal'])
            && has_filter('query', $callbacks['queryFinal']) === PHP_INT_MAX,
        'httpEarly'  => isset($callbacks['httpEarly'])
            && has_filter('pre_http_request', $callbacks['httpEarly']) === PHP_INT_MIN,
        'httpFinal'  => isset($callbacks['httpFinal'])
            && has_filter('pre_http_request', $callbacks['httpFinal']) === PHP_INT_MAX,
    ];
}

function tbl_tickera_runtime_probe_capture_session_checkpoint(string $checkpoint): void {
    $state = &$GLOBALS['tbl_tickera_runtime_probe_state']['session'];
    $state['status' . $checkpoint] = session_status();
    $state['module' . $checkpoint] = tbl_tickera_runtime_probe_session_module();
}

function tbl_tickera_runtime_probe_reinforce_session_handler(string $checkpoint): bool {
    if (session_status() !== PHP_SESSION_NONE) {
        return false;
    }

    $handler = $GLOBALS['tbl_tickera_runtime_probe_session_handler'] ?? null;
    if (! $handler instanceof TBL_Tickera_No_Persist_Session_Handler) {
        return false;
    }

    $installed = session_set_save_handler($handler, false)
        && tbl_tickera_runtime_probe_session_module() === 'user';
    $GLOBALS['tbl_tickera_runtime_probe_state']['session'][$checkpoint] = $installed;
    return $installed;
}

function tbl_tickera_runtime_probe_register_hooks(): void {
    $query_early_filter = static function ($query) {
        $query = (string) $query;
        $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
        $state['database']['totalQueries']++;
        if (tbl_tickera_runtime_sql_is_read_only($query)) {
            $state['database']['readOnlyQueries']++;
            return $query;
        }

        $state['database']['nonReadAttempts']++;
        $state['database']['blockedNonReadAttempts']++;
        $operation = tbl_tickera_runtime_sql_operation($query);
        if (! in_array($operation, $state['database']['blockedOperations'], true)) {
            $state['database']['blockedOperations'][] = $operation;
        }
        throw new RuntimeException('Blocked non-read SQL operation: ' . $operation);
    };
    $query_final_filter = static function ($query) {
        $query = (string) $query;
        $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
        $state['database']['finalQueries']++;
        if (tbl_tickera_runtime_sql_is_read_only($query)) {
            $state['database']['finalReadOnlyQueries']++;
            return $query;
        }

        $state['database']['lateNonReadAttempts']++;
        throw new RuntimeException(
            'Blocked non-read SQL operation after intermediate query filters: '
            . tbl_tickera_runtime_sql_operation($query)
        );
    };
    $http_early_filter = static function ($preempt, $arguments, $url) {
        unset($preempt, $arguments, $url);
        $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
        $state['network']['wpHttpAttempts']++;
        $state['network']['blockedWpHttpAttempts']++;
        return new WP_Error('tbl_runtime_probe_http_blocked', 'HTTP blocked by read-only qualification.');
    };
    $http_final_filter = static function ($preempt, $arguments, $url) {
        unset($preempt, $arguments, $url);
        $GLOBALS['tbl_tickera_runtime_probe_state']['network']['finalBlockCalls']++;
        return new WP_Error('tbl_runtime_probe_http_blocked_final', 'HTTP blocked by final read-only qualification hook.');
    };
    $GLOBALS['tbl_tickera_runtime_probe_callbacks'] = [
        'queryEarly' => $query_early_filter,
        'queryFinal' => $query_final_filter,
        'httpEarly'  => $http_early_filter,
        'httpFinal'  => $http_final_filter,
    ];

    tbl_tickera_runtime_probe_add_hook(
        'query',
        $query_early_filter,
        PHP_INT_MIN,
        1
    );
    tbl_tickera_runtime_probe_add_hook(
        'query',
        $query_final_filter,
        PHP_INT_MAX,
        1
    );

    tbl_tickera_runtime_probe_add_hook(
        'pre_http_request',
        $http_early_filter,
        PHP_INT_MIN,
        3
    );
    tbl_tickera_runtime_probe_add_hook(
        'pre_http_request',
        $http_final_filter,
        PHP_INT_MAX,
        3
    );

    foreach (['set_transient', 'setted_transient'] as $hook) {
        tbl_tickera_runtime_probe_add_hook(
            $hook,
            static function (): void {
                $GLOBALS['tbl_tickera_runtime_probe_state']['cache']['setTransientAttempts']++;
            },
            PHP_INT_MIN,
            0
        );
    }

    foreach (
        [
            'woocommerce_add_to_cart',
            'woocommerce_cart_updated',
            'woocommerce_applied_coupon',
            'woocommerce_removed_coupon',
            'woocommerce_checkout_order_created',
            'woocommerce_new_order',
            'woocommerce_order_status_changed',
            'woocommerce_payment_complete',
            'tc_order_created',
            'tc_ticket_instance_created',
        ] as $hook
    ) {
        tbl_tickera_runtime_probe_add_hook(
            $hook,
            static function (): void {
                $GLOBALS['tbl_tickera_runtime_probe_state']['mutations']['businessHooks']++;
            },
            PHP_INT_MIN,
            0
        );
    }

    tbl_tickera_runtime_probe_add_hook(
        'rest_api_init',
        static function (): void {
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            $route = $state['request']['route'];
            if (! tbl_tickera_runtime_is_catalog_route($route)) {
                return;
            }

            $cache_key = tbl_tickera_runtime_probe_catalog_key($route);
            if (! is_string($cache_key) || $cache_key === '') {
                return;
            }
            $state['cache']['writeBlockInstalled'] = true;
            add_filter(
                'pre_set_transient_' . $cache_key,
                static function ($value) {
                    $GLOBALS['tbl_tickera_runtime_probe_state']['cache']['setTransientAttempts']++;
                    throw new RuntimeException('Blocked catalogue transient write');
                },
                PHP_INT_MIN,
                1
            );

            $cached = get_transient($cache_key);
            $state['cache']['observedPreflightState'] = $cached === false ? 'MISS' : 'HIT';
            if ($cached === false) {
                throw new RuntimeException('Catalogue cache is not warm; Phase S stopped before the route callback.');
            }
        },
        PHP_INT_MIN,
        0
    );

    tbl_tickera_runtime_probe_add_hook(
        'wp_loaded',
        static function (): void {
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            $tc    = $GLOBALS['tc'] ?? null;

            $state['hook']['sequence'][] = 'wp_loaded_before';

            $state['runtime']['wordpressLoaded'] = true;
            $state['runtime']['realWordPressRuntime'] = true;
            $state['runtime']['hostIsIsolatedClone'] = function_exists('home_url')
                && strtolower((string) parse_url((string) home_url('/'), PHP_URL_HOST))
                    === $state['runtime']['cloneHost'];
            $state['runtime']['wpEnvironmentType'] = function_exists('wp_get_environment_type')
                ? (string) wp_get_environment_type()
                : '';
            $state['runtime']['tickeraLoaded'] = $tc instanceof \Tickera\TC;
            $state['runtime']['tickeraVersion'] = $state['runtime']['tickeraLoaded'] && isset($tc->version)
                ? (string) $tc->version
                : '';
            if ($state['runtime']['tickeraLoaded']) {
                $reflection = new ReflectionClass($tc);
                $source     = $reflection->getFileName();
                $state['runtime']['tickeraSourceSha256'] = is_string($source) && is_readable($source)
                    ? strtolower((string) hash_file('sha256', $source))
                    : '';
                $state['hook']['before'] = has_action('wp_loaded', [$tc, 'update_cart']);
            }
            $state['hook']['beforeInventory'] = tbl_tickera_runtime_probe_tickera_inventory();

            $state['runtime']['shimLoaded'] = function_exists('tbl_tickera_stateless_rest_request_is_allowlisted');
            if ($state['runtime']['shimLoaded']) {
                $reflection = new ReflectionFunction('tbl_tickera_stateless_rest_request_is_allowlisted');
                $source     = $reflection->getFileName();
                $state['runtime']['shimSha256'] = is_string($source) && is_readable($source)
                    ? strtolower((string) hash_file('sha256', $source))
                    : '';
                $state['runtime']['requestAllowlisted'] = tbl_tickera_stateless_rest_request_is_allowlisted();
                $state['hook']['guardPriorityIsMin'] = has_action(
                    'wp_loaded',
                    'tbl_tickera_stateless_rest_disable_global_cart_bootstrap'
                ) === PHP_INT_MIN;
            }
            $state['instrumentation']['filterHealthAtWpLoaded'] = tbl_tickera_runtime_probe_filter_health();
            tbl_tickera_runtime_probe_capture_session_checkpoint('AtWpLoadedBefore');
            $state['session']['strictModeAtWpLoaded'] = (string) ini_get('session.use_strict_mode');
        },
        PHP_INT_MIN,
        0
    );

    tbl_tickera_runtime_probe_add_hook(
        'wp_loaded',
        static function (): void {
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            $state['hook']['sequence'][] = 'wp_loaded_reinforce';
            tbl_tickera_runtime_probe_capture_session_checkpoint('AtWpLoadedReinforce');
            tbl_tickera_runtime_probe_reinforce_session_handler('handlerReinforcedAtWpLoaded');
            $state['session']['moduleAfterWpLoadedReinforce'] = tbl_tickera_runtime_probe_session_module();
        },
        9,
        0
    );

    tbl_tickera_runtime_probe_add_hook(
        'wp_loaded',
        static function (): void {
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            $tc    = $GLOBALS['tc'] ?? null;
            $state['hook']['sequence'][] = 'wp_loaded_after';
            $state['hook']['after'] = $tc instanceof \Tickera\TC
                ? has_action('wp_loaded', [$tc, 'update_cart'])
                : null;
            $state['hook']['afterInventory'] = tbl_tickera_runtime_probe_tickera_inventory();
            tbl_tickera_runtime_probe_capture_session_checkpoint('AtWpLoadedAfter');
            $state['runtime']['executed'] = true;
        },
        PHP_INT_MAX,
        0
    );

    tbl_tickera_runtime_probe_add_hook(
        'rest_pre_dispatch',
        static function ($result, $server, $request) {
            unset($server);
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            if (
                ! is_object($request)
                || ! method_exists($request, 'get_route')
                || (string) $request->get_route() !== $state['request']['route']
            ) {
                return $result;
            }

            $state['hook']['sequence'][] = 'rest_pre_dispatch';
            $state['instrumentation']['restPreDispatchObserved'] = true;
            tbl_tickera_runtime_probe_capture_session_checkpoint('AtRestPreDispatch');
            return $result;
        },
        PHP_INT_MIN,
        3
    );

    tbl_tickera_runtime_probe_add_hook(
        'rest_request_before_callbacks',
        static function ($response, $handler, $request) {
            unset($handler);
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            if (
                ! is_object($request)
                || ! method_exists($request, 'get_route')
                || (string) $request->get_route() !== $state['request']['route']
            ) {
                return $response;
            }
            $state['hook']['sequence'][] = 'rest_before_callbacks';
            $state['instrumentation']['restCallbackObserved'] = true;
            tbl_tickera_runtime_probe_capture_session_checkpoint('BeforeRestCallback');
            tbl_tickera_runtime_probe_reinforce_session_handler('handlerReinforcedBeforeRestCallback');
            $state['session']['moduleAfterRestReinforce'] = tbl_tickera_runtime_probe_session_module();
            return $response;
        },
        PHP_INT_MIN,
        3
    );

    tbl_tickera_runtime_probe_add_hook(
        'rest_post_dispatch',
        static function ($response, $server, $request) {
            unset($server);
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            if (! is_object($request) || ! method_exists($request, 'get_route')) {
                return $response;
            }
            if ((string) $request->get_route() !== $state['request']['route']) {
                return $response;
            }

            $state['hook']['sequence'][] = 'rest_post_dispatch';
            $state['instrumentation']['restPostDispatchObserved'] = true;
            if (! is_object($response)) {
                return $response;
            }

            $headers = method_exists($response, 'get_headers') ? (array) $response->get_headers() : [];
            $data    = method_exists($response, 'get_data') ? $response->get_data() : null;
            $status  = method_exists($response, 'get_status') ? (int) $response->get_status() : 0;
            $normalized_headers = [];
            foreach ($headers as $name => $value) {
                if (is_string($name) && (is_scalar($value) || $value === null)) {
                    $normalized_headers[strtolower($name)] = (string) $value;
                }
            }

            $state['response']['httpStatus'] = $status;
            $state['response']['jsonValid'] = json_encode($data, JSON_INVALID_UTF8_SUBSTITUTE) !== false;
            $state['cache']['responseState'] = strtoupper(
                (string) ($normalized_headers['x-lamako-catalog-cache'] ?? 'NOT_APPLICABLE')
            );
            if (
                $state['request']['route'] === '/lamako-mobile/v2/web-session'
                && $state['request']['method'] !== 'OPTIONS'
            ) {
                $state['response']['authSemanticsValid'] = is_array($data)
                    && array_key_exists('authenticated', $data)
                    && $data['authenticated'] === false
                    && $state['request']['webSessionMode'] === 'ANONYMOUS_CLI';
            } else {
                $state['response']['authSemanticsValid'] = is_array($data) || is_object($data);
            }

            return $response;
        },
        PHP_INT_MAX,
        3
    );

    tbl_tickera_runtime_probe_add_hook(
        'shutdown',
        static function (): void {
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            $state['hook']['sequence'][] = 'wp_shutdown';
            $state['instrumentation']['wp_shutdown_seen'] = true;
            $state['instrumentation']['filterHealthAtWpShutdown'] = tbl_tickera_runtime_probe_filter_health();
            $tc = $GLOBALS['tc'] ?? null;
            $state['hook']['atWpShutdown'] = $tc instanceof \Tickera\TC
                ? has_action('wp_loaded', [$tc, 'update_cart'])
                : null;
            $state['hook']['shutdownInventory'] = tbl_tickera_runtime_probe_tickera_inventory();
            tbl_tickera_runtime_probe_capture_session_checkpoint('AtWpShutdown');
            $state['session']['autoStartAtWpShutdown'] = (string) ini_get('session.auto_start');
        },
        PHP_INT_MAX,
        0
    );
}

/**
 * @param array<string, mixed> $state
 */
function tbl_tickera_runtime_probe_emit(array &$state): int {
    if (! empty($state['reportEmitted'])) {
        return 1;
    }

    $state['report']['attempts']++;
    $state['hook']['sequence'][] = 'reporter_destruct';
    $state['instrumentation']['reporterAfterWpShutdown'] =
        ($state['instrumentation']['wp_shutdown_seen'] ?? false) === true;
    $state['instrumentation']['filterHealthAtReporter'] = function_exists('has_filter')
        ? tbl_tickera_runtime_probe_filter_health()
        : ['queryEarly' => false, 'queryFinal' => false, 'httpEarly' => false, 'httpFinal' => false];
    $tc = $GLOBALS['tc'] ?? null;
    $state['hook']['atReporter'] = $tc instanceof \Tickera\TC
        ? has_action('wp_loaded', [$tc, 'update_cart'])
        : null;
    $state['hook']['reporterInventory'] = function_exists('has_action')
        ? tbl_tickera_runtime_probe_tickera_inventory()
        : [];
    tbl_tickera_runtime_probe_capture_session_checkpoint('AtReporterBeforeCleanup');

    $state['session']['cleanupMethod'] = 'NONE';
    $state['session']['cleanupSucceeded'] = true;
    if (session_status() === PHP_SESSION_ACTIVE) {
        $state['session']['cleanupMethod'] = 'SESSION_ABORT';
        $state['session']['cleanupSucceeded'] = session_abort();
    }
    tbl_tickera_runtime_probe_capture_session_checkpoint('AtReporterAfterCleanup');

    $last_error = error_get_last();
    $fatal_types = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    $state['runtime']['fatalError'] = is_array($last_error)
        && in_array((int) ($last_error['type'] ?? 0), $fatal_types, true);

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    $state['report']['emitted'] = true;
    $state['report']['intendedExitCode'] = 0;
    $state['decision'] = 'COMPONENT_PASS_EXTERNAL_REQUIRED';
    $state['reportEmitted'] = true;
    $failures = tbl_tickera_runtime_validate_report(
        $state,
        (string) ($state['runtime']['invocationIdSha256'] ?? '')
    );
    if ($failures !== []) {
        $state['decision'] = 'STOP';
        $state['report']['intendedExitCode'] = 1;
    }
    $state['failures'] = $failures;
    $json = json_encode(
        $state,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if (! is_string($json)) {
        return 1;
    }
    $line = 'TBL_TICKERA_RUNTIME_REPORT ' . $json . "\n";
    $written = fwrite(STDERR, $line);
    if ($written === false || $written !== strlen($line)) {
        return 1;
    }
    return $failures === [] ? 0 : 1;
}

function tbl_tickera_runtime_probe_main(): int {
    if (PHP_SAPI !== 'cli') {
        fwrite(STDERR, "STOP cli_only\n");
        return 1;
    }
    if (function_exists('add_filter') || defined('ABSPATH')) {
        fwrite(STDERR, "STOP bootstrap_already_started\n");
        return 1;
    }

    $options = getopt(
        '',
        [
            'wp-root:',
            'method:',
            'uri:',
            'cache-preflight:',
            'web-session-mode:',
            'wp-config-sha256:',
            'isolation-proof:',
            'isolation-proof-sha256:',
            'invocation-id:',
        ]
    );
    if (
        ! is_array($options)
        || ! isset(
            $options['wp-root'],
            $options['method'],
            $options['uri'],
            $options['cache-preflight'],
            $options['web-session-mode'],
            $options['wp-config-sha256'],
            $options['isolation-proof'],
            $options['isolation-proof-sha256'],
            $options['invocation-id']
        )
    ) {
        fwrite(STDERR, "STOP real_wordpress_runtime_required\n");
        return 1;
    }

    $method = (string) $options['method'];
    $uri    = (string) $options['uri'];
    $parsed = tbl_tickera_runtime_probe_parse_request($method, $uri);
    if ($parsed === null) {
        fwrite(STDERR, "STOP request_not_allowlisted\n");
        return 1;
    }

    $invocation_id = (string) $options['invocation-id'];
    if (! preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $invocation_id)) {
        fwrite(STDERR, "STOP invocation_id_invalid\n");
        return 1;
    }
    $invocation_id_sha256 = hash('sha256', $invocation_id);
    $request_fingerprint_sha256 = hash('sha256', $method . "\n" . $uri);

    $cache_preflight = strtoupper((string) $options['cache-preflight']);
    $catalog_route   = tbl_tickera_runtime_is_catalog_route($parsed['route']);
    if (($catalog_route && $cache_preflight !== 'HIT') || (! $catalog_route && $cache_preflight !== 'NOT_APPLICABLE')) {
        fwrite(STDERR, "STOP cache_preflight_not_safe\n");
        return 1;
    }
    $web_session_mode = strtoupper((string) $options['web-session-mode']);
    if (
        ($parsed['route'] === '/lamako-mobile/v2/web-session' && $web_session_mode !== 'ANONYMOUS_CLI')
        || ($parsed['route'] !== '/lamako-mobile/v2/web-session' && $web_session_mode !== 'NOT_APPLICABLE')
    ) {
        fwrite(STDERR, "STOP web_session_mode_invalid\n");
        return 1;
    }

    $wp_root = realpath((string) $options['wp-root']);
    $normalized_wp_root = $wp_root === false ? '' : str_replace('\\', '/', $wp_root);
    if (
        $wp_root === false
        || $normalized_wp_root === TBL_TICKERA_RUNTIME_SOURCE_STAGING_ROOT
        || ! is_readable($wp_root . DIRECTORY_SEPARATOR . 'wp-blog-header.php')
        || ! is_readable($wp_root . DIRECTORY_SEPARATOR . 'wp-config.php')
    ) {
        fwrite(STDERR, "STOP isolated_clone_wordpress_root_unavailable\n");
        return 1;
    }

    $expected_wp_config_sha256 = strtolower((string) $options['wp-config-sha256']);
    $actual_wp_config_sha256   = strtolower(
        (string) hash_file('sha256', $wp_root . DIRECTORY_SEPARATOR . 'wp-config.php')
    );
    if (
        ! preg_match('/^[a-f0-9]{64}$/D', $expected_wp_config_sha256)
        || ! hash_equals($expected_wp_config_sha256, $actual_wp_config_sha256)
    ) {
        fwrite(STDERR, "STOP wp_config_hash_mismatch\n");
        return 1;
    }

    $runner_sha256    = strtolower((string) hash_file('sha256', __FILE__));
    $validator_sha256 = strtolower(
        (string) hash_file('sha256', __DIR__ . '/validate-tickera-stateless-rest-runtime.php')
    );
    $proof_path = realpath((string) $options['isolation-proof']);
    $normalized_proof_path = $proof_path === false ? '' : str_replace('\\', '/', $proof_path);
    if (
        $proof_path === false
        || str_starts_with($normalized_proof_path, $normalized_wp_root . '/')
        || ! is_readable($proof_path)
        || ((int) fileperms($proof_path) & 0777) !== 0600
    ) {
        fwrite(STDERR, "STOP private_isolation_proof_unavailable\n");
        return 1;
    }
    $expected_proof_sha256 = strtolower((string) $options['isolation-proof-sha256']);
    $actual_proof_sha256   = strtolower((string) hash_file('sha256', $proof_path));
    if (
        ! preg_match('/^[a-f0-9]{64}$/D', $expected_proof_sha256)
        || ! hash_equals($expected_proof_sha256, $actual_proof_sha256)
    ) {
        fwrite(STDERR, "STOP isolation_proof_hash_mismatch\n");
        return 1;
    }
    try {
        $proof = json_decode((string) file_get_contents($proof_path), true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        fwrite(STDERR, "STOP isolation_proof_invalid_json\n");
        return 1;
    }
    if (! is_array($proof)) {
        fwrite(STDERR, "STOP isolation_proof_not_object\n");
        return 1;
    }
    $proof_failures = tbl_tickera_runtime_probe_validate_isolation_proof($proof, [
        'wpRoot'                   => $normalized_wp_root,
        'wpConfigSha256'           => $actual_wp_config_sha256,
        'runnerSha256'             => $runner_sha256,
        'validatorSha256'          => $validator_sha256,
        'invocationIdSha256'       => $invocation_id_sha256,
        'requestFingerprintSha256' => $request_fingerprint_sha256,
        'method'                   => $method,
        'urlForm'                  => $parsed['urlForm'],
        'webSessionMode'           => $web_session_mode,
        'cachePreflightState'      => $cache_preflight,
    ]);
    if ($proof_failures !== []) {
        fwrite(STDERR, 'STOP isolation_' . implode(',', $proof_failures) . "\n");
        return 1;
    }

    if (
        (string) ini_get('session.auto_start') !== '0'
        || (string) ini_get('session.use_strict_mode') !== '1'
        || session_status() !== PHP_SESSION_NONE
        || headers_sent()
        || tbl_tickera_runtime_probe_session_module() === ''
        || tbl_tickera_runtime_probe_session_module() === 'user'
    ) {
        fwrite(STDERR, "STOP session_prebootstrap_state_invalid\n");
        return 1;
    }

    $clone_host = strtolower((string) $proof['cloneHost']);

    $GLOBALS['tbl_tickera_runtime_probe_state'] = [
        'schemaVersion' => TBL_TICKERA_STATELESS_REST_RUNTIME_SCHEMA,
        'phase'         => 'S',
        'runtime'       => [
            'executed'             => false,
            'syntheticRequest'     => true,
            'realWordPressRuntime' => false,
            'freshProcess'         => true,
            'executionKind'        => 'CLI_SYNTHETIC_REQUEST_REAL_BOOTSTRAP',
            'wordpressLoaded'      => false,
            'hostIsIsolatedClone'  => false,
            'wpEnvironmentType'    => '',
            'wpRoot'               => $normalized_wp_root,
            'cloneHost'            => $clone_host,
            'tickeraLoaded'        => false,
            'tickeraVersion'       => '',
            'tickeraSourceSha256'  => '',
            'shimLoaded'           => false,
            'shimSha256'           => '',
            'requestAllowlisted'   => false,
            'fatalError'           => false,
            'runnerSha256'         => $runner_sha256,
            'validatorSha256'      => $validator_sha256,
            'invocationIdSha256'   => $invocation_id_sha256,
            'requestFingerprintSha256' => $request_fingerprint_sha256,
            'wpConfigSha256'       => $actual_wp_config_sha256,
            'isolationProofSha256' => $actual_proof_sha256,
            'httpEvidenceIncluded' => false,
        ],
        'instrumentation' => [
            'preinitializedBeforeBootstrap' => true,
            'prebootstrapQualification'      => [
                'proofValidated'      => true,
                'environmentQualified' => true,
                'rootQualified'       => true,
                'databaseQualified'   => true,
                'cacheQualified'      => true,
                'networkQualified'    => true,
                'filesystemQualified' => true,
            ],
            'filterHealthAtWpLoaded'         => [],
            'filterHealthAtWpShutdown'       => [],
            'filterHealthAtReporter'         => [],
            'restPreDispatchObserved'        => false,
            'restCallbackObserved'           => false,
            'restPostDispatchObserved'       => false,
            'wp_shutdown_seen'               => false,
            'reporterAfterWpShutdown'        => false,
        ],
        'isolation' => [
            'assertionSource'                 => 'EXTERNAL_SEALED_PROVISIONING',
            'runnerVerificationScope'         => 'MANIFEST_SHAPE_HASH_AND_BINDING_ONLY',
            'environment'                     => 'isolated-clone',
            'cloneOnly'                       => true,
            'databaseReadOnlyEnforced'       => true,
            'databaseCanaryWriteRejected'     => true,
            'databaseControl'                 => (string) $proof['databaseControl'],
            'databaseTargetFingerprintSha256' => (string) $proof['databaseTargetFingerprintSha256'],
            'objectCacheWritesBlocked'       => true,
            'objectCacheControl'              => (string) $proof['objectCacheControl'],
            'objectCacheTargetFingerprintSha256' => (string) $proof['objectCacheTargetFingerprintSha256'],
            'directNetworkEgressBlocked'     => true,
            'networkControl'                  => (string) $proof['networkControl'],
            'filesystemWritesDeniedOrEphemeral' => true,
            'filesystemControl'               => (string) $proof['filesystemControl'],
            'productionCredentialsUnavailable' => true,
            'cronDisabled'                    => true,
            'queueWorkersDisabled'            => true,
            'mailDeliveryDisabled'            => true,
            'providerCallbacksDisabled'       => true,
            'publicAccessRestricted'          => true,
            'activePluginFingerprintSha256'  => (string) $proof['activePluginFingerprintSha256'],
            'evidenceManifestSha256'         => (string) $proof['evidenceManifestSha256'],
        ],
        'request'       => [
            'method'                   => $method,
            'route'                    => $parsed['route'],
            'urlForm'                  => $parsed['urlForm'],
            'webSessionMode'           => $web_session_mode,
            'requestFingerprintSha256' => $request_fingerprint_sha256,
        ],
        'hook'          => [
            'before'             => null,
            'after'              => null,
            'atWpShutdown'       => null,
            'atReporter'         => null,
            'guardPriorityIsMin' => false,
            'beforeInventory'    => [],
            'afterInventory'     => [],
            'shutdownInventory'  => [],
            'reporterInventory'  => [],
            'sequence'           => [],
        ],
        'session'       => [
            'handlerInstalledBeforeBootstrap' => false,
            'handlerReinforcedAtWpLoaded'      => false,
            'handlerReinforcedBeforeRestCallback' => false,
            'autoStartBefore'                  => (string) ini_get('session.auto_start'),
            'autoStartAtWpShutdown'            => null,
            'headersSentBefore'                => headers_sent(),
            'strictModeBefore'                 => (string) ini_get('session.use_strict_mode'),
            'strictModeAtWpLoaded'             => null,
            'statusBefore'                     => session_status(),
            'moduleBefore'                     => tbl_tickera_runtime_probe_session_module(),
            'moduleAfterInstall'                => null,
            'statusAtWpLoadedBefore'            => null,
            'moduleAtWpLoadedBefore'            => null,
            'statusAtWpLoadedReinforce'         => null,
            'moduleAtWpLoadedReinforce'         => null,
            'moduleAfterWpLoadedReinforce'      => null,
            'statusAtWpLoadedAfter'             => null,
            'moduleAtWpLoadedAfter'             => null,
            'statusAtRestPreDispatch'           => null,
            'moduleAtRestPreDispatch'           => null,
            'statusBeforeRestCallback'          => null,
            'moduleBeforeRestCallback'          => null,
            'moduleAfterRestReinforce'           => null,
            'statusAtWpShutdown'                 => null,
            'moduleAtWpShutdown'                 => null,
            'statusAtReporterBeforeCleanup'      => null,
            'moduleAtReporterBeforeCleanup'      => null,
            'statusAtReporterAfterCleanup'       => null,
            'moduleAtReporterAfterCleanup'       => null,
            'cleanupMethod'                      => null,
            'cleanupSucceeded'                   => null,
            'firstEvent'                         => null,
            'firstEventStack'                    => [],
            'open'                            => 0,
            'read'                            => 0,
            'write'                           => 0,
            'destroy'                         => 0,
            'close'                           => 0,
            'gc'                              => 0,
            'createSid'                       => 0,
            'validateId'                      => 0,
            'updateTimestamp'                 => 0,
        ],
        'network'       => [
            'blockInstalled'             => true,
            'coverage'                   => 'WP_HTTP_API_ONLY',
            'directTransportBlocked'     => false,
            'externalEgressProofRequired' => true,
            'wpHttpAttempts'             => 0,
            'blockedWpHttpAttempts'      => 0,
            'finalBlockCalls'            => 0,
        ],
        'database'      => [
            'guardScope'             => 'WPDB_QUERY_FILTER_ONLY',
            'directDriverBlocked'    => false,
            'externalReadOnlyProofRequired' => true,
            'totalQueries'           => 0,
            'readOnlyQueries'        => 0,
            'finalQueries'           => 0,
            'finalReadOnlyQueries'   => 0,
            'nonReadAttempts'        => 0,
            'blockedNonReadAttempts' => 0,
            'lateNonReadAttempts'    => 0,
            'blockedOperations'      => [],
        ],
        'cache'         => [
            'declaredPreflightState' => $cache_preflight,
            'observedPreflightState' => $catalog_route ? 'UNOBSERVED' : 'NOT_APPLICABLE',
            'responseState'          => 'NOT_APPLICABLE',
            'setTransientAttempts' => 0,
            'writeBlockInstalled'  => ! $catalog_route,
        ],
        'mutations'     => ['businessHooks' => 0],
        'response'      => [
            'httpStatus'        => 0,
            'jsonValid'         => false,
            'authSemanticsValid' => false,
            'headersObservable' => false,
            'externalHttpRequired' => true,
        ],
        'externalHttpContract' => [
            'required'                    => true,
            'freshProcessPerCase'         => true,
            'methods'                     => ['GET', 'HEAD', 'OPTIONS'],
            'urlForms'                    => ['PRETTY', 'REST_ROUTE'],
            'webSessionModes'             => ['ANONYMOUS', 'AUTHENTICATED'],
            'corsJwtStatusRequired'       => true,
            'phpSessionCookieForbidden'   => true,
        ],
        'report' => [
            'attempts'         => 0,
            'emitted'          => false,
            'intendedExitCode' => null,
        ],
        'reportEmitted' => false,
    ];

    $handler = new TBL_Tickera_No_Persist_Session_Handler();
    $GLOBALS['tbl_tickera_runtime_probe_session_handler'] = $handler;
    $installed = session_set_save_handler($handler, false)
        && tbl_tickera_runtime_probe_session_module() === 'user';
    $GLOBALS['tbl_tickera_runtime_probe_state']['session']['handlerInstalledBeforeBootstrap'] = $installed;
    $GLOBALS['tbl_tickera_runtime_probe_state']['session']['moduleAfterInstall'] =
        tbl_tickera_runtime_probe_session_module();
    if (! $installed) {
        fwrite(STDERR, "STOP session_handler_install_failed\n");
        return 1;
    }

    tbl_tickera_runtime_probe_register_hooks();
    $GLOBALS['tbl_tickera_runtime_probe_reporter'] = new TBL_Tickera_Runtime_Probe_Reporter();

    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['REQUEST_URI']    = $uri;
    $_SERVER['QUERY_STRING']   = $parsed['rawQuery'];
    $_SERVER['HTTP_HOST']      = $clone_host;
    $_SERVER['SERVER_NAME']    = $clone_host;
    $_SERVER['SERVER_PORT']    = '443';
    $_SERVER['HTTPS']          = 'on';
    $_SERVER['SCRIPT_NAME']    = '/index.php';
    $_SERVER['PHP_SELF']       = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = $wp_root . DIRECTORY_SEPARATOR . 'index.php';
    $_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
    $_SERVER['REMOTE_ADDR']    = '127.0.0.1';
    $_SERVER['HTTP_ORIGIN']    = 'https://' . $clone_host;
    $_GET                      = $parsed['get'];
    $_POST                     = [];
    $_COOKIE                   = [];
    $_REQUEST                  = $_GET;

    if (! defined('WP_USE_THEMES')) {
        define('WP_USE_THEMES', false);
    }
    if (! defined('DISABLE_WP_CRON')) {
        define('DISABLE_WP_CRON', true);
    }
    if (! defined('DOING_CRON')) {
        define('DOING_CRON', true);
    }
    ob_start(static function (string $buffer): string {
        unset($buffer);
        return '';
    });
    require $wp_root . DIRECTORY_SEPARATOR . 'wp-blog-header.php';
    return 0;
}

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    exit(tbl_tickera_runtime_probe_main());
}
