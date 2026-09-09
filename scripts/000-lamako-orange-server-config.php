<?php
/**
 * Plugin Name: Lamako Orange Server Configuration
 * Description: Exposes the existing server-side Orange credentials to the hardened mobile payment guard.
 */

defined('ABSPATH') || exit;

if (!defined('TBL_ORANGE_PAYMENT_ENVIRONMENT')) {
    define('TBL_ORANGE_PAYMENT_ENVIRONMENT', 'production');
}

$tbl_orange_settings = get_option('woocommerce_papi_paiement_settings', array());
$tbl_orange_merchant = isset($tbl_orange_settings['merchant_key'])
    ? trim((string) $tbl_orange_settings['merchant_key'])
    : '';
$tbl_orange_consumer = isset($tbl_orange_settings['consumer_key'])
    ? trim((string) $tbl_orange_settings['consumer_key'])
    : '';

if ($tbl_orange_merchant !== '' && $tbl_orange_consumer !== '') {
    if (!defined('TBL_ORANGE_MERCHANT_KEY')) {
        define('TBL_ORANGE_MERCHANT_KEY', $tbl_orange_merchant);
    }

    if (!defined('TBL_ORANGE_CONSUMER_KEY')) {
        define('TBL_ORANGE_CONSUMER_KEY', $tbl_orange_consumer);
    }
}

unset(
    $tbl_orange_settings,
    $tbl_orange_merchant,
    $tbl_orange_consumer
);
