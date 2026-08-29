<?php

declare( strict_types=1 );

define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'MINUTE_IN_SECONDS', 60 );

final class WP_Error {
    public function __construct( public string $code, public string $message ) {}
}

class WC_Payment_Gateway {
    public string $plugin_id = 'woocommerce_';
    public string $id = '';
    public string $icon = '';
    public bool $has_fields = false;
    public string $method_title = '';
    public string $method_description = '';
    public array $supports = [];
    public array $form_fields = [];
    public array $settings = [];
    public string $enabled = 'no';
    public string $title = '';
    public string $description = '';

    public function init_settings(): void {
        $this->settings = $GLOBALS['tbl_gateway_options'];
    }

    public function get_option( string $key, $default = '' ) {
        return $this->settings[ $key ] ?? $default;
    }

    public function process_admin_options(): bool {
        return true;
    }
}

$GLOBALS['tbl_gateway_options'] = [
    'enabled'         => 'yes',
    'title'           => 'Orange Money',
    'description'     => 'Legacy configuration must not be trusted.',
    'merchant_key'    => 'legacy-merchant-must-be-ignored',
    'consumer_key'    => 'legacy-consumer-must-be-ignored',
    'api_token_url'   => 'https://api.orange.com/oauth/v3/token',
    'api_payment_url' => 'https://api.orange.com/orange-money-webpay/mg/v1/webpayment',
];
$GLOBALS['tbl_home_url']      = 'https://staging.ticketbylamako.com';
$GLOBALS['tbl_provider_calls'] = 0;

function add_action( string $hook, $callback, int $priority = 10, int $accepted_args = 1 ): void {
    if ( 'plugins_loaded' === $hook ) {
        $callback();
    }
}

function add_filter( ...$args ): void {}
function plugins_url( string $path = '' ): string { return 'https://ticketbylamako.com/wp-content/plugins/' . ltrim( $path, '/' ); }
function __( string $message, string $domain = '' ): string { return $message; }
function home_url(): string { return $GLOBALS['tbl_home_url']; }
function sanitize_key( $value ): string { return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $value ) ); }
function wp_parse_url( string $url, int $component = -1 ) { return parse_url( $url, $component ); }
function esc_url_raw( $value ): string { return (string) $value; }
function wp_http_validate_url( string $url ): bool { return false !== filter_var( $url, FILTER_VALIDATE_URL ); }
function is_wp_error( $value ): bool { return $value instanceof WP_Error; }
function wp_safe_remote_post( string $url, array $args = [] ) {
    $GLOBALS['tbl_provider_calls']++;
    return new WP_Error( 'provider_call_forbidden', 'The behavioral harness must not call Orange.' );
}

function assert_true( bool $condition, string $message ): void {
    if ( ! $condition ) {
        throw new RuntimeException( $message );
    }
}

function set_server_value( string $name, ?string $value ): void {
    putenv( null === $value ? $name : $name . '=' . $value );
}

require dirname( __DIR__, 2 ) . '/scripts/tbl-orange-callback-guard.php';

assert_true( class_exists( 'TBL_Secure_Orange_Gateway' ), 'plugins_loaded must construct the secure fallback gateway' );
$gateway = new TBL_Secure_Orange_Gateway();

assert_true( ! array_key_exists( 'merchant_key', $gateway->form_fields ), 'merchant key must be absent from admin fields' );
assert_true( ! array_key_exists( 'consumer_key', $gateway->form_fields ), 'consumer key must be absent from admin fields' );
assert_true( '' === $gateway->merchant_key, 'legacy merchant option must not be loaded into the gateway' );
assert_true( '' === $gateway->consumer_key, 'legacy consumer option must not be loaded into the gateway' );

set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', null );
assert_true( '' === tbl_orange_payment_environment(), 'an absent payment environment must fail closed' );
set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', 'invalid' );
assert_true( '' === tbl_orange_payment_environment(), 'an invalid payment environment must fail closed' );
set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', 'test' );
assert_true( 'test' === tbl_orange_payment_environment(), 'the test environment must be accepted exactly' );
set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', 'production' );
assert_true( 'production' === tbl_orange_payment_environment(), 'the production environment must be accepted exactly' );

set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', 'test' );
set_server_value( 'TBL_ORANGE_MERCHANT_KEY', null );
set_server_value( 'TBL_ORANGE_CONSUMER_KEY', null );
assert_true( ! $gateway->tbl_security_ready(), 'missing server secrets must fail closed despite legacy options' );

set_server_value( 'TBL_ORANGE_MERCHANT_KEY', 'server-merchant' );
assert_true( ! $gateway->tbl_security_ready(), 'a partial server secret configuration must fail closed' );

set_server_value( 'TBL_ORANGE_CONSUMER_KEY', 'server-consumer' );
assert_true( $gateway->tbl_security_ready(), 'complete test secrets must be ready on the staging host' );
assert_true( tbl_orange_gateway_is_hardened( $gateway ), 'the complete staging gateway must be hardened' );

set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', 'production' );
assert_true( ! $gateway->tbl_security_ready(), 'production mode must fail on the staging host' );

$GLOBALS['tbl_home_url'] = 'https://ticketbylamako.com';
assert_true( $gateway->tbl_security_ready(), 'production mode must be ready on the production apex' );
set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', 'test' );
assert_true( ! $gateway->tbl_security_ready(), 'test mode must fail on the production host' );

$GLOBALS['tbl_home_url'] = 'https://example.com';
set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', 'production' );
assert_true( ! $gateway->tbl_security_ready(), 'unknown hosts must fail closed' );

$GLOBALS['tbl_home_url'] = 'https://ticketbylamako.com';
$gateway->api_token_url = 'https://example.com/oauth/v3/token';
assert_true( ! $gateway->tbl_security_ready(), 'a non-Orange token endpoint must fail closed' );
$gateway->api_token_url = 'https://api.orange.com/oauth/v3/token';
$gateway->api_payment_url = 'http://api.orange.com/orange-money-webpay/mg/v1/webpayment';
assert_true( ! $gateway->tbl_security_ready(), 'a non-HTTPS payment endpoint must fail closed' );

assert_true( 0 === $GLOBALS['tbl_provider_calls'], 'the behavioral gateway harness must perform zero provider calls' );

set_server_value( 'TBL_ORANGE_PAYMENT_ENVIRONMENT', null );
set_server_value( 'TBL_ORANGE_MERCHANT_KEY', null );
set_server_value( 'TBL_ORANGE_CONSUMER_KEY', null );

echo "Orange gateway guard harness: PASS; provider calls=0\n";
