<?php
/**
 * Server-side Apple Wallet and Google Wallet pass issuance.
 *
 * Private keys are read exclusively from paths declared in wp-config.php or
 * environment-specific bootstrap code. They must never live in this plugin.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! defined( 'LAMAKO_MOBILE_WALLET_LINK_TTL' ) ) {
    define( 'LAMAKO_MOBILE_WALLET_LINK_TTL', 10 * MINUTE_IN_SECONDS );
}

add_action( 'rest_api_init', 'lamako_mobile_v2_wallet_register_routes' );
add_action( 'template_redirect', 'lamako_mobile_v2_maybe_serve_public_apple_wallet_pass', 0 );
add_action( 'admin_post_lamako_mobile_apple_wallet', 'lamako_mobile_v2_serve_apple_wallet_pass' );
add_action( 'admin_post_nopriv_lamako_mobile_apple_wallet', 'lamako_mobile_v2_serve_apple_wallet_pass' );

function lamako_mobile_v2_wallet_register_routes() {
    register_rest_route( 'lamako-mobile/v2', '/orders/(?P<order_id>\d+)/tickets/(?P<ticket_id>\d+)/wallet/(?P<platform>apple|google)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_create_wallet_link_route',
        'permission_callback' => 'lamako_mobile_v2_require_user',
        'args'                => [
            'order_id'  => [ 'sanitize_callback' => 'absint' ],
            'ticket_id' => [ 'sanitize_callback' => 'absint' ],
            'platform'  => [ 'sanitize_callback' => 'sanitize_key' ],
        ],
    ] );
}

function lamako_mobile_v2_wallet_path_is_private( $path ) {
    $real = realpath( (string) $path );
    if ( ! $real || ! is_readable( $real ) ) {
        return false;
    }

    $web_root = realpath( ABSPATH );
    if ( ! $web_root ) {
        return true;
    }

    $real_normalized = wp_normalize_path( $real );
    $web_normalized  = trailingslashit( wp_normalize_path( $web_root ) );
    return strpos( $real_normalized, $web_normalized ) !== 0;
}

function lamako_mobile_v2_apple_wallet_is_configured() {
    if ( ! extension_loaded( 'openssl' ) || ! class_exists( 'ZipArchive' ) ) {
        return false;
    }

    $required_constants = [
        'LAMAKO_WALLET_APPLE_PASS_TYPE_ID',
        'LAMAKO_WALLET_APPLE_TEAM_ID',
        'LAMAKO_WALLET_APPLE_CERT_PATH',
        'LAMAKO_WALLET_APPLE_KEY_PATH',
        'LAMAKO_WALLET_APPLE_WWDR_PATH',
        'LAMAKO_WALLET_ICON_PATH',
        'LAMAKO_WALLET_ICON_2X_PATH',
    ];
    foreach ( $required_constants as $constant ) {
        if ( ! defined( $constant ) || constant( $constant ) === '' ) {
            return false;
        }
    }

    return lamako_mobile_v2_wallet_path_is_private( LAMAKO_WALLET_APPLE_CERT_PATH )
        && lamako_mobile_v2_wallet_path_is_private( LAMAKO_WALLET_APPLE_KEY_PATH )
        && lamako_mobile_v2_wallet_path_is_private( LAMAKO_WALLET_APPLE_WWDR_PATH )
        && is_readable( LAMAKO_WALLET_ICON_PATH )
        && is_readable( LAMAKO_WALLET_ICON_2X_PATH );
}

function lamako_mobile_v2_google_wallet_is_configured() {
    return extension_loaded( 'openssl' )
        && defined( 'LAMAKO_WALLET_GOOGLE_ISSUER_ID' )
        && preg_match( '/^\d+$/', (string) LAMAKO_WALLET_GOOGLE_ISSUER_ID )
        && defined( 'LAMAKO_WALLET_GOOGLE_SERVICE_ACCOUNT_PATH' )
        && lamako_mobile_v2_wallet_path_is_private( LAMAKO_WALLET_GOOGLE_SERVICE_ACCOUNT_PATH );
}

function lamako_mobile_v2_wallet_availability() {
    static $availability = null;
    if ( is_array( $availability ) ) {
        return $availability;
    }

    $availability = [
        'apple' => lamako_mobile_v2_apple_wallet_is_configured(),
        'google'=> lamako_mobile_v2_google_wallet_is_configured(),
    ];

    return $availability;
}

function lamako_mobile_v2_wallet_ticket_context( WC_Order $order, $ticket_id ) {
    if ( ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
        return new WP_Error( 'lamako_wallet_order_not_paid', 'Wallet passes require a paid order.', [ 'status' => 409 ] );
    }

    foreach ( lamako_mobile_v2_get_tickets_for_order( $order ) as $ticket ) {
        if ( absint( $ticket['instanceId'] ?? 0 ) === absint( $ticket_id ) ) {
            if ( trim( (string) ( $ticket['ticketCode'] ?? '' ) ) === '' ) {
                return new WP_Error( 'lamako_wallet_ticket_code_missing', 'Ticket QR code is unavailable.', [ 'status' => 409 ] );
            }
            return $ticket;
        }
    }

    return new WP_Error( 'lamako_wallet_ticket_not_found', 'Ticket not found for this order.', [ 'status' => 404 ] );
}

function lamako_mobile_v2_create_wallet_link_route( WP_REST_Request $request ) {
    $order = wc_get_order( absint( $request['order_id'] ) );
    if ( ! $order ) {
        return new WP_Error( 'lamako_wallet_order_not_found', 'Order not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_wallet_forbidden', 'You cannot access this ticket.', [ 'status' => 403 ] );
    }

    $ticket = lamako_mobile_v2_wallet_ticket_context( $order, absint( $request['ticket_id'] ) );
    if ( is_wp_error( $ticket ) ) {
        return $ticket;
    }

    $platform    = sanitize_key( $request['platform'] );
    $availability = lamako_mobile_v2_wallet_availability();
    if ( empty( $availability[ $platform ] ) ) {
        return new WP_Error( 'lamako_wallet_not_configured', 'This wallet provider is not configured.', [ 'status' => 503 ] );
    }

    if ( $platform === 'google' ) {
        $url = lamako_mobile_v2_google_wallet_url( $order, $ticket );
        if ( is_wp_error( $url ) ) {
            return $url;
        }
        return rest_ensure_response( [
            'platform'  => 'google',
            'url'       => $url,
            'expiresAt' => null,
        ] );
    }

    $pass = lamako_mobile_v2_build_apple_wallet_pass( $order, $ticket );
    if ( is_wp_error( $pass ) ) {
        return $pass;
    }

    $token = wp_generate_password( 48, false, false );
    $expires_at = time() + (int) LAMAKO_MOBILE_WALLET_LINK_TTL;
    set_transient( 'lamako_apple_wallet_' . hash( 'sha256', $token ), [
        'user_id'   => get_current_user_id(),
        'order_id'  => $order->get_id(),
        'ticket_id' => absint( $ticket['instanceId'] ?? 0 ),
        'pass'      => base64_encode( $pass ),
        'expires_at'=> $expires_at,
    ], (int) LAMAKO_MOBILE_WALLET_LINK_TTL );

    return rest_ensure_response( [
        'platform'  => 'apple',
        'url'       => add_query_arg( [
            'lamako_wallet_pass' => $token,
        ], home_url( '/' ) ),
        'expiresAt' => gmdate( 'c', $expires_at ),
    ] );
}

function lamako_mobile_v2_maybe_serve_public_apple_wallet_pass() {
    if ( empty( $_GET['lamako_wallet_pass'] ) ) {
        return;
    }
    lamako_mobile_v2_serve_apple_wallet_pass();
}

function lamako_mobile_v2_serve_apple_wallet_pass() {
    $raw_token = $_GET['lamako_wallet_pass'] ?? $_GET['token'] ?? '';
    $token = sanitize_text_field( wp_unslash( $raw_token ) );
    if ( $token === '' || strlen( $token ) > 96 ) {
        status_header( 400 );
        exit;
    }

    $record = get_transient( 'lamako_apple_wallet_' . hash( 'sha256', $token ) );
    if ( ! is_array( $record ) || absint( $record['expires_at'] ?? 0 ) < time() ) {
        status_header( 410 );
        nocache_headers();
        exit;
    }

    $order = wc_get_order( absint( $record['order_id'] ?? 0 ) );
    if ( ! $order ) {
        status_header( 404 );
        exit;
    }
    $ticket = lamako_mobile_v2_wallet_ticket_context( $order, absint( $record['ticket_id'] ?? 0 ) );
    if ( is_wp_error( $ticket ) ) {
        status_header( (int) ( $ticket->get_error_data()['status'] ?? 403 ) );
        exit;
    }

    $pass = base64_decode( (string) ( $record['pass'] ?? '' ), true );
    if ( ! is_string( $pass ) || $pass === '' ) {
        $pass = lamako_mobile_v2_build_apple_wallet_pass( $order, $ticket );
        if ( is_wp_error( $pass ) ) {
            error_log( '[Lamako Wallet] Apple pass generation failed: ' . sanitize_text_field( $pass->get_error_code() ) );
            status_header( 503 );
            exit;
        }
    }

    // Wallet may fetch the pass more than once while validating and importing it.
    // Keep the short-lived token reusable until its normal transient expiry.
    while ( ob_get_level() > 0 ) {
        ob_end_clean();
    }

    nocache_headers();
    header( 'Content-Type: application/vnd.apple.pkpass' );
    header( 'Content-Disposition: attachment; filename="ticketbylamako-' . absint( $ticket['instanceId'] ) . '.pkpass"' );
    header( 'X-Content-Type-Options: nosniff' );
    header( 'Content-Length: ' . strlen( $pass ) );
    if ( strtoupper( (string) ( $_SERVER['REQUEST_METHOD'] ?? 'GET' ) ) === 'HEAD' ) {
        exit;
    }
    echo $pass; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Signed binary pass.
    exit;
}

function lamako_mobile_v2_wallet_localized_string( $value, $language = 'fr-FR' ) {
    return [
        'defaultValue' => [
            'language' => $language,
            'value'    => wp_strip_all_tags( (string) $value ),
        ],
    ];
}

function lamako_mobile_v2_wallet_iso_date( $value ) {
    if ( ! is_scalar( $value ) || trim( (string) $value ) === '' ) {
        return '';
    }
    try {
        return ( new DateTimeImmutable( (string) $value, wp_timezone() ) )->format( DATE_ATOM );
    } catch ( Exception $exception ) {
        return '';
    }
}

function lamako_mobile_v2_wallet_holder_name( WC_Order $order ) {
    $name = trim( $order->get_formatted_billing_full_name() );
    return $name !== '' ? $name : $order->get_billing_email();
}

function lamako_mobile_v2_wallet_local_attachment_path( $url, $event_id = 0 ) {
    $attachment_id = get_post_thumbnail_id( absint( $event_id ) );
    if ( $attachment_id <= 0 ) {
        $attachment_id = attachment_url_to_postid( esc_url_raw( (string) $url ) );
    }
    if ( $attachment_id <= 0 ) {
        return '';
    }

    $path = get_attached_file( $attachment_id );
    $real = $path ? realpath( $path ) : false;
    $uploads = wp_get_upload_dir();
    $uploads_root = ! empty( $uploads['basedir'] ) ? realpath( $uploads['basedir'] ) : false;
    if ( ! $real || ! $uploads_root || ! is_readable( $real ) ) {
        return '';
    }

    $normalized_real = wp_normalize_path( $real );
    $normalized_root = trailingslashit( wp_normalize_path( $uploads_root ) );
    return strpos( $normalized_real, $normalized_root ) === 0 ? $real : '';
}

function lamako_mobile_v2_wallet_brand_logo_url() {
    if ( defined( 'LAMAKO_WALLET_LOGO_URL' ) ) {
        $configured = esc_url_raw( (string) LAMAKO_WALLET_LOGO_URL );
        if ( $configured !== '' ) {
            return $configured;
        }
    }

    $custom_logo_id = absint( get_theme_mod( 'custom_logo' ) );
    if ( $custom_logo_id > 0 ) {
        $custom_logo = wp_get_attachment_image_url( $custom_logo_id, 'full' );
        if ( is_string( $custom_logo ) && $custom_logo !== '' ) {
            return esc_url_raw( $custom_logo );
        }
    }

    $bundled_logo = dirname( __DIR__ ) . '/assets/wallet-logo.png';
    if ( is_readable( $bundled_logo ) ) {
        return esc_url_raw(
            set_url_scheme(
                plugins_url( 'assets/wallet-logo.png', dirname( __DIR__ ) . '/lamako-mobile-api.php' ),
                'https'
            )
        );
    }

    return esc_url_raw( (string) get_site_icon_url( 512 ) );
}

function lamako_mobile_v2_wallet_brand_logo_path() {
    if ( defined( 'LAMAKO_WALLET_LOGO_PATH' ) && is_readable( LAMAKO_WALLET_LOGO_PATH ) ) {
        $configured = realpath( LAMAKO_WALLET_LOGO_PATH );
        if ( $configured ) {
            return $configured;
        }
    }

    $attachment = lamako_mobile_v2_wallet_local_attachment_path(
        lamako_mobile_v2_wallet_brand_logo_url()
    );
    if ( $attachment !== '' ) {
        return $attachment;
    }

    $bundled_logo = dirname( __DIR__ ) . '/assets/wallet-logo.png';
    if ( is_readable( $bundled_logo ) ) {
        $bundled = realpath( $bundled_logo );
        if ( $bundled ) {
            return $bundled;
        }
    }

    foreach ( [ 'LAMAKO_WALLET_ICON_2X_PATH', 'LAMAKO_WALLET_ICON_PATH' ] as $constant ) {
        if ( defined( $constant ) && is_readable( constant( $constant ) ) ) {
            $fallback = realpath( constant( $constant ) );
            if ( $fallback ) {
                return $fallback;
            }
        }
    }

    return '';
}

function lamako_mobile_v2_wallet_create_logo( $source, $destination, $width, $height ) {
    $editor = wp_get_image_editor( $source );
    if ( is_wp_error( $editor ) ) {
        return false;
    }

    $resized = $editor->resize( absint( $width ), absint( $height ), false );
    if ( is_wp_error( $resized ) ) {
        return false;
    }
    $editor->set_quality( 92 );
    $saved = $editor->save( $destination, 'image/png' );
    return ! is_wp_error( $saved ) && is_file( $destination );
}

function lamako_mobile_v2_wallet_create_strip( $source, $destination, $width, $height ) {
    $editor = wp_get_image_editor( $source );
    if ( is_wp_error( $editor ) ) {
        return false;
    }

    $resized = $editor->resize( absint( $width ), absint( $height ), true );
    if ( is_wp_error( $resized ) ) {
        return false;
    }
    // Keep the pass fast to download and present. PNG quality maps to
    // compression in WordPress image editors; 82 preserves event artwork.
    $editor->set_quality( 82 );
    $saved = $editor->save( $destination, 'image/png' );
    return ! is_wp_error( $saved ) && is_file( $destination );
}

function lamako_mobile_v2_apple_pass_payload( WC_Order $order, array $ticket ) {
    $event_name = wp_strip_all_tags( (string) ( $ticket['eventName'] ?? $ticket['productName'] ?? 'Événement' ) );
    $event_date = lamako_mobile_v2_wallet_iso_date( $ticket['eventDate'] ?? '' );
    $event_end  = lamako_mobile_v2_wallet_iso_date( $ticket['eventEndDate'] ?? '' );
    $location   = wp_strip_all_tags( (string) ( $ticket['eventLocation'] ?? '' ) );
    $seat       = wp_strip_all_tags( (string) ( $ticket['seatLabel'] ?? '' ) );
    $ticket_code= sanitize_text_field( (string) ( $ticket['ticketCode'] ?? '' ) );
    $checkin    = lamako_mobile_v2_ticket_checkin_state( absint( $ticket['instanceId'] ?? 0 ) );

    $secondary = [];
    if ( $event_date !== '' ) {
        $secondary[] = [ 'key' => 'date', 'label' => 'DATE', 'value' => $event_date, 'dateStyle' => 'PKDateStyleMedium', 'timeStyle' => 'PKDateStyleShort' ];
    }
    if ( $location !== '' ) {
        $secondary[] = [ 'key' => 'venue', 'label' => 'LIEU', 'value' => $location ];
    }

    $auxiliary = [];
    if ( $seat !== '' ) {
        $auxiliary[] = [ 'key' => 'seat', 'label' => 'PLACE', 'value' => $seat ];
    }
    $auxiliary[] = [ 'key' => 'order', 'label' => 'COMMANDE', 'value' => '#' . $order->get_order_number() ];

    $payload = [
        'formatVersion'       => 1,
        'passTypeIdentifier'  => (string) LAMAKO_WALLET_APPLE_PASS_TYPE_ID,
        'serialNumber'        => 'ticket-' . absint( $ticket['instanceId'] ?? 0 ),
        'teamIdentifier'      => (string) LAMAKO_WALLET_APPLE_TEAM_ID,
        'organizationName'    => 'TicketByLamako',
        'description'         => 'Billet ' . $event_name,
        'logoText'            => 'TicketByLamako',
        'groupingIdentifier'  => 'event-' . absint( $ticket['eventId'] ?? 0 ),
        'suppressStripShine'  => true,
        'foregroundColor'     => 'rgb(255, 255, 255)',
        'backgroundColor'     => 'rgb(12, 12, 20)',
        'labelColor'          => 'rgb(247, 184, 45)',
        'associatedStoreIdentifiers' => [ 6793957219 ],
        'appLaunchURL'        => add_query_arg(
            'ticketId',
            absint( $ticket['instanceId'] ?? 0 ),
            'ticketbylamako://ticket/' . $order->get_id()
        ),
        'userInfo'            => [
            'orderId'  => $order->get_id(),
            'ticketId' => absint( $ticket['instanceId'] ?? 0 ),
        ],
        'voided'              => ! empty( $checkin['checkedIn'] ),
        'barcodes'            => [ [
            'format'          => 'PKBarcodeFormatQR',
            'message'         => $ticket_code,
            'messageEncoding' => 'iso-8859-1',
            'altText'         => $ticket_code,
        ] ],
        'eventTicket'         => [
            'primaryFields'   => [ [ 'key' => 'event', 'label' => 'ÉVÉNEMENT', 'value' => $event_name ] ],
            'secondaryFields' => $secondary,
            'auxiliaryFields' => $auxiliary,
            'backFields'      => [
                [ 'key' => 'holder', 'label' => 'TITULAIRE', 'value' => lamako_mobile_v2_wallet_holder_name( $order ) ],
                [ 'key' => 'ticket', 'label' => 'BILLET', 'value' => wp_strip_all_tags( (string) ( $ticket['productName'] ?? '' ) ) ],
                [ 'key' => 'support', 'label' => 'ASSISTANCE', 'value' => 'https://www.ticketbylamako.com/contact/' ],
            ],
        ],
    ];
    if ( $event_date !== '' ) {
        $payload['relevantDate'] = $event_date;
    }
    if ( $event_end !== '' ) {
        $payload['expirationDate'] = $event_end;
    }

    return $payload;
}

function lamako_mobile_v2_build_apple_wallet_pass( WC_Order $order, array $ticket ) {
    if ( ! lamako_mobile_v2_apple_wallet_is_configured() ) {
        return new WP_Error( 'lamako_wallet_apple_not_configured', 'Apple Wallet is not configured.' );
    }

    $base = trailingslashit( get_temp_dir() ) . 'lamako-pass-' . wp_generate_uuid4();
    if ( ! wp_mkdir_p( $base ) ) {
        return new WP_Error( 'lamako_wallet_temp_failed', 'Unable to create the pass workspace.' );
    }

    $cleanup = function() use ( $base ) {
        foreach ( glob( $base . '/*' ) ?: [] as $file ) {
            @unlink( $file );
        }
        @rmdir( $base );
    };

    $payload = wp_json_encode( lamako_mobile_v2_apple_pass_payload( $order, $ticket ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
    if ( ! is_string( $payload ) || file_put_contents( $base . '/pass.json', $payload ) === false ) {
        $cleanup();
        return new WP_Error( 'lamako_wallet_pass_json_failed', 'Unable to create pass.json.' );
    }

    $icon_path    = realpath( LAMAKO_WALLET_ICON_PATH );
    $icon_2x_path = realpath( LAMAKO_WALLET_ICON_2X_PATH );
    if ( ! $icon_path || ! $icon_2x_path || ! copy( $icon_path, $base . '/icon.png' ) || ! copy( $icon_2x_path, $base . '/icon@2x.png' ) ) {
        $cleanup();
        return new WP_Error( 'lamako_wallet_icon_failed', 'Unable to prepare the Apple Wallet icon.' );
    }
    if ( defined( 'LAMAKO_WALLET_ICON_3X_PATH' ) && is_readable( LAMAKO_WALLET_ICON_3X_PATH ) ) {
        $icon_3x_path = realpath( LAMAKO_WALLET_ICON_3X_PATH );
        if ( ! $icon_3x_path || ! copy( $icon_3x_path, $base . '/icon@3x.png' ) ) {
            $cleanup();
            return new WP_Error( 'lamako_wallet_icon_3x_failed', 'Unable to prepare the Apple Wallet 3x icon.' );
        }
    }
    $logo_path = lamako_mobile_v2_wallet_brand_logo_path();
    if ( $logo_path !== '' ) {
        $logo_sizes = [
            'logo.png'    => [ 160, 50 ],
            'logo@2x.png' => [ 320, 100 ],
        ];
        foreach ( $logo_sizes as $filename => $size ) {
            if ( ! lamako_mobile_v2_wallet_create_logo( $logo_path, $base . '/' . $filename, $size[0], $size[1] ) ) {
                $cleanup();
                return new WP_Error( 'lamako_wallet_logo_failed', 'Unable to prepare the Apple Wallet logo.' );
            }
        }
    }

    $event_image = lamako_mobile_v2_wallet_local_attachment_path(
        $ticket['eventImage'] ?? '',
        absint( $ticket['eventId'] ?? 0 )
    );
    if ( $event_image !== '' ) {
        // Apple event-ticket strips use a 375x98 point canvas. Supplying the
        // matching 1x/2x assets avoids oversized or rejected pass packages.
        $strip_sizes = [
            'strip.png'    => [ 375, 98 ],
            'strip@2x.png' => [ 750, 196 ],
        ];
        foreach ( $strip_sizes as $filename => $size ) {
            if ( ! lamako_mobile_v2_wallet_create_strip( $event_image, $base . '/' . $filename, $size[0], $size[1] ) ) {
                @unlink( $base . '/' . $filename );
            }
        }
    }

    $manifest = [];
    foreach ( glob( $base . '/*' ) ?: [] as $file ) {
        if ( is_file( $file ) ) {
            $manifest[ basename( $file ) ] = sha1_file( $file );
        }
    }
    file_put_contents( $base . '/manifest.json', wp_json_encode( $manifest, JSON_UNESCAPED_SLASHES ) );

    $cert = openssl_x509_read( file_get_contents( realpath( LAMAKO_WALLET_APPLE_CERT_PATH ) ) );
    $password = defined( 'LAMAKO_WALLET_APPLE_KEY_PASSWORD' ) ? (string) LAMAKO_WALLET_APPLE_KEY_PASSWORD : '';
    $key = openssl_pkey_get_private( file_get_contents( realpath( LAMAKO_WALLET_APPLE_KEY_PATH ) ), $password );
    if ( ! $cert || ! $key ) {
        $cleanup();
        return new WP_Error( 'lamako_wallet_apple_key_invalid', 'Apple Wallet certificate or key is invalid.' );
    }

    $signed = false;
    if ( function_exists( 'openssl_cms_sign' ) && defined( 'OPENSSL_ENCODING_DER' ) ) {
        $signed = openssl_cms_sign(
            $base . '/manifest.json',
            $base . '/signature',
            $cert,
            $key,
            [],
            OPENSSL_CMS_BINARY | OPENSSL_CMS_DETACHED,
            OPENSSL_ENCODING_DER,
            realpath( LAMAKO_WALLET_APPLE_WWDR_PATH )
        );
    }
    if ( ! $signed ) {
        $smime = $base . '/signature.smime';
        $signed = openssl_pkcs7_sign(
            $base . '/manifest.json',
            $smime,
            $cert,
            $key,
            [],
            PKCS7_BINARY | PKCS7_DETACHED,
            realpath( LAMAKO_WALLET_APPLE_WWDR_PATH )
        );
        if ( $signed ) {
            $contents = file_get_contents( $smime );
            if ( preg_match( '/Content-Transfer-Encoding:\s*base64\s+([A-Za-z0-9+\/=\r\n]+)/i', $contents, $matches ) ) {
                $signature = base64_decode( preg_replace( '/\s+/', '', $matches[1] ), true );
                $signed = is_string( $signature ) && file_put_contents( $base . '/signature', $signature ) !== false;
            } else {
                $signed = false;
            }
            @unlink( $smime );
        }
    }
    if ( ! $signed ) {
        $cleanup();
        return new WP_Error( 'lamako_wallet_apple_sign_failed', 'Unable to sign the Apple Wallet pass.' );
    }

    $zip_path = $base . '/pass.pkpass';
    $zip = new ZipArchive();
    if ( $zip->open( $zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE ) !== true ) {
        $cleanup();
        return new WP_Error( 'lamako_wallet_zip_failed', 'Unable to package the Apple Wallet pass.' );
    }
    foreach ( [ 'pass.json', 'icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'strip.png', 'strip@2x.png', 'manifest.json', 'signature' ] as $filename ) {
        if ( is_file( $base . '/' . $filename ) ) {
            $zip->addFile( $base . '/' . $filename, $filename );
        }
    }
    $zip->close();
    $binary = file_get_contents( $zip_path );
    $cleanup();

    return is_string( $binary ) && $binary !== ''
        ? $binary
        : new WP_Error( 'lamako_wallet_pass_empty', 'The Apple Wallet pass is empty.' );
}

function lamako_mobile_v2_base64url_encode( $value ) {
    return rtrim( strtr( base64_encode( $value ), '+/', '-_' ), '=' );
}

function lamako_mobile_v2_google_wallet_id_suffix( $value ) {
    $value = preg_replace( '/[^A-Za-z0-9._-]/', '_', (string) $value );
    return trim( $value, '._-' );
}

function lamako_mobile_v2_google_wallet_url( WC_Order $order, array $ticket ) {
    if ( ! lamako_mobile_v2_google_wallet_is_configured() ) {
        return new WP_Error( 'lamako_wallet_google_not_configured', 'Google Wallet is not configured.', [ 'status' => 503 ] );
    }

    $credentials = json_decode( file_get_contents( realpath( LAMAKO_WALLET_GOOGLE_SERVICE_ACCOUNT_PATH ) ), true );
    if ( ! is_array( $credentials ) || empty( $credentials['client_email'] ) || empty( $credentials['private_key'] ) ) {
        return new WP_Error( 'lamako_wallet_google_key_invalid', 'Google Wallet service account is invalid.', [ 'status' => 503 ] );
    }

    $issuer       = (string) LAMAKO_WALLET_GOOGLE_ISSUER_ID;
    $event_id     = absint( $ticket['eventId'] ?? 0 );
    $ticket_id    = absint( $ticket['instanceId'] ?? 0 );
    $event_name   = wp_strip_all_tags( (string) ( $ticket['eventName'] ?? $ticket['productName'] ?? 'Événement' ) );
    $location     = wp_strip_all_tags( (string) ( $ticket['eventLocation'] ?? '' ) );
    $ticket_code  = sanitize_text_field( (string) ( $ticket['ticketCode'] ?? '' ) );
    // Version the visual contract so previously created Google classes do not
    // keep serving an obsolete layout when branding assets change.
    $template_version = 'v2';
    $class_id     = $issuer . '.' . lamako_mobile_v2_google_wallet_id_suffix( 'event_' . $event_id . '_' . $template_version );
    $object_id    = $issuer . '.' . lamako_mobile_v2_google_wallet_id_suffix( 'ticket_' . $ticket_id . '_' . $template_version );
    $event_date   = lamako_mobile_v2_wallet_iso_date( $ticket['eventDate'] ?? '' );
    $event_end    = lamako_mobile_v2_wallet_iso_date( $ticket['eventEndDate'] ?? '' );

    $class = [
        'id'           => $class_id,
        'issuerName'   => 'TicketByLamako',
        'eventName'    => lamako_mobile_v2_wallet_localized_string( $event_name ),
        'reviewStatus' => 'UNDER_REVIEW',
    ];
    $brand_logo = lamako_mobile_v2_wallet_brand_logo_url();
    if ( $brand_logo !== '' ) {
        $class['logo'] = [
            'sourceUri'          => [ 'uri' => $brand_logo ],
            'contentDescription' => lamako_mobile_v2_wallet_localized_string( 'Logo TicketByLamako' ),
        ];
    }
    if ( $location !== '' ) {
        $class['venue'] = [
            'name'    => lamako_mobile_v2_wallet_localized_string( $location ),
            'address' => lamako_mobile_v2_wallet_localized_string( $location ),
        ];
    }
    if ( $event_date !== '' ) {
        $class['dateTime'] = [ 'start' => $event_date ];
        if ( $event_end !== '' ) {
            $class['dateTime']['end'] = $event_end;
        }
    }

    $object = [
        'id'               => $object_id,
        'classId'          => $class_id,
        'state'            => 'ACTIVE',
        'ticketHolderName' => lamako_mobile_v2_wallet_holder_name( $order ),
        'ticketNumber'     => $ticket_code,
        'barcode'          => [
            'type'          => 'QR_CODE',
            'value'         => $ticket_code,
            'alternateText' => $ticket_code,
        ],
    ];
    $seat = wp_strip_all_tags( (string) ( $ticket['seatLabel'] ?? '' ) );
    if ( $seat !== '' ) {
        $object['seatInfo'] = [ 'seat' => lamako_mobile_v2_wallet_localized_string( $seat ) ];
    }
    $event_image = esc_url_raw( (string) ( $ticket['eventImage'] ?? '' ) );
    if ( $event_image !== '' ) {
        $object['heroImage'] = [
            'sourceUri' => [ 'uri' => $event_image ],
            'contentDescription' => lamako_mobile_v2_wallet_localized_string( 'Affiche de ' . $event_name ),
        ];
    }

    $claims = [
        'iss'     => sanitize_email( $credentials['client_email'] ),
        'aud'     => 'google',
        'typ'     => 'savetowallet',
        'iat'     => time(),
        'origins' => [ wp_parse_url( home_url(), PHP_URL_HOST ) ],
        'payload' => [
            'eventTicketClasses' => [ $class ],
            'eventTicketObjects' => [ $object ],
        ],
    ];
    $header = [ 'alg' => 'RS256', 'typ' => 'JWT' ];
    $unsigned = lamako_mobile_v2_base64url_encode( wp_json_encode( $header ) ) . '.'
        . lamako_mobile_v2_base64url_encode( wp_json_encode( $claims, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );
    $signature = '';
    if ( ! openssl_sign( $unsigned, $signature, $credentials['private_key'], OPENSSL_ALGO_SHA256 ) ) {
        return new WP_Error( 'lamako_wallet_google_sign_failed', 'Unable to sign the Google Wallet pass.', [ 'status' => 503 ] );
    }

    return 'https://pay.google.com/gp/v/save/' . $unsigned . '.' . lamako_mobile_v2_base64url_encode( $signature );
}
