<?php

declare( strict_types=1 );

define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'MINUTE_IN_SECONDS', 60 );

final class WP_Error {
    private string $code;
    private string $message;
    private array $data;

    public function __construct( string $code, string $message, array $data = [] ) {
        $this->code    = $code;
        $this->message = $message;
        $this->data    = $data;
    }

    public function get_error_code(): string {
        return $this->code;
    }

    public function get_error_message(): string {
        return $this->message;
    }

    public function get_error_data(): array {
        return $this->data;
    }
}

final class WP_REST_Request {
    private array $body;

    public function __construct( array $body ) {
        $this->body = $body;
    }

    public function get_body(): string {
        return (string) json_encode( $this->body );
    }

    public function get_header( string $name ): string {
        return strtolower( $name ) === 'content-type' ? 'application/json; charset=utf-8' : '';
    }

    public function get_json_params(): array {
        return $this->body;
    }

    public function get_param( string $name ) {
        return $this->body[ $name ] ?? null;
    }
}

class WC_Payment_Gateway {}

final class WC_Order {
    private int $id;
    private float $total;
    private string $currency;
    private string $payment_method = 'papi_paiement';
    private string $status = 'pending';
    private bool $paid = false;
    private array $meta = [];
    private int $created_at;
    public int $payment_complete_calls = 0;

    public function __construct( int $id, float $total = 1000, string $currency = 'MGA', ?int $created_at = null ) {
        $this->id         = $id;
        $this->total      = $total;
        $this->currency   = $currency;
        $this->created_at = $created_at ?? time();
    }

    public function get_id(): int {
        return $this->id;
    }

    public function get_total(): string {
        return (string) $this->total;
    }

    public function get_currency(): string {
        return $this->currency;
    }

    public function get_payment_method(): string {
        return $this->payment_method;
    }

    public function get_meta( string $key ) {
        return $this->meta[ $key ] ?? '';
    }

    public function update_meta_data( string $key, $value ): void {
        $this->meta[ $key ] = $value;
    }

    public function delete_meta_data( string $key ): void {
        unset( $this->meta[ $key ] );
    }

    public function get_date_created(): DateTimeImmutable {
        return ( new DateTimeImmutable() )->setTimestamp( $this->created_at );
    }

    public function is_paid(): bool {
        return $this->paid;
    }

    public function payment_complete( string $transaction_id ): void {
        assert_true( str_starts_with( $transaction_id, 'orange_' ), 'transaction id must be provider-scoped' );
        $this->payment_complete_calls++;
        $this->paid   = true;
        $this->status = 'processing';
    }

    public function has_status( string $status ): bool {
        return $this->status === $status;
    }

    public function get_status(): string {
        return $this->status;
    }

    public function update_status( string $status, string $note = '' ): void {
        $this->status = $status;
    }

    public function add_order_note( string $note ): void {}

    public function save(): void {}
}

final class TBL_Test_WPDB {
    public function prepare( string $query, string $value ): array {
        return [ $query, $value ];
    }

    public function get_var( array $prepared ): int {
        return str_contains( $prepared[0], 'GET_LOCK' ) ? 1 : 1;
    }
}

$GLOBALS['wpdb']                 = new TBL_Test_WPDB();
$GLOBALS['tbl_test_orders']      = [];
$GLOBALS['tbl_test_transients']  = [];

function sanitize_text_field( $value ): string {
    return trim( preg_replace( '/[\r\n\t]+/', '', (string) $value ) );
}

function sanitize_key( $value ): string {
    return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $value ) );
}

function wp_unslash( $value ) {
    return $value;
}

function wp_generate_uuid4(): string {
    return '11111111-2222-4333-8444-555555555555';
}

function wp_salt( string $scheme = 'auth' ): string {
    return 'test-salt-' . $scheme;
}

function absint( $value ): int {
    return abs( (int) $value );
}

function esc_url_raw( $value ): string {
    return (string) $value;
}

function get_transient( string $key ) {
    return $GLOBALS['tbl_test_transients'][ $key ] ?? false;
}

function set_transient( string $key, $value, int $ttl ): bool {
    $GLOBALS['tbl_test_transients'][ $key ] = $value;
    return true;
}

function is_wp_error( $value ): bool {
    return $value instanceof WP_Error;
}

function wc_get_orders( array $args ): array {
    $matches = [];
    foreach ( $GLOBALS['tbl_test_orders'] as $order ) {
        if ( isset( $args['payment_method'] ) && $order->get_payment_method() !== $args['payment_method'] ) {
            continue;
        }
        if ( (string) $order->get_meta( $args['meta_key'] ) === (string) $args['meta_value'] ) {
            $matches[] = $order;
        }
    }
    return array_slice( $matches, 0, (int) ( $args['limit'] ?? 10 ) );
}

function wc_get_order( int $order_id ) {
    return $GLOBALS['tbl_test_orders'][ $order_id ] ?? false;
}

function rest_ensure_response( array $response ): array {
    return $response;
}

function __( string $message, string $domain = '' ): string {
    return $message;
}

function add_action( ...$args ): void {}
function add_filter( ...$args ): void {}
function current_user_can( string $capability ): bool { return false; }
function get_current_user_id(): int { return 0; }

require dirname( __DIR__, 2 ) . '/scripts/tbl-orange-callback-guard.php';

function assert_true( bool $condition, string $message ): void {
    if ( ! $condition ) {
        throw new RuntimeException( $message );
    }
}

function assert_error( $value, string $code, int $status ): void {
    assert_true( $value instanceof WP_Error, 'expected WP_Error ' . $code );
    assert_true( $value->get_error_code() === $code, 'unexpected error code: ' . $value->get_error_code() );
    assert_true( (int) ( $value->get_error_data()['status'] ?? 0 ) === $status, 'unexpected HTTP status for ' . $code );
}

putenv( 'TBL_ORANGE_MERCHANT_KEY=test-merchant' );
putenv( 'TBL_ORANGE_CONSUMER_KEY' );
assert_true( 'partial' === tbl_orange_server_credentials_state(), 'a partial server secret configuration must be detected' );
assert_true(
    [ 'merchant' => '', 'consumer' => '' ] === tbl_orange_credentials(),
    'partial server secrets must fail closed'
);
putenv( 'TBL_ORANGE_CONSUMER_KEY=test-consumer' );
assert_true( 'complete' === tbl_orange_server_credentials_state(), 'both server secrets must be detected' );
assert_true(
    [ 'merchant' => 'test-merchant', 'consumer' => 'test-consumer' ] === tbl_orange_credentials(),
    'complete server secrets must be available to the gateway'
);
putenv( 'TBL_ORANGE_MERCHANT_KEY' );
putenv( 'TBL_ORANGE_CONSUMER_KEY' );
assert_true(
    [ 'merchant' => '', 'consumer' => '' ] === tbl_orange_credentials(),
    'missing server secrets must fail closed without a WordPress option fallback'
);

function add_secured_order( int $id, string $token, int $expires_at, float $total = 1000 ): WC_Order {
    $order = new WC_Order( $id, $total );
    $order->update_meta_data( '_tbl_papi_notif_token_hash', tbl_orange_token_hash( $token ) );
    $order->update_meta_data( '_tbl_orange_expected_amount', (int) $total );
    $order->update_meta_data( '_tbl_orange_expected_currency', 'MGA' );
    $order->update_meta_data( '_tbl_orange_expected_reference', 'tbl' . $id . 'reference' );
    $order->update_meta_data( '_tbl_orange_token_issued_at', time() - 10 );
    $order->update_meta_data( '_tbl_orange_token_expires_at', $expires_at );
    $GLOBALS['tbl_test_orders'][ $id ] = $order;
    return $order;
}

$token = '0123456789abcdef0123456789abcdef';
$order = add_secured_order( 101, $token, time() + 600 );
$first = tbl_orange_secure_webhook( new WP_REST_Request( [ 'notif_token' => $token, 'status' => 'SUCCESS' ] ) );
assert_true( true === $first['accepted'] && 'paid' === $first['status'], 'valid callback must complete the order' );
assert_true( 1 === $order->payment_complete_calls, 'payment_complete must run exactly once' );

$replay = tbl_orange_secure_webhook( new WP_REST_Request( [ 'notif_token' => $token, 'status' => 'SUCCESS' ] ) );
assert_true( true === $replay['idempotent_replay'], 'duplicate success must be idempotent' );
assert_true( 1 === $order->payment_complete_calls, 'duplicate success must not call payment_complete again' );

$downgrade = tbl_orange_secure_webhook( new WP_REST_Request( [ 'notif_token' => $token, 'status' => 'FAILED' ] ) );
assert_error( $downgrade, 'orange_callback_paid_downgrade_blocked', 409 );

$mismatch_token = 'abcdef0123456789abcdef0123456789';
$mismatch_order = add_secured_order( 102, $mismatch_token, time() + 600 );
$mismatch = tbl_orange_secure_webhook(
    new WP_REST_Request( [ 'notif_token' => $mismatch_token, 'status' => 'SUCCESS', 'amount' => 999 ] )
);
assert_error( $mismatch, 'orange_callback_amount_mismatch', 409 );
assert_true( ! $mismatch_order->is_paid(), 'amount mismatch must never complete the order' );
assert_true( 'REVIEW' === $mismatch_order->get_meta( '_tbl_payment_state' ), 'mismatch must enter manual review' );

$expired_token = 'fedcba9876543210fedcba9876543210';
$expired_order = add_secured_order( 103, $expired_token, time() - 1 );
$expired = tbl_orange_secure_webhook( new WP_REST_Request( [ 'notif_token' => $expired_token, 'status' => 'SUCCESS' ] ) );
assert_error( $expired, 'orange_callback_expired', 409 );
assert_true( ! $expired_order->is_paid(), 'expired callback must never complete the order' );

$failed_token = '8899aabbccddeeff0011223344556677';
$failed_order = add_secured_order( 105, $failed_token, time() + 600 );
$failed = tbl_orange_secure_webhook( new WP_REST_Request( [ 'notif_token' => $failed_token, 'status' => 'FAILED' ] ) );
assert_true( 'failed' === $failed['status'], 'failure callback must fail an unpaid order' );
$late_success = tbl_orange_secure_webhook( new WP_REST_Request( [ 'notif_token' => $failed_token, 'status' => 'SUCCESS' ] ) );
assert_error( $late_success, 'orange_callback_terminal_order', 409 );
assert_true( ! $failed_order->is_paid(), 'late success must not resurrect a failed order with restored stock' );

$legacy_token = '00112233445566778899aabbccddeeff';
$legacy_order = new WC_Order( 104 );
$legacy_order->update_meta_data( '_papi_notif_token', $legacy_token );
$legacy_order->update_meta_data( '_papi_pay_token', str_repeat( 'a', 64 ) );
$GLOBALS['tbl_test_orders'][104] = $legacy_order;
$legacy = tbl_orange_secure_webhook( new WP_REST_Request( [ 'notif_token' => $legacy_token, 'status' => 'COMPLETED' ] ) );
assert_true( 'paid' === $legacy['status'], 'recent legacy callback must migrate safely' );
assert_true( '' === $legacy_order->get_meta( '_papi_notif_token' ), 'legacy raw notification token must be erased' );
assert_true( '' !== $legacy_order->get_meta( '_tbl_papi_notif_token_hash' ), 'legacy notification token must be hashed' );

$unknown = tbl_orange_secure_webhook(
    new WP_REST_Request( [ 'notif_token' => 'ffeeddccbbaa99887766554433221100', 'status' => 'SUCCESS' ] )
);
assert_error( $unknown, 'orange_callback_order_not_found', 404 );

echo "Orange callback guard harness: PASS\n";
