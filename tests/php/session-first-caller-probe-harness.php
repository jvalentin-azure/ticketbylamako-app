<?php

declare(strict_types=1);

if ( $argc !== 2 ) {
    fwrite( STDERR, "Usage: php session-first-caller-probe-harness.php <scenario>\n" );
    exit( 2 );
}

$scenario = (string) $argv[1];
$known_scenarios = [
    'authorized-get',
    'authorized-head',
    'fpm-empty-content-metadata',
    'nonempty-content-length',
    'nonempty-content-type',
    'ordinary',
    'wrong-token',
    'short-token',
    'invalid-config',
    'query',
    'cookie',
    'public-output',
    'existing-output',
    'active-session',
    'user-handler',
];
if ( ! in_array( $scenario, $known_scenarios, true ) ) {
    fwrite( STDERR, "Unknown scenario\n" );
    exit( 2 );
}

$fixture_root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tbl-session-probe-'
    . getmypid() . '-' . bin2hex( random_bytes( 6 ) );
$public_root = $fixture_root . DIRECTORY_SEPARATOR . 'public_html';
$private_root = $fixture_root . DIRECTORY_SEPARATOR . 'private_html';
$operator_root = $private_root . DIRECTORY_SEPARATOR . 'operator';
$session_root = $private_root . DIRECTORY_SEPARATOR . 'sessions';
$public_operator_root = $public_root . DIRECTORY_SEPARATOR . 'operator';
$output_path = $operator_root . DIRECTORY_SEPARATOR . 'tbl-session-first-caller-fixture.json';
$public_output_path = $public_operator_root . DIRECTORY_SEPARATOR
    . 'tbl-session-first-caller-fixture.json';
$manifest_path = $private_root . DIRECTORY_SEPARATOR
    . 'tbl-session-first-caller-probe-config.json';

foreach (
    [
        $fixture_root,
        $public_root,
        $private_root,
        $operator_root,
        $session_root,
        $public_operator_root,
    ] as $directory
) {
    if ( ! mkdir( $directory, 0700 ) ) {
        fwrite( STDERR, "Unable to create isolated fixture\n" );
        exit( 3 );
    }
    @chmod( $directory, 0700 );
}

define( 'ABSPATH', $public_root . DIRECTORY_SEPARATOR );
ini_set( 'session.save_handler', 'files' );
ini_set( 'session.save_path', $session_root );
ini_set( 'session.use_cookies', '0' );
ini_set( 'session.cache_limiter', '' );
ini_set( 'session.use_strict_mode', '0' );

$token = str_repeat( 'a1', 32 );
$wrong_token = str_repeat( 'b2', 32 );
$manifest = [
    'schema' => 1,
    'tokenSha256' => hash( 'sha256', $token ),
    'outputPath' => $scenario === 'public-output' ? $public_output_path : $output_path,
];
file_put_contents( $manifest_path, json_encode( $manifest ) );
@chmod( $manifest_path, 0600 );
if ( $scenario === 'invalid-config' ) {
    file_put_contents( $manifest_path, '{}' );
}

$_SERVER['REQUEST_METHOD'] = $scenario === 'authorized-head' ? 'HEAD' : 'GET';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['QUERY_STRING'] = '';
$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
$_SERVER['HTTP_USER_AGENT'] = 'private-fixture-user-agent';
$_GET = [];
$_POST = [];
$_FILES = [];
$_COOKIE = [];

if ( $scenario === 'fpm-empty-content-metadata' ) {
    $_SERVER['CONTENT_LENGTH'] = '';
    $_SERVER['CONTENT_TYPE'] = '';
}
if ( $scenario === 'nonempty-content-length' ) {
    $_SERVER['CONTENT_LENGTH'] = '987654321';
}
if ( $scenario === 'nonempty-content-type' ) {
    $_SERVER['CONTENT_TYPE'] = 'application/octet-stream';
}

if ( $scenario !== 'ordinary' ) {
    $_SERVER['HTTP_X_TBL_SESSION_PROBE_TOKEN'] = $scenario === 'wrong-token'
        ? $wrong_token
        : ( $scenario === 'short-token' ? 'abc123' : $token );
}
if ( $scenario === 'query' ) {
    $_SERVER['REQUEST_URI'] = '/?customer=private-query-value';
    $_SERVER['QUERY_STRING'] = 'customer=private-query-value';
    $_GET = [ 'customer' => 'private-query-value' ];
}
if ( $scenario === 'cookie' ) {
    $_COOKIE = [ 'PHPSESSID' => 'private-cookie-value' ];
}
if ( $scenario === 'existing-output' ) {
    file_put_contents( $output_path, "existing-sentinel\n" );
}

$preexisting_handler = null;
if ( $scenario === 'user-handler' ) {
    $preexisting_handler = new class implements SessionHandlerInterface {
        private array $values = [];
        public function open( string $path, string $name ): bool { return true; }
        public function close(): bool { return true; }
        public function read( string $id ): string|false { return $this->values[ $id ] ?? ''; }
        public function write( string $id, string $data ): bool {
            $this->values[ $id ] = $data;
            return true;
        }
        public function destroy( string $id ): bool {
            unset( $this->values[ $id ] );
            return true;
        }
        public function gc( int $max_lifetime ): int|false { return 0; }
    };
    session_set_save_handler( $preexisting_handler, true );
}

if ( $scenario === 'active-session' ) {
    session_id( 'preexisting-session-fixture' );
    session_start();
}

$handler_before = session_module_name();
require dirname( __DIR__, 2 ) . DIRECTORY_SEPARATOR . 'scripts'
    . DIRECTORY_SEPARATOR . 'tbl-session-first-caller-probe.php';
$active = tbl_session_probe_is_active();
$handler_after = session_module_name();
$loaded_manifest = tbl_session_probe_private_manifest();
$token_matches = is_array( $loaded_manifest )
    && tbl_session_probe_token_matches( $loaded_manifest['tokenSha256'] );
$request_shape = tbl_session_probe_request_shape();
$request_authorized = $token_matches
    && tbl_session_probe_request_shape_is_allowed( $request_shape );
$output_path_valid_before_trace = is_array( $loaded_manifest )
    && tbl_session_probe_output_path( $loaded_manifest['outputPath'] ) !== '';

$session_preserved = null;
$first_trace_hash = null;
$second_trace_hash = null;
if ( $active ) {
    session_id( 'transparent-session-fixture' );
    session_start();
    $_SESSION['private_fixture_key'] = 'private-session-value';
    session_write_close();
    $first_trace_hash = is_file( $output_path ) ? hash_file( 'sha256', $output_path ) : null;

    session_id( 'transparent-session-fixture' );
    session_start();
    $session_preserved = isset( $_SESSION['private_fixture_key'] )
        && $_SESSION['private_fixture_key'] === 'private-session-value';
    session_write_close();
    $second_trace_hash = is_file( $output_path ) ? hash_file( 'sha256', $output_path ) : null;
}

if ( session_status() === PHP_SESSION_ACTIVE ) {
    session_abort();
}

$trace_path = is_file( $output_path ) ? $output_path : $public_output_path;
$trace_raw = is_file( $trace_path ) ? file_get_contents( $trace_path ) : '';
$trace = is_string( $trace_raw ) && $trace_raw !== ''
    ? json_decode( $trace_raw, true )
    : null;
$result = [
    'scenario' => $scenario,
    'active' => $active,
    'requestAuthorized' => $request_authorized,
    'outputPathValidBeforeTrace' => $output_path_valid_before_trace,
    'handlerBefore' => $handler_before,
    'handlerAfter' => $handler_after,
    'traceExists' => is_file( $trace_path ),
    'traceIsJson' => is_array( $trace ),
    'traceEvent' => is_array( $trace ) ? ( $trace['event'] ?? null ) : null,
    'refusalReason' => is_array( $trace ) ? ( $trace['reason'] ?? null ) : null,
    'reportedRequestShape' => is_array( $trace ) ? ( $trace['requestShape'] ?? null ) : null,
    'gateReport' => is_array( $trace ) && ( $trace['event'] ?? null ) === 'probe_gate_refused'
        ? $trace
        : null,
    'traceMethod' => is_array( $trace ) ? ( $trace['requestMethod'] ?? null ) : null,
    'traceFrames' => is_array( $trace ) ? ( $trace['frames'] ?? null ) : null,
    'traceKeys' => is_array( $trace ) ? array_keys( $trace ) : null,
    'traceContainsToken' => is_string( $trace_raw ) && strpos( $trace_raw, $token ) !== false,
    'traceContainsQuery' => is_string( $trace_raw )
        && strpos( $trace_raw, 'private-query-value' ) !== false,
    'traceContainsCookie' => is_string( $trace_raw )
        && strpos( $trace_raw, 'private-cookie-value' ) !== false,
    'traceContainsUserAgent' => is_string( $trace_raw )
        && strpos( $trace_raw, 'private-fixture-user-agent' ) !== false,
    'traceContainsContentLength' => is_string( $trace_raw )
        && strpos( $trace_raw, '987654321' ) !== false,
    'traceContainsContentType' => is_string( $trace_raw )
        && strpos( $trace_raw, 'application/octet-stream' ) !== false,
    'traceContainsFixtureRoot' => is_string( $trace_raw )
        && strpos( $trace_raw, str_replace( '\\', '/', $fixture_root ) ) !== false,
    'anonymousSymbolRedacted' => tbl_session_probe_normalize_symbol(
        "class@anonymous\0C:\\Users\\private"
    ) === '[anonymous-class]',
    'sessionPreserved' => $session_preserved,
    'oneTraceOnly' => $first_trace_hash !== null && $first_trace_hash === $second_trace_hash,
    'existingOutputPreserved' => $scenario !== 'existing-output'
        || $trace_raw === "existing-sentinel\n",
];

echo json_encode( $result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

foreach ( glob( $session_root . DIRECTORY_SEPARATOR . '*' ) ?: [] as $session_file ) {
    if ( is_file( $session_file ) ) {
        unlink( $session_file );
    }
}
foreach ( [ $output_path, $public_output_path, $manifest_path ] as $candidate_file ) {
    if ( is_file( $candidate_file ) ) {
        unlink( $candidate_file );
    }
}
foreach (
    [
        $public_operator_root,
        $session_root,
        $operator_root,
        $private_root,
        $public_root,
        $fixture_root,
    ] as $directory
) {
    if ( is_dir( $directory ) ) {
        rmdir( $directory );
    }
}
