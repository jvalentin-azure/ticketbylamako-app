<?php
/**
 * Plugin Name: Lamako Rewards API
 * Plugin URI: https://www.ticketbylamako.com
 * Description: REST API for LamakoRewards loyalty program - points, tiers, referrals, redemption.
 * Version: 3.0.0
 * Author: Lamako Events
 * Author URI: https://www.ticketbylamako.com
 * License: GPL v2 or later
 * Requires Plugins: mycred
 *
 * Endpoints:
 * - GET  /wp-json/lamako-rewards/v1/balance?user_id={id}
 * - GET  /wp-json/lamako-rewards/v1/history?user_id={id}&limit={n}
 * - GET  /wp-json/lamako-rewards/v1/user-by-email?email={email}
 * - POST /wp-json/lamako-rewards/v1/redeem
 * - POST /wp-json/lamako-rewards/v1/referral/register
 * - POST /wp-json/lamako-rewards/v1/referral/validate
 * - GET  /wp-json/lamako-rewards/v1/referral/code?user_id={id}
 *
 * Authentication: JWT token (from mobile app) OR API key (legacy)
 * Rate Limiting: 60 requests per minute per IP
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ============================================================
// CONFIGURATION
// ============================================================

define( 'LR_API_KEY', defined( 'LAMAKO_REWARDS_API_KEY' ) ? LAMAKO_REWARDS_API_KEY : '' );
define( 'LR_RATE_LIMIT', 60 ); // requests per minute
define( 'LR_RATE_WINDOW', 60 ); // seconds

// Tier thresholds (lifetime points) - based on Otayo/Ticketmaster benchmarks
define( 'LR_TIER_FAN', 0 );
define( 'LR_TIER_SILVER', 500 );
define( 'LR_TIER_GOLD', 2000 );
define( 'LR_TIER_PLATINUM', 5000 );
define( 'LR_TIER_DIAMOND', 10000 );

// Redemption minimum: 750 pts lifetime = 750 000 Ar spent (independent of tier)
define( 'LR_REDEMPTION_MIN_LIFETIME', 750 );

// Points configuration
define( 'LR_POINTS_PER_1000AR', 1 );
define( 'LR_REGISTRATION_BONUS', 100 );
define( 'LR_PROFILE_BONUS', 100 );
define( 'LR_LOGIN_BONUS', 2 );
define( 'LR_FIRST_PURCHASE_BONUS', 200 );
define( 'LR_ATTENDANCE_BONUS', 10 );
define( 'LR_REVIEW_BONUS', 15 );
define( 'LR_REFERRAL_BONUS', 75 );
define( 'LR_REFEREE_BONUS', 25 );
define( 'LR_BIRTHDAY_BONUS', 200 );
define( 'LR_SHARE_BONUS', 20 );
define( 'LR_NEWSLETTER_BONUS', 100 );

// Tier multipliers (conservative: only high tiers get bonus)
define( 'LR_MULTIPLIER_FAN', 1.0 );
define( 'LR_MULTIPLIER_SILVER', 1.0 );
define( 'LR_MULTIPLIER_GOLD', 1.25 );
define( 'LR_MULTIPLIER_PLATINUM', 1.5 );
define( 'LR_MULTIPLIER_DIAMOND', 2.0 );

define( 'LR_CONFIG_OPTION', 'lamako_rewards_config_v1' );
define( 'LR_AUDIT_LOG_OPTION', 'lamako_rewards_audit_log_v1' );

function lr_rewards_array_merge_recursive_distinct( array $base, array $override ) {
    foreach ( $override as $key => $value ) {
        if ( is_array( $value ) && isset( $base[ $key ] ) && is_array( $base[ $key ] ) ) {
            $base[ $key ] = lr_rewards_array_merge_recursive_distinct( $base[ $key ], $value );
        } else {
            $base[ $key ] = $value;
        }
    }

    return $base;
}

function lr_rewards_default_config() {
    return array(
        'version' => 1,
        'program' => array(
            'enabled' => true,
            'signup_bonus_points' => LR_REGISTRATION_BONUS,
            'earn_rate' => array(
                'points' => LR_POINTS_PER_1000AR,
                'amount_ariary' => 1000,
            ),
            'minimum_redeem_points' => LR_REDEMPTION_MIN_LIFETIME,
            'redemption_options' => array(
                array( 'points' => 1000, 'amount_ariary' => 20000 ),
                array( 'points' => 2000, 'amount_ariary' => 40000 ),
            ),
            'referral' => array(
                'referrer_points' => LR_REFERRAL_BONUS,
                'referred_points' => LR_REFEREE_BONUS,
            ),
            'earning_actions' => array(
                'profile_completed_points' => LR_PROFILE_BONUS,
                'daily_login_points' => LR_LOGIN_BONUS,
                'first_purchase_points' => LR_FIRST_PURCHASE_BONUS,
                'event_attendance_points' => LR_ATTENDANCE_BONUS,
                'review_points' => LR_REVIEW_BONUS,
                'social_share_points' => LR_SHARE_BONUS,
                'newsletter_points' => LR_NEWSLETTER_BONUS,
                'birthday_points' => LR_BIRTHDAY_BONUS,
            ),
            'tiers' => array(
                array(
                    'id' => 'fan',
                    'name' => 'Fan',
                    'min_points' => LR_TIER_FAN,
                    'multiplier' => LR_MULTIPLIER_FAN,
                    'benefits' => array( 'Acces au programme de fidelite', '1 point par 1 000 Ar depense', 'Historique des points et transactions', 'Code de parrainage personnel' ),
                ),
                array(
                    'id' => 'silver',
                    'name' => 'Silver',
                    'min_points' => LR_TIER_SILVER,
                    'multiplier' => LR_MULTIPLIER_SILVER,
                    'benefits' => array( 'Reductions membres selon disponibilite', 'Acces prioritaire aux preventes selon disponibilite', 'Offres speciales par notification', 'Support prioritaire selon disponibilite' ),
                ),
                array(
                    'id' => 'gold',
                    'name' => 'Gold',
                    'min_points' => LR_TIER_GOLD,
                    'multiplier' => LR_MULTIPLIER_GOLD,
                    'benefits' => array( 'x1.25 points sur chaque achat eligible', 'Invitations selon disponibilite', 'Early access selon disponibilite', 'Cadeaux ponctuels selon operations' ),
                ),
                array(
                    'id' => 'platinum',
                    'name' => 'Platinum',
                    'min_points' => LR_TIER_PLATINUM,
                    'multiplier' => LR_MULTIPLIER_PLATINUM,
                    'benefits' => array( 'x1.5 points sur chaque achat eligible', 'Surclassements selon disponibilite', 'Acces VIP selon disponibilite', 'Support dedie selon disponibilite' ),
                ),
                array(
                    'id' => 'diamond',
                    'name' => 'Diamond',
                    'min_points' => LR_TIER_DIAMOND,
                    'multiplier' => LR_MULTIPLIER_DIAMOND,
                    'benefits' => array( 'x2 points sur chaque achat eligible', 'Experiences exclusives selon disponibilite', 'Meet and greet selon disponibilite', 'Conciergerie evenementielle selon disponibilite', 'Invitations privees selon disponibilite' ),
                ),
            ),
            'points_expire' => false,
        ),
        'visibility' => array(
            'show_global_cta' => true,
            'show_product_badges' => true,
            'show_event_badges' => true,
            'show_badges_only_when_redeem_available' => true,
            'distinguish_earn_from_redeem' => true,
        ),
        'popup' => array(
            'web' => array(
                'enabled' => true,
                'audience' => 'guests',
                'delay_seconds' => 8,
                'frequency_days' => 7,
                'max_impressions_per_user' => 3,
                'pages' => array( 'home', 'shop', 'event', 'product', 'cart' ),
                'exclude_pages' => array( 'checkout_payment_step' ),
                'cta_url' => '/lamako-rewards/',
            ),
            'mobile' => array(
                'enabled' => true,
                'audience' => 'guests',
                'delay_seconds' => 12,
                'frequency_days' => 7,
                'max_impressions_per_user' => 3,
                'cta_route' => '/rewards',
            ),
        ),
        'notifications' => array(
            'email' => array( 'enabled' => true ),
            'push' => array( 'enabled' => true ),
            'in_app' => array( 'enabled' => true ),
            'daily_email_cap' => 2,
            'daily_push_cap' => 2,
            'quiet_hours_enabled' => true,
            'quiet_hours_start' => '21:00',
            'quiet_hours_end' => '08:00',
            'respect_user_preferences' => true,
        ),
        'copy' => array(
            'headline' => 'Rejoignez Lamako Rewards',
            'signup_bonus' => 'Recevez 100 points de bienvenue',
            'earn_message' => 'Gagnez des points sur vos achats eligibles.',
            'redeem_message' => 'Utilisez vos points sur les evenements et offres participants Lamako Rewards.',
            'minimum_redeem_message' => 'Les reductions Rewards sont debloquees a partir de 750 points.',
            'points_to_redeem_message' => 'Plus que {{points_to_redeem}} points pour debloquer vos reductions Rewards.',
            'non_participating_event_message' => 'Vous gagnez des points avec votre achat, mais les reductions Rewards ne sont pas disponibles sur cet evenement.',
            'participating_event_message' => 'Points gagnes + reduction Rewards disponible.',
        ),
    );
}

function lr_rewards_get_config() {
    $stored = get_option( LR_CONFIG_OPTION, array() );
    if ( ! is_array( $stored ) ) {
        $stored = array();
    }

    return lr_rewards_array_merge_recursive_distinct( lr_rewards_default_config(), $stored );
}

function lr_rewards_config_get( $path, $fallback = null ) {
    $value = lr_rewards_get_config();
    foreach ( explode( '.', (string) $path ) as $segment ) {
        if ( is_array( $value ) && array_key_exists( $segment, $value ) ) {
            $value = $value[ $segment ];
        } else {
            return $fallback;
        }
    }

    return $value;
}

function lr_rewards_public_config( $platform = 'web' ) {
    $config = lr_rewards_get_config();
    $platform = in_array( $platform, array( 'web', 'mobile' ), true ) ? $platform : 'web';
    $config['platform'] = $platform;
    $config['server_time'] = current_time( 'c' );

    return $config;
}

function lr_rewards_minimum_redeem_points() {
    return (int) lr_rewards_config_get( 'program.minimum_redeem_points', LR_REDEMPTION_MIN_LIFETIME );
}

function lr_rewards_redemption_options() {
    $options = lr_rewards_config_get( 'program.redemption_options', array() );
    return is_array( $options ) ? $options : array();
}

function lr_rewards_redemption_value( $points ) {
    $points = (int) $points;
    foreach ( lr_rewards_redemption_options() as $option ) {
        $option_points = (int) ( $option['points'] ?? 0 );
        if ( $option_points === $points ) {
            return (int) ( $option['amount_ariary'] ?? $option['value'] ?? 0 );
        }
    }

    return 0;
}

function lr_rewards_tiers() {
    $tiers = lr_rewards_config_get( 'program.tiers', array() );
    return is_array( $tiers ) ? $tiers : array();
}

function lr_rewards_earning_actions() {
    $actions = lr_rewards_config_get( 'program.earning_actions', array() );
    return is_array( $actions ) ? $actions : array();
}

function lr_rewards_admin_can_manage() {
    return current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' );
}

function lr_rewards_sanitize_bool( $value ) {
    return in_array( strtolower( (string) $value ), array( '1', 'true', 'yes', 'on' ), true );
}

function lr_rewards_sanitize_string_list( $value ) {
    if ( is_string( $value ) ) {
        $value = preg_split( '/[\r\n,]+/', $value );
    }
    if ( ! is_array( $value ) ) {
        return array();
    }

    $items = array();
    foreach ( $value as $item ) {
        $item = sanitize_key( trim( (string) $item ) );
        if ( $item !== '' ) {
            $items[] = $item;
        }
    }

    return array_values( array_unique( $items ) );
}

function lr_rewards_sanitize_config( $config ) {
    $defaults = lr_rewards_default_config();
    if ( ! is_array( $config ) ) {
        return $defaults;
    }

    $config = lr_rewards_array_merge_recursive_distinct( $defaults, $config );

    $config['program']['enabled'] = ! empty( $config['program']['enabled'] );
    $config['program']['signup_bonus_points'] = max( 0, absint( $config['program']['signup_bonus_points'] ) );
    $config['program']['minimum_redeem_points'] = max( 750, absint( $config['program']['minimum_redeem_points'] ) );
    $config['program']['earn_rate']['points'] = max( 1, absint( $config['program']['earn_rate']['points'] ) );
    $config['program']['earn_rate']['amount_ariary'] = max( 1, absint( $config['program']['earn_rate']['amount_ariary'] ) );
    $config['program']['referral']['referrer_points'] = max( 0, absint( $config['program']['referral']['referrer_points'] ) );
    $config['program']['referral']['referred_points'] = max( 0, absint( $config['program']['referral']['referred_points'] ) );
    $config['program']['points_expire'] = ! empty( $config['program']['points_expire'] );

    foreach ( array( 'profile_completed_points', 'daily_login_points', 'first_purchase_points', 'event_attendance_points', 'review_points', 'social_share_points', 'newsletter_points', 'birthday_points' ) as $key ) {
        $config['program']['earning_actions'][ $key ] = max( 0, absint( $config['program']['earning_actions'][ $key ] ?? 0 ) );
    }

    $redemption_options = array();
    foreach ( (array) ( $config['program']['redemption_options'] ?? array() ) as $option ) {
        $points = absint( $option['points'] ?? 0 );
        $amount = absint( $option['amount_ariary'] ?? $option['value'] ?? 0 );
        if ( $points >= (int) $config['program']['minimum_redeem_points'] && $amount > 0 ) {
            $redemption_options[] = array(
                'points' => $points,
                'amount_ariary' => $amount,
            );
        }
    }
    $config['program']['redemption_options'] = ! empty( $redemption_options ) ? $redemption_options : $defaults['program']['redemption_options'];

    foreach ( array( 'show_global_cta', 'show_product_badges', 'show_event_badges', 'show_badges_only_when_redeem_available', 'distinguish_earn_from_redeem' ) as $key ) {
        $config['visibility'][ $key ] = ! empty( $config['visibility'][ $key ] );
    }

    foreach ( array( 'web', 'mobile' ) as $channel ) {
        $config['popup'][ $channel ]['enabled'] = ! empty( $config['popup'][ $channel ]['enabled'] );
        $audience = sanitize_key( $config['popup'][ $channel ]['audience'] ?? 'guests' );
        $config['popup'][ $channel ]['audience'] = in_array( $audience, array( 'guests', 'authenticated', 'all' ), true ) ? $audience : 'guests';
        $config['popup'][ $channel ]['delay_seconds'] = max( 0, absint( $config['popup'][ $channel ]['delay_seconds'] ?? 0 ) );
        $config['popup'][ $channel ]['frequency_days'] = max( 1, absint( $config['popup'][ $channel ]['frequency_days'] ?? 7 ) );
        $config['popup'][ $channel ]['max_impressions_per_user'] = max( 0, absint( $config['popup'][ $channel ]['max_impressions_per_user'] ?? 3 ) );
    }
    $config['popup']['web']['pages'] = lr_rewards_sanitize_string_list( $config['popup']['web']['pages'] ?? array() );
    $config['popup']['web']['exclude_pages'] = lr_rewards_sanitize_string_list( $config['popup']['web']['exclude_pages'] ?? array() );
    $config['popup']['web']['cta_url'] = esc_url_raw( $config['popup']['web']['cta_url'] ?? '/lamako-rewards/' );
    $config['popup']['mobile']['cta_route'] = sanitize_text_field( $config['popup']['mobile']['cta_route'] ?? '/rewards' );

    foreach ( array( 'email', 'push', 'in_app' ) as $channel ) {
        $config['notifications'][ $channel ]['enabled'] = ! empty( $config['notifications'][ $channel ]['enabled'] );
    }
    $config['notifications']['daily_email_cap'] = max( 0, absint( $config['notifications']['daily_email_cap'] ?? 2 ) );
    $config['notifications']['daily_push_cap'] = max( 0, absint( $config['notifications']['daily_push_cap'] ?? 2 ) );
    $config['notifications']['quiet_hours_enabled'] = ! empty( $config['notifications']['quiet_hours_enabled'] );
    $config['notifications']['quiet_hours_start'] = sanitize_text_field( $config['notifications']['quiet_hours_start'] ?? '21:00' );
    $config['notifications']['quiet_hours_end'] = sanitize_text_field( $config['notifications']['quiet_hours_end'] ?? '08:00' );
    $config['notifications']['respect_user_preferences'] = ! empty( $config['notifications']['respect_user_preferences'] );

    foreach ( (array) $config['copy'] as $key => $value ) {
        $config['copy'][ $key ] = sanitize_text_field( $value );
    }

    return $config;
}

function lr_rewards_update_config( array $config, $source = 'admin' ) {
    $sanitized = lr_rewards_sanitize_config( $config );
    update_option( LR_CONFIG_OPTION, $sanitized, false );
    lr_rewards_audit_log( 'config_updated', array( 'source' => sanitize_key( $source ) ) );
    return $sanitized;
}

function lr_rewards_audit_log( $action, array $details = array() ) {
    $logs = get_option( LR_AUDIT_LOG_OPTION, array() );
    if ( ! is_array( $logs ) ) {
        $logs = array();
    }

    array_unshift( $logs, array(
        'time' => current_time( 'mysql' ),
        'user_id' => get_current_user_id(),
        'action' => sanitize_key( $action ),
        'details' => $details,
    ) );

    update_option( LR_AUDIT_LOG_OPTION, array_slice( $logs, 0, 100 ), false );
}

function lr_rewards_get_audit_log() {
    $logs = get_option( LR_AUDIT_LOG_OPTION, array() );
    return is_array( $logs ) ? $logs : array();
}

// ============================================================
// RATE LIMITING
// ============================================================

function lr_check_rate_limit() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $transient_key = 'lr_rate_' . md5( $ip );
    $current = get_transient( $transient_key );
    
    if ( $current === false ) {
        set_transient( $transient_key, 1, LR_RATE_WINDOW );
        return true;
    }
    
    if ( (int) $current >= LR_RATE_LIMIT ) {
        return false;
    }
    
    set_transient( $transient_key, (int) $current + 1, LR_RATE_WINDOW );
    return true;
}

// ============================================================
// ADMIN CONTROL CENTER
// ============================================================

add_action( 'admin_menu', 'lr_rewards_register_admin_page' );

function lr_rewards_register_admin_page() {
    add_menu_page(
        'Lamako Rewards',
        'Lamako Rewards',
        'manage_woocommerce',
        'lamako-rewards-control-center',
        'lr_rewards_render_admin_page',
        'dashicons-awards',
        56
    );
}

function lr_rewards_admin_notice( $message, $type = 'success' ) {
    printf(
        '<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
        esc_attr( $type ),
        esc_html( $message )
    );
}

function lr_rewards_admin_apply_basic_post( array $config ) {
    $program = isset( $_POST['program'] ) && is_array( $_POST['program'] ) ? wp_unslash( $_POST['program'] ) : array();
    $popup = isset( $_POST['popup'] ) && is_array( $_POST['popup'] ) ? wp_unslash( $_POST['popup'] ) : array();
    $visibility = isset( $_POST['visibility'] ) && is_array( $_POST['visibility'] ) ? wp_unslash( $_POST['visibility'] ) : array();
    $copy = isset( $_POST['copy'] ) && is_array( $_POST['copy'] ) ? wp_unslash( $_POST['copy'] ) : array();

    $config['program']['enabled'] = ! empty( $program['enabled'] );
    $config['program']['signup_bonus_points'] = absint( $program['signup_bonus_points'] ?? 100 );
    $config['program']['minimum_redeem_points'] = absint( $program['minimum_redeem_points'] ?? 750 );
    $config['program']['earn_rate']['points'] = absint( $program['earn_rate_points'] ?? 1 );
    $config['program']['earn_rate']['amount_ariary'] = absint( $program['earn_rate_amount_ariary'] ?? 1000 );
    $config['program']['referral']['referrer_points'] = absint( $program['referrer_points'] ?? 75 );
    $config['program']['referral']['referred_points'] = absint( $program['referred_points'] ?? 25 );

    $redemption_lines = isset( $program['redemption_options'] ) ? explode( "\n", sanitize_textarea_field( $program['redemption_options'] ) ) : array();
    $redemption_options = array();
    foreach ( $redemption_lines as $line ) {
        if ( preg_match( '/^\s*(\d+)\s*[:=,]\s*(\d+)\s*$/', $line, $matches ) ) {
            $redemption_options[] = array(
                'points' => absint( $matches[1] ),
                'amount_ariary' => absint( $matches[2] ),
            );
        }
    }
    if ( ! empty( $redemption_options ) ) {
        $config['program']['redemption_options'] = $redemption_options;
    }

    foreach ( array( 'show_global_cta', 'show_product_badges', 'show_event_badges', 'show_badges_only_when_redeem_available', 'distinguish_earn_from_redeem' ) as $key ) {
        $config['visibility'][ $key ] = ! empty( $visibility[ $key ] );
    }

    foreach ( array( 'web', 'mobile' ) as $channel ) {
        $channel_payload = isset( $popup[ $channel ] ) && is_array( $popup[ $channel ] ) ? $popup[ $channel ] : array();
        $config['popup'][ $channel ]['enabled'] = ! empty( $channel_payload['enabled'] );
        $config['popup'][ $channel ]['audience'] = sanitize_key( $channel_payload['audience'] ?? 'guests' );
        $config['popup'][ $channel ]['delay_seconds'] = absint( $channel_payload['delay_seconds'] ?? ( $channel === 'web' ? 8 : 12 ) );
        $config['popup'][ $channel ]['frequency_days'] = absint( $channel_payload['frequency_days'] ?? 7 );
        $config['popup'][ $channel ]['max_impressions_per_user'] = absint( $channel_payload['max_impressions_per_user'] ?? 3 );
    }
    $config['popup']['web']['pages'] = sanitize_text_field( $popup['web']['pages'] ?? 'home,shop,event,product,cart' );
    $config['popup']['web']['exclude_pages'] = sanitize_text_field( $popup['web']['exclude_pages'] ?? 'checkout_payment_step' );
    $config['popup']['web']['cta_url'] = esc_url_raw( $popup['web']['cta_url'] ?? '/lamako-rewards/' );
    $config['popup']['mobile']['cta_route'] = sanitize_text_field( $popup['mobile']['cta_route'] ?? '/rewards' );

    foreach ( array( 'headline', 'signup_bonus', 'earn_message', 'redeem_message', 'minimum_redeem_message', 'points_to_redeem_message', 'non_participating_event_message', 'participating_event_message' ) as $key ) {
        if ( isset( $copy[ $key ] ) ) {
            $config['copy'][ $key ] = sanitize_text_field( $copy[ $key ] );
        }
    }

    return $config;
}

function lr_rewards_handle_admin_post() {
    if ( empty( $_POST['lr_rewards_action'] ) ) {
        return;
    }
    if ( ! lr_rewards_admin_can_manage() ) {
        wp_die( esc_html__( 'Permission denied.', 'lamako-rewards' ) );
    }
    check_admin_referer( 'lr_rewards_control_center' );

    $action = sanitize_key( wp_unslash( $_POST['lr_rewards_action'] ) );
    if ( $action === 'reset_defaults' ) {
        delete_option( LR_CONFIG_OPTION );
        lr_rewards_audit_log( 'config_reset_defaults' );
        lr_rewards_admin_notice( 'Configuration Rewards restauree aux valeurs par defaut.' );
        return;
    }

    $config = lr_rewards_get_config();
    if ( $action === 'save_basic' ) {
        lr_rewards_update_config( lr_rewards_admin_apply_basic_post( $config ), 'admin_basic' );
        lr_rewards_admin_notice( 'Configuration Rewards sauvegardee.' );
        return;
    }

    if ( $action === 'save_json' ) {
        $raw_json = isset( $_POST['lr_rewards_config_json'] ) ? wp_unslash( $_POST['lr_rewards_config_json'] ) : '';
        $decoded = json_decode( $raw_json, true );
        if ( ! is_array( $decoded ) ) {
            lr_rewards_admin_notice( 'JSON invalide. Aucun changement applique.', 'error' );
            return;
        }
        lr_rewards_update_config( $decoded, 'admin_json' );
        lr_rewards_admin_notice( 'Configuration JSON importee et sauvegardee.' );
    }
}

function lr_rewards_render_admin_page() {
    if ( ! lr_rewards_admin_can_manage() ) {
        wp_die( esc_html__( 'Permission denied.', 'lamako-rewards' ) );
    }

    lr_rewards_handle_admin_post();
    $config = lr_rewards_get_config();
    $redemption_lines = array();
    foreach ( lr_rewards_redemption_options() as $option ) {
        $redemption_lines[] = (int) ( $option['points'] ?? 0 ) . ':' . (int) ( $option['amount_ariary'] ?? $option['value'] ?? 0 );
    }
    $logs = lr_rewards_get_audit_log();
    ?>
    <div class="wrap lr-admin">
        <h1>Lamako Rewards Control Center</h1>
        <p>Controle centralise des regles Rewards consommees par le web, l'app mobile, les popups et le checkout.</p>

        <style>
            .lr-admin-grid { display:grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, .8fr); gap:20px; align-items:start; }
            .lr-admin-card { background:#fff; border:1px solid #dcdcde; border-radius:8px; padding:16px; margin:0 0 16px; }
            .lr-admin-card h2 { margin-top:0; }
            .lr-admin-row { display:grid; grid-template-columns: 220px minmax(0, 1fr); gap:12px; align-items:center; margin:10px 0; }
            .lr-admin-row input[type="number"], .lr-admin-row input[type="text"], .lr-admin-row select, .lr-admin-row textarea { width:100%; max-width:520px; }
            .lr-admin-row textarea { min-height:74px; font-family:monospace; }
            .lr-admin-json { width:100%; min-height:360px; font-family:monospace; }
            .lr-admin-log { margin:0; padding-left:18px; max-height:260px; overflow:auto; }
            @media (max-width: 1100px) { .lr-admin-grid { grid-template-columns:1fr; } .lr-admin-row { grid-template-columns:1fr; } }
        </style>

        <div class="lr-admin-grid">
            <div>
                <form method="post">
                    <?php wp_nonce_field( 'lr_rewards_control_center' ); ?>
                    <input type="hidden" name="lr_rewards_action" value="save_basic">

                    <div class="lr-admin-card">
                        <h2>Programme global</h2>
                        <label><input type="checkbox" name="program[enabled]" value="1" <?php checked( ! empty( $config['program']['enabled'] ) ); ?>> Programme Rewards actif</label>
                        <div class="lr-admin-row"><label>Bonus inscription</label><input type="number" name="program[signup_bonus_points]" value="<?php echo esc_attr( $config['program']['signup_bonus_points'] ); ?>"></div>
                        <div class="lr-admin-row"><label>Taux gain points</label><input type="number" name="program[earn_rate_points]" value="<?php echo esc_attr( $config['program']['earn_rate']['points'] ); ?>"></div>
                        <div class="lr-admin-row"><label>Montant Ariary par point</label><input type="number" name="program[earn_rate_amount_ariary]" value="<?php echo esc_attr( $config['program']['earn_rate']['amount_ariary'] ); ?>"></div>
                        <div class="lr-admin-row"><label>Minimum echange</label><input type="number" name="program[minimum_redeem_points]" min="750" value="<?php echo esc_attr( $config['program']['minimum_redeem_points'] ); ?>"></div>
                        <div class="lr-admin-row"><label>Parrain</label><input type="number" name="program[referrer_points]" value="<?php echo esc_attr( $config['program']['referral']['referrer_points'] ); ?>"></div>
                        <div class="lr-admin-row"><label>Filleul</label><input type="number" name="program[referred_points]" value="<?php echo esc_attr( $config['program']['referral']['referred_points'] ); ?>"></div>
                        <div class="lr-admin-row"><label>Conversions officielles</label><textarea name="program[redemption_options]" placeholder="1000:20000"><?php echo esc_textarea( implode( "\n", $redemption_lines ) ); ?></textarea></div>
                        <p class="description">Format: un couple points:ariary par ligne. Les lignes sous le minimum d'echange sont ignorees.</p>
                    </div>

                    <div class="lr-admin-card">
                        <h2>Badges et visibilite</h2>
                        <?php foreach ( array(
                            'show_global_cta' => 'CTA global',
                            'show_product_badges' => 'Badges produits',
                            'show_event_badges' => 'Badges evenements',
                            'show_badges_only_when_redeem_available' => 'Badges reduction uniquement si utilisable',
                            'distinguish_earn_from_redeem' => 'Distinguer points gagnes et reduction utilisable',
                        ) as $key => $label ) : ?>
                            <label style="display:block;margin:8px 0;"><input type="checkbox" name="visibility[<?php echo esc_attr( $key ); ?>]" value="1" <?php checked( ! empty( $config['visibility'][ $key ] ) ); ?>> <?php echo esc_html( $label ); ?></label>
                        <?php endforeach; ?>
                    </div>

                    <div class="lr-admin-card">
                        <h2>Popups</h2>
                        <?php foreach ( array( 'web' => 'Web', 'mobile' => 'Mobile' ) as $channel => $label ) : ?>
                            <h3><?php echo esc_html( $label ); ?></h3>
                            <label><input type="checkbox" name="popup[<?php echo esc_attr( $channel ); ?>][enabled]" value="1" <?php checked( ! empty( $config['popup'][ $channel ]['enabled'] ) ); ?>> Actif</label>
                            <div class="lr-admin-row"><label>Audience</label><select name="popup[<?php echo esc_attr( $channel ); ?>][audience]">
                                <?php foreach ( array( 'guests' => 'Invites', 'authenticated' => 'Connectes', 'all' => 'Tous' ) as $value => $text ) : ?>
                                    <option value="<?php echo esc_attr( $value ); ?>" <?php selected( $config['popup'][ $channel ]['audience'], $value ); ?>><?php echo esc_html( $text ); ?></option>
                                <?php endforeach; ?>
                            </select></div>
                            <div class="lr-admin-row"><label>Delai secondes</label><input type="number" name="popup[<?php echo esc_attr( $channel ); ?>][delay_seconds]" value="<?php echo esc_attr( $config['popup'][ $channel ]['delay_seconds'] ); ?>"></div>
                            <div class="lr-admin-row"><label>Frequence jours</label><input type="number" name="popup[<?php echo esc_attr( $channel ); ?>][frequency_days]" value="<?php echo esc_attr( $config['popup'][ $channel ]['frequency_days'] ); ?>"></div>
                            <div class="lr-admin-row"><label>Max impressions</label><input type="number" name="popup[<?php echo esc_attr( $channel ); ?>][max_impressions_per_user]" value="<?php echo esc_attr( $config['popup'][ $channel ]['max_impressions_per_user'] ); ?>"></div>
                        <?php endforeach; ?>
                        <div class="lr-admin-row"><label>Pages web incluses</label><input type="text" name="popup[web][pages]" value="<?php echo esc_attr( implode( ',', (array) $config['popup']['web']['pages'] ) ); ?>"></div>
                        <div class="lr-admin-row"><label>Pages web exclues</label><input type="text" name="popup[web][exclude_pages]" value="<?php echo esc_attr( implode( ',', (array) $config['popup']['web']['exclude_pages'] ) ); ?>"></div>
                        <div class="lr-admin-row"><label>CTA web</label><input type="text" name="popup[web][cta_url]" value="<?php echo esc_attr( $config['popup']['web']['cta_url'] ); ?>"></div>
                        <div class="lr-admin-row"><label>Route mobile</label><input type="text" name="popup[mobile][cta_route]" value="<?php echo esc_attr( $config['popup']['mobile']['cta_route'] ); ?>"></div>
                    </div>

                    <div class="lr-admin-card">
                        <h2>Textes principaux</h2>
                        <?php foreach ( array( 'headline', 'signup_bonus', 'earn_message', 'redeem_message', 'minimum_redeem_message', 'points_to_redeem_message', 'non_participating_event_message', 'participating_event_message' ) as $key ) : ?>
                            <div class="lr-admin-row"><label><?php echo esc_html( $key ); ?></label><input type="text" name="copy[<?php echo esc_attr( $key ); ?>]" value="<?php echo esc_attr( $config['copy'][ $key ] ?? '' ); ?>"></div>
                        <?php endforeach; ?>
                    </div>

                    <?php submit_button( 'Sauvegarder la configuration Rewards' ); ?>
                </form>
            </div>

            <div>
                <div class="lr-admin-card">
                    <h2>JSON config</h2>
                    <form method="post">
                        <?php wp_nonce_field( 'lr_rewards_control_center' ); ?>
                        <input type="hidden" name="lr_rewards_action" value="save_json">
                        <textarea class="lr-admin-json" name="lr_rewards_config_json"><?php echo esc_textarea( wp_json_encode( $config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ); ?></textarea>
                        <?php submit_button( 'Importer JSON', 'secondary' ); ?>
                    </form>
                </div>

                <div class="lr-admin-card">
                    <h2>Rollback rapide</h2>
                    <p>Ce bouton restaure les defaults serveur sans supprimer les points utilisateurs.</p>
                    <form method="post" onsubmit="return confirm('Restaurer les valeurs Rewards par defaut ?');">
                        <?php wp_nonce_field( 'lr_rewards_control_center' ); ?>
                        <input type="hidden" name="lr_rewards_action" value="reset_defaults">
                        <?php submit_button( 'Reset defaults Rewards', 'delete' ); ?>
                    </form>
                </div>

                <div class="lr-admin-card">
                    <h2>Audit log</h2>
                    <ol class="lr-admin-log">
                        <?php foreach ( $logs as $log ) : ?>
                            <li><strong><?php echo esc_html( $log['time'] ?? '' ); ?></strong> - <?php echo esc_html( $log['action'] ?? '' ); ?> - user #<?php echo esc_html( (string) ( $log['user_id'] ?? 0 ) ); ?></li>
                        <?php endforeach; ?>
                    </ol>
                </div>
            </div>
        </div>
    </div>
    <?php
}

// ============================================================
// AUTHENTICATION
// ============================================================

function lr_authenticate_request( $request ) {
    // Check rate limit first
    if ( ! lr_check_rate_limit() ) {
        return new WP_Error( 'rate_limited', 'Too many requests. Please try again later.', array( 'status' => 429 ) );
    }

    // Method 1: JWT token (preferred)
    $auth_header = $request->get_header( 'Authorization' );
    if ( $auth_header && strpos( $auth_header, 'Bearer ' ) === 0 ) {
        $token = substr( $auth_header, 7 );
        $user_id = lr_validate_jwt( $token );
        if ( $user_id ) {
            return $user_id;
        }
    }

    // Method 2: API key (legacy, for backward compatibility)
    $api_key = $request->get_param( 'api_key' );
    if ( $api_key && LR_API_KEY && hash_equals( LR_API_KEY, $api_key ) ) {
        return true;
    }

    return new WP_Error( 'unauthorized', 'Invalid authentication.', array( 'status' => 401 ) );
}

function lr_validate_jwt( $token ) {
    // Use the JWT Auth plugin's validation if available
    if ( function_exists( 'jwt_auth_validate_token' ) ) {
        $result = jwt_auth_validate_token( $token );
        if ( ! is_wp_error( $result ) && isset( $result->data->user->id ) ) {
            return $result->data->user->id;
        }
    }
    
    // Fallback: decode JWT manually (HS256)
    $secret = defined( 'JWT_AUTH_SECRET_KEY' ) ? JWT_AUTH_SECRET_KEY : wp_salt( 'auth' );
    $parts = explode( '.', $token );
    if ( count( $parts ) !== 3 ) return false;
    
    $payload = json_decode( base64_decode( strtr( $parts[1], '-_', '+/' ) ), true );
    if ( ! $payload || ! isset( $payload['data']['user']['id'] ) ) return false;
    
    // Check expiration
    if ( isset( $payload['exp'] ) && $payload['exp'] < time() ) return false;
    
    // Verify signature
    $header_payload = $parts[0] . '.' . $parts[1];
    $signature = hash_hmac( 'sha256', $header_payload, $secret, true );
    $expected_sig = rtrim( strtr( base64_encode( $signature ), '+/', '-_' ), '=' );
    
    if ( hash_equals( $expected_sig, $parts[2] ) ) {
        return (int) $payload['data']['user']['id'];
    }
    
    return false;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function lr_get_tier( $lifetime_points ) {
    if ( $lifetime_points >= LR_TIER_DIAMOND ) return 'diamond';
    if ( $lifetime_points >= LR_TIER_PLATINUM ) return 'platinum';
    if ( $lifetime_points >= LR_TIER_GOLD ) return 'gold';
    if ( $lifetime_points >= LR_TIER_SILVER ) return 'silver';
    return 'fan';
}

function lr_get_tier_name( $tier ) {
    $names = array(
        'fan' => 'Fan',
        'silver' => 'Silver',
        'gold' => 'Gold',
        'platinum' => 'Platinum',
        'diamond' => 'Diamond',
    );
    return $names[ $tier ] ?? 'Fan';
}

function lr_get_next_tier( $tier ) {
    $next = array(
        'fan' => 'Silver',
        'silver' => 'Gold',
        'gold' => 'Platinum',
        'platinum' => 'Diamond',
        'diamond' => '',
    );
    return $next[ $tier ] ?? '';
}

function lr_get_points_to_next_tier( $lifetime_points ) {
    if ( $lifetime_points >= LR_TIER_DIAMOND ) return 0;
    if ( $lifetime_points >= LR_TIER_PLATINUM ) return LR_TIER_DIAMOND - $lifetime_points;
    if ( $lifetime_points >= LR_TIER_GOLD ) return LR_TIER_PLATINUM - $lifetime_points;
    if ( $lifetime_points >= LR_TIER_SILVER ) return LR_TIER_GOLD - $lifetime_points;
    return LR_TIER_SILVER - $lifetime_points;
}

function lr_get_next_tier_threshold( $lifetime_points ) {
    if ( $lifetime_points >= LR_TIER_DIAMOND ) return LR_TIER_DIAMOND;
    if ( $lifetime_points >= LR_TIER_PLATINUM ) return LR_TIER_DIAMOND;
    if ( $lifetime_points >= LR_TIER_GOLD ) return LR_TIER_PLATINUM;
    if ( $lifetime_points >= LR_TIER_SILVER ) return LR_TIER_GOLD;
    return LR_TIER_SILVER;
}

function lr_get_current_tier_threshold( $lifetime_points ) {
    if ( $lifetime_points >= LR_TIER_DIAMOND ) return LR_TIER_DIAMOND;
    if ( $lifetime_points >= LR_TIER_PLATINUM ) return LR_TIER_PLATINUM;
    if ( $lifetime_points >= LR_TIER_GOLD ) return LR_TIER_GOLD;
    if ( $lifetime_points >= LR_TIER_SILVER ) return LR_TIER_SILVER;
    return 0;
}

function lr_get_multiplier( $tier ) {
    $multipliers = array(
        'fan' => LR_MULTIPLIER_FAN,
        'silver' => LR_MULTIPLIER_SILVER,
        'gold' => LR_MULTIPLIER_GOLD,
        'platinum' => LR_MULTIPLIER_PLATINUM,
        'diamond' => LR_MULTIPLIER_DIAMOND,
    );
    return $multipliers[ $tier ] ?? 1.0;
}

function lr_get_total_earned( $user_id ) {
    global $wpdb;
    $table = $wpdb->prefix . 'myCRED_log';
    
    if ( ! $wpdb->get_var( "SHOW TABLES LIKE '$table'" ) ) {
        return 0;
    }
    
    $total = $wpdb->get_var( $wpdb->prepare(
        "SELECT COALESCE(SUM(creds), 0) FROM $table WHERE user_id = %d AND creds > 0",
        $user_id
    ) );
    
    return (float) $total;
}

// ============================================================
// REFERRAL SYSTEM
// ============================================================

/**
 * Store referral code in user meta when user registers
 */
function lr_generate_referral_code( $user_id ) {
    $existing = get_user_meta( $user_id, '_lamako_referral_code', true );
    if ( $existing ) return $existing;
    
    $user = get_userdata( $user_id );
    $prefix = strtoupper( substr( $user->user_login, 0, 3 ) );
    $suffix = strtoupper( substr( md5( $user_id . time() ), 0, 5 ) );
    $code = "TBL-{$prefix}{$suffix}";
    
    update_user_meta( $user_id, '_lamako_referral_code', $code );
    return $code;
}

/**
 * Register a referral relationship
 */
function lr_register_referral( $referee_user_id, $referrer_code ) {
    global $wpdb;
    
    // Find referrer by code
    $referrer_id = $wpdb->get_var( $wpdb->prepare(
        "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_lamako_referral_code' AND meta_value = %s",
        $referrer_code
    ) );
    
    if ( ! $referrer_id ) {
        return new WP_Error( 'invalid_code', 'Code de parrainage invalide.' );
    }
    
    if ( (int) $referrer_id === (int) $referee_user_id ) {
        return new WP_Error( 'self_referral', 'Vous ne pouvez pas vous parrainer vous-même.' );
    }
    
    // Check if referee already has a referrer
    $existing = get_user_meta( $referee_user_id, '_lamako_referred_by', true );
    if ( $existing ) {
        return new WP_Error( 'already_referred', 'Vous avez déjà un parrain.' );
    }
    
    // Store the relationship
    update_user_meta( $referee_user_id, '_lamako_referred_by', $referrer_id );
    update_user_meta( $referee_user_id, '_lamako_referral_code_used', $referrer_code );
    update_user_meta( $referee_user_id, '_lamako_referral_date', current_time( 'mysql' ) );
    
    // Add referrer's referral count
    $count = (int) get_user_meta( $referrer_id, '_lamako_referral_count', true );
    update_user_meta( $referrer_id, '_lamako_referral_count', $count + 1 );
    
    // Give referee bonus immediately
    if ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'referral_signup', $referee_user_id, LR_REFEREE_BONUS, 'Bonus parrainage (inscription)' );
    }
    
    return array(
        'success' => true,
        'referrer_id' => (int) $referrer_id,
        'referee_bonus' => LR_REFEREE_BONUS,
    );
}

/**
 * Credit referrer when referee makes first purchase
 * Hook into WooCommerce order completed
 */
add_action( 'woocommerce_order_status_completed', 'lr_credit_referrer_on_purchase', 20, 1 );

function lr_credit_referrer_on_purchase( $order_id ) {
    $order = wc_get_order( $order_id );
    if ( ! $order ) return;
    
    $customer_id = $order->get_customer_id();
    if ( ! $customer_id ) return;
    
    // Check if this user was referred
    $referrer_id = get_user_meta( $customer_id, '_lamako_referred_by', true );
    if ( ! $referrer_id ) return;
    
    // Check if referrer was already credited for this referee
    $credited = get_user_meta( $customer_id, '_lamako_referral_credited', true );
    if ( $credited ) return;
    
    // Credit the referrer
    if ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'referral_purchase', (int) $referrer_id, LR_REFERRAL_BONUS, 
            sprintf( 'Bonus parrainage - filleul #%d a effectué un achat', $customer_id ) 
        );
    }
    
    // Mark as credited
    update_user_meta( $customer_id, '_lamako_referral_credited', current_time( 'mysql' ) );
}

// ============================================================
// POINTS ON PURCHASE (with tier multiplier)
// ============================================================

add_action( 'woocommerce_order_status_completed', 'lr_award_purchase_points', 10, 1 );

function lr_award_purchase_points( $order_id ) {
    $order = wc_get_order( $order_id );
    if ( ! $order ) return;
    
    $customer_id = $order->get_customer_id();
    if ( ! $customer_id ) return;
    
    // Check if points already awarded for this order.
    $awarded  = (int) $order->get_meta( '_lamako_points_awarded', true );
    $reversed = (int) $order->get_meta( '_lamako_points_reversed', true );
    if ( $awarded > 0 && $reversed <= 0 ) return;

    if ( $awarded > 0 && $reversed > 0 ) {
        if ( function_exists( 'mycred_add' ) ) {
            mycred_add( 'purchase_reinstated', $customer_id, $reversed,
                sprintf( 'Commande #%d reactivee - recrédit points Rewards', $order_id )
            );
        }

        $order->delete_meta_data( '_lamako_points_reversed' );
        $order->delete_meta_data( '_lamako_points_reversed_at' );
        $order->delete_meta_data( '_lamako_points_reversal_status' );
        $order->save();
        return;
    }
    
    // Calculate base points (1 pt per 1000 Ar)
    $total = (float) $order->get_total();
    $base_points = floor( $total / 1000 );
    
    if ( $base_points <= 0 ) return;
    
    // Apply tier multiplier
    $lifetime = lr_get_total_earned( $customer_id );
    $tier = lr_get_tier( $lifetime );
    $multiplier = lr_get_multiplier( $tier );
    $final_points = (int) floor( $base_points * $multiplier );
    
    // Award points
    if ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'purchase', $customer_id, $final_points, 
            sprintf( 'Achat #%d (%s Ar) - x%.1f %s', $order_id, number_format( $total, 0, ',', ' ' ), $multiplier, lr_get_tier_name( $tier ) )
        );
    }
    
    // Mark order as processed.
    $order->update_meta_data( '_lamako_points_awarded', $final_points );
    $order->update_meta_data( '_lamako_points_multiplier', $multiplier );
    $order->save();
}

add_action( 'woocommerce_order_status_cancelled', 'lr_reverse_purchase_points_on_order_close', 20, 1 );
add_action( 'woocommerce_order_status_refunded', 'lr_reverse_purchase_points_on_order_close', 20, 1 );
add_action( 'woocommerce_order_status_failed', 'lr_reverse_purchase_points_on_order_close', 20, 1 );

function lr_get_external_order_points_to_reverse( $order_id, $customer_id ) {
    global $wpdb;

    $table = $wpdb->prefix . 'myCRED_log';
    $exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
    if ( $exists !== $table ) {
        return 0;
    }

    return (float) $wpdb->get_var(
        $wpdb->prepare(
            "SELECT COALESCE(SUM(creds), 0) FROM {$table} WHERE user_id = %d AND ref_id = %d AND creds > 0 AND ref <> %s",
            $customer_id,
            $order_id,
            'purchase_reversal'
        )
    );
}

function lr_reverse_purchase_points_on_order_close( $order_id ) {
    $order = wc_get_order( $order_id );
    if ( ! $order ) return;

    $customer_id = $order->get_customer_id();
    if ( ! $customer_id ) return;

    $awarded = (int) $order->get_meta( '_lamako_points_awarded', true );
    $already_reversed = (int) $order->get_meta( '_lamako_points_reversed', true );
    $own_points_to_reverse = max( 0, $awarded - max( 0, $already_reversed ) );

    $external_awarded = lr_get_external_order_points_to_reverse( $order_id, $customer_id );
    $external_reversed = (float) $order->get_meta( '_lamako_points_external_reversed', true );
    $external_points_to_reverse = max( 0, $external_awarded - max( 0, $external_reversed ) );

    $points_to_reverse = $own_points_to_reverse + $external_points_to_reverse;
    if ( $points_to_reverse <= 0 ) return;

    if ( function_exists( 'mycred_subtract' ) ) {
        mycred_subtract( 'purchase_reversal', $customer_id, $points_to_reverse,
            sprintf( 'Commande #%d %s - retrait points Rewards', $order_id, $order->get_status() )
        );
    } elseif ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'purchase_reversal', $customer_id, -1 * $points_to_reverse,
            sprintf( 'Commande #%d %s - retrait points Rewards', $order_id, $order->get_status() )
        );
    } else {
        return;
    }

    if ( $own_points_to_reverse > 0 ) {
        $order->update_meta_data( '_lamako_points_reversed', $awarded );
    }
    if ( $external_points_to_reverse > 0 ) {
        $order->update_meta_data( '_lamako_points_external_reversed', $external_awarded );
    }
    $order->update_meta_data( '_lamako_points_reversed_at', current_time( 'mysql' ) );
    $order->update_meta_data( '_lamako_points_reversal_status', $order->get_status() );
    $order->save();
}

// ============================================================
// DAILY LOGIN BONUS
// ============================================================

add_action( 'wp_login', 'lr_daily_login_bonus', 10, 2 );

function lr_daily_login_bonus( $user_login, $user ) {
    $user_id = $user->ID;
    $today = date( 'Y-m-d' );
    $last_login_bonus = get_user_meta( $user_id, '_lamako_last_login_bonus', true );
    
    if ( $last_login_bonus === $today ) return; // Already awarded today
    
    if ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'daily_login', $user_id, LR_LOGIN_BONUS, 'Bonus connexion quotidienne' );
    }
    
    update_user_meta( $user_id, '_lamako_last_login_bonus', $today );
}

// ============================================================
// REGISTRATION BONUS
// ============================================================

add_action( 'user_register', 'lr_registration_bonus', 10, 1 );

function lr_registration_bonus( $user_id ) {
    // Generate referral code for new user
    lr_generate_referral_code( $user_id );
    
    // Award registration bonus
    if ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'registration', $user_id, LR_REGISTRATION_BONUS, 'Bonus inscription LamakoRewards' );
    }
}

// ============================================================
// BIRTHDAY BONUS
// ============================================================

add_action( 'lr_daily_cron', 'lr_check_birthdays' );

function lr_check_birthdays() {
    global $wpdb;
    $today = date( 'm-d' );
    
    // Find users with birthday today
    $users = $wpdb->get_col( $wpdb->prepare(
        "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_lamako_birthday' AND RIGHT(meta_value, 5) = %s",
        $today
    ) );
    
    foreach ( $users as $user_id ) {
        $last_birthday_bonus = get_user_meta( $user_id, '_lamako_last_birthday_bonus', true );
        if ( $last_birthday_bonus === date( 'Y' ) ) continue;
        
        if ( function_exists( 'mycred_add' ) ) {
            mycred_add( 'birthday', (int) $user_id, LR_BIRTHDAY_BONUS, 'Joyeux anniversaire ! 🎂' );
        }
        
        update_user_meta( $user_id, '_lamako_last_birthday_bonus', date( 'Y' ) );
    }
}

// Schedule daily cron
if ( ! wp_next_scheduled( 'lr_daily_cron' ) ) {
    wp_schedule_event( time(), 'daily', 'lr_daily_cron' );
}

// ============================================================
// REST API ENDPOINTS
// ============================================================

add_action( 'rest_api_init', function() {
    $namespace = 'lamako-rewards/v1';

    // GET /config
    register_rest_route( $namespace, '/config', array(
        'methods' => 'GET',
        'callback' => 'lr_api_get_config',
        'permission_callback' => '__return_true',
        'args' => array(
            'platform' => array(
                'sanitize_callback' => 'sanitize_key',
                'default' => 'web',
            ),
        ),
    ) );

    // GET/POST /admin/config
    register_rest_route( $namespace, '/admin/config', array(
        array(
            'methods' => 'GET',
            'callback' => 'lr_api_admin_get_config',
            'permission_callback' => 'lr_api_admin_permission',
        ),
        array(
            'methods' => 'POST',
            'callback' => 'lr_api_admin_update_config',
            'permission_callback' => 'lr_api_admin_permission',
        ),
    ) );
    
    // GET /balance
    register_rest_route( $namespace, '/balance', array(
        'methods' => 'GET',
        'callback' => 'lr_api_get_balance',
        'permission_callback' => '__return_true',
    ) );
    
    // GET /history
    register_rest_route( $namespace, '/history', array(
        'methods' => 'GET',
        'callback' => 'lr_api_get_history',
        'permission_callback' => '__return_true',
    ) );
    
    // GET /user-by-email
    register_rest_route( $namespace, '/user-by-email', array(
        'methods' => 'GET',
        'callback' => 'lr_api_get_user_by_email',
        'permission_callback' => '__return_true',
    ) );
    
    // POST /redeem
    register_rest_route( $namespace, '/redeem', array(
        'methods' => 'POST',
        'callback' => 'lr_api_redeem_points',
        'permission_callback' => '__return_true',
    ) );
    
    // POST /referral/register
    register_rest_route( $namespace, '/referral/register', array(
        'methods' => 'POST',
        'callback' => 'lr_api_register_referral',
        'permission_callback' => '__return_true',
    ) );
    
    // POST /referral/validate
    register_rest_route( $namespace, '/referral/validate', array(
        'methods' => 'POST',
        'callback' => 'lr_api_validate_referral_code',
        'permission_callback' => '__return_true',
    ) );
    
    // GET /referral/code
    register_rest_route( $namespace, '/referral/code', array(
        'methods' => 'GET',
        'callback' => 'lr_api_get_referral_code',
        'permission_callback' => '__return_true',
    ) );
    
    // GET /tiers
    register_rest_route( $namespace, '/tiers', array(
        'methods' => 'GET',
        'callback' => 'lr_api_get_tiers',
        'permission_callback' => '__return_true',
    ) );
});

// ----- CONFIG -----
function lr_api_get_config( $request ) {
    $platform = sanitize_key( $request->get_param( 'platform' ) ?: 'web' );
    return rest_ensure_response( lr_rewards_public_config( $platform ) );
}

function lr_api_admin_permission() {
    return lr_rewards_admin_can_manage();
}

function lr_api_admin_get_config( $request ) {
    return rest_ensure_response( array(
        'config' => lr_rewards_get_config(),
        'audit_log' => lr_rewards_get_audit_log(),
    ) );
}

function lr_api_admin_update_config( $request ) {
    $body = $request->get_json_params();
    if ( ! is_array( $body ) ) {
        return new WP_Error( 'invalid_config', 'JSON body must be an object.', array( 'status' => 400 ) );
    }

    $config = isset( $body['config'] ) && is_array( $body['config'] ) ? $body['config'] : $body;
    return rest_ensure_response( array(
        'config' => lr_rewards_update_config( $config, 'admin_rest' ),
    ) );
}

// ----- BALANCE -----
function lr_api_get_balance( $request ) {
    $auth = lr_authenticate_request( $request );
    if ( is_wp_error( $auth ) ) return $auth;
    
    $user_id = (int) $request->get_param( 'user_id' );
    if ( ! $user_id ) {
        return new WP_Error( 'missing_param', 'user_id is required.', array( 'status' => 400 ) );
    }
    
    if ( ! function_exists( 'mycred_get_users_balance' ) ) {
        return new WP_Error( 'mycred_missing', 'myCred plugin not active.', array( 'status' => 500 ) );
    }
    
    $balance = mycred_get_users_balance( $user_id );
    $total_earned = lr_get_total_earned( $user_id );
    $tier = lr_get_tier( $total_earned );
    
    return rest_ensure_response( array(
        'user_id' => $user_id,
        'balance' => (float) $balance,
        'total_earned' => (float) $total_earned,
        'tier' => $tier,
        'tier_name' => lr_get_tier_name( $tier ),
        'next_tier' => lr_get_next_tier( $tier ),
        'points_to_next_tier' => lr_get_points_to_next_tier( $total_earned ),
        'multiplier' => lr_get_multiplier( $tier ),
        'discount_percent' => lr_get_discount_percent( $tier ),
    ) );
}

function lr_get_discount_percent( $tier ) {
    // No automatic discount - rewards are experiential (early access, upgrades, backstage)
    // Discounts come from redeeming points only
    return 0;
}

// ----- HISTORY -----
function lr_api_get_history( $request ) {
    $auth = lr_authenticate_request( $request );
    if ( is_wp_error( $auth ) ) return $auth;
    
    $user_id = (int) $request->get_param( 'user_id' );
    $limit = min( (int) ( $request->get_param( 'limit' ) ?: 20 ), 100 );
    
    if ( ! $user_id ) {
        return new WP_Error( 'missing_param', 'user_id is required.', array( 'status' => 400 ) );
    }
    
    global $wpdb;
    $table = $wpdb->prefix . 'myCRED_log';
    
    $results = $wpdb->get_results( $wpdb->prepare(
        "SELECT id, ref AS type, creds AS points, entry AS description, time 
         FROM $table WHERE user_id = %d ORDER BY time DESC LIMIT %d",
        $user_id, $limit
    ) );
    
    $history = array();
    foreach ( $results as $row ) {
        $history[] = array(
            'id' => (int) $row->id,
            'type' => $row->type,
            'points' => (float) $row->points,
            'description' => $row->description,
            'date' => date( 'c', (int) $row->time ),
        );
    }
    
    return rest_ensure_response( array( 'history' => $history ) );
}

// ----- USER BY EMAIL -----
function lr_api_get_user_by_email( $request ) {
    $auth = lr_authenticate_request( $request );
    if ( is_wp_error( $auth ) ) return $auth;
    
    $email = sanitize_email( $request->get_param( 'email' ) );
    if ( ! $email ) {
        return new WP_Error( 'missing_param', 'email is required.', array( 'status' => 400 ) );
    }
    
    $user = get_user_by( 'email', $email );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', array( 'status' => 404 ) );
    }
    
    $balance = function_exists( 'mycred_get_users_balance' ) ? mycred_get_users_balance( $user->ID ) : 0;
    $total_earned = lr_get_total_earned( $user->ID );
    
    return rest_ensure_response( array(
        'user_id' => $user->ID,
        'balance' => (float) $balance,
        'total_earned' => (float) $total_earned,
    ) );
}

// ----- REDEEM POINTS -----
function lr_api_redeem_points( $request ) {
    $auth = lr_authenticate_request( $request );
    if ( is_wp_error( $auth ) ) return $auth;
    
    $body = $request->get_json_params();
    $user_id = (int) ( $body['user_id'] ?? 0 );
    $points = (int) ( $body['points'] ?? 0 );
    
    if ( ! $user_id || ! $points ) {
        return new WP_Error( 'missing_params', 'user_id and points are required.', array( 'status' => 400 ) );
    }

    $minimum_redeem_points = lr_rewards_minimum_redeem_points();
    $total_earned = lr_get_total_earned( $user_id );
    if ( $total_earned < $minimum_redeem_points ) {
        return new WP_Error( 'tier_too_low',
            sprintf(
                'L echange de points est disponible a partir de %d pts cumules (= %s Ar depenses). Il vous manque %d pts.',
                $minimum_redeem_points,
                number_format( $minimum_redeem_points * 1000, 0, ',', ' ' ),
                $minimum_redeem_points - $total_earned
            ),
            array( 'status' => 403 )
        );
    }

    $discount_value = lr_rewards_redemption_value( $points );
    if ( $discount_value <= 0 ) {
        $valid_points = array_map( function( $option ) {
            return (int) ( $option['points'] ?? 0 );
        }, lr_rewards_redemption_options() );
        $valid_points = array_values( array_filter( $valid_points ) );
        return new WP_Error( 'invalid_points', 'Points must be one of: ' . implode( ', ', $valid_points ) . '.', array( 'status' => 400 ) );
    }

    if ( ! function_exists( 'mycred_get_users_balance' ) ) {
        return new WP_Error( 'mycred_missing', 'myCred plugin not active.', array( 'status' => 500 ) );
    }

    $balance = mycred_get_users_balance( $user_id );
    if ( $balance < $minimum_redeem_points ) {
        return new WP_Error(
            'minimum_balance_required',
            sprintf( 'Les reductions Rewards sont debloquees a partir de %d points disponibles.', $minimum_redeem_points ),
            array( 'status' => 403 )
        );
    }

    if ( $balance < $points ) {
        return new WP_Error( 'insufficient_points', 'Solde insuffisant.', array( 'status' => 400 ) );
    }

    mycred_subtract( 'redemption', $user_id, $points,
        sprintf( 'Echange %d pts vers %s Ar de reduction', $points, number_format( $discount_value, 0, ',', ' ' ) )
    );

    $coupon_code = 'LR-' . strtoupper( wp_generate_password( 8, false ) );

    $coupon = new WC_Coupon();
    $coupon->set_code( $coupon_code );
    $coupon->set_discount_type( 'fixed_cart' );
    $coupon->set_amount( $discount_value );
    $coupon->set_usage_limit( 1 );
    $coupon->set_usage_limit_per_user( 1 );
    $coupon->set_date_expires( strtotime( '+30 days' ) );
    $coupon->set_description( sprintf( 'LamakoRewards - %d points echanges par user #%d', $points, $user_id ) );
    $coupon->save();

    return rest_ensure_response( array(
        'success' => true,
        'coupon_code' => $coupon_code,
        'discount_value' => $discount_value,
        'points_deducted' => $points,
        'new_balance' => mycred_get_users_balance( $user_id ),
        'expires' => date( 'c', strtotime( '+30 days' ) ),
    ) );
    
    // Check minimum lifetime points for redemption (750 pts = 750 000 Ar spent)
    $total_earned = lr_get_total_earned( $user_id );
    if ( $total_earned < LR_REDEMPTION_MIN_LIFETIME ) {
        return new WP_Error( 'tier_too_low', 
            sprintf( 'L\'échange de points est disponible à partir de %d pts cumulés (= %s Ar dépensés). Il vous manque %d pts.', 
                LR_REDEMPTION_MIN_LIFETIME, 
                number_format( LR_REDEMPTION_MIN_LIFETIME * 1000, 0, ',', ' ' ),
                LR_REDEMPTION_MIN_LIFETIME - $total_earned 
            ),
            array( 'status' => 403 ) 
        );
    }
    
    // Validate redemption tiers from the official Rewards config.
    $valid_tiers = array( 1000, 2000 );
    if ( ! in_array( $points, $valid_tiers ) ) {
        return new WP_Error( 'invalid_points', 'Points must be one of: 1000, 2000.', array( 'status' => 400 ) );
    }
    
    // Check balance
    if ( ! function_exists( 'mycred_get_users_balance' ) ) {
        return new WP_Error( 'mycred_missing', 'myCred plugin not active.', array( 'status' => 500 ) );
    }
    
    $balance = mycred_get_users_balance( $user_id );
    if ( $balance < $points ) {
        return new WP_Error( 'insufficient_points', 'Solde insuffisant.', array( 'status' => 400 ) );
    }
    
    // Calculate discount value from the official Rewards config.
    $values = array( 1000 => 20000, 2000 => 40000 );
    $discount_value = $values[ $points ];
    
    // Deduct points
    mycred_subtract( 'redemption', $user_id, $points, 
        sprintf( 'Échange %d pts → %s Ar de réduction', $points, number_format( $discount_value, 0, ',', ' ' ) )
    );
    
    // Generate coupon code
    $coupon_code = 'LR-' . strtoupper( wp_generate_password( 8, false ) );
    
    // Create WooCommerce coupon
    $coupon = new WC_Coupon();
    $coupon->set_code( $coupon_code );
    $coupon->set_discount_type( 'fixed_cart' );
    $coupon->set_amount( $discount_value );
    $coupon->set_usage_limit( 1 );
    $coupon->set_usage_limit_per_user( 1 );
    $coupon->set_date_expires( strtotime( '+30 days' ) );
    $coupon->set_description( sprintf( 'LamakoRewards - %d points échangés par user #%d', $points, $user_id ) );
    $coupon->save();
    
    return rest_ensure_response( array(
        'success' => true,
        'coupon_code' => $coupon_code,
        'discount_value' => $discount_value,
        'points_deducted' => $points,
        'new_balance' => mycred_get_users_balance( $user_id ),
        'expires' => date( 'c', strtotime( '+30 days' ) ),
    ) );
}

// ----- REFERRAL: REGISTER -----
function lr_api_register_referral( $request ) {
    $auth = lr_authenticate_request( $request );
    if ( is_wp_error( $auth ) ) return $auth;
    
    $body = $request->get_json_params();
    $referee_user_id = (int) ( $body['referee_user_id'] ?? 0 );
    $referrer_code = sanitize_text_field( $body['referrer_code'] ?? '' );
    
    if ( ! $referee_user_id || ! $referrer_code ) {
        return new WP_Error( 'missing_params', 'referee_user_id and referrer_code are required.', array( 'status' => 400 ) );
    }
    
    $result = lr_register_referral( $referee_user_id, $referrer_code );
    
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    
    return rest_ensure_response( $result );
}

// ----- REFERRAL: VALIDATE CODE -----
function lr_api_validate_referral_code( $request ) {
    $auth = lr_authenticate_request( $request );
    if ( is_wp_error( $auth ) ) return $auth;
    
    $body = $request->get_json_params();
    $code = sanitize_text_field( $body['code'] ?? '' );
    
    if ( ! $code ) {
        return new WP_Error( 'missing_param', 'code is required.', array( 'status' => 400 ) );
    }
    
    global $wpdb;
    $referrer_id = $wpdb->get_var( $wpdb->prepare(
        "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_lamako_referral_code' AND meta_value = %s",
        $code
    ) );
    
    if ( ! $referrer_id ) {
        return rest_ensure_response( array( 'valid' => false, 'message' => 'Code invalide.' ) );
    }
    
    $user = get_userdata( (int) $referrer_id );
    $display_name = $user ? $user->display_name : 'Utilisateur';
    
    return rest_ensure_response( array(
        'valid' => true,
        'referrer_name' => $display_name,
        'bonus' => LR_REFEREE_BONUS,
    ) );
}

// ----- REFERRAL: GET CODE -----
function lr_api_get_referral_code( $request ) {
    $auth = lr_authenticate_request( $request );
    if ( is_wp_error( $auth ) ) return $auth;
    
    $user_id = (int) $request->get_param( 'user_id' );
    if ( ! $user_id ) {
        return new WP_Error( 'missing_param', 'user_id is required.', array( 'status' => 400 ) );
    }
    
    $code = lr_generate_referral_code( $user_id );
    $referral_count = (int) get_user_meta( $user_id, '_lamako_referral_count', true );
    
    return rest_ensure_response( array(
        'code' => $code,
        'referral_count' => $referral_count,
        'bonus_per_referral' => LR_REFERRAL_BONUS,
    ) );
}

// ----- TIERS INFO -----
function lr_api_get_tiers( $request ) {
    $earning_actions = lr_rewards_earning_actions();

    return rest_ensure_response( array(
        'tiers' => lr_rewards_tiers(),
        'earn_rules' => array(
            'purchase' => '1 pt / 1 000 Ar',
            'registration' => (int) lr_rewards_config_get( 'program.signup_bonus_points', LR_REGISTRATION_BONUS ) . ' pts',
            'daily_login' => (int) ( $earning_actions['daily_login_points'] ?? LR_LOGIN_BONUS ) . ' pts',
            'attendance' => (int) ( $earning_actions['event_attendance_points'] ?? LR_ATTENDANCE_BONUS ) . ' pts',
            'review' => (int) ( $earning_actions['review_points'] ?? LR_REVIEW_BONUS ) . ' pts',
            'referral' => (int) lr_rewards_config_get( 'program.referral.referrer_points', LR_REFERRAL_BONUS ) . ' pts',
            'referee_bonus' => (int) lr_rewards_config_get( 'program.referral.referred_points', LR_REFEREE_BONUS ) . ' pts',
            'birthday' => (int) ( $earning_actions['birthday_points'] ?? LR_BIRTHDAY_BONUS ) . ' pts',
            'share' => (int) ( $earning_actions['social_share_points'] ?? LR_SHARE_BONUS ) . ' pts',
            'newsletter' => (int) ( $earning_actions['newsletter_points'] ?? LR_NEWSLETTER_BONUS ) . ' pts',
        ),
        'minimum_redeem_points' => lr_rewards_minimum_redeem_points(),
        'redemption' => array_map( function( $option ) {
            return array(
                'points' => (int) ( $option['points'] ?? 0 ),
                'value' => (int) ( $option['amount_ariary'] ?? $option['value'] ?? 0 ),
            );
        }, lr_rewards_redemption_options() ),
    ) );

    return rest_ensure_response( array(
        'tiers' => array(
            array(
                'id' => 'fan',
                'name' => 'Fan',
                'min_points' => LR_TIER_FAN,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_FAN,
                'benefits' => array( 'Accès au programme de fidélité', '1 point par 1 000 Ar dépensé', 'Historique des points et transactions', 'Code de parrainage personnel' ),
            ),
            array(
                'id' => 'silver',
                'name' => 'Silver',
                'min_points' => LR_TIER_SILVER,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_SILVER,
                'benefits' => array( 'Réductions membres exclusives', 'Accès prioritaire aux préventes', 'Offres spéciales par notification', 'Support prioritaire WhatsApp' ),
            ),
            array(
                'id' => 'gold',
                'name' => 'Gold',
                'min_points' => LR_TIER_GOLD,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_GOLD,
                'benefits' => array( 'x1.25 points sur chaque achat', 'Invitations aux événements exclusifs', 'Early access aux nouvelles ventes', 'Cadeaux surprises aux événements' ),
            ),
            array(
                'id' => 'platinum',
                'name' => 'Platinum',
                'min_points' => LR_TIER_PLATINUM,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_PLATINUM,
                'benefits' => array( 'x1.5 points sur chaque achat', 'Surclassement de billets', 'Accès VIP aux événements', 'Support dédié' ),
            ),
            array(
                'id' => 'diamond',
                'name' => 'Diamond',
                'min_points' => LR_TIER_DIAMOND,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_DIAMOND,
                'benefits' => array( 'x2 points sur chaque achat', 'Accès backstage', 'Meet & greet artistes', 'Conciergerie événementielle', 'Surclassement automatique', 'Invitations privées' ),
            ),
        ),
        'earn_rules' => array(
            'purchase' => '1 pt / 1 000 Ar',
            'registration' => LR_REGISTRATION_BONUS . ' pts',
            'daily_login' => LR_LOGIN_BONUS . ' pts',
            'attendance' => LR_ATTENDANCE_BONUS . ' pts',
            'review' => LR_REVIEW_BONUS . ' pts',
            'referral' => LR_REFERRAL_BONUS . ' pts',
            'referee_bonus' => LR_REFEREE_BONUS . ' pts',
            'birthday' => LR_BIRTHDAY_BONUS . ' pts',
            'share' => LR_SHARE_BONUS . ' pts',
        ),
        'redemption' => array(
            array( 'points' => 1000, 'value' => 20000 ),
            array( 'points' => 2000, 'value' => 40000 ),
        ),
    ) );
}

// ============================================================
// SHORTCODES FOR WORDPRESS PAGES
// ============================================================

// [lamako_rewards_page] - Full rewards page
add_shortcode( 'lamako_rewards_page', 'lr_shortcode_rewards_page' );

function lr_shortcode_rewards_page() {
    $logo_dark = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_Dark.png';
    $logo_white = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_white.png';
    ob_start();
    ?>
    <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <div id="lamako-rewards-page" class="lr-page">
        <style>
            .lr-page { font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
            .lr-page h2 { font-family: 'Raleway', sans-serif; font-weight: 700; }
            .lr-hero { background: linear-gradient(135deg, #3d2314 0%, #663d17 50%, #8B5E34 100%); color: white; border-radius: 20px; padding: 60px 40px; text-align: center; margin-bottom: 48px; position: relative; overflow: hidden; }
            .lr-hero::before { content: ''; position: absolute; top: -50%; right: -20%; width: 60%; height: 200%; background: radial-gradient(circle, rgba(199,159,108,0.15) 0%, transparent 70%); }
            .lr-hero-logo { max-width: 320px; height: auto; margin-bottom: 16px; }
            .lr-hero p { font-size: 1.2em; opacity: 0.9; font-weight: 400; max-width: 600px; margin: 0 auto; }
            .lr-section-title { text-align: center; margin-bottom: 8px; font-size: 1.6em; color: #3d2314; }
            .lr-section-subtitle { text-align: center; color: #666; margin-bottom: 32px; font-weight: 400; }
            .lr-tiers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 48px; }
            .lr-tier-card { border: 2px solid #e5e7eb; border-radius: 16px; padding: 28px 20px; text-align: center; transition: transform 0.3s ease, box-shadow 0.3s ease; background: white; }
            .lr-tier-card:hover { transform: translateY(-6px); box-shadow: 0 12px 32px rgba(61,35,20,0.12); }
            .lr-tier-card.fan { border-color: #c79f6c; border-top: 4px solid #c79f6c; }
            .lr-tier-card.silver { border-color: #C0C0C0; border-top: 4px solid #C0C0C0; }
            .lr-tier-card.gold { border-color: #FFD700; border-top: 4px solid #FFD700; background: linear-gradient(to bottom, #fffdf5, #fff); }
            .lr-tier-card.platinum { border-color: #a8a8a8; border-top: 4px solid #a8a8a8; background: linear-gradient(to bottom, #f8f8fa, #fff); }
            .lr-tier-card.diamond { border-color: #7dd3fc; border-top: 4px solid #7dd3fc; background: linear-gradient(to bottom, #f0f9ff, #fff); }
            .lr-tier-badge { width: 56px; height: 56px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 1.6em; margin-bottom: 12px; }
            .lr-tier-card.fan .lr-tier-badge { background: linear-gradient(135deg, #c79f6c, #a67c52); }
            .lr-tier-card.silver .lr-tier-badge { background: linear-gradient(135deg, #e8e8e8, #c0c0c0); }
            .lr-tier-card.gold .lr-tier-badge { background: linear-gradient(135deg, #FFD700, #f0c000); }
            .lr-tier-card.platinum .lr-tier-badge { background: linear-gradient(135deg, #d4d4d8, #a1a1aa); }
            .lr-tier-card.diamond .lr-tier-badge { background: linear-gradient(135deg, #7dd3fc, #38bdf8); }
            .lr-tier-name { font-size: 1.3em; font-weight: 700; margin-bottom: 6px; color: #3d2314; }
            .lr-tier-threshold { font-size: 0.85em; color: #888; margin-bottom: 16px; font-weight: 500; }
            .lr-tier-mult { display: inline-block; background: #f0f0f0; padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: 600; color: #3d2314; margin-bottom: 14px; }
            .lr-tier-benefits { list-style: none; padding: 0; text-align: left; margin: 0; }
            .lr-tier-benefits li { padding: 7px 0; border-bottom: 1px solid #f5f5f5; font-size: 0.88em; color: #444; }
            .lr-tier-benefits li:last-child { border-bottom: none; }
            .lr-tier-benefits li::before { content: "\2713"; color: #22c55e; font-weight: bold; margin-right: 8px; }
            .lr-earn-section { background: linear-gradient(135deg, #faf8f5 0%, #f5f0eb 100%); border-radius: 16px; padding: 48px 40px; margin-bottom: 48px; }
            .lr-earn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 28px; }
            .lr-earn-item { background: white; border-radius: 12px; padding: 20px 16px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.04); border: 1px solid #f0ebe5; transition: transform 0.2s; }
            .lr-earn-item:hover { transform: translateY(-2px); }
            .lr-earn-item .points { font-size: 1.4em; font-weight: 800; color: #663d17; }
            .lr-earn-item .action { font-size: 0.85em; color: #666; margin-top: 6px; font-weight: 500; }
            .lr-redeem-section { margin-bottom: 48px; }
            .lr-redeem-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 0.95em; color: #92400e; }
            .lr-redeem-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
            .lr-redeem-table th { padding: 16px; background: linear-gradient(135deg, #3d2314, #663d17); color: white; font-weight: 600; text-align: center; }
            .lr-redeem-table td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; text-align: center; font-weight: 500; }
            .lr-redeem-table tbody tr:last-child td { border-bottom: none; }
            .lr-redeem-table tbody tr:hover { background: #faf8f5; }
            .lr-cta { background: linear-gradient(135deg, #663d17, #3d2314); color: white; border: none; padding: 16px 36px; border-radius: 50px; font-size: 1.05em; font-weight: 600; cursor: pointer; display: inline-block; text-decoration: none; margin-top: 20px; transition: all 0.3s; font-family: 'Raleway', sans-serif; letter-spacing: 0.5px; }
            .lr-cta:hover { background: linear-gradient(135deg, #8B5E34, #663d17); color: white; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(61,35,20,0.25); }
            .lr-referral-section { background: linear-gradient(135deg, #663d17 0%, #3d2314 100%); border-radius: 16px; padding: 48px 40px; margin-bottom: 48px; text-align: center; color: white; position: relative; overflow: hidden; }
            .lr-referral-section::before { content: ''; position: absolute; top: -30%; left: -10%; width: 50%; height: 160%; background: radial-gradient(circle, rgba(199,159,108,0.2) 0%, transparent 70%); }
            .lr-referral-section h2 { color: white; position: relative; }
            .lr-referral-section p { position: relative; }
            .lr-faq-section { margin-bottom: 48px; }
            .lr-faq-item { border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 12px; overflow: hidden; background: white; }
            .lr-faq-question { padding: 18px 24px; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1em; color: #3d2314; transition: background 0.2s; }
            .lr-faq-question:hover { background: #faf8f5; }
            .lr-faq-arrow { transition: transform 0.3s; font-size: 1.2em; color: #c79f6c; }
            .lr-faq-item.open .lr-faq-arrow { transform: rotate(180deg); }
            .lr-faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s ease, padding 0.3s ease; padding: 0 24px; }
            .lr-faq-item.open .lr-faq-answer { max-height: 500px; padding: 0 24px 20px; }
            .lr-faq-answer p { color: #555; font-size: 0.95em; line-height: 1.7; margin: 0; }
            .lr-profile-section { background: white; border: 2px solid #c79f6c; border-radius: 16px; padding: 36px; margin-bottom: 48px; box-shadow: 0 4px 20px rgba(199,159,108,0.1); }
            .lr-profile-section h2 { text-align: center; color: #3d2314; }
            .lr-profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top: 24px; text-align: center; }
            .lr-profile-stat { font-size: 2.2em; font-weight: 800; color: #663d17; }
            .lr-profile-label { color: #888; font-size: 0.9em; font-weight: 500; margin-top: 4px; }
            .lr-progress-bar { height: 8px; background: #f0ebe5; border-radius: 4px; margin-top: 20px; overflow: hidden; }
            .lr-progress-fill { height: 100%; background: linear-gradient(90deg, #c79f6c, #663d17); border-radius: 4px; transition: width 0.5s ease; }
            @media (max-width: 768px) {
                .lr-hero { padding: 36px 20px; }
                .lr-hero-logo { max-width: 240px; }
                .lr-tiers { grid-template-columns: repeat(3, 1fr); gap: 12px; }
                .lr-tier-card { padding: 20px 14px; }
                .lr-earn-section, .lr-referral-section { padding: 28px 20px; }
                .lr-earn-grid { grid-template-columns: 1fr 1fr; }
                .lr-section-title { font-size: 1.3em; }
            }
            @media (max-width: 480px) {
                .lr-tiers { grid-template-columns: 1fr 1fr; }
                .lr-earn-grid { grid-template-columns: 1fr; }
            }
        </style>

        <!-- Hero -->
        <div class="lr-hero">
            <img src="<?php echo esc_url( $logo_white ); ?>" alt="LamakoRewards" class="lr-hero-logo">
            <p>Gagnez des points à chaque achat et débloquez des avantages exclusifs</p>
            <?php if ( ! is_user_logged_in() ) : ?>
                <a href="<?php echo wp_registration_url(); ?>" class="lr-cta" style="margin-top:24px; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">Rejoindre gratuitement</a>
            <?php endif; ?>
        </div>

        <!-- Tiers -->
        <h2 class="lr-section-title">Nos niveaux de fidélité</h2>
        <p class="lr-section-subtitle">Montez en niveau et débloquez des avantages de plus en plus exclusifs</p>
        <div class="lr-tiers">
            <div class="lr-tier-card fan">
                <div class="lr-tier-badge">🎵</div>
                <div class="lr-tier-name">Fan</div>
                <div class="lr-tier-threshold">Inscription gratuite</div>
                <div class="lr-tier-mult">x1 points</div>
                <ul class="lr-tier-benefits">
                    <li>Accès au programme de fidélité</li>
                    <li>1 point par 1 000 Ar dépensé</li>
                    <li>Historique des points et transactions</li>
                    <li>Code de parrainage personnel</li>
                </ul>
            </div>
            <div class="lr-tier-card silver">
                <div class="lr-tier-badge">⭐</div>
                <div class="lr-tier-name">Silver</div>
                <div class="lr-tier-threshold">500 pts (≈ 3-5 événements)</div>
                <div class="lr-tier-mult">x1 points</div>
                <ul class="lr-tier-benefits">
                    <li>Réductions membres exclusives</li>
                    <li>Accès prioritaire aux préventes</li>
                    <li>Offres spéciales par notification</li>
                    <li>Support prioritaire WhatsApp</li>
                </ul>
            </div>
            <div class="lr-tier-card gold">
                <div class="lr-tier-badge">🌟</div>
                <div class="lr-tier-name">Gold</div>
                <div class="lr-tier-threshold">2 000 pts (≈ 10-15 événements)</div>
                <div class="lr-tier-mult">x1.25 points</div>
                <ul class="lr-tier-benefits">
                    <li>x1.25 points sur chaque achat</li>
                    <li>Invitations aux événements exclusifs</li>
                    <li>Early access aux nouvelles ventes</li>
                    <li>Cadeaux surprises aux événements</li>
                </ul>
            </div>
            <div class="lr-tier-card platinum">
                <div class="lr-tier-badge">💎</div>
                <div class="lr-tier-name">Platinum</div>
                <div class="lr-tier-threshold">5 000 pts (≈ 30+ événements)</div>
                <div class="lr-tier-mult">x1.5 points</div>
                <ul class="lr-tier-benefits">
                    <li>x1.5 points sur chaque achat</li>
                    <li>Surclassement de billets</li>
                    <li>Accès VIP aux événements</li>
                    <li>Support dédié</li>
                </ul>
            </div>
            <div class="lr-tier-card diamond">
                <div class="lr-tier-badge">👑</div>
                <div class="lr-tier-name">Diamond</div>
                <div class="lr-tier-threshold">10 000 pts (top 1%)</div>
                <div class="lr-tier-mult">x2 points</div>
                <ul class="lr-tier-benefits">
                    <li>x2 points sur chaque achat</li>
                    <li>Accès backstage</li>
                    <li>Meet & greet artistes</li>
                    <li>Conciergerie événementielle</li>
                    <li>Surclassement automatique</li>
                    <li>Invitations privées</li>
                </ul>
            </div>
        </div>

        <!-- How to earn -->
        <div class="lr-earn-section">
            <h2 class="lr-section-title" style="color:#3d2314;">Comment gagner des points</h2>
            <p class="lr-section-subtitle">Chaque interaction vous rapproche du niveau supérieur</p>
            <div class="lr-earn-grid">
                <div class="lr-earn-item">
                    <div class="points">1 pt / 1 000 Ar</div>
                    <div class="action">Acheter des billets ou produits</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+100 pts</div>
                    <div class="action">S'inscrire au programme</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+100 pts</div>
                    <div class="action">Compléter son profil</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+200 pts</div>
                    <div class="action">Premier achat</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+75 pts</div>
                    <div class="action">Parrainer un ami</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+25 pts</div>
                    <div class="action">Être parrainé</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+20 pts</div>
                    <div class="action">Partager sur les réseaux</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+100 pts</div>
                    <div class="action">S'abonner à la newsletter</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+200 pts</div>
                    <div class="action">Bonus anniversaire</div>
                </div>
                <div class="lr-earn-item">
                    <div class="points">+2 pts</div>
                    <div class="action">Connexion quotidienne</div>
                </div>
            </div>
        </div>

        <!-- Redemption -->
        <div class="lr-redeem-section">
            <h2 class="lr-section-title">Échanger vos points</h2>
            <p class="lr-section-subtitle">Convertissez vos points en réductions sur vos prochains achats</p>
            <div class="lr-redeem-note">
                <strong>Condition :</strong> Les reductions Rewards sont debloquees a partir de 750 points disponibles et s utilisent uniquement sur les evenements et offres participants Lamako Rewards.
            </div>
            <table class="lr-redeem-table">
                <thead>
                    <tr><th>Points échangés</th><th>Réduction obtenue</th><th>Taux</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>1 000 pts</strong></td><td>20 000 Ar</td><td>20 Ar/pt</td></tr>
                    <tr><td><strong>2 000 pts</strong></td><td>40 000 Ar</td><td>20 Ar/pt</td></tr>
                </tbody>
            </table>
        </div>

        <!-- Referral -->
        <div class="lr-referral-section">
            <img src="<?php echo esc_url( $logo_white ); ?>" alt="LamakoRewards" style="max-width:200px; height:auto; margin-bottom:16px; position:relative;">
            <h2 style="font-size:1.5em; margin-bottom:12px;">Parrainez vos amis</h2>
            <p style="position:relative; max-width:500px; margin:0 auto;">Partagez votre code et gagnez <strong>75 points</strong> quand votre filleul effectue son premier achat.<br>Votre filleul reçoit aussi <strong>25 points bonus</strong> à l'inscription !</p>
            <?php if ( is_user_logged_in() ) : 
                $code = lr_generate_referral_code( get_current_user_id() );
                $count = (int) get_user_meta( get_current_user_id(), '_lamako_referral_count', true );
            ?>
                <div style="background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); display:inline-block; padding:16px 40px; border-radius:12px; margin-top:20px; border:1px solid rgba(255,255,255,0.3); position:relative;">
                    <strong style="font-size:1.5em; letter-spacing:3px; font-family:'Raleway',sans-serif;"><?php echo esc_html( $code ); ?></strong>
                </div>
                <p style="margin-top:12px; font-size:0.9em; opacity:0.8; position:relative;">Vous avez parrainé <strong><?php echo $count; ?></strong> personne(s)</p>
            <?php else : ?>
                <a href="<?php echo wp_registration_url(); ?>" class="lr-cta" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); position:relative;">S'inscrire pour obtenir mon code</a>
            <?php endif; ?>
        </div>

        <!-- FAQ -->
        <div class="lr-faq-section">
            <h2 class="lr-section-title">Questions fréquentes</h2>
            <p class="lr-section-subtitle">Tout ce que vous devez savoir sur LamakoRewards</p>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Comment rejoindre le programme LamakoRewards ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>C'est gratuit et automatique ! Il suffit de créer un compte sur TicketByLamako (site web ou application mobile). Vous recevez immédiatement <strong>100 points bonus</strong> à l'inscription et commencez au niveau Fan.</p>
                </div>
            </div>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Comment gagner des points ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>Vous gagnez <strong>1 point par 1 000 Ar dépensés</strong> sur vos achats de billets et produits. Des bonus supplémentaires sont offerts pour le parrainage (+75 pts), le premier achat (+200 pts), l'anniversaire (+200 pts), et bien d'autres actions. Les membres Gold et au-dessus bénéficient d'un multiplicateur sur leurs achats.</p>
                </div>
            </div>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Quand puis-je échanger mes points contre des réductions ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>Les reductions Rewards sont debloquees a partir de <strong>750 points disponibles</strong>. Elles sont utilisables uniquement sur les evenements et offres participants Lamako Rewards.</p>
                </div>
            </div>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Mes points expirent-ils ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>Non, vos points n'expirent jamais ! Ils restent sur votre compte tant que celui-ci est actif. Vous pouvez accumuler vos points à votre rythme et les échanger quand vous le souhaitez.</p>
                </div>
            </div>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Comment fonctionne le parrainage ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>Chaque membre reçoit un code de parrainage unique (ex: TBL-XXXXXXXX). Partagez-le avec vos amis. Quand un ami s'inscrit avec votre code et effectue son premier achat, vous recevez <strong>75 points</strong> et votre ami reçoit <strong>25 points bonus</strong>. Il n'y a pas de limite au nombre de parrainages !</p>
                </div>
            </div>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Comment utiliser ma réduction après l'échange de points ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>Lorsque vous échangez vos points, un <strong>code promo unique</strong> est généré automatiquement. Vous pouvez l'appliquer lors de votre prochain achat sur le site ou l'application. Le code est à usage unique et s'applique sur le montant total de votre commande.</p>
                </div>
            </div>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Puis-je perdre mon niveau ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>Non ! Votre niveau est basé sur vos points <strong>cumulés à vie</strong> (total de tous les points gagnés depuis l'inscription). Même si vous échangez des points, votre niveau ne baisse pas. Une fois Gold, toujours Gold (ou mieux) !</p>
                </div>
            </div>

            <div class="lr-faq-item">
                <div class="lr-faq-question" onclick="this.parentElement.classList.toggle('open')">
                    <span>Où puis-je voir mon solde de points ?</span>
                    <span class="lr-faq-arrow">▼</span>
                </div>
                <div class="lr-faq-answer">
                    <p>Vous pouvez consulter votre solde de plusieurs façons : sur l'<strong>application mobile</strong> TicketByLamako (écran Récompenses), sur cette page si vous êtes connecté(e), ou dans l'onglet <strong>"Mes Récompenses"</strong> de votre espace Mon Compte sur le site web.</p>
                </div>
            </div>
        </div>

        <!-- User Profile Section (logged in only) -->
        <?php if ( is_user_logged_in() ) : 
            $user_id = get_current_user_id();
            $balance = function_exists( 'mycred_get_users_balance' ) ? mycred_get_users_balance( $user_id ) : 0;
            $total_earned = lr_get_total_earned( $user_id );
            $tier = lr_get_tier( $total_earned );
            $tier_name = lr_get_tier_name( $tier );
            $next = lr_get_next_tier( $tier );
            $to_next = lr_get_points_to_next_tier( $total_earned );
            $next_threshold = lr_get_next_tier_threshold( $total_earned );
            $current_threshold = lr_get_current_tier_threshold( $total_earned );
            $progress = $next_threshold > $current_threshold ? min(100, (($total_earned - $current_threshold) / ($next_threshold - $current_threshold)) * 100) : 100;
        ?>
        <div class="lr-profile-section">
            <img src="<?php echo esc_url( $logo_dark ); ?>" alt="LamakoRewards" style="max-width:180px; height:auto; display:block; margin:0 auto 16px;">
            <h2>Mon compte</h2>
            <div class="lr-profile-grid">
                <div>
                    <div class="lr-profile-stat"><?php echo number_format( $balance, 0, ',', ' ' ); ?></div>
                    <div class="lr-profile-label">Points disponibles</div>
                </div>
                <div>
                    <div class="lr-profile-stat"><?php echo esc_html( $tier_name ); ?></div>
                    <div class="lr-profile-label">Niveau actuel</div>
                </div>
                <div>
                    <div class="lr-profile-stat"><?php echo number_format( $total_earned, 0, ',', ' ' ); ?></div>
                    <div class="lr-profile-label">Points totaux gagnés</div>
                </div>
            </div>
            <?php if ( $next ) : ?>
            <div class="lr-progress-bar" style="margin-top:24px;">
                <div class="lr-progress-fill" style="width:<?php echo $progress; ?>%;"></div>
            </div>
            <p style="text-align:center; margin-top:12px; color:#888; font-size:0.9em;">
                Plus que <strong style="color:#663d17;"><?php echo number_format($to_next, 0, ',', ' '); ?> points</strong> pour atteindre <strong style="color:#663d17;"><?php echo esc_html( $next ); ?></strong>
            </p>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <!-- CTA -->
        <div style="text-align:center; padding:48px 0; background:linear-gradient(135deg, #faf8f5 0%, #f5f0eb 100%); border-radius:16px; margin-bottom:20px;">
            <img src="<?php echo esc_url( $logo_dark ); ?>" alt="LamakoRewards" style="max-width:200px; height:auto; margin-bottom:16px;">
            <h2 style="color:#3d2314; margin-bottom:8px;">Prêt à commencer ?</h2>
            <p style="color:#666; margin-bottom:24px; max-width:400px; margin-left:auto; margin-right:auto;">Téléchargez l'app TicketByLamako pour gérer vos points en temps réel</p>
            <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                <a href="https://apps.apple.com/app/ticketbylamako" class="lr-cta" style="display:inline-flex; align-items:center; gap:8px;">🍎 App Store</a>
                <a href="https://play.google.com/store/apps/details?id=space.manus.ticketbylamako.app" class="lr-cta" style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, #3d2314, #663d17);">▶ Google Play</a>
            </div>
            <p style="color:#999; font-size:0.8em; margin-top:12px;">Application bientôt disponible</p>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// [lamako_rewards_cta] - Small CTA banner for existing pages
add_shortcode( 'lamako_rewards_cta', 'lr_shortcode_cta' );

function lr_shortcode_cta( $atts ) {
    $atts = shortcode_atts( array( 'text' => 'Gagnez des points sur cet achat !' ), $atts );
    ob_start();
    ?>
    <div style="background:linear-gradient(135deg, #3d2314, #6b3a1f); color:white; padding:12px 20px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; margin:16px 0; flex-wrap:wrap; gap:8px;">
        <span style="font-weight:600; display:flex; align-items:center; gap:8px;"><img src="https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_white.png" alt="LamakoRewards" style="height:22px; width:auto;"> <?php echo esc_html( $atts['text'] ); ?></span>
        <a href="/lamako-rewards" style="background:white; color:#3d2314; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:600; font-size:0.9em;">En savoir plus</a>
    </div>
    <?php
    return ob_get_clean();
}

// [lamako_rewards_checkout_popup] - Popup for checkout page
add_shortcode( 'lamako_rewards_checkout_popup', 'lr_shortcode_checkout_popup' );

function lr_shortcode_checkout_popup() {
    if ( is_user_logged_in() ) return ''; // Don't show to logged-in users
    ob_start();
    ?>
    <div id="lr-checkout-popup" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center;">
        <div style="background:white; border-radius:16px; padding:32px; max-width:400px; width:90%; text-align:center; position:relative;">
            <button onclick="document.getElementById('lr-checkout-popup').style.display='none'" style="position:absolute; top:12px; right:16px; background:none; border:none; font-size:1.5em; cursor:pointer;">&times;</button>
            <img src="https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_Dark.png" alt="LamakoRewards" style="height:40px; width:auto; margin-bottom:16px;">
            <h3 style="margin-bottom:8px; font-family:Raleway,-apple-system,sans-serif; color:#3d2314;">Rejoignez LamakoRewards !</h3>
            <p style="color:#666; font-size:0.9em; margin-bottom:16px; font-family:Raleway,-apple-system,sans-serif;">Creez un compte et gagnez <strong>100 points bonus</strong> + des points sur vos achats eligibles. Les reductions sont disponibles a partir de 750 points sur les evenements participants.</p>
            <a href="<?php echo wp_registration_url(); ?>" style="display:block; background:linear-gradient(135deg,#3d2314,#663d17); color:white; padding:14px; border-radius:8px; text-decoration:none; font-weight:600; margin-bottom:8px; font-family:Raleway,-apple-system,sans-serif;">S'inscrire gratuitement</a>
            <button onclick="document.getElementById('lr-checkout-popup').style.display='none'" style="background:none; border:none; color:#666; cursor:pointer; font-size:0.9em; font-family:Raleway,-apple-system,sans-serif;">Non merci, continuer sans compte</button>
        </div>
    </div>
    <script>
    (function() {
        setTimeout(function() {
            var popup = document.getElementById('lr-checkout-popup');
            if (popup) popup.style.display = 'flex';
        }, 3000);
    })();
    </script>
    <?php
    return ob_get_clean();
}

// ============================================================
// AUTO-INSERT CTA ON PRODUCT/EVENT PAGES
// ============================================================

// Single product page - detailed badge
add_action( 'woocommerce_before_add_to_cart_form', 'lr_product_page_cta' );

function lr_product_page_cta() {
    global $product;
    if ( ! $product ) return;
    
    $price = (float) $product->get_price();
    $base_points = floor( $price / 1000 );
    
    if ( $base_points <= 0 ) return;
    
    // Get user tier multiplier if logged in
    $multiplier = 1;
    $tier_name = '';
    $tier_emoji = '';
    if ( is_user_logged_in() ) {
        $user_id = get_current_user_id();
        $lifetime = (int) get_user_meta( $user_id, 'lr_lifetime_points', true );
        if ( $lifetime >= LR_TIER_DIAMOND ) { $multiplier = 2; $tier_name = 'Diamond'; $tier_emoji = '👑'; }
        elseif ( $lifetime >= LR_TIER_PLATINUM ) { $multiplier = 1.5; $tier_name = 'Platinum'; $tier_emoji = '💎'; }
        elseif ( $lifetime >= LR_TIER_GOLD ) { $multiplier = 1.25; $tier_name = 'Gold'; $tier_emoji = '🌟'; }
        else { $multiplier = 1; }
    }
    
    $final_points = floor( $base_points * $multiplier );
    $logo_dark = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_Dark.png';
    
    // Stacked layout (matching mobile app PointsBadge)
    echo '<div style="background:#fdf6ee; border:1px solid #e8d5a3; border-radius:12px; padding:16px; margin-bottom:16px; font-family:Raleway,-apple-system,sans-serif;">';
    
    // Row 1: logo + points text
    echo '<div style="display:flex; align-items:center; gap:10px;">';
    echo '<img src="' . esc_url( $logo_dark ) . '" alt="LamakoRewards" style="width:36px; height:auto; flex-shrink:0;">';
    echo '<div>';
    echo '<div style="font-weight:600; color:#3d2314; font-size:0.9em;">Gagnez <span style="font-weight:700; color:#b45309; font-size:1.05em;">' . $final_points . ' points</span> LamakoRewards</div>';
    if ( $multiplier > 1 ) {
        echo '<div style="font-size:0.78em; color:#92400e; margin-top:2px;">' . $tier_emoji . ' Bonus ' . $tier_name . ' : x' . $multiplier . '</div>';
    }
    echo '</div>';
    echo '</div>';
    
    // Row 2: user info or signup CTA
    if ( ! is_user_logged_in() ) {
        echo '<div style="margin-top:10px; padding-top:10px; border-top:1px solid #e8d5a3; font-size:0.8em; color:#92400e;"><a href="' . wp_registration_url() . '" style="color:#b45309; font-weight:600; text-decoration:underline;">Inscrivez-vous gratuitement</a> pour commencer</div>';
    } else {
        $balance = (int) get_user_meta( get_current_user_id(), 'lr_points_balance', true );
        echo '<div style="margin-top:10px; padding-top:10px; border-top:1px solid #e8d5a3; font-size:0.8em; color:#92400e;">Votre solde : <strong>' . $balance . ' pts</strong></div>';
    }
    
    echo '</div>';
}

// Shop loop / product listing - compact badge
add_action( 'woocommerce_after_shop_loop_item_title', 'lr_shop_loop_points_badge', 15 );

function lr_shop_loop_points_badge() {
    global $product;
    if ( ! $product ) return;
    
    $price = (float) $product->get_price();
    $points = floor( $price / 1000 );
    
    if ( $points > 0 ) {
        $logo_dark = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_Dark.png';
        echo '<div style="font-family:Raleway,-apple-system,sans-serif; font-size:0.78em; color:#b45309; font-weight:600; margin-top:4px; display:flex; align-items:center; gap:4px;">';
        echo '<img src="' . esc_url( $logo_dark ) . '" alt="LR" style="width:18px; height:auto;">';
        echo '+' . $points . ' pts LamakoRewards';
        echo '</div>';
    }
}

// Auto-insert checkout popup for guests (uses wp_footer for block checkout compatibility)
add_action( 'wp_footer', 'lr_checkout_page_popup' );

function lr_checkout_page_popup() {
    if ( is_user_logged_in() ) return;
    // Show on: checkout, cart, events, shop/boutique pages
    $is_target = false;
    if ( function_exists( 'is_checkout' ) && is_checkout() ) $is_target = true;
    if ( function_exists( 'is_cart' ) && is_cart() ) $is_target = true;
    if ( is_page( 'checkout' ) || is_page( 'cart' ) || is_page( 'panier' ) ) $is_target = true;
    if ( function_exists( 'is_shop' ) && is_shop() ) $is_target = true;
    if ( is_singular( 'tc_events' ) ) $is_target = true;
    if ( is_singular( 'product' ) ) $is_target = true;
    if ( is_post_type_archive( 'tc_events' ) ) $is_target = true;
    // Fallback: check page ID directly
    $page_id = get_queried_object_id();
    if ( $page_id == wc_get_page_id( 'checkout' ) || $page_id == wc_get_page_id( 'cart' ) || $page_id == wc_get_page_id( 'shop' ) ) $is_target = true;
    if ( ! $is_target ) return;
    echo do_shortcode( '[lamako_rewards_checkout_popup]' );
}

// ============================================================
// WOOCOMMERCE MY ACCOUNT TAB
// ============================================================

// Add "Mes Récompenses" tab to My Account
add_filter( 'woocommerce_account_menu_items', 'lr_add_account_tab' );

function lr_add_account_tab( $items ) {
    $new_items = array();
    foreach ( $items as $key => $label ) {
        $new_items[ $key ] = $label;
        if ( $key === 'orders' ) {
            $new_items['lamako-rewards'] = 'Mes Récompenses';
        }
    }
    return $new_items;
}

add_action( 'init', 'lr_add_account_endpoint' );

function lr_add_account_endpoint() {
    add_rewrite_endpoint( 'lamako-rewards', EP_PAGES );
}

add_action( 'woocommerce_account_lamako-rewards_endpoint', 'lr_account_rewards_content' );

function lr_account_rewards_content() {
    $user_id = get_current_user_id();
    $balance = function_exists( 'mycred_get_users_balance' ) ? mycred_get_users_balance( $user_id ) : 0;
    $total_earned = lr_get_total_earned( $user_id );
    $tier = lr_get_tier( $total_earned );
    $tier_name = lr_get_tier_name( $tier );
    $multiplier = lr_get_multiplier( $tier );
    $code = lr_generate_referral_code( $user_id );
    $referral_count = (int) get_user_meta( $user_id, '_lamako_referral_count', true );
    $next = lr_get_next_tier( $tier );
    $to_next = lr_get_points_to_next_tier( $total_earned );
    $can_redeem = $total_earned >= LR_REDEMPTION_MIN_LIFETIME;
    $logo_dark = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_Dark.png';
    
    // Tier colors
    $tier_colors = array( 'fan' => '#c79f6c', 'silver' => '#C0C0C0', 'gold' => '#FFD700', 'platinum' => '#a8a8a8', 'diamond' => '#7dd3fc' );
    $tier_color = $tier_colors[ $tier ] ?? '#c79f6c';
    $tier_emojis = array( 'fan' => '🎵', 'silver' => '⭐', 'gold' => '🌟', 'platinum' => '💎', 'diamond' => '👑' );
    $tier_emoji = $tier_emojis[ $tier ] ?? '';
    
    // Progress calculation
    $next_threshold = lr_get_next_tier_threshold( $total_earned );
    $current_threshold = lr_get_current_tier_threshold( $total_earned );
    $range = max( 1, $next_threshold - $current_threshold );
    $progress = $tier === 'diamond' ? 100 : min( 100, ( ( $total_earned - $current_threshold ) / $range ) * 100 );
    
    ?>
    <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <div style="max-width:680px; font-family:'Raleway', -apple-system, sans-serif;">
        
        <!-- Header with logo -->
        <div style="text-align:center; margin-bottom:32px;">
            <img src="<?php echo esc_url( $logo_dark ); ?>" alt="LamakoRewards" style="max-width:220px; height:auto; margin-bottom:12px;">
        </div>
        
        <!-- Stats cards -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:28px;">
            <div style="background:linear-gradient(135deg, #3d2314, #663d17); padding:24px 16px; border-radius:12px; text-align:center; color:white;">
                <div style="font-size:2.2em; font-weight:800;"><?php echo number_format( $balance, 0, ',', ' ' ); ?></div>
                <div style="font-size:0.85em; opacity:0.85; margin-top:4px;">Points disponibles</div>
            </div>
            <div style="background:white; padding:24px 16px; border-radius:12px; text-align:center; border:2px solid <?php echo $tier_color; ?>;">
                <div style="font-size:1.2em; margin-bottom:4px;"><?php echo $tier_emoji; ?></div>
                <div style="font-size:1.6em; font-weight:800; color:#3d2314;"><?php echo esc_html( $tier_name ); ?></div>
                <div style="font-size:0.85em; color:#888; margin-top:4px;">x<?php echo $multiplier; ?> points</div>
            </div>
            <div style="background:#f9fafb; padding:24px 16px; border-radius:12px; text-align:center;">
                <div style="font-size:2.2em; font-weight:800; color:#663d17;"><?php echo number_format( $total_earned, 0, ',', ' ' ); ?></div>
                <div style="font-size:0.85em; color:#888; margin-top:4px;">Points cumulés</div>
            </div>
        </div>
        
        <!-- Progress bar -->
        <?php if ( $next ) : ?>
        <div style="background:#faf8f5; padding:20px 24px; border-radius:12px; margin-bottom:28px; border:1px solid #f0ebe5;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-weight:600; color:#3d2314;">Progression vers <?php echo esc_html( $next ); ?></span>
                <span style="font-weight:700; color:#663d17;"><?php echo round( $progress ); ?>%</span>
            </div>
            <div style="background:#e5e0d8; border-radius:6px; height:10px; overflow:hidden;">
                <div style="background:linear-gradient(90deg, #c79f6c, #663d17); height:100%; width:<?php echo $progress; ?>%; border-radius:6px; transition:width 0.5s ease;"></div>
            </div>
            <div style="font-size:0.85em; color:#888; margin-top:8px;">Plus que <strong style="color:#3d2314;"><?php echo number_format( $to_next, 0, ',', ' ' ); ?> points</strong> pour atteindre <strong><?php echo esc_html( $next ); ?></strong></div>
        </div>
        <?php elseif ( $tier === 'diamond' ) : ?>
        <div style="background:linear-gradient(135deg, #f0f9ff, #e0f2fe); padding:20px 24px; border-radius:12px; margin-bottom:28px; border:1px solid #7dd3fc; text-align:center;">
            <div style="font-size:1.1em; font-weight:700; color:#0369a1;">👑 Niveau maximum atteint ! Vous êtes au sommet.</div>
        </div>
        <?php endif; ?>
        
        <!-- Rewards reduction status -->
        <div style="background:<?php echo $can_redeem ? '#f0fdf4' : '#fef3c7'; ?>; padding:20px 24px; border-radius:12px; margin-bottom:28px; border:1px solid <?php echo $can_redeem ? '#bbf7d0' : '#fde68a'; ?>;">
            <?php if ( $can_redeem ) : ?>
                <div style="font-weight:700; color:#166534; margin-bottom:4px;">Reduction Rewards debloquee</div>
                <div style="font-size:0.9em; color:#15803d;">Vos points peuvent etre utilises sur les evenements et offres participants Lamako Rewards.</div>
            <?php else : ?>
                <div style="font-weight:700; color:#92400e; margin-bottom:4px;">Reduction Rewards verrouillee</div>
                <div style="font-size:0.9em; color:#a16207;">Les reductions Rewards sont debloquees a partir de <?php echo number_format( lr_rewards_minimum_redeem_points(), 0, ',', ' ' ); ?> points disponibles. Il vous manque <strong><?php echo number_format( max( 0, lr_rewards_minimum_redeem_points() - $balance ), 0, ',', ' ' ); ?> pts</strong>.</div>
            <?php endif; ?>
        </div>
        
        <!-- Referral code -->
        <div style="background:linear-gradient(135deg, #3d2314, #663d17); padding:28px 24px; border-radius:12px; text-align:center; margin-bottom:28px; color:white;">
            <div style="font-size:1.1em; font-weight:700; margin-bottom:12px;">Mon code de parrainage</div>
            <div style="background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); padding:14px 24px; border-radius:8px; display:inline-block; margin-bottom:12px; border:1px solid rgba(255,255,255,0.2);">
                <code style="font-size:1.4em; letter-spacing:3px; font-weight:800; color:white;"><?php echo esc_html( $code ); ?></code>
            </div>
            <div style="font-size:0.9em; opacity:0.85;">Partagez ce code et gagnez <strong>75 pts</strong> par filleul</div>
            <div style="font-size:0.85em; opacity:0.7; margin-top:8px;">Filleuls parrainés : <strong><?php echo $referral_count; ?></strong></div>
        </div>
        
        <!-- CTA -->
        <div style="text-align:center;">
            <a href="/lamako-rewards" style="display:inline-block; background:linear-gradient(135deg, #c79f6c, #a67c52); color:white; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; font-size:1em; transition:opacity 0.2s;">Voir tous les avantages →</a>
        </div>
    </div>
    <?php
}

// ============================================================
// HOMEPAGE LAMAKOREWARDS CTA BANNER
// ============================================================

// add_action( 'wp_footer', 'lr_homepage_cta_banner' ); // Disabled - trop intrusif

function lr_homepage_cta_banner() {
    if ( ! is_front_page() ) return;
    $logo_white = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_white.png';
    ?>
    <div id="lr-homepage-banner" style="
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 9999;
        background: linear-gradient(135deg, #3d2314 0%, #663d17 50%, #8B5E34 100%);
        color: white;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        flex-wrap: wrap;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
        font-family: 'Raleway', -apple-system, sans-serif;
        transform: translateY(100%);
        transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    ">
        <img src="<?php echo esc_url( $logo_white ); ?>" alt="LamakoRewards" style="height:36px; width:auto;">
        <span style="font-size:1em; font-weight:600;">Gagnez des points sur vos achats eligibles et suivez votre progression Rewards.</span>
        <a href="/lamako-rewards" style="
            background: white;
            color: #3d2314;
            padding: 10px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 700;
            font-size: 0.95em;
            white-space: nowrap;
            transition: opacity 0.2s;
        " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Découvrir le programme</a>
        <button onclick="document.getElementById('lr-homepage-banner').style.display='none'" style="
            background: none;
            border: none;
            color: white;
            font-size: 1.4em;
            cursor: pointer;
            opacity: 0.7;
            padding: 0 4px;
            line-height: 1;
        " aria-label="Fermer">&times;</button>
    </div>
    <script>
    (function() {
        // Show banner after 2 seconds with slide-up animation
        setTimeout(function() {
            var banner = document.getElementById('lr-homepage-banner');
            if (banner) banner.style.transform = 'translateY(0)';
        }, 2000);
        // Auto-hide after 15 seconds
        setTimeout(function() {
            var banner = document.getElementById('lr-homepage-banner');
            if (banner && banner.style.display !== 'none') {
                banner.style.transform = 'translateY(100%)';
            }
        }, 17000);
    })();
    </script>
    <?php
}

// ============================================================
// WELCOME EMAIL FOR NEW USERS
// ============================================================

add_action( 'user_register', 'lr_send_welcome_email', 20 );

function lr_send_welcome_email( $user_id ) {
    $user = get_userdata( $user_id );
    if ( ! $user ) return;
    
    $first_name = $user->first_name ?: $user->display_name;
    $logo_dark = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_Dark.png';
    $rewards_url = home_url( '/lamako-rewards/' );
    
    $subject = 'Bienvenue chez LamakoRewards ! +100 points offerts';
    
    $body = '
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&display=swap" rel="stylesheet">
    </head>
    <body style="margin:0; padding:0; background:#f9fafb; font-family:Raleway,-apple-system,BlinkMacSystemFont,sans-serif;">
        <div style="max-width:600px; margin:0 auto; background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
            <!-- Header -->
            <div style="background:linear-gradient(135deg, #3d2314 0%, #663d17 50%, #8B5E34 100%); padding:40px 32px; text-align:center;">
                <img src="' . esc_url( $logo_dark ) . '" alt="LamakoRewards" style="height:50px; width:auto; filter:brightness(0) invert(1);">
                <h1 style="color:white; margin:16px 0 0; font-size:1.6em; font-weight:800;">Bienvenue, ' . esc_html( $first_name ) . ' !</h1>
            </div>
            
            <!-- Content -->
            <div style="padding:32px;">
                <div style="background:linear-gradient(135deg, #fdf6ee, #fef3c7); border:1px solid #e8d5a3; border-radius:12px; padding:24px; text-align:center; margin-bottom:24px;">
                    <div style="font-size:2.5em; font-weight:800; color:#b45309;">+100 pts</div>
                    <div style="font-size:1em; color:#92400e; font-weight:600; margin-top:4px;">Bonus d\'inscription offert !</div>
                </div>
                
                <p style="color:#333; font-size:1em; line-height:1.6; margin-bottom:16px;">
                    Vous faites maintenant partie du programme <strong>LamakoRewards</strong> ! Gagnez des points sur vos achats eligibles, puis utilisez-les en reduction sur les evenements et offres participants.
                </p>
                
                <h3 style="color:#3d2314; margin:24px 0 12px; font-weight:700;">Comment ca marche :</h3>
                <table style="width:100%; border-collapse:collapse; font-size:0.9em;">
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:10px 0;">Achat de billets/produits</td>
                        <td style="padding:10px 0; text-align:right; font-weight:700; color:#b45309;">1 pt / 1 000 Ar</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:10px 0;">Parrainage d\'un ami</td>
                        <td style="padding:10px 0; text-align:right; font-weight:700; color:#b45309;">+75 pts</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:10px 0;">Presence a un evenement</td>
                        <td style="padding:10px 0; text-align:right; font-weight:700; color:#b45309;">+10 pts</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;">Reductions Rewards</td>
                        <td style="padding:10px 0; text-align:right; font-weight:700; color:#b45309;">Des 750 pts disponibles</td>
                    </tr>
                </table>
                
                <div style="text-align:center; margin-top:32px;">
                    <a href="' . esc_url( $rewards_url ) . '" style="display:inline-block; background:linear-gradient(135deg, #3d2314, #663d17); color:white; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; font-size:1em;">Decouvrir mes avantages</a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background:#f9fafb; padding:20px 32px; text-align:center; border-top:1px solid #f0f0f0;">
                <p style="color:#888; font-size:0.8em; margin:0;">TicketByLamako - La billetterie #1 a Madagascar</p>
            </div>
        </div>
    </body>
    </html>';
    
    $headers = array(
        'Content-Type: text/html; charset=UTF-8',
        'From: LamakoRewards <noreply@ticketbylamako.com>',
    );
    
    wp_mail( $user->user_email, $subject, $body, $headers );
}

// ============================================================
// HEADER BANNER (SITE-WIDE, ABOVE MENU)
// ============================================================

// Header banner removed (trop intrusif per user feedback)
// add_action( 'wp_body_open', 'lr_header_banner' );

// --- HEADER POINTS COUNTER (for logged-in users) ---
// add_action( 'wp_footer', 'lr_header_points_counter' ); // Disabled - trop intrusif

function lr_header_points_counter() {
    if ( ! is_user_logged_in() ) return;
    if ( is_admin() ) return;
    
    $user_id = get_current_user_id();
    $balance = (int) get_user_meta( $user_id, 'mycred_default', true );
    $lifetime = (int) get_user_meta( $user_id, 'mycred_default_total', true );
    $tier = 'Fan';
    $tier_emoji = '🎵';
    $tier_color = '#9BA1A6';
    
    if ( $lifetime >= LR_TIER_DIAMOND ) { $tier = 'Diamond'; $tier_emoji = '👑'; $tier_color = '#E5E4E2'; }
    elseif ( $lifetime >= LR_TIER_PLATINUM ) { $tier = 'Platinum'; $tier_emoji = '💎'; $tier_color = '#B9F2FF'; }
    elseif ( $lifetime >= LR_TIER_GOLD ) { $tier = 'Gold'; $tier_emoji = '🌟'; $tier_color = '#c79f6c'; }
    elseif ( $lifetime >= LR_TIER_SILVER ) { $tier = 'Silver'; $tier_emoji = '⭐'; $tier_color = '#C0C0C0'; }
    
    $logo_dark = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_Dark.png';
    ?>
    <style>
    #lr-points-counter {
        position: fixed;
        top: 70px;
        right: 16px;
        z-index: 9999;
        font-family: 'Raleway', -apple-system, sans-serif;
    }
    #lr-points-toggle {
        background: linear-gradient(135deg, #663d17, #c79f6c);
        color: white;
        border: none;
        border-radius: 50px;
        padding: 6px 14px;
        font-size: 0.8em;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 2px 8px rgba(102,61,23,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
        font-family: 'Raleway', -apple-system, sans-serif;
    }
    #lr-points-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(102,61,23,0.4);
    }
    #lr-points-detail {
        display: none;
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        background: white;
        border-radius: 12px;
        padding: 16px;
        min-width: 220px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        border: 1px solid #E5E7EB;
        font-family: 'Raleway', -apple-system, sans-serif;
    }
    #lr-points-detail.lr-show { display: block; }
    @media (max-width: 768px) {
        #lr-points-counter { top: auto; bottom: 80px; right: 12px; }
    }
    </style>
    <div id="lr-points-counter">
        <button id="lr-points-toggle" onclick="document.getElementById('lr-points-detail').classList.toggle('lr-show')">
            <span><?php echo $tier_emoji; ?></span>
            <span><?php echo number_format( $balance, 0, ',', ' ' ); ?> pts</span>
        </button>
        <div id="lr-points-detail">
            <div style="text-align:center; margin-bottom:10px;">
                <img src="<?php echo esc_url( $logo_dark ); ?>" alt="LamakoRewards" style="height:28px; width:auto;">
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:#687076; font-size:0.85em;">Solde</span>
                <span style="font-weight:700; color:#11181C;"><?php echo number_format( $balance, 0, ',', ' ' ); ?> pts</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:#687076; font-size:0.85em;">Niveau</span>
                <span style="font-weight:700; color:<?php echo $tier_color; ?>;"><?php echo $tier_emoji . ' ' . $tier; ?></span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                <span style="color:#687076; font-size:0.85em;">Cumulés</span>
                <span style="font-weight:600; color:#11181C;"><?php echo number_format( $lifetime, 0, ',', ' ' ); ?> pts</span>
            </div>
            <a href="/lamako-rewards" style="
                display:block;
                text-align:center;
                background: linear-gradient(135deg, #663d17, #c79f6c);
                color:white;
                padding:8px;
                border-radius:8px;
                text-decoration:none;
                font-weight:600;
                font-size:0.85em;
            ">Voir mes récompenses</a>
        </div>
    </div>
    <script>
    document.addEventListener('click', function(e) {
        var counter = document.getElementById('lr-points-counter');
        var detail = document.getElementById('lr-points-detail');
        if (counter && detail && !counter.contains(e.target)) {
            detail.classList.remove('lr-show');
        }
    });
    </script>
    <?php
}

// ============================================================
// TICKERA EVENT PAGES - POINTS BADGE
// ============================================================

add_action( 'the_content', 'lr_tickera_event_badge', 5 );

function lr_tickera_event_badge( $content ) {
    if ( ! is_singular( 'tc_events' ) ) return $content;
    
    global $post;
    
    // Get the event's ticket price (from linked ticket products)
    $event_id = $post->ID;
    $price = 0;
    
    // Try to get price from Tickera ticket types linked to this event
    $ticket_types = get_posts( array(
        'post_type' => 'tc_tickets',
        'meta_key' => 'event_name',
        'meta_value' => $event_id,
        'posts_per_page' => -1,
        'fields' => 'ids',
    ));
    
    if ( ! empty( $ticket_types ) ) {
        // Get the cheapest ticket price for display
        $min_price = PHP_INT_MAX;
        foreach ( $ticket_types as $ticket_id ) {
            $ticket_price = (float) get_post_meta( $ticket_id, 'price_per_ticket', true );
            if ( $ticket_price > 0 && $ticket_price < $min_price ) {
                $min_price = $ticket_price;
            }
        }
        if ( $min_price < PHP_INT_MAX ) $price = $min_price;
    }
    
    // Fallback: try WooCommerce product linked to event
    if ( $price <= 0 ) {
        $wc_product_id = get_post_meta( $event_id, '_wc_product_id', true );
        if ( $wc_product_id && function_exists( 'wc_get_product' ) ) {
            $product = wc_get_product( $wc_product_id );
            if ( $product ) $price = (float) $product->get_price();
        }
    }
    
    $base_points = floor( $price / 1000 );
    
    // Get user tier multiplier
    $multiplier = 1;
    $tier_info = '';
    $tier_name = '';
    if ( is_user_logged_in() ) {
        $user_id = get_current_user_id();
        $lifetime = (int) get_user_meta( $user_id, 'lr_lifetime_points', true );
        if ( $lifetime >= LR_TIER_DIAMOND ) { $multiplier = 2; $tier_info = 'x2'; $tier_name = 'Diamond'; }
        elseif ( $lifetime >= LR_TIER_PLATINUM ) { $multiplier = 1.5; $tier_info = 'x1.5'; $tier_name = 'Platinum'; }
        elseif ( $lifetime >= LR_TIER_GOLD ) { $multiplier = 1.25; $tier_info = 'x1.25'; $tier_name = 'Gold'; }
    }
    
    $final_points = ( $base_points > 0 ) ? floor( $base_points * $multiplier ) : 0;
    
    // Premium dark card style (matching mobile app RewardsPopup)
    $logo_white = 'https://www.ticketbylamako.com/wp-content/uploads/2026/04/LamakoRewards_white.png';
    $register_url = wp_registration_url();
    $login_url = wp_login_url( get_permalink() );
    
    $badge = '<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800&display=swap" rel="stylesheet">';
    $badge .= '<div class="lr-event-badge-premium" style="'
        . 'position:relative; overflow:hidden; border-radius:20px; margin-bottom:28px; '
        . 'background: linear-gradient(135deg, #1a0f0a 0%, #2d1810 40%, #3d2314 100%); '
        . 'box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(199,159,108,0.1); '
        . 'font-family: Raleway, -apple-system, BlinkMacSystemFont, sans-serif;">';
    
    // Decorative background pattern (subtle radial glow)
    $badge .= '<div style="position:absolute; top:0; left:0; right:0; bottom:0; '
        . 'background: radial-gradient(ellipse at 30% 20%, rgba(199,159,108,0.08) 0%, transparent 60%), '
        . 'radial-gradient(ellipse at 80% 80%, rgba(199,159,108,0.05) 0%, transparent 50%); '
        . 'pointer-events:none;"></div>';
    
    // Content container
    $badge .= '<div style="position:relative; z-index:1; padding:32px 28px; text-align:center;">';
    
    // White logo
    $badge .= '<img src="' . esc_url( $logo_white ) . '" alt="LamakoRewards" style="'
        . 'width:120px; height:auto; margin:0 auto 6px; display:block;">';
    
    // "Rewards" label in gold
    $badge .= '<div style="color:#c79f6c; font-size:13px; font-weight:600; letter-spacing:1px; margin-bottom:18px;">REWARDS</div>';
    
    // Points display (if available)
    if ( $final_points > 0 ) {
        $badge .= '<div style="margin-bottom:14px;">';
        $badge .= '<span style="color:#c79f6c; font-size:32px; font-weight:800; line-height:1;">' . $final_points . '</span>';
        $badge .= '<span style="color:rgba(255,255,255,0.8); font-size:14px; font-weight:600; margin-left:6px;">points</span>';
        if ( $tier_info ) {
            $badge .= '<div style="color:#c79f6c; font-size:12px; font-weight:500; margin-top:4px; opacity:0.85;">Bonus ' . $tier_name . ' ' . $tier_info . '</div>';
        }
        $badge .= '</div>';
    }
    
    // Main text
    $badge .= '<p style="color:#ffffff; font-size:15px; font-weight:600; line-height:1.5; margin:0 0 10px; max-width:320px; margin-left:auto; margin-right:auto;">';
    $badge .= 'Gagnez des points sur vos achats eligibles<br>et suivez votre progression Rewards.';
    $badge .= '</p>';
    
    // Features line
    $badge .= '<p style="color:rgba(255,255,255,0.65); font-size:12px; font-weight:500; margin:0 0 22px; letter-spacing:0.3px;">';
    $badge .= 'Reductions des 750 pts &bull; Offres participantes &bull; Statut membre';
    $badge .= '</p>';
    
    if ( ! is_user_logged_in() ) {
        // CTA button (gold)
        $badge .= '<a href="' . esc_url( $register_url ) . '" style="'
            . 'display:inline-block; background:#c79f6c; color:#ffffff; '
            . 'padding:14px 36px; border-radius:30px; text-decoration:none; '
            . 'font-size:15px; font-weight:700; letter-spacing:0.3px; '
            . 'box-shadow: 0 4px 16px rgba(199,159,108,0.3); '
            . 'transition: opacity 0.2s, transform 0.2s;" '
            . 'onmouseover="this.style.opacity=0.9;this.style.transform=\'scale(0.98)\'" '
            . 'onmouseout="this.style.opacity=1;this.style.transform=\'scale(1)\'">';
        $badge .= 'Rejoindre maintenant !';
        $badge .= '</a>';
        
        // Login link
        $badge .= '<div style="margin-top:14px;">';
        $badge .= '<span style="color:rgba(255,255,255,0.55); font-size:13px;">Deja un compte ? </span>';
        $badge .= '<a href="' . esc_url( $login_url ) . '" style="color:#c79f6c; font-size:13px; font-weight:600; text-decoration:none;">Se connecter</a>';
        $badge .= '</div>';
    } else {
        // Logged-in user: show balance + link to rewards page
        $balance = (int) get_user_meta( get_current_user_id(), 'lr_points_balance', true );
        $badge .= '<div style="background:rgba(199,159,108,0.12); border:1px solid rgba(199,159,108,0.25); border-radius:12px; padding:12px 20px; display:inline-block;">';
        $badge .= '<span style="color:rgba(255,255,255,0.7); font-size:13px;">Votre solde : </span>';
        $badge .= '<span style="color:#c79f6c; font-size:16px; font-weight:700;">' . $balance . ' pts</span>';
        $badge .= '</div>';
        $badge .= '<div style="margin-top:12px;"><a href="/lamako-rewards" style="color:#c79f6c; font-size:13px; font-weight:600; text-decoration:none;">Voir mes recompenses &rarr;</a></div>';
    }
    
    $badge .= '</div>'; // end content
    $badge .= '</div>'; // end card
    
    return $badge . $content;
}

// Flush rewrite rules on activation
register_activation_hook( __FILE__, function() {
    lr_add_account_endpoint();
    flush_rewrite_rules();
});
