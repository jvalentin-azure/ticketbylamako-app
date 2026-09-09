<?php
/**
 * Grandfather existing LamakoRewards customers into voluntary membership.
 *
 * Run with WP-CLI only:
 *   LAMAKO_REWARDS_MIGRATION_MODE=audit wp eval-file scripts/lamako-rewards-membership-migration.php
 *   LAMAKO_REWARDS_MIGRATION_MODE=apply wp eval-file scripts/lamako-rewards-membership-migration.php
 *
 * This migration never deletes or changes myCred balances or ledger rows.
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

$mode = getenv( 'LAMAKO_REWARDS_MIGRATION_MODE' );
$mode = 'apply' === $mode ? 'apply' : 'audit';

$eligible_roles = array( 'customer', 'subscriber' );
$internal_roles = array(
	'administrator',
	'editor',
	'author',
	'contributor',
	'staff',
	'shop_manager',
	'organisateur',
	'guichet',
	'responsable',
	'responsable_vente',
	'wpseo_manager',
	'wpseo_editor',
	'staff_checkin',
	'staff_kiosk',
	'event_manager',
	'checkin_supervisor',
	'responsable_finance',
	'operations_supervisor',
	'lamako_support',
);

global $wpdb;
$log_table = isset( $wpdb->mycred_log ) ? $wpdb->mycred_log : $wpdb->prefix . 'myCRED_log';
$log_table_exists = $log_table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $log_table ) );

$counts = array(
	'users_scanned'                 => 0,
	'eligible_existing_members'     => 0,
	'eligible_grandfathered'        => 0,
	'eligible_without_history'      => 0,
	'internal_members_disabled'     => 0,
	'internal_already_excluded'     => 0,
	'mixed_role_accounts_excluded'  => 0,
);

$user_ids = get_users(
	array(
		'fields' => 'ID',
		'number' => -1,
	)
);

foreach ( $user_ids as $user_id ) {
	$counts['users_scanned']++;
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		continue;
	}

	$roles = (array) $user->roles;
	$has_internal_role = (bool) array_intersect( $roles, $internal_roles );
	$has_eligible_role = (bool) array_intersect( $roles, $eligible_roles );
	$is_member = 'yes' === get_user_meta( $user_id, '_lamako_rewards_member', true );

	if ( $has_internal_role ) {
		if ( $has_eligible_role ) {
			$counts['mixed_role_accounts_excluded']++;
		}

		if ( $is_member ) {
			$counts['internal_members_disabled']++;
			if ( 'apply' === $mode ) {
				update_user_meta( $user_id, '_lamako_rewards_member', 'no' );
				update_user_meta( $user_id, '_lamako_rewards_membership_disabled_reason', 'internal_role_migration_20260909' );
			}
		} else {
			$counts['internal_already_excluded']++;
		}
		continue;
	}

	if ( ! $has_eligible_role ) {
		continue;
	}

	if ( $is_member ) {
		$counts['eligible_existing_members']++;
		continue;
	}

	$has_history = false;
	if ( $log_table_exists ) {
		$has_history = (bool) $wpdb->get_var(
			$wpdb->prepare( "SELECT id FROM {$log_table} WHERE user_id = %d LIMIT 1", $user_id )
		);
	}

	$balance = 0.0;
	if ( function_exists( 'mycred_get_users_balance' ) ) {
		$balance = (float) mycred_get_users_balance( $user_id );
	} elseif ( function_exists( 'mycred' ) ) {
		$balance = (float) mycred()->get_users_balance( $user_id );
	}

	if ( ! $has_history && 0.0 === $balance ) {
		$counts['eligible_without_history']++;
		continue;
	}

	$counts['eligible_grandfathered']++;
	if ( 'apply' === $mode ) {
		update_user_meta( $user_id, '_lamako_rewards_member', 'yes' );
		if ( ! get_user_meta( $user_id, '_lamako_rewards_member_since', true ) ) {
			update_user_meta( $user_id, '_lamako_rewards_member_since', gmdate( 'c' ) );
		}
		update_user_meta( $user_id, '_lamako_rewards_welcome_awarded', 'yes' );
		update_user_meta( $user_id, '_lamako_rewards_membership_migrated', '20260909' );
	}
}

WP_CLI::log( wp_json_encode( array( 'mode' => $mode, 'log_table_available' => $log_table_exists, 'counts' => $counts ), JSON_PRETTY_PRINT ) );
WP_CLI::success( 'LamakoRewards membership migration ' . $mode . ' completed.' );
