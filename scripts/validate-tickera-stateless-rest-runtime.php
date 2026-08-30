<?php

declare(strict_types=1);

const TBL_TICKERA_STATELESS_REST_RUNTIME_SCHEMA = 3;
const TBL_TICKERA_STATELESS_REST_SHA256 = '9ee50c7fc73bbe4f2cebcd17ca8aac93aface21f7620e85d83cf2babe3ec1ddf';
const TBL_TICKERA_3602_SHA256 = 'beb244415bf3e874925bd76a88f9bbf19c246121251877723dc6a3db41caac52';

/**
 * @param array<string, mixed> $report
 * @return mixed
 */
function tbl_tickera_runtime_value(array $report, string $path) {
    $value = $report;
    foreach (explode('.', $path) as $part) {
        if (! is_array($value) || ! array_key_exists($part, $value)) {
            return null;
        }
        $value = $value[$part];
    }
    return $value;
}

function tbl_tickera_runtime_sql_operation(string $query): string {
    $query = preg_replace('/^\xEF\xBB\xBF/', '', $query) ?? $query;

    do {
        $before = $query;
        $query  = ltrim($query);
        $query  = preg_replace('#^/\*.*?\*/\s*#s', '', $query) ?? $query;
        $query  = preg_replace('/^(?:--|#)[^\r\n]*(?:\r\n|\r|\n|$)\s*/', '', $query) ?? $query;
    } while ($query !== $before);

    return preg_match('/^([a-z]+)/i', $query, $matches)
        ? strtoupper($matches[1])
        : 'UNKNOWN';
}

function tbl_tickera_runtime_sql_is_read_only(string $query): bool {
    if (str_contains($query, "\0") || preg_match('#/\*!#', $query)) {
        return false;
    }

    $operation = tbl_tickera_runtime_sql_operation($query);
    if (! in_array($operation, ['SELECT', 'SHOW'], true)) {
        return false;
    }

    // Multiple statements and SELECT variants with observable side effects are
    // unnecessary for this read-only qualification. This remains a guard on
    // WordPress' `query` filter, not a SQL parser or a direct-driver sandbox.
    if (preg_match('/;\s*\S/s', $query)) {
        return false;
    }

    if ($operation === 'SELECT' && preg_match(
        '/\b(?:FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE|INTO\s+(?:OUTFILE|DUMPFILE)|GET_LOCK\s*\(|RELEASE_LOCK\s*\(|IS_FREE_LOCK\s*\(|IS_USED_LOCK\s*\(|SLEEP\s*\(|BENCHMARK\s*\(|LOAD_FILE\s*\()|@[a-z0-9_$]+\s*:=/i',
        $query
    )) {
        return false;
    }

    return true;
}

function tbl_tickera_runtime_is_catalog_route(string $route): bool {
    return (bool) preg_match(
        '#^/lamako-mobile/v2/public/(?:home-data|events-data|shop-data|events/[0-9]+|products/[0-9]+)$#D',
        $route
    );
}

function tbl_tickera_runtime_clone_host_is_safe(string $host): bool {
    $host = strtolower($host);
    return (bool) preg_match('/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/D', $host)
        && ! in_array($host, ['ticketbylamako.com', 'www.ticketbylamako.com', 'staging.ticketbylamako.com'], true)
        && ! str_ends_with($host, '.ticketbylamako.com');
}

/**
 * @param array<string, mixed> $report
 * @return list<string>
 */
function tbl_tickera_runtime_validate_report(array $report, string $expected_invocation_sha256 = ''): array {
    $failures = [];
    $expect   = static function (bool $condition, string $code) use (&$failures): void {
        if (! $condition) {
            $failures[] = $code;
        }
    };

    $expect(tbl_tickera_runtime_value($report, 'schemaVersion') === TBL_TICKERA_STATELESS_REST_RUNTIME_SCHEMA, 'schema');
    $expect(tbl_tickera_runtime_value($report, 'phase') === 'S', 'phase_not_session_only');
    $expect(tbl_tickera_runtime_value($report, 'runtime.executed') === true, 'runtime_not_executed');
    $expect(tbl_tickera_runtime_value($report, 'runtime.syntheticRequest') === true, 'synthetic_request_not_declared');
    $expect(tbl_tickera_runtime_value($report, 'runtime.realWordPressRuntime') === true, 'real_wordpress_runtime_missing');
    $expect(tbl_tickera_runtime_value($report, 'runtime.freshProcess') === true, 'process_not_fresh');
    $expect(
        tbl_tickera_runtime_value($report, 'runtime.executionKind') === 'CLI_SYNTHETIC_REQUEST_REAL_BOOTSTRAP',
        'execution_kind'
    );
    $expect(tbl_tickera_runtime_value($report, 'runtime.wordpressLoaded') === true, 'wordpress_not_loaded');
    $expect(tbl_tickera_runtime_value($report, 'runtime.hostIsIsolatedClone') === true, 'not_isolated_clone');
    $expect(tbl_tickera_runtime_value($report, 'runtime.wpEnvironmentType') === 'staging', 'wp_environment_type');
    $wp_root = tbl_tickera_runtime_value($report, 'runtime.wpRoot');
    $expect(
        is_string($wp_root)
            && $wp_root !== ''
            && $wp_root !== '/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html',
        'wp_root'
    );
    $clone_host = tbl_tickera_runtime_value($report, 'runtime.cloneHost');
    $expect(is_string($clone_host) && tbl_tickera_runtime_clone_host_is_safe($clone_host), 'clone_host');
    $expect(tbl_tickera_runtime_value($report, 'runtime.tickeraLoaded') === true, 'tickera_not_loaded');
    $expect(tbl_tickera_runtime_value($report, 'runtime.tickeraVersion') === '3.6.0.2', 'tickera_version');
    $expect(
        tbl_tickera_runtime_value($report, 'runtime.tickeraSourceSha256') === TBL_TICKERA_3602_SHA256,
        'tickera_hash'
    );
    $expect(tbl_tickera_runtime_value($report, 'runtime.shimLoaded') === true, 'shim_not_loaded');
    $expect(
        tbl_tickera_runtime_value($report, 'runtime.shimSha256') === TBL_TICKERA_STATELESS_REST_SHA256,
        'shim_hash'
    );
    $expect(tbl_tickera_runtime_value($report, 'runtime.requestAllowlisted') === true, 'request_not_allowlisted');
    $expect(tbl_tickera_runtime_value($report, 'runtime.fatalError') === false, 'runtime_error');
    foreach (
        [
            'runnerSha256',
            'validatorSha256',
            'invocationIdSha256',
            'requestFingerprintSha256',
            'wpConfigSha256',
            'isolationProofSha256',
        ] as $runtime_hash
    ) {
        $value = tbl_tickera_runtime_value($report, 'runtime.' . $runtime_hash);
        $expect(is_string($value) && (bool) preg_match('/^[a-f0-9]{64}$/D', $value), 'runtime_' . $runtime_hash);
    }
    $runner_hash = is_readable(__DIR__ . '/qa-tickera-stateless-rest-runtime.php')
        ? strtolower((string) hash_file('sha256', __DIR__ . '/qa-tickera-stateless-rest-runtime.php'))
        : '';
    $validator_hash = strtolower((string) hash_file('sha256', __FILE__));
    $expect(tbl_tickera_runtime_value($report, 'runtime.runnerSha256') === $runner_hash, 'runner_hash');
    $expect(tbl_tickera_runtime_value($report, 'runtime.validatorSha256') === $validator_hash, 'validator_hash');
    $expect(
        preg_match('/^[a-f0-9]{64}$/D', $expected_invocation_sha256) === 1
            && tbl_tickera_runtime_value($report, 'runtime.invocationIdSha256') === $expected_invocation_sha256,
        'invocation_hash'
    );
    $expect(tbl_tickera_runtime_value($report, 'runtime.httpEvidenceIncluded') === false, 'cli_http_evidence_claim');

    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.preinitializedBeforeBootstrap') === true,
        'instrumentation_not_early'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.prebootstrapQualification') === [
            'proofValidated'       => true,
            'environmentQualified' => true,
            'rootQualified'        => true,
            'databaseQualified'    => true,
            'cacheQualified'       => true,
            'networkQualified'     => true,
            'filesystemQualified'  => true,
        ],
        'prebootstrap_qualification'
    );
    foreach (['filterHealthAtWpLoaded', 'filterHealthAtWpShutdown', 'filterHealthAtReporter'] as $checkpoint) {
        $expect(
            tbl_tickera_runtime_value($report, 'instrumentation.' . $checkpoint) === [
                'queryEarly' => true,
                'queryFinal' => true,
                'httpEarly'  => true,
                'httpFinal'  => true,
            ],
            $checkpoint
        );
    }
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.restPreDispatchObserved') === true,
        'rest_pre_dispatch_not_observed'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.restPostDispatchObserved') === true,
        'rest_dispatch_not_observed'
    );
    $expect(tbl_tickera_runtime_value($report, 'instrumentation.wp_shutdown_seen') === true, 'wp_shutdown_not_seen');
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.reporterAfterWpShutdown') === true,
        'reporter_not_after_wp_shutdown'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'isolation.assertionSource') === 'EXTERNAL_SEALED_PROVISIONING',
        'isolation_assertion_source'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'isolation.runnerVerificationScope')
            === 'MANIFEST_SHAPE_HASH_AND_BINDING_ONLY',
        'isolation_runner_scope'
    );
    $expect(tbl_tickera_runtime_value($report, 'isolation.environment') === 'isolated-clone', 'isolation_environment');
    $expect(tbl_tickera_runtime_value($report, 'isolation.cloneOnly') === true, 'isolation_clone_only');
    foreach (
        [
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
            'publicAccessRestricted',
        ] as $isolation_gate
    ) {
        $expect(
            tbl_tickera_runtime_value($report, 'isolation.' . $isolation_gate) === true,
            'isolation_' . $isolation_gate
        );
    }
    foreach (
        [
            'databaseTargetFingerprintSha256',
            'objectCacheTargetFingerprintSha256',
            'activePluginFingerprintSha256',
            'evidenceManifestSha256',
        ] as $isolation_hash
    ) {
        $value = tbl_tickera_runtime_value($report, 'isolation.' . $isolation_hash);
        $expect(is_string($value) && (bool) preg_match('/^[a-f0-9]{64}$/D', $value), 'isolation_' . $isolation_hash);
    }
    $expect(
        tbl_tickera_runtime_value($report, 'isolation.databaseControl') === 'CLONE_SELECT_ONLY_CREDENTIAL',
        'isolation_database_control'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'isolation.objectCacheControl') === 'CLONE_EPHEMERAL_OR_WRITE_DENIED',
        'isolation_object_cache_control'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'isolation.networkControl') === 'PROCESS_EGRESS_DENY',
        'isolation_network_control'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'isolation.filesystemControl') === 'READ_ONLY_ROOT_EPHEMERAL_TMP',
        'isolation_filesystem_control'
    );

    $method = tbl_tickera_runtime_value($report, 'request.method');
    $route  = tbl_tickera_runtime_value($report, 'request.route');
    $expect(in_array($method, ['GET', 'HEAD', 'OPTIONS'], true), 'method_not_safe');
    $expect(is_string($route) && $route !== '', 'route_missing');
    $url_form = tbl_tickera_runtime_value($report, 'request.urlForm');
    $expect(in_array($url_form, ['PRETTY', 'REST_ROUTE'], true), 'url_form');
    $web_session_mode = tbl_tickera_runtime_value($report, 'request.webSessionMode');
    $expect(
        ($route === '/lamako-mobile/v2/web-session' && $web_session_mode === 'ANONYMOUS_CLI')
            || ($route !== '/lamako-mobile/v2/web-session' && $web_session_mode === 'NOT_APPLICABLE'),
        'web_session_mode'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.restCallbackObserved') === ($method !== 'OPTIONS'),
        'rest_callback_observation'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'request.requestFingerprintSha256')
            === tbl_tickera_runtime_value($report, 'runtime.requestFingerprintSha256'),
        'request_fingerprint'
    );

    $expect(tbl_tickera_runtime_value($report, 'hook.before') === 10, 'tickera_hook_before');
    $expect(tbl_tickera_runtime_value($report, 'hook.after') === false, 'tickera_hook_after');
    $expect(tbl_tickera_runtime_value($report, 'hook.atWpShutdown') === false, 'tickera_hook_at_wp_shutdown');
    $expect(tbl_tickera_runtime_value($report, 'hook.atReporter') === false, 'tickera_hook_at_reporter');
    $expect(tbl_tickera_runtime_value($report, 'hook.guardPriorityIsMin') === true, 'guard_priority');
    $expected_inventory = [[
        'class'        => 'Tickera\\TC',
        'method'       => 'update_cart',
        'priority'     => 10,
        'isGlobalTc'   => true,
        'sourceSha256' => TBL_TICKERA_3602_SHA256,
    ]];
    $expect(tbl_tickera_runtime_value($report, 'hook.beforeInventory') === $expected_inventory, 'tickera_inventory_before');
    foreach (['afterInventory', 'shutdownInventory', 'reporterInventory'] as $inventory) {
        $expect(tbl_tickera_runtime_value($report, 'hook.' . $inventory) === [], 'tickera_' . $inventory);
    }
    $expected_sequence = [
        'wp_loaded_before',
        'wp_loaded_reinforce',
        'wp_loaded_after',
        'rest_pre_dispatch',
    ];
    if ($method !== 'OPTIONS') {
        $expected_sequence[] = 'rest_before_callbacks';
    }
    $expected_sequence[] = 'rest_post_dispatch';
    $expected_sequence[] = 'wp_shutdown';
    $expected_sequence[] = 'reporter_destruct';
    $expect(
        tbl_tickera_runtime_value($report, 'hook.sequence') === $expected_sequence,
        'hook_sequence'
    );

    $expect(
        tbl_tickera_runtime_value($report, 'session.handlerInstalledBeforeBootstrap') === true,
        'session_handler_not_early'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'session.handlerReinforcedAtWpLoaded') === true,
        'session_handler_not_reinforced'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'session.handlerReinforcedBeforeRestCallback') === ($method !== 'OPTIONS'),
        'session_handler_rest_reinforcement'
    );
    $expect(tbl_tickera_runtime_value($report, 'session.autoStartBefore') === '0', 'session_auto_start_before');
    $expect(tbl_tickera_runtime_value($report, 'session.autoStartAtWpShutdown') === '0', 'session_auto_start_shutdown');
    $expect(tbl_tickera_runtime_value($report, 'session.headersSentBefore') === false, 'session_headers_sent_before');
    $expect(tbl_tickera_runtime_value($report, 'session.strictModeBefore') === '1', 'session_strict_mode_before');
    $expect(tbl_tickera_runtime_value($report, 'session.strictModeAtWpLoaded') === '1', 'session_strict_mode');
    $module_before = tbl_tickera_runtime_value($report, 'session.moduleBefore');
    $expect(
        is_string($module_before) && $module_before !== '' && $module_before !== 'user',
        'session_module_before'
    );
    foreach (
        [
            'statusBefore',
            'statusAtWpLoadedBefore',
            'statusAtWpLoadedReinforce',
            'statusAtWpLoadedAfter',
            'statusAtRestPreDispatch',
            'statusAtWpShutdown',
            'statusAtReporterBeforeCleanup',
            'statusAtReporterAfterCleanup',
        ] as $status
    ) {
        $expect(tbl_tickera_runtime_value($report, 'session.' . $status) === PHP_SESSION_NONE, 'session_' . $status);
    }
    foreach (
        [
            'moduleAfterInstall',
            'moduleAtWpLoadedBefore',
            'moduleAtWpLoadedReinforce',
            'moduleAfterWpLoadedReinforce',
            'moduleAtWpLoadedAfter',
            'moduleAtRestPreDispatch',
            'moduleAtWpShutdown',
            'moduleAtReporterBeforeCleanup',
            'moduleAtReporterAfterCleanup',
        ] as $module
    ) {
        $expect(tbl_tickera_runtime_value($report, 'session.' . $module) === 'user', 'session_' . $module);
    }
    if ($method !== 'OPTIONS') {
        $expect(
            tbl_tickera_runtime_value($report, 'session.statusBeforeRestCallback') === PHP_SESSION_NONE,
            'session_statusBeforeRestCallback'
        );
        foreach (['moduleBeforeRestCallback', 'moduleAfterRestReinforce'] as $module) {
            $expect(tbl_tickera_runtime_value($report, 'session.' . $module) === 'user', 'session_' . $module);
        }
    } else {
        $expect(tbl_tickera_runtime_value($report, 'session.statusBeforeRestCallback') === null, 'options_callback_status');
        $expect(tbl_tickera_runtime_value($report, 'session.moduleBeforeRestCallback') === null, 'options_callback_module');
    }
    $expect(tbl_tickera_runtime_value($report, 'session.cleanupMethod') === 'NONE', 'session_cleanup_method');
    $expect(tbl_tickera_runtime_value($report, 'session.cleanupSucceeded') === true, 'session_cleanup');
    $expect(tbl_tickera_runtime_value($report, 'session.firstEvent') === null, 'session_first_event');
    $expect(tbl_tickera_runtime_value($report, 'session.firstEventStack') === [], 'session_first_event_stack');
    foreach (
        ['open', 'read', 'write', 'destroy', 'close', 'gc', 'createSid', 'validateId', 'updateTimestamp'] as $operation
    ) {
        $expect(tbl_tickera_runtime_value($report, 'session.' . $operation) === 0, 'session_' . $operation);
    }

    $expect(tbl_tickera_runtime_value($report, 'network.blockInstalled') === true, 'wp_http_block_not_installed');
    $expect(
        tbl_tickera_runtime_value($report, 'network.coverage') === 'WP_HTTP_API_ONLY',
        'wp_http_coverage'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'network.directTransportBlocked') === false,
        'direct_http_claim_invalid'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'network.externalEgressProofRequired') === true,
        'external_egress_gate_missing'
    );
    $expect(tbl_tickera_runtime_value($report, 'network.wpHttpAttempts') === 0, 'provider_http_attempt');
    $expect(tbl_tickera_runtime_value($report, 'network.blockedWpHttpAttempts') === 0, 'provider_http_blocked');
    $expect(tbl_tickera_runtime_value($report, 'network.finalBlockCalls') === 0, 'provider_http_final_blocked');

    $query_total = tbl_tickera_runtime_value($report, 'database.totalQueries');
    $query_reads = tbl_tickera_runtime_value($report, 'database.readOnlyQueries');
    $expect(is_int($query_total) && $query_total > 0, 'query_total');
    $expect(is_int($query_reads) && $query_reads >= 0, 'query_reads');
    $expect($query_total === $query_reads, 'query_count_mismatch');
    $expect(tbl_tickera_runtime_value($report, 'database.finalQueries') === $query_total, 'final_query_count');
    $expect(tbl_tickera_runtime_value($report, 'database.finalReadOnlyQueries') === $query_total, 'final_read_query_count');
    $expect(
        tbl_tickera_runtime_value($report, 'database.guardScope') === 'WPDB_QUERY_FILTER_ONLY',
        'database_guard_scope'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'database.directDriverBlocked') === false,
        'direct_database_claim_invalid'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'database.externalReadOnlyProofRequired') === true,
        'external_database_gate_missing'
    );
    $expect(tbl_tickera_runtime_value($report, 'database.nonReadAttempts') === 0, 'sql_non_read');
    $expect(tbl_tickera_runtime_value($report, 'database.blockedNonReadAttempts') === 0, 'sql_non_read_blocked');
    $expect(tbl_tickera_runtime_value($report, 'database.lateNonReadAttempts') === 0, 'sql_late_non_read');

    $expect(tbl_tickera_runtime_value($report, 'cache.setTransientAttempts') === 0, 'cache_write');
    if (is_string($route) && tbl_tickera_runtime_is_catalog_route($route)) {
        $expect(tbl_tickera_runtime_value($report, 'cache.declaredPreflightState') === 'HIT', 'cache_not_declared_hot');
        $expect(tbl_tickera_runtime_value($report, 'cache.observedPreflightState') === 'HIT', 'cache_not_hot_before');
        $expect(tbl_tickera_runtime_value($report, 'cache.responseState') === 'HIT', 'cache_not_hot_during');
        $expect(tbl_tickera_runtime_value($report, 'cache.writeBlockInstalled') === true, 'cache_write_block_missing');
    } else {
        $expect(
            tbl_tickera_runtime_value($report, 'cache.declaredPreflightState') === 'NOT_APPLICABLE',
            'cache_preflight_non_catalog'
        );
        $expect(
            tbl_tickera_runtime_value($report, 'cache.observedPreflightState') === 'NOT_APPLICABLE',
            'cache_observed_non_catalog'
        );
        $expect(
            tbl_tickera_runtime_value($report, 'cache.responseState') === 'NOT_APPLICABLE',
            'cache_response_non_catalog'
        );
        $expect(tbl_tickera_runtime_value($report, 'cache.writeBlockInstalled') === true, 'cache_write_block_missing');
    }

    $expect(tbl_tickera_runtime_value($report, 'mutations.businessHooks') === 0, 'business_mutation_hook');
    $expect(tbl_tickera_runtime_value($report, 'response.httpStatus') === 200, 'http_status');
    $expect(tbl_tickera_runtime_value($report, 'response.jsonValid') === true, 'invalid_json');
    $expect(tbl_tickera_runtime_value($report, 'response.authSemanticsValid') === true, 'auth_semantics');
    $expect(tbl_tickera_runtime_value($report, 'response.headersObservable') === false, 'cli_headers_claim_invalid');
    $expect(tbl_tickera_runtime_value($report, 'response.externalHttpRequired') === true, 'external_http_gate_missing');
    $expect(tbl_tickera_runtime_value($report, 'externalHttpContract') === [
        'required'                  => true,
        'freshProcessPerCase'       => true,
        'methods'                   => ['GET', 'HEAD', 'OPTIONS'],
        'urlForms'                  => ['PRETTY', 'REST_ROUTE'],
        'webSessionModes'           => ['ANONYMOUS', 'AUTHENTICATED'],
        'corsJwtStatusRequired'     => true,
        'phpSessionCookieForbidden' => true,
    ], 'external_http_contract');
    $expect(tbl_tickera_runtime_value($report, 'report.attempts') === 1, 'report_attempts');
    $expect(tbl_tickera_runtime_value($report, 'report.emitted') === true, 'report_not_emitted');
    $expect(tbl_tickera_runtime_value($report, 'report.intendedExitCode') === 0, 'report_exit_code');
    $expect(tbl_tickera_runtime_value($report, 'reportEmitted') === true, 'report_flag');
    $expect(tbl_tickera_runtime_value($report, 'decision') === 'COMPONENT_PASS_EXTERNAL_REQUIRED', 'decision');

    return array_values(array_unique($failures));
}

function tbl_tickera_runtime_validator_main(array $arguments): int {
    if (count($arguments) !== 3) {
        fwrite(
            STDERR,
            "Usage: php validate-tickera-stateless-rest-runtime.php <runtime-report.json> <expected-invocation-sha256>\n"
        );
        return 2;
    }

    $expected_invocation_sha256 = strtolower((string) $arguments[2]);
    if (! preg_match('/^[a-f0-9]{64}$/D', $expected_invocation_sha256)) {
        fwrite(STDERR, "STOP expected_invocation_hash_invalid\n");
        return 1;
    }

    $json = @file_get_contents($arguments[1]);
    if ($json === false) {
        fwrite(STDERR, "STOP runtime_report_unreadable\n");
        return 1;
    }

    try {
        $report = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        fwrite(STDERR, "STOP runtime_report_invalid_json\n");
        return 1;
    }
    if (! is_array($report)) {
        fwrite(STDERR, "STOP runtime_report_not_object\n");
        return 1;
    }

    $failures = tbl_tickera_runtime_validate_report($report, $expected_invocation_sha256);
    if ($failures !== []) {
        fwrite(STDERR, 'STOP ' . implode(',', $failures) . "\n");
        return 1;
    }

    fwrite(
        STDOUT,
        "COMPONENT_PASS_EXTERNAL_REQUIRED real_wordpress_cli session_events=0 wp_http_attempts=0 "
        . "wpdb_non_read=0 cache_writes=0 business_hooks=0\n"
    );
    return 0;
}

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    exit(tbl_tickera_runtime_validator_main($argv));
}
