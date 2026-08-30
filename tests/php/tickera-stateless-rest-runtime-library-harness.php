<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/scripts/qa-tickera-stateless-rest-runtime.php';

$scenario = (string) ($argv[1] ?? '');
$result   = null;

$request_context = [
    'wpRoot'                   => '/srv/tbl-phase-s-clone/current',
    'wpConfigSha256'           => str_repeat('1', 64),
    'runnerSha256'             => str_repeat('2', 64),
    'validatorSha256'          => str_repeat('3', 64),
    'invocationIdSha256'       => str_repeat('4', 64),
    'requestFingerprintSha256' => str_repeat('5', 64),
    'method'                   => 'GET',
    'urlForm'                  => 'PRETTY',
    'webSessionMode'           => 'NOT_APPLICABLE',
    'cachePreflightState'      => 'HIT',
];
$valid_proof = [
    'schemaVersion'                       => 2,
    'phase'                               => 'S',
    'environment'                         => 'isolated-clone',
    'sourceEnvironment'                   => 'staging',
    'cloneOnly'                           => true,
    'publicAccessRestricted'              => true,
    'wpRoot'                              => $request_context['wpRoot'],
    'cloneHost'                           => 'phase-s-clone.invalid',
    'wpConfigSha256'                      => $request_context['wpConfigSha256'],
    'runnerSha256'                        => $request_context['runnerSha256'],
    'validatorSha256'                     => $request_context['validatorSha256'],
    'invocationIdSha256'                  => $request_context['invocationIdSha256'],
    'requestFingerprintSha256'            => $request_context['requestFingerprintSha256'],
    'method'                              => $request_context['method'],
    'urlForm'                             => $request_context['urlForm'],
    'webSessionMode'                      => $request_context['webSessionMode'],
    'cachePreflightState'                 => $request_context['cachePreflightState'],
    'databaseReadOnlyEnforced'            => true,
    'databaseCanaryWriteRejected'         => true,
    'databaseControl'                     => 'CLONE_SELECT_ONLY_CREDENTIAL',
    'databaseTargetFingerprintSha256'     => str_repeat('6', 64),
    'objectCacheWritesBlocked'            => true,
    'objectCacheControl'                  => 'CLONE_EPHEMERAL_OR_WRITE_DENIED',
    'objectCacheTargetFingerprintSha256'  => str_repeat('7', 64),
    'directNetworkEgressBlocked'          => true,
    'networkControl'                      => 'PROCESS_EGRESS_DENY',
    'filesystemWritesDeniedOrEphemeral'   => true,
    'filesystemControl'                   => 'READ_ONLY_ROOT_EPHEMERAL_TMP',
    'productionCredentialsUnavailable'   => true,
    'cronDisabled'                        => true,
    'queueWorkersDisabled'                => true,
    'mailDeliveryDisabled'                => true,
    'providerCallbacksDisabled'           => true,
    'activePluginFingerprintSha256'       => str_repeat('8', 64),
    'evidenceManifestSha256'              => str_repeat('9', 64),
    'issuedAtUtc'                         => gmdate('Y-m-d\TH:i:s\Z', time() - 30),
    'expiresAtUtc'                        => gmdate('Y-m-d\TH:i:s\Z', time() + 1800),
];

switch ($scenario) {
    case 'sql-select':
        $query  = 'SELECT option_value FROM wp_options';
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'sql-comment-show':
        $query  = "/* qa */\n-- read only\nSHOW TABLES";
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'sql-update':
        $query  = 'UPDATE wp_options SET option_value = 1';
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'sql-cte':
        $query  = 'WITH rows AS (SELECT 1) SELECT * FROM rows';
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'sql-multiple':
        $query  = 'SELECT 1; UPDATE wp_options SET option_value = 1';
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'sql-versioned-comment':
        $query  = '/*!50000 SET @audit = 1 */ SELECT 1';
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'sql-select-for-update':
        $query  = 'SELECT option_value FROM wp_options FOR UPDATE';
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'sql-select-get-lock':
        $query  = "SELECT GET_LOCK('tbl-runtime', 1)";
        $result = ['operation' => tbl_tickera_runtime_sql_operation($query), 'readOnly' => tbl_tickera_runtime_sql_is_read_only($query)];
        break;
    case 'isolation-valid':
    case 'isolation-cache-unblocked':
    case 'isolation-database-unbound':
    case 'isolation-cache-unbound':
    case 'isolation-source-staging-root':
        $proof   = $valid_proof;
        $context = $request_context;
        if ($scenario === 'isolation-cache-unblocked') {
            $proof['objectCacheWritesBlocked'] = false;
        } elseif ($scenario === 'isolation-database-unbound') {
            $proof['databaseTargetFingerprintSha256'] = str_repeat('x', 64);
        } elseif ($scenario === 'isolation-cache-unbound') {
            unset($proof['objectCacheTargetFingerprintSha256']);
        } elseif ($scenario === 'isolation-source-staging-root') {
            $proof['wpRoot']   = TBL_TICKERA_RUNTIME_SOURCE_STAGING_ROOT;
            $context['wpRoot'] = TBL_TICKERA_RUNTIME_SOURCE_STAGING_ROOT;
        }
        $result = tbl_tickera_runtime_probe_validate_isolation_proof($proof, $context);
        break;
    case 'request-pretty-get':
        $result = tbl_tickera_runtime_probe_parse_request(
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?summary=1&events_limit=12&products_limit=8'
        );
        break;
    case 'request-rest-route-head':
        $result = tbl_tickera_runtime_probe_parse_request(
            'HEAD',
            '/?rest_route=/lamako-mobile/v2/public/events/42'
        );
        break;
    case 'request-rest-route-options':
        $result = tbl_tickera_runtime_probe_parse_request(
            'OPTIONS',
            '/index.php?rest_route=/lamako-mobile/v2/rewards/config'
        );
        break;
    case 'request-web-session':
        $result = tbl_tickera_runtime_probe_parse_request('GET', '/wp-json/lamako-mobile/v2/web-session');
        break;
    case 'request-post':
        $result = tbl_tickera_runtime_probe_parse_request('POST', '/wp-json/lamako-mobile/v2/web-session');
        break;
    case 'request-duplicate-rest-route':
        $result = tbl_tickera_runtime_probe_parse_request(
            'GET',
            '/?rest_route=/lamako-mobile/v2/web-session&rest_route=/lamako-mobile/v2/rewards/config'
        );
        break;
    case 'request-mutative-query':
        $result = tbl_tickera_runtime_probe_parse_request(
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?add-to-cart=13845'
        );
        break;
    case 'request-encoded-path':
        $result = tbl_tickera_runtime_probe_parse_request(
            'GET',
            '/wp-json/lamako-mobile/v2/public%2Fhome-data'
        );
        break;
    case 'request-unknown-route':
        $result = tbl_tickera_runtime_probe_parse_request('GET', '/wp-json/lamako-mobile/v2/profile');
        break;
    case 'handler-contract':
        $handler = new TBL_Tickera_No_Persist_Session_Handler();
        $result = [
            'sessionHandler' => $handler instanceof SessionHandlerInterface,
            'sessionId' => $handler instanceof SessionIdInterface,
            'sessionUpdateTimestamp' => $handler instanceof SessionUpdateTimestampHandlerInterface,
            'hasCreateSid' => method_exists($handler, 'create_sid'),
            'hasValidateId' => method_exists($handler, 'validateId'),
            'hasUpdateTimestamp' => method_exists($handler, 'updateTimestamp'),
        ];
        break;
    case 'handler-safe-stack':
        $GLOBALS['tbl_tickera_runtime_probe_state'] = [
            'runtime' => ['wpRoot' => '/srv/tbl-phase-s-clone/current'],
            'session' => [
                'firstEvent' => null,
                'firstEventStack' => [],
                'write' => 0,
            ],
        ];
        $handler = new TBL_Tickera_No_Persist_Session_Handler();
        $handler->write('PII-session-id-never-report', 'PII-session-data-never-report');
        $result = [
            'firstEvent' => $GLOBALS['tbl_tickera_runtime_probe_state']['session']['firstEvent'],
            'firstEventStack' => $GLOBALS['tbl_tickera_runtime_probe_state']['session']['firstEventStack'],
        ];
        break;
    default:
        fwrite(STDERR, "Unknown scenario\n");
        exit(2);
}

echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
