<?php

declare(strict_types=1);

require_once __DIR__ . '/validate-tickera-stateless-rest-runtime.php';

const TBL_TICKERA_RUNTIME_STAGING_ROOT = '/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html';
const TBL_TICKERA_RUNTIME_PRIVATE_PREFIX = '/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/';

final class TBL_Tickera_No_Persist_Session_Handler extends SessionHandler implements SessionUpdateTimestampHandlerInterface {
    private function count(string $operation): void {
        $GLOBALS['tbl_tickera_runtime_probe_state']['session'][$operation]++;
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
        tbl_tickera_runtime_probe_emit($GLOBALS['tbl_tickera_runtime_probe_state']);
    }
}

/**
 * @return array{route: string, get: array<string, string>}|null
 */
function tbl_tickera_runtime_probe_parse_uri(string $uri): ?array {
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
    if (! str_starts_with($path, '/wp-json/')) {
        return null;
    }

    $route = substr($path, strlen('/wp-json'));
    if (! preg_match(
        '#^/lamako-mobile/v2/(?:rewards/config|web-session|public/(?:home-data|events-data|shop-data|events/[0-9]+|products/[0-9]+))$#D',
        $route
    )) {
        return null;
    }

    $allowed_keys = [];
    if ($route === '/lamako-mobile/v2/public/home-data') {
        $allowed_keys = ['summary', 'events_limit', 'products_limit'];
    } elseif ($route === '/lamako-mobile/v2/public/events-data') {
        $allowed_keys = ['summary', 'limit'];
    } elseif ($route === '/lamako-mobile/v2/public/shop-data') {
        $allowed_keys = ['limit'];
    }

    $get       = [];
    $raw_query = $parts[1] ?? '';
    if ($raw_query === '') {
        return ['route' => $route, 'get' => $get];
    }
    if (str_contains($raw_query, ';')) {
        return null;
    }

    foreach (explode('&', $raw_query) as $pair) {
        $pair_parts = explode('=', $pair, 2);
        $key        = $pair_parts[0];
        $raw_value  = $pair_parts[1] ?? '';
        if (
            $key === ''
            || ! preg_match('/^[a-z0-9_-]+$/D', $key)
            || ! in_array($key, $allowed_keys, true)
            || array_key_exists($key, $get)
            || str_contains($raw_value, '%')
            || str_contains($raw_value, '+')
        ) {
            return null;
        }

        $value_is_valid = $key === 'summary'
            ? in_array($raw_value, ['0', '1', 'false', 'true'], true)
            : (bool) preg_match('/^[0-9]{1,3}$/D', $raw_value);
        if (! $value_is_valid) {
            return null;
        }
        $get[$key] = $raw_value;
    }

    return ['route' => $route, 'get' => $get];
}

/**
 * @param array<string, mixed> $proof
 * @return list<string>
 */
function tbl_tickera_runtime_probe_validate_isolation_proof(array $proof, string $wp_config_sha256): array {
    $failures = [];
    $expect   = static function (bool $condition, string $code) use (&$failures): void {
        if (! $condition) {
            $failures[] = $code;
        }
    };

    $expect(($proof['schemaVersion'] ?? null) === 1, 'schema');
    $expect(($proof['phase'] ?? null) === 'S', 'phase');
    $expect(($proof['environment'] ?? null) === 'staging', 'environment');
    $expect(($proof['wpRoot'] ?? null) === TBL_TICKERA_RUNTIME_STAGING_ROOT, 'wp_root');
    $expect(($proof['wpConfigSha256'] ?? null) === $wp_config_sha256, 'wp_config_hash');
    foreach (
        [
            'databaseReadOnlyEnforced',
            'objectCacheWritesBlocked',
            'directNetworkEgressBlocked',
            'productionCredentialsUnavailable',
        ] as $gate
    ) {
        $expect(($proof[$gate] ?? null) === true, $gate);
    }
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

function tbl_tickera_runtime_probe_reinforce_session_handler(string $checkpoint): bool {
    if (session_status() !== PHP_SESSION_NONE) {
        return false;
    }

    $handler = $GLOBALS['tbl_tickera_runtime_probe_session_handler'] ?? null;
    if (! $handler instanceof TBL_Tickera_No_Persist_Session_Handler) {
        return false;
    }

    $installed = session_set_save_handler($handler, false);
    $GLOBALS['tbl_tickera_runtime_probe_state']['session'][$checkpoint] = $installed;
    return $installed;
}

function tbl_tickera_runtime_probe_register_hooks(): void {
    $query_filter = static function ($query) {
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
    $http_filter = static function ($preempt, $arguments, $url) {
        unset($preempt, $arguments, $url);
        $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
        $state['network']['wpHttpAttempts']++;
        $state['network']['blockedWpHttpAttempts']++;
        return new WP_Error('tbl_runtime_probe_http_blocked', 'HTTP blocked by read-only qualification.');
    };
    $GLOBALS['tbl_tickera_runtime_probe_callbacks'] = [
        'query' => $query_filter,
        'http'  => $http_filter,
    ];

    tbl_tickera_runtime_probe_add_hook(
        'query',
        $query_filter,
        PHP_INT_MIN,
        1
    );

    tbl_tickera_runtime_probe_add_hook(
        'pre_http_request',
        $http_filter,
        PHP_INT_MIN,
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
            $state['runtime']['hostIsStaging'] = function_exists('home_url')
                && parse_url((string) home_url('/'), PHP_URL_HOST) === 'staging.ticketbylamako.com';
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
            $callbacks = $GLOBALS['tbl_tickera_runtime_probe_callbacks'] ?? [];
            $state['instrumentation']['queryFilterLiveAtWpLoaded'] = isset($callbacks['query'])
                && has_filter('query', $callbacks['query']) === PHP_INT_MIN;
            $state['instrumentation']['wpHttpFilterLiveAtWpLoaded'] = isset($callbacks['http'])
                && has_filter('pre_http_request', $callbacks['http']) === PHP_INT_MIN;
            $state['session']['statusAtWpLoadedBefore'] = session_status();
        },
        PHP_INT_MIN,
        0
    );

    tbl_tickera_runtime_probe_add_hook(
        'wp_loaded',
        static function (): void {
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            $state['hook']['sequence'][] = 'wp_loaded_reinforce';
            $state['session']['statusAtWpLoadedReinforce'] = session_status();
            tbl_tickera_runtime_probe_reinforce_session_handler('handlerReinforcedAtWpLoaded');
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
            $state['session']['statusAtWpLoadedAfter'] = session_status();
            $state['runtime']['executed'] = true;
        },
        PHP_INT_MAX,
        0
    );

    tbl_tickera_runtime_probe_add_hook(
        'rest_request_before_callbacks',
        static function ($response, $handler, $request) {
            unset($handler, $request);
            $state = &$GLOBALS['tbl_tickera_runtime_probe_state'];
            $state['hook']['sequence'][] = 'rest_before_callbacks';
            $state['session']['statusBeforeRestCallback'] = session_status();
            tbl_tickera_runtime_probe_reinforce_session_handler('handlerReinforcedBeforeRestCallback');
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
            if ($state['request']['route'] === '/lamako-mobile/v2/web-session') {
                $state['response']['authSemanticsValid'] = is_array($data)
                    && array_key_exists('authenticated', $data)
                    && is_bool($data['authenticated']);
            } else {
                $state['response']['authSemanticsValid'] = is_array($data) || is_object($data);
            }

            return $response;
        },
        PHP_INT_MAX,
        3
    );
}

/**
 * @param array<string, mixed> $state
 */
function tbl_tickera_runtime_probe_emit(array &$state): void {
    $state['hook']['sequence'][] = 'shutdown';
    $state['session']['statusAtShutdownBeforeCleanup'] = session_status();
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_abort();
    }
    $state['session']['statusAtShutdownAfterCleanup'] = session_status();

    $last_error = error_get_last();
    $fatal_types = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    $state['runtime']['fatalError'] = is_array($last_error)
        && in_array((int) ($last_error['type'] ?? 0), $fatal_types, true);

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    $failures          = tbl_tickera_runtime_validate_report($state);
    $state['decision'] = $failures === [] ? 'COMPONENT_PASS_EXTERNAL_REQUIRED' : 'STOP';
    $state['failures'] = $failures;
    $state['reportEmitted'] = true;
    fwrite(
        STDERR,
        'TBL_TICKERA_RUNTIME_REPORT ' . json_encode(
            $state,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        ) . "\n"
    );
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

    $options = getopt('', ['uri:', 'cache-preflight:', 'wp-config-sha256:', 'isolation-proof:']);
    if (
        ! is_array($options)
        || ! isset(
            $options['uri'],
            $options['cache-preflight'],
            $options['wp-config-sha256'],
            $options['isolation-proof']
        )
    ) {
        fwrite(STDERR, "STOP real_wordpress_runtime_required\n");
        return 1;
    }

    $wp_root = realpath(TBL_TICKERA_RUNTIME_STAGING_ROOT);
    $parsed  = tbl_tickera_runtime_probe_parse_uri((string) $options['uri']);
    if (
        $wp_root === false
        || str_replace('\\', '/', $wp_root) !== TBL_TICKERA_RUNTIME_STAGING_ROOT
        || ! is_readable($wp_root . DIRECTORY_SEPARATOR . 'wp-blog-header.php')
        || ! is_readable($wp_root . DIRECTORY_SEPARATOR . 'wp-config.php')
    ) {
        fwrite(STDERR, "STOP exact_staging_wordpress_root_unavailable\n");
        return 1;
    }
    if ($parsed === null) {
        fwrite(STDERR, "STOP request_not_allowlisted\n");
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

    $proof_path = realpath((string) $options['isolation-proof']);
    if (
        $proof_path === false
        || ! str_starts_with(str_replace('\\', '/', $proof_path), TBL_TICKERA_RUNTIME_PRIVATE_PREFIX)
        || ! is_readable($proof_path)
        || ((int) fileperms($proof_path) & 0777) !== 0600
    ) {
        fwrite(STDERR, "STOP private_isolation_proof_unavailable\n");
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
    $proof_failures = tbl_tickera_runtime_probe_validate_isolation_proof($proof, $actual_wp_config_sha256);
    if ($proof_failures !== []) {
        fwrite(STDERR, 'STOP isolation_' . implode(',', $proof_failures) . "\n");
        return 1;
    }

    $cache_preflight = strtoupper((string) $options['cache-preflight']);
    $catalog_route   = tbl_tickera_runtime_is_catalog_route($parsed['route']);
    if (($catalog_route && $cache_preflight !== 'HIT') || (! $catalog_route && $cache_preflight !== 'NOT_APPLICABLE')) {
        fwrite(STDERR, "STOP cache_preflight_not_safe\n");
        return 1;
    }
    if (session_status() !== PHP_SESSION_NONE) {
        fwrite(STDERR, "STOP session_already_active\n");
        return 1;
    }

    $GLOBALS['tbl_tickera_runtime_probe_state'] = [
        'schemaVersion' => TBL_TICKERA_STATELESS_REST_RUNTIME_SCHEMA,
        'phase'         => 'S',
        'runtime'       => [
            'executed'             => false,
            'synthetic'            => false,
            'freshProcess'         => true,
            'executionKind'        => 'CLI_FRONT_CONTROLLER',
            'wordpressLoaded'      => false,
            'hostIsStaging'        => false,
            'tickeraLoaded'        => false,
            'tickeraVersion'       => '',
            'tickeraSourceSha256'  => '',
            'shimLoaded'           => false,
            'shimSha256'           => '',
            'requestAllowlisted'   => false,
            'fatalError'           => false,
            'runnerSha256'         => strtolower((string) hash_file('sha256', __FILE__)),
            'validatorSha256'      => strtolower(
                (string) hash_file('sha256', __DIR__ . '/validate-tickera-stateless-rest-runtime.php')
            ),
            'invocationNonceSha256' => hash('sha256', random_bytes(32)),
            'wpConfigSha256'       => $actual_wp_config_sha256,
            'isolationProofSha256' => strtolower((string) hash_file('sha256', $proof_path)),
        ],
        'instrumentation' => [
            'preinitializedBeforeBootstrap' => true,
            'queryFilterLiveAtWpLoaded'      => false,
            'wpHttpFilterLiveAtWpLoaded'     => false,
            'restPostDispatchObserved'       => false,
        ],
        'isolation' => [
            'databaseReadOnlyEnforced'       => true,
            'objectCacheWritesBlocked'       => true,
            'directNetworkEgressBlocked'     => true,
            'productionCredentialsUnavailable' => true,
            'activePluginFingerprintSha256'  => (string) $proof['activePluginFingerprintSha256'],
            'evidenceManifestSha256'         => (string) $proof['evidenceManifestSha256'],
        ],
        'request'       => ['method' => 'GET', 'route' => $parsed['route']],
        'hook'          => [
            'before'             => null,
            'after'              => null,
            'guardPriorityIsMin' => false,
            'sequence'           => [],
        ],
        'session'       => [
            'handlerInstalledBeforeBootstrap' => false,
            'handlerReinforcedAtWpLoaded'      => false,
            'handlerReinforcedBeforeRestCallback' => false,
            'statusBefore'                    => session_status(),
            'statusAtWpLoadedBefore'          => null,
            'statusAtWpLoadedReinforce'       => null,
            'statusAtWpLoadedAfter'           => null,
            'statusBeforeRestCallback'        => null,
            'statusAtShutdownBeforeCleanup'   => null,
            'statusAtShutdownAfterCleanup'    => null,
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
        ],
        'database'      => [
            'guardScope'             => 'WPDB_QUERY_FILTER_ONLY',
            'directDriverBlocked'    => false,
            'externalReadOnlyProofRequired' => true,
            'totalQueries'           => 0,
            'readOnlyQueries'        => 0,
            'nonReadAttempts'        => 0,
            'blockedNonReadAttempts' => 0,
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
        'reportEmitted' => false,
    ];

    $handler = new TBL_Tickera_No_Persist_Session_Handler();
    $GLOBALS['tbl_tickera_runtime_probe_session_handler'] = $handler;
    $installed = session_set_save_handler($handler, false);
    $GLOBALS['tbl_tickera_runtime_probe_state']['session']['handlerInstalledBeforeBootstrap'] = $installed;
    if (! $installed) {
        fwrite(STDERR, "STOP session_handler_install_failed\n");
        return 1;
    }

    tbl_tickera_runtime_probe_register_hooks();
    $GLOBALS['tbl_tickera_runtime_probe_reporter'] = new TBL_Tickera_Runtime_Probe_Reporter();

    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REQUEST_URI']    = (string) $options['uri'];
    $_SERVER['HTTP_HOST']      = 'staging.ticketbylamako.com';
    $_SERVER['SERVER_NAME']    = 'staging.ticketbylamako.com';
    $_SERVER['SERVER_PORT']    = '443';
    $_SERVER['HTTPS']          = 'on';
    $_SERVER['SCRIPT_NAME']    = '/index.php';
    $_SERVER['REMOTE_ADDR']    = '127.0.0.1';
    $_SERVER['HTTP_ORIGIN']    = 'https://staging.ticketbylamako.com';
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
