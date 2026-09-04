<?php

declare(strict_types=1);

/**
 * Clone-only Phase S side-effect controls.
 *
 * This file must never be installed on staging or production. The operating
 * system network namespace, read-only database credential and read-only root
 * remain the authoritative isolation boundaries.
 */

defined('ABSPATH') || exit;

const TBL_TICKERA_PHASE_S_ISOLATION_VERSION = '1.0.0';

$GLOBALS['tbl_tickera_phase_s_isolation'] = [];

/**
 * Refuse to register any control unless both the clone-only constant and an
 * RFC 2606 .invalid hostname identify the disposable runtime. This makes an
 * accidental copy to staging or production inert.
 */
function tbl_tickera_phase_s_isolated_clone_is_qualified(): bool {
    if (! defined('TBL_TICKERA_PHASE_S_ISOLATED_CLONE') || TBL_TICKERA_PHASE_S_ISOLATED_CLONE !== true) {
        return false;
    }

    $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
    $host = preg_replace('/:\d+$/D', '', $host) ?? $host;

    return preg_match('/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+invalid$/D', $host) === 1;
}

if (! tbl_tickera_phase_s_isolated_clone_is_qualified()) {
    return;
}

$GLOBALS['tbl_tickera_phase_s_isolation'] = [
    'jetpackListenerDisabled' => true,
    'jetpackSenderDisabled'   => true,
    'checkinInstallerRemoved' => false,
    'asyncRunnerDisabled'     => true,
    'mailDeliveryDisabled'    => true,
    'freemiusSdkOptionFrozen' => true,
];

function tbl_tickera_phase_s_return_false(): bool {
    return false;
}

/**
 * Preserve the clone snapshot's Freemius SDK inventory. Tickera's bundled
 * Freemius loader otherwise refreshes this technical option during plugin
 * inclusion, before the measured REST route is dispatched.
 *
 * @param mixed $new_value
 * @param mixed $old_value
 * @return mixed
 */
function tbl_tickera_phase_s_preserve_old_option($new_value, $old_value) {
    return $old_value;
}

add_filter('jetpack_sync_listener_should_load', 'tbl_tickera_phase_s_return_false', PHP_INT_MIN);
add_filter('jetpack_sync_sender_should_load', 'tbl_tickera_phase_s_return_false', PHP_INT_MIN);
add_filter('action_scheduler_allow_async_request_runner', 'tbl_tickera_phase_s_return_false', PHP_INT_MIN);
add_filter('pre_wp_mail', 'tbl_tickera_phase_s_return_false', PHP_INT_MIN);
add_filter(
    'pre_update_option_fs_active_plugins',
    'tbl_tickera_phase_s_preserve_old_option',
    PHP_INT_MIN,
    2
);

add_action(
    'plugins_loaded',
    static function (): void {
        $GLOBALS['tbl_tickera_phase_s_isolation']['checkinInstallerRemoved'] = remove_action(
            'plugins_loaded',
            'tbl_checkin_facts_install_schema',
            21
        );
    },
    PHP_INT_MIN
);

/** @return array<string, bool> */
function tbl_tickera_phase_s_isolation_state(): array {
    return $GLOBALS['tbl_tickera_phase_s_isolation'];
}
