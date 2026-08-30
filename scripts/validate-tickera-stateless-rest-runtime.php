<?php

declare(strict_types=1);

const TBL_TICKERA_STATELESS_REST_RUNTIME_SCHEMA = 2;
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

/**
 * @param array<string, mixed> $report
 * @return list<string>
 */
function tbl_tickera_runtime_validate_report(array $report): array {
    $failures = [];
    $expect   = static function (bool $condition, string $code) use (&$failures): void {
        if (! $condition) {
            $failures[] = $code;
        }
    };

    $expect(tbl_tickera_runtime_value($report, 'schemaVersion') === TBL_TICKERA_STATELESS_REST_RUNTIME_SCHEMA, 'schema');
    $expect(tbl_tickera_runtime_value($report, 'phase') === 'S', 'phase_not_session_only');
    $expect(tbl_tickera_runtime_value($report, 'runtime.executed') === true, 'runtime_not_executed');
    $expect(tbl_tickera_runtime_value($report, 'runtime.synthetic') === false, 'synthetic_runtime');
    $expect(tbl_tickera_runtime_value($report, 'runtime.freshProcess') === true, 'process_not_fresh');
    $expect(
        tbl_tickera_runtime_value($report, 'runtime.executionKind') === 'CLI_FRONT_CONTROLLER',
        'execution_kind'
    );
    $expect(tbl_tickera_runtime_value($report, 'runtime.wordpressLoaded') === true, 'wordpress_not_loaded');
    $expect(tbl_tickera_runtime_value($report, 'runtime.hostIsStaging') === true, 'not_staging');
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
    foreach (['runnerSha256', 'validatorSha256', 'invocationNonceSha256', 'wpConfigSha256', 'isolationProofSha256'] as $runtime_hash) {
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
        tbl_tickera_runtime_value($report, 'instrumentation.preinitializedBeforeBootstrap') === true,
        'instrumentation_not_early'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.queryFilterLiveAtWpLoaded') === true,
        'query_filter_not_live'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.wpHttpFilterLiveAtWpLoaded') === true,
        'http_filter_not_live'
    );
    $expect(
        tbl_tickera_runtime_value($report, 'instrumentation.restPostDispatchObserved') === true,
        'rest_dispatch_not_observed'
    );
    foreach (
        [
            'databaseReadOnlyEnforced',
            'objectCacheWritesBlocked',
            'directNetworkEgressBlocked',
            'productionCredentialsUnavailable',
        ] as $isolation_gate
    ) {
        $expect(
            tbl_tickera_runtime_value($report, 'isolation.' . $isolation_gate) === true,
            'isolation_' . $isolation_gate
        );
    }
    foreach (['activePluginFingerprintSha256', 'evidenceManifestSha256'] as $isolation_hash) {
        $value = tbl_tickera_runtime_value($report, 'isolation.' . $isolation_hash);
        $expect(is_string($value) && (bool) preg_match('/^[a-f0-9]{64}$/D', $value), 'isolation_' . $isolation_hash);
    }

    $method = tbl_tickera_runtime_value($report, 'request.method');
    $route  = tbl_tickera_runtime_value($report, 'request.route');
    $expect($method === 'GET', 'method_not_get');
    $expect(is_string($route) && $route !== '', 'route_missing');

    $expect(tbl_tickera_runtime_value($report, 'hook.before') === 10, 'tickera_hook_before');
    $expect(tbl_tickera_runtime_value($report, 'hook.after') === false, 'tickera_hook_after');
    $expect(tbl_tickera_runtime_value($report, 'hook.guardPriorityIsMin') === true, 'guard_priority');
    $expect(
        tbl_tickera_runtime_value($report, 'hook.sequence') === [
            'wp_loaded_before',
            'wp_loaded_reinforce',
            'wp_loaded_after',
            'rest_before_callbacks',
            'rest_post_dispatch',
            'shutdown',
        ],
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
        tbl_tickera_runtime_value($report, 'session.handlerReinforcedBeforeRestCallback') === true,
        'session_handler_not_reinforced_for_rest'
    );
    foreach (
        [
            'statusBefore',
            'statusAtWpLoadedBefore',
            'statusAtWpLoadedReinforce',
            'statusAtWpLoadedAfter',
            'statusBeforeRestCallback',
            'statusAtShutdownBeforeCleanup',
            'statusAtShutdownAfterCleanup',
        ] as $status
    ) {
        $expect(tbl_tickera_runtime_value($report, 'session.' . $status) === PHP_SESSION_NONE, 'session_' . $status);
    }
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

    $query_total = tbl_tickera_runtime_value($report, 'database.totalQueries');
    $query_reads = tbl_tickera_runtime_value($report, 'database.readOnlyQueries');
    $expect(is_int($query_total) && $query_total > 0, 'query_total');
    $expect(is_int($query_reads) && $query_reads >= 0, 'query_reads');
    $expect($query_total === $query_reads, 'query_count_mismatch');
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

    $expect(tbl_tickera_runtime_value($report, 'cache.setTransientAttempts') === 0, 'cache_write');
    if (is_string($route) && tbl_tickera_runtime_is_catalog_route($route)) {
        $expect(tbl_tickera_runtime_value($report, 'cache.declaredPreflightState') === 'HIT', 'cache_not_declared_hot');
        $expect(tbl_tickera_runtime_value($report, 'cache.observedPreflightState') === 'HIT', 'cache_not_hot_before');
        $expect(tbl_tickera_runtime_value($report, 'cache.responseState') === 'HIT', 'cache_not_hot_during');
        $expect(tbl_tickera_runtime_value($report, 'cache.writeBlockInstalled') === true, 'cache_write_block_missing');
    }

    $expect(tbl_tickera_runtime_value($report, 'mutations.businessHooks') === 0, 'business_mutation_hook');
    $expect(tbl_tickera_runtime_value($report, 'response.httpStatus') === 200, 'http_status');
    $expect(tbl_tickera_runtime_value($report, 'response.jsonValid') === true, 'invalid_json');
    $expect(tbl_tickera_runtime_value($report, 'response.authSemanticsValid') === true, 'auth_semantics');
    $expect(tbl_tickera_runtime_value($report, 'response.headersObservable') === false, 'cli_headers_claim_invalid');
    $expect(tbl_tickera_runtime_value($report, 'response.externalHttpRequired') === true, 'external_http_gate_missing');

    return array_values(array_unique($failures));
}

function tbl_tickera_runtime_validator_main(array $arguments): int {
    if (count($arguments) !== 2) {
        fwrite(STDERR, "Usage: php validate-tickera-stateless-rest-runtime.php <runtime-report.json>\n");
        return 2;
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

    $failures = tbl_tickera_runtime_validate_report($report);
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
