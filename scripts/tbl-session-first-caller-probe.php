<?php
/**
 * Plugin Name: TicketByLamako Temporary First Session Caller Probe
 * Description: One-shot, operator-gated attribution of the first PHP session open call.
 * Version: 0.2.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! function_exists( 'tbl_session_probe_normalize_path' ) ) {
    function tbl_session_probe_normalize_path( $path ) {
        $normalized = rtrim( str_replace( '\\', '/', (string) $path ), '/' );
        return DIRECTORY_SEPARATOR === '\\' ? strtolower( $normalized ) : $normalized;
    }
}

if ( ! function_exists( 'tbl_session_probe_token_matches' ) ) {
    function tbl_session_probe_token_matches( $expected_hash ) {
        $token = isset( $_SERVER['HTTP_X_TBL_SESSION_PROBE_TOKEN'] )
            && is_string( $_SERVER['HTTP_X_TBL_SESSION_PROBE_TOKEN'] )
            ? $_SERVER['HTTP_X_TBL_SESSION_PROBE_TOKEN']
            : '';
        if (
            ! is_string( $expected_hash )
            || ! preg_match( '/\A[a-f0-9]{64}\z/D', $expected_hash )
            || ! preg_match( '/\A[a-f0-9]{64}\z/D', $token )
            || ! hash_equals( $expected_hash, hash( 'sha256', $token ) )
        ) {
            return false;
        }

        return true;
    }
}

if ( ! function_exists( 'tbl_session_probe_server_field_empty' ) ) {
    function tbl_session_probe_server_field_empty( $key ) {
        return ! array_key_exists( $key, $_SERVER ) || $_SERVER[ $key ] === '';
    }
}

if ( ! function_exists( 'tbl_session_probe_request_shape' ) ) {
    function tbl_session_probe_request_shape() {
        $method = isset( $_SERVER['REQUEST_METHOD'] ) && is_string( $_SERVER['REQUEST_METHOD'] )
            ? $_SERVER['REQUEST_METHOD']
            : '';
        $request_uri = isset( $_SERVER['REQUEST_URI'] ) && is_string( $_SERVER['REQUEST_URI'] )
            ? $_SERVER['REQUEST_URI']
            : '';
        $query_string = isset( $_SERVER['QUERY_STRING'] ) && is_string( $_SERVER['QUERY_STRING'] )
            ? $_SERVER['QUERY_STRING']
            : '';

        return [
            'method'                => in_array( $method, [ 'GET', 'HEAD' ], true )
                ? $method
                : 'OTHER',
            'pathIsRoot'            => $request_uri === '/',
            'queryStringEmpty'      => $query_string === '',
            'getEmpty'              => empty( $_GET ),
            'postEmpty'             => empty( $_POST ),
            'filesEmpty'            => empty( $_FILES ),
            'cookiesEmpty'          => empty( $_COOKIE ),
            'authorizationEmpty'    => tbl_session_probe_server_field_empty( 'HTTP_AUTHORIZATION' )
                && tbl_session_probe_server_field_empty( 'REDIRECT_HTTP_AUTHORIZATION' )
                && tbl_session_probe_server_field_empty( 'PHP_AUTH_USER' )
                && tbl_session_probe_server_field_empty( 'REMOTE_USER' ),
            'contentLengthEmpty'    => tbl_session_probe_server_field_empty( 'CONTENT_LENGTH' ),
            'contentTypeEmpty'      => tbl_session_probe_server_field_empty( 'CONTENT_TYPE' ),
            'transferEncodingEmpty' => tbl_session_probe_server_field_empty( 'HTTP_TRANSFER_ENCODING' ),
            'methodOverrideEmpty'   => tbl_session_probe_server_field_empty( 'HTTP_X_HTTP_METHOD_OVERRIDE' ),
        ];
    }
}

if ( ! function_exists( 'tbl_session_probe_request_shape_is_allowed' ) ) {
    function tbl_session_probe_request_shape_is_allowed( $shape ) {
        if ( ! is_array( $shape ) || ! in_array( $shape['method'] ?? '', [ 'GET', 'HEAD' ], true ) ) {
            return false;
        }
        foreach ( $shape as $key => $value ) {
            if ( $key !== 'method' && $value !== true ) {
                return false;
            }
        }

        return true;
    }
}

if ( ! function_exists( 'tbl_session_probe_private_manifest' ) ) {
    function tbl_session_probe_private_manifest() {
        $public_root = realpath( rtrim( ABSPATH, '/\\' ) );
        $application_root = $public_root === false ? false : realpath( dirname( $public_root ) );
        $private_root = $application_root === false
            ? false
            : realpath( $application_root . DIRECTORY_SEPARATOR . 'private_html' );
        if ( $public_root === false || $application_root === false || $private_root === false ) {
            return null;
        }

        $manifest_path = $private_root . DIRECTORY_SEPARATOR
            . 'tbl-session-first-caller-probe-config.json';
        if ( is_link( $manifest_path ) || ! is_file( $manifest_path ) || ! is_readable( $manifest_path ) ) {
            return null;
        }
        $manifest_size = @filesize( $manifest_path );
        if ( $manifest_size === false || $manifest_size < 2 || $manifest_size > 2048 ) {
            return null;
        }

        if ( DIRECTORY_SEPARATOR !== '\\' ) {
            $permissions = @fileperms( $manifest_path );
            if ( $permissions === false || ( $permissions & 0777 ) !== 0600 ) {
                return null;
            }
            if (
                function_exists( 'posix_geteuid' )
                && function_exists( 'fileowner' )
                && @fileowner( $manifest_path ) !== posix_geteuid()
            ) {
                return null;
            }
        }

        try {
            $raw = @file_get_contents( $manifest_path );
            $manifest = is_string( $raw )
                ? json_decode( $raw, true, 4, JSON_THROW_ON_ERROR )
                : null;
        } catch ( Throwable $error ) {
            return null;
        }
        if ( ! is_array( $manifest ) ) {
            return null;
        }
        $keys = array_keys( $manifest );
        sort( $keys );
        if (
            $keys !== [ 'outputPath', 'schema', 'tokenSha256' ]
            || $manifest['schema'] !== 1
            || ! is_string( $manifest['tokenSha256'] )
            || ! preg_match( '/\A[a-f0-9]{64}\z/D', $manifest['tokenSha256'] )
            || ! is_string( $manifest['outputPath'] )
        ) {
            return null;
        }

        return $manifest;
    }
}

if ( ! function_exists( 'tbl_session_probe_output_path' ) ) {
    function tbl_session_probe_output_path( $configured_path ) {
        if ( ! is_string( $configured_path ) || $configured_path === '' ) {
            return '';
        }

        $public_root = realpath( rtrim( ABSPATH, '/\\' ) );
        $application_root = $public_root === false ? false : realpath( dirname( $public_root ) );
        $private_root = $application_root === false
            ? false
            : realpath( $application_root . DIRECTORY_SEPARATOR . 'private_html' );
        $output_parent = realpath( dirname( $configured_path ) );
        $output_name = basename( $configured_path );
        if (
            $public_root === false
            || $application_root === false
            || $private_root === false
            || $output_parent === false
            || ! preg_match( '/\Atbl-session-first-caller-[a-z0-9][a-z0-9-]{0,63}\.json\z/D', $output_name )
            || ! is_dir( $output_parent )
            || ! is_writable( $output_parent )
            || file_exists( $configured_path )
            || is_link( $configured_path )
        ) {
            return '';
        }

        $public_root = tbl_session_probe_normalize_path( $public_root );
        $application_root = tbl_session_probe_normalize_path( $application_root );
        $private_root = tbl_session_probe_normalize_path( $private_root );
        $output_parent = tbl_session_probe_normalize_path( $output_parent );
        $canonical_path = $output_parent . '/' . $output_name;
        if (
            dirname( $private_root ) !== $application_root
            || strpos( $private_root . '/', $public_root . '/' ) === 0
            || strpos( $output_parent . '/', $private_root . '/' ) !== 0
        ) {
            return '';
        }

        if ( DIRECTORY_SEPARATOR !== '\\' ) {
            $permissions = fileperms( $output_parent );
            if ( $permissions === false || ( $permissions & 0077 ) !== 0 ) {
                return '';
            }
            if (
                function_exists( 'posix_geteuid' )
                && function_exists( 'fileowner' )
                && fileowner( $output_parent ) !== posix_geteuid()
            ) {
                return '';
            }
        }

        return str_replace( '/', DIRECTORY_SEPARATOR, $canonical_path );
    }
}

if ( ! function_exists( 'tbl_session_probe_normalize_frame_file' ) ) {
    function tbl_session_probe_normalize_frame_file( $file ) {
        if ( ! is_string( $file ) || $file === '' ) {
            return '[internal]';
        }

        $file = tbl_session_probe_normalize_path( $file );
        $public_root = tbl_session_probe_normalize_path( realpath( rtrim( ABSPATH, '/\\' ) ) ?: '' );
        if ( $public_root !== '' && strpos( $file . '/', $public_root . '/' ) === 0 ) {
            return '[ABSPATH]/' . ltrim( substr( $file, strlen( $public_root ) ), '/' );
        }

        return '[external]';
    }
}

if ( ! function_exists( 'tbl_session_probe_normalize_symbol' ) ) {
    function tbl_session_probe_normalize_symbol( $symbol ) {
        if ( ! is_string( $symbol ) || $symbol === '' ) {
            return '';
        }
        if ( strpos( $symbol, '@anonymous' ) !== false ) {
            return '[anonymous-class]';
        }
        if ( ! preg_match( '/\A[A-Za-z0-9_\\\\{}:-]{1,160}\z/D', $symbol ) ) {
            return '[redacted-symbol]';
        }

        return $symbol;
    }
}

if ( ! function_exists( 'tbl_session_probe_trace_frames' ) ) {
    function tbl_session_probe_trace_frames() {
        $result = [];
        foreach ( debug_backtrace( DEBUG_BACKTRACE_IGNORE_ARGS, 32 ) as $frame ) {
            $result[] = [
                'file'     => tbl_session_probe_normalize_frame_file( $frame['file'] ?? '' ),
                'line'     => isset( $frame['line'] ) ? (int) $frame['line'] : 0,
                'function' => tbl_session_probe_normalize_symbol( $frame['function'] ?? '' ),
                'class'    => tbl_session_probe_normalize_symbol( $frame['class'] ?? '' ),
                'type'     => isset( $frame['type'] ) && in_array( $frame['type'], [ '->', '::' ], true )
                    ? $frame['type']
                    : '',
            ];
        }

        return $result;
    }
}

if ( ! function_exists( 'tbl_session_probe_write_exclusive_report' ) ) {
    function tbl_session_probe_write_exclusive_report( $output_path, $report ) {
        try {
            $encoded = json_encode(
                $report,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
            );
            if ( ! is_string( $encoded ) ) {
                return false;
            }

            $handle = @fopen( $output_path, 'x' );
            if ( $handle === false ) {
                return false;
            }
            @chmod( $output_path, 0600 );
            $written = @fwrite( $handle, $encoded . "\n" );
            @fclose( $handle );

            return is_int( $written ) && $written === strlen( $encoded ) + 1;
        } catch ( Throwable $error ) {
            return false;
        }
    }
}

if (
    class_exists( 'SessionHandler', false )
    && ! class_exists( 'TBL_Session_First_Caller_Probe_Handler', false )
) {
    final class TBL_Session_First_Caller_Probe_Handler extends SessionHandler {
        private $output_path;
        private $original_handler;
        private $captured = false;

        public function __construct( $output_path, $original_handler ) {
            $this->output_path = (string) $output_path;
            $this->original_handler = (string) $original_handler;
        }

        public function open( string $path, string $name ): bool {
            if ( ! $this->captured ) {
                $this->captured = true;
                $this->capture_first_open();
            }

            return parent::open( $path, $name );
        }

        private function capture_first_open() {
            try {
                $report = [
                    'schema'          => 1,
                    'event'           => 'first_session_handler_open',
                    'capturedAtUtc'   => gmdate( 'Y-m-d\TH:i:s\Z' ),
                    'requestMethod'   => isset( $_SERVER['REQUEST_METHOD'] )
                        && is_string( $_SERVER['REQUEST_METHOD'] )
                        ? $_SERVER['REQUEST_METHOD']
                        : '',
                    'originalHandler' => $this->original_handler,
                    'frames'          => tbl_session_probe_trace_frames(),
                ];
                tbl_session_probe_write_exclusive_report( $this->output_path, $report );
            } catch ( Throwable $error ) {
                // Attribution must never alter the wrapped session outcome.
            }
        }
    }
}

if ( ! function_exists( 'tbl_session_probe_is_active' ) ) {
    function tbl_session_probe_is_active( $initialize = null ) {
        static $initialized = false;
        static $active      = false;

        if ( ! $initialized && is_bool( $initialize ) ) {
            $active      = $initialize;
            $initialized = true;
        }

        return $initialized && $active;
    }
}

$tbl_session_probe_active                    = false;
$tbl_session_probe_manifest                  = tbl_session_probe_private_manifest();
$tbl_session_probe_config_valid              = is_array( $tbl_session_probe_manifest );
$tbl_session_probe_token_matches             = $tbl_session_probe_config_valid
    && tbl_session_probe_token_matches( $tbl_session_probe_manifest['tokenSha256'] );
$tbl_session_probe_shape                     = tbl_session_probe_request_shape();
$tbl_session_probe_shape_allowed             = tbl_session_probe_request_shape_is_allowed(
    $tbl_session_probe_shape
);
$tbl_session_probe_status                    = function_exists( 'session_status' )
    ? session_status()
    : -1;
$tbl_session_probe_status_is_none            = defined( 'PHP_SESSION_NONE' )
    && $tbl_session_probe_status === PHP_SESSION_NONE;
$tbl_session_probe_status_name               = $tbl_session_probe_status_is_none
    ? 'none'
    : ( defined( 'PHP_SESSION_ACTIVE' ) && $tbl_session_probe_status === PHP_SESSION_ACTIVE
        ? 'active'
        : ( defined( 'PHP_SESSION_DISABLED' ) && $tbl_session_probe_status === PHP_SESSION_DISABLED
            ? 'disabled'
            : 'unknown' ) );
$tbl_session_probe_original_handler          = function_exists( 'session_module_name' )
    ? session_module_name()
    : false;
$tbl_session_probe_original_handler_is_valid = is_string( $tbl_session_probe_original_handler )
    && preg_match( '/\A[a-z0-9_-]{1,64}\z/D', $tbl_session_probe_original_handler );
$tbl_session_probe_module_name               = ! $tbl_session_probe_original_handler_is_valid
    ? 'invalid'
    : ( $tbl_session_probe_original_handler === 'files'
        ? 'files'
        : ( $tbl_session_probe_original_handler === 'user' ? 'user' : 'other' ) );
$tbl_session_probe_class_available           = class_exists( 'SessionHandler', false );
$tbl_session_probe_registration_available    = function_exists( 'session_set_save_handler' );
$tbl_session_probe_output                    = $tbl_session_probe_token_matches
    ? tbl_session_probe_output_path( $tbl_session_probe_manifest['outputPath'] )
    : '';
$tbl_session_probe_output_valid              = $tbl_session_probe_output !== '';
$tbl_session_probe_safe_to_report            = $tbl_session_probe_token_matches
    && $tbl_session_probe_output_valid
    && $tbl_session_probe_status_is_none
    && $tbl_session_probe_original_handler_is_valid
    && $tbl_session_probe_original_handler !== 'user';
$tbl_session_probe_refusal_reason            = '';

if ( $tbl_session_probe_safe_to_report ) {
    if ( ! $tbl_session_probe_shape_allowed ) {
        $tbl_session_probe_refusal_reason = 'request_shape';
    } elseif ( ! $tbl_session_probe_class_available || ! $tbl_session_probe_registration_available ) {
        $tbl_session_probe_refusal_reason = 'handler_unavailable';
    } else {
        $tbl_session_probe_handler = new TBL_Session_First_Caller_Probe_Handler(
            $tbl_session_probe_output,
            $tbl_session_probe_original_handler
        );
        $tbl_session_probe_active = @session_set_save_handler(
            $tbl_session_probe_handler,
            true
        );
        if ( ! $tbl_session_probe_active ) {
            $tbl_session_probe_refusal_reason = 'handler_registration';
        }
    }

    if ( $tbl_session_probe_refusal_reason !== '' ) {
        tbl_session_probe_write_exclusive_report(
            $tbl_session_probe_output,
            [
                'schema'                       => 2,
                'event'                        => 'probe_gate_refused',
                'reason'                       => $tbl_session_probe_refusal_reason,
                'requestShape'                 => $tbl_session_probe_shape,
                'sessionStatus'                => $tbl_session_probe_status_name,
                'sessionModule'                => $tbl_session_probe_module_name,
                'sessionHandlerClassAvailable' => $tbl_session_probe_class_available,
                'handlerRegistrationAvailable' => $tbl_session_probe_registration_available,
                'configValid'                  => $tbl_session_probe_config_valid,
                'outputValid'                  => $tbl_session_probe_output_valid,
            ]
        );
    }
}
tbl_session_probe_is_active( $tbl_session_probe_active );
unset(
    $tbl_session_probe_active,
    $tbl_session_probe_class_available,
    $tbl_session_probe_config_valid,
    $tbl_session_probe_manifest,
    $tbl_session_probe_module_name,
    $tbl_session_probe_original_handler,
    $tbl_session_probe_original_handler_is_valid,
    $tbl_session_probe_output,
    $tbl_session_probe_output_valid,
    $tbl_session_probe_refusal_reason,
    $tbl_session_probe_registration_available,
    $tbl_session_probe_safe_to_report,
    $tbl_session_probe_shape,
    $tbl_session_probe_shape_allowed,
    $tbl_session_probe_status,
    $tbl_session_probe_status_is_none,
    $tbl_session_probe_status_name,
    $tbl_session_probe_token_matches,
    $tbl_session_probe_handler
);
