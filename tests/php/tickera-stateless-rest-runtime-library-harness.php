<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/scripts/qa-tickera-stateless-rest-runtime.php';

$scenario = (string) ($argv[1] ?? '');
$result   = null;

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
        $proof = [
            'schemaVersion' => 1,
            'phase' => 'S',
            'environment' => 'staging',
            'wpRoot' => TBL_TICKERA_RUNTIME_STAGING_ROOT,
            'wpConfigSha256' => str_repeat('1', 64),
            'databaseReadOnlyEnforced' => true,
            'objectCacheWritesBlocked' => $scenario === 'isolation-valid',
            'directNetworkEgressBlocked' => true,
            'productionCredentialsUnavailable' => true,
            'activePluginFingerprintSha256' => str_repeat('2', 64),
            'evidenceManifestSha256' => str_repeat('3', 64),
            'issuedAtUtc' => gmdate('Y-m-d\TH:i:s\Z', time() - 30),
            'expiresAtUtc' => gmdate('Y-m-d\TH:i:s\Z', time() + 1800),
        ];
        $result = tbl_tickera_runtime_probe_validate_isolation_proof($proof, str_repeat('1', 64));
        break;
    case 'uri-allowed':
        $result = tbl_tickera_runtime_probe_parse_uri(
            '/wp-json/lamako-mobile/v2/public/home-data?summary=1&events_limit=12&products_limit=8'
        );
        break;
    case 'uri-mutative-query':
        $result = tbl_tickera_runtime_probe_parse_uri(
            '/wp-json/lamako-mobile/v2/public/home-data?add-to-cart=13845'
        );
        break;
    case 'uri-encoded-path':
        $result = tbl_tickera_runtime_probe_parse_uri(
            '/wp-json/lamako-mobile/v2/public%2Fhome-data'
        );
        break;
    case 'uri-unknown-route':
        $result = tbl_tickera_runtime_probe_parse_uri('/wp-json/lamako-mobile/v2/profile');
        break;
    default:
        fwrite(STDERR, "Unknown scenario\n");
        exit(2);
}

echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
