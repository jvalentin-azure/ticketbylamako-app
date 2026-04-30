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

define( 'LR_API_KEY', defined( 'LAMAKO_REWARDS_API_KEY' ) ? LAMAKO_REWARDS_API_KEY : 'LR_2024_SECURE_KEY_TBL' );
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
    if ( $api_key && $api_key === LR_API_KEY ) {
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
    
    // Check if points already awarded for this order
    $awarded = get_post_meta( $order_id, '_lamako_points_awarded', true );
    if ( $awarded ) return;
    
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
    
    // Mark order as processed
    update_post_meta( $order_id, '_lamako_points_awarded', $final_points );
    update_post_meta( $order_id, '_lamako_points_multiplier', $multiplier );
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
    
    // Validate redemption tiers (fixed rate: 20 Ar/pt = 2% cashback)
    $valid_tiers = array( 500, 1000, 2000, 5000 );
    if ( ! in_array( $points, $valid_tiers ) ) {
        return new WP_Error( 'invalid_points', 'Points must be one of: 500, 1000, 2000, 5000.', array( 'status' => 400 ) );
    }
    
    // Check balance
    if ( ! function_exists( 'mycred_get_users_balance' ) ) {
        return new WP_Error( 'mycred_missing', 'myCred plugin not active.', array( 'status' => 500 ) );
    }
    
    $balance = mycred_get_users_balance( $user_id );
    if ( $balance < $points ) {
        return new WP_Error( 'insufficient_points', 'Solde insuffisant.', array( 'status' => 400 ) );
    }
    
    // Calculate discount value (fixed rate: 20 Ar per point = 2% cashback)
    $values = array( 500 => 10000, 1000 => 20000, 2000 => 40000, 5000 => 100000 );
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
    return rest_ensure_response( array(
        'tiers' => array(
            array(
                'id' => 'fan',
                'name' => 'Fan',
                'min_points' => LR_TIER_FAN,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_FAN,
                'benefits' => array( 'Accès au programme', '1 pt/1000 Ar', 'Code parrainage' ),
            ),
            array(
                'id' => 'silver',
                'name' => 'Silver',
                'min_points' => LR_TIER_SILVER,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_SILVER,
                'benefits' => array( 'Réductions membres', 'Préventes', 'Offres spéciales', 'Support WhatsApp' ),
            ),
            array(
                'id' => 'gold',
                'name' => 'Gold',
                'min_points' => LR_TIER_GOLD,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_GOLD,
                'benefits' => array( 'x1.25 points', 'Événements exclusifs', 'Early access', 'Cadeaux surprises' ),
            ),
            array(
                'id' => 'platinum',
                'name' => 'Platinum',
                'min_points' => LR_TIER_PLATINUM,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_PLATINUM,
                'benefits' => array( 'x1.5 points', 'Surclassement billets', 'Accès VIP', 'Support dédié' ),
            ),
            array(
                'id' => 'diamond',
                'name' => 'Diamond',
                'min_points' => LR_TIER_DIAMOND,
                'discount' => 0,
                'multiplier' => LR_MULTIPLIER_DIAMOND,
                'benefits' => array( 'x2 points', 'Backstage', 'Meet & greet', 'Conciergerie', 'Surclassement auto' ),
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
            array( 'points' => 500, 'value' => 10000 ),
            array( 'points' => 1000, 'value' => 20000 ),
            array( 'points' => 2000, 'value' => 40000 ),
            array( 'points' => 5000, 'value' => 100000 ),
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
            .lr-tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 48px; }
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
                .lr-tiers { grid-template-columns: 1fr 1fr; gap: 12px; }
                .lr-tier-card { padding: 20px 14px; }
                .lr-earn-section, .lr-referral-section { padding: 28px 20px; }
                .lr-earn-grid { grid-template-columns: 1fr 1fr; }
                .lr-section-title { font-size: 1.3em; }
            }
            @media (max-width: 480px) {
                .lr-tiers { grid-template-columns: 1fr; }
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
                    <li>1 point par 1 000 Ar dépensé</li>
                    <li>Code de parrainage personnel</li>
                    <li>Historique des transactions</li>
                    <li>100 pts bonus à l'inscription</li>
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
                    <li>Support WhatsApp prioritaire</li>
                </ul>
            </div>
            <div class="lr-tier-card gold">
                <div class="lr-tier-badge">🌟</div>
                <div class="lr-tier-name">Gold</div>
                <div class="lr-tier-threshold">2 000 pts (≈ 10-15 événements)</div>
                <div class="lr-tier-mult">x1.25 points</div>
                <ul class="lr-tier-benefits">
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
                    <li>Surclassement de billets</li>
                    <li>Accès VIP aux événements</li>
                    <li>Support dédié par téléphone</li>
                </ul>
            </div>
            <div class="lr-tier-card diamond">
                <div class="lr-tier-badge">👑</div>
                <div class="lr-tier-name">Diamond</div>
                <div class="lr-tier-threshold">10 000 pts (top 1%)</div>
                <div class="lr-tier-mult">x2 points</div>
                <ul class="lr-tier-benefits">
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
                <strong>Condition :</strong> Le cashback est débloqué dès 750 000 Ar dépensés au total (= 750 points cumulés). Taux fixe : 20 Ar par point (2% de retour).
            </div>
            <table class="lr-redeem-table">
                <thead>
                    <tr><th>Points échangés</th><th>Réduction obtenue</th><th>Taux</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>500 pts</strong></td><td>10 000 Ar</td><td>20 Ar/pt</td></tr>
                    <tr><td><strong>1 000 pts</strong></td><td>20 000 Ar</td><td>20 Ar/pt</td></tr>
                    <tr><td><strong>2 000 pts</strong></td><td>40 000 Ar</td><td>20 Ar/pt</td></tr>
                    <tr><td><strong>5 000 pts</strong></td><td>100 000 Ar</td><td>20 Ar/pt</td></tr>
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
                    <p>Le cashback est débloqué dès que vous avez dépensé <strong>750 000 Ar au total</strong> sur la plateforme (soit 750 points cumulés à vie). Cela correspond à environ 5 à 7 événements. Une fois ce seuil atteint, vous pouvez échanger vos points à tout moment au taux de 20 Ar par point.</p>
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
            <a href="https://www.ticketbylamako.com/app" class="lr-cta">Télécharger l'application</a>
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
        <span style="font-weight:600;">🎵 <?php echo esc_html( $atts['text'] ); ?></span>
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
            <div style="font-size:2.5em; margin-bottom:12px;">🎵</div>
            <h3 style="margin-bottom:8px;">Rejoignez LamakoRewards !</h3>
            <p style="color:#666; font-size:0.9em; margin-bottom:16px;">Créez un compte et gagnez <strong>50 points bonus</strong> + des points sur cet achat. Échangez-les contre des réductions !</p>
            <a href="<?php echo wp_registration_url(); ?>" style="display:block; background:#3d2314; color:white; padding:14px; border-radius:8px; text-decoration:none; font-weight:600; margin-bottom:8px;">S'inscrire gratuitement</a>
            <button onclick="document.getElementById('lr-checkout-popup').style.display='none'" style="background:none; border:none; color:#666; cursor:pointer; font-size:0.9em;">Non merci, continuer sans compte</button>
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

add_action( 'woocommerce_before_add_to_cart_form', 'lr_product_page_cta' );

function lr_product_page_cta() {
    global $product;
    if ( ! $product ) return;
    
    $price = (float) $product->get_price();
    $points = floor( $price / 1000 );
    
    if ( $points > 0 ) {
        echo '<div style="background:linear-gradient(135deg, #fef3c7, #fde68a); padding:10px 16px; border-radius:8px; margin-bottom:16px; font-size:0.9em;">';
        echo '<strong>🎵 LamakoRewards :</strong> Gagnez <strong>' . $points . ' points</strong> sur cet achat ! ';
        if ( ! is_user_logged_in() ) {
            echo '<a href="' . wp_registration_url() . '" style="color:#3d2314; font-weight:600;">S\'inscrire</a>';
        }
        echo '</div>';
    }
}

// Auto-insert checkout popup for guests (uses wp_footer for block checkout compatibility)
add_action( 'wp_footer', 'lr_checkout_page_popup' );

function lr_checkout_page_popup() {
    if ( is_user_logged_in() ) return;
    // Support both classic and block checkout: check by page slug or WC functions
    $is_target = false;
    if ( function_exists( 'is_checkout' ) && is_checkout() ) $is_target = true;
    if ( function_exists( 'is_cart' ) && is_cart() ) $is_target = true;
    if ( is_page( 'checkout' ) || is_page( 'cart' ) || is_page( 'panier' ) ) $is_target = true;
    // Fallback: check page ID directly
    $page_id = get_queried_object_id();
    if ( $page_id == wc_get_page_id( 'checkout' ) || $page_id == wc_get_page_id( 'cart' ) ) $is_target = true;
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
    $code = lr_generate_referral_code( $user_id );
    $referral_count = (int) get_user_meta( $user_id, '_lamako_referral_count', true );
    $next = lr_get_next_tier( $tier );
    $to_next = lr_get_points_to_next_tier( $total_earned );
    
    ?>
    <div style="max-width:600px;">
        <h2>🎵 LamakoRewards</h2>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:24px 0;">
            <div style="background:#f9fafb; padding:20px; border-radius:8px; text-align:center;">
                <div style="font-size:2em; font-weight:700; color:#3d2314;"><?php echo number_format( $balance, 0, ',', ' ' ); ?></div>
                <div style="color:#666; font-size:0.9em;">Points disponibles</div>
            </div>
            <div style="background:#f9fafb; padding:20px; border-radius:8px; text-align:center;">
                <div style="font-size:2em; font-weight:700; color:#3d2314;"><?php echo esc_html( $tier_name ); ?></div>
                <div style="color:#666; font-size:0.9em;">Niveau actuel</div>
            </div>
        </div>
        
        <?php if ( $next ) : ?>
        <div style="background:#fef3c7; padding:12px 16px; border-radius:8px; margin-bottom:24px;">
            <strong><?php echo $to_next; ?> points</strong> pour atteindre le niveau <strong><?php echo esc_html( $next ); ?></strong>
            <div style="background:#e5e7eb; border-radius:4px; height:8px; margin-top:8px; overflow:hidden;">
                <?php 
                $current_min = constant( 'LR_TIER_' . strtoupper( $tier ) );
                $next_min = $tier === 'fan' ? LR_TIER_VIP : ( $tier === 'vip' ? LR_TIER_SUPERVIP : LR_TIER_ELITE );
                $progress = min( 100, ( ( $total_earned - $current_min ) / ( $next_min - $current_min ) ) * 100 );
                ?>
                <div style="background:#3d2314; height:100%; width:<?php echo $progress; ?>%; border-radius:4px;"></div>
            </div>
        </div>
        <?php endif; ?>
        
        <h3>Mon code de parrainage</h3>
        <div style="background:#f0f0f0; padding:16px; border-radius:8px; text-align:center; margin-bottom:24px;">
            <code style="font-size:1.3em; letter-spacing:2px; font-weight:700;"><?php echo esc_html( $code ); ?></code>
            <p style="color:#666; font-size:0.85em; margin-top:8px;">Partagez ce code - gagnez 100 pts quand votre filleul achète !</p>
            <p style="font-size:0.85em;">Filleuls parrainés : <strong><?php echo $referral_count; ?></strong></p>
        </div>
        
        <p><a href="/lamako-rewards" style="color:#3d2314; font-weight:600;">Voir tous les avantages →</a></p>
    </div>
    <?php
}

// Flush rewrite rules on activation
register_activation_hook( __FILE__, function() {
    lr_add_account_endpoint();
    flush_rewrite_rules();
});
