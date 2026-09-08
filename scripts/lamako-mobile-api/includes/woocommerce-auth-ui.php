<?php
/**
 * Unified customer authentication choices for WooCommerce My Account.
 *
 * Social identities use the existing hardened OAuth handlers. Those handlers
 * create a customer account on first use and authenticate an existing account
 * on later visits.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_filter( 'option_woocommerce_enable_myaccount_registration', 'lamako_customer_enable_myaccount_registration' );
add_filter( 'option_woocommerce_registration_generate_password', 'lamako_customer_require_registration_password' );
add_filter( 'woocommerce_registration_errors', 'lamako_customer_validate_registration_password', 10, 3 );
add_action( 'woocommerce_login_form_start', 'lamako_customer_render_social_auth' );
add_action( 'woocommerce_register_form_start', 'lamako_customer_render_social_auth' );
add_action( 'wp_head', 'lamako_customer_social_auth_styles' );

function lamako_customer_enable_myaccount_registration( $value ) {
    if ( ! is_admin() && function_exists( 'is_account_page' ) && is_account_page() ) {
        return 'yes';
    }

    return $value;
}

function lamako_customer_require_registration_password( $value ) {
    if ( ! is_admin() && function_exists( 'is_account_page' ) && is_account_page() ) {
        return 'no';
    }

    return $value;
}

function lamako_customer_validate_registration_password( $errors, $username, $email ) {
    unset( $username, $email );
    $password = isset( $_POST['password'] ) ? (string) wp_unslash( $_POST['password'] ) : '';
    if ( ! function_exists( 'lamako_mobile_password_is_strong' ) || ! lamako_mobile_password_is_strong( $password ) ) {
        $errors->add(
            'lamako_weak_password',
            __( 'Utilisez au moins 10 caracteres avec une majuscule, une minuscule et un chiffre.', 'lamako-mobile-api' )
        );
    }

    return $errors;
}

function lamako_customer_account_redirect_url() {
    $account_url = function_exists( 'wc_get_page_permalink' )
        ? wc_get_page_permalink( 'myaccount' )
        : home_url( '/my-account/' );

    return wp_validate_redirect( $account_url, home_url( '/' ) );
}

function lamako_customer_social_auth_urls() {
    $redirect_to = lamako_customer_account_redirect_url();

    return [
        'apple' => add_query_arg(
            [ 'action' => 'lamako_apple_start', 'redirect_to' => $redirect_to ],
            admin_url( 'admin-post.php' )
        ),
        'facebook' => add_query_arg(
            [ 'action' => 'lamako_facebook_start', 'redirect_to' => $redirect_to ],
            admin_url( 'admin-post.php' )
        ),
        // Google currently completes its OIDC handoff in the shared web-mobile
        // auth surface, then returns to the same WordPress account page.
        'google' => add_query_arg(
            [ 'returnTo' => wp_make_link_relative( $redirect_to ) ],
            home_url( '/mobile/login' )
        ),
    ];
}

function lamako_customer_render_social_auth() {
    if ( is_user_logged_in() ) {
        return;
    }

    $urls = lamako_customer_social_auth_urls();
    ?>
    <section class="lamako-customer-social-auth" aria-label="Connexion ou inscription avec un compte social">
        <p class="lamako-customer-social-auth__title"><?php echo esc_html__( 'Continuer avec', 'lamako-mobile-api' ); ?></p>
        <div class="lamako-customer-social-auth__grid">
            <a class="lamako-customer-social-auth__button is-apple" href="<?php echo esc_url( $urls['apple'] ); ?>">Apple</a>
            <a class="lamako-customer-social-auth__button is-google" href="<?php echo esc_url( $urls['google'] ); ?>">Google</a>
            <a class="lamako-customer-social-auth__button is-facebook" href="<?php echo esc_url( $urls['facebook'] ); ?>">Facebook</a>
        </div>
        <p class="lamako-customer-social-auth__divider"><span><?php echo esc_html__( 'ou avec votre e-mail', 'lamako-mobile-api' ); ?></span></p>
    </section>
    <?php
}

function lamako_customer_social_auth_styles() {
    if ( ! function_exists( 'is_account_page' ) || ! is_account_page() || is_user_logged_in() ) {
        return;
    }
    ?>
    <style id="lamako-customer-social-auth-css">
        .lamako-customer-social-auth{margin:0 0 24px}.lamako-customer-social-auth__title{font-weight:700;margin:0 0 12px;text-align:center}.lamako-customer-social-auth__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.lamako-customer-social-auth__button{align-items:center;border:1px solid #d9d9d9;border-radius:10px;display:flex;font-weight:700;justify-content:center;min-height:48px;padding:10px 12px;text-decoration:none!important}.lamako-customer-social-auth__button.is-apple{background:#000;color:#fff}.lamako-customer-social-auth__button.is-google{background:#fff;color:#202124}.lamako-customer-social-auth__button.is-facebook{background:#1877f2;color:#fff}.lamako-customer-social-auth__divider{align-items:center;display:flex;gap:12px;margin:20px 0 0;color:#666;font-size:13px}.lamako-customer-social-auth__divider:before,.lamako-customer-social-auth__divider:after{background:#ddd;content:"";height:1px;flex:1}@media(max-width:640px){.lamako-customer-social-auth__grid{grid-template-columns:1fr}}
    </style>
    <?php
}
