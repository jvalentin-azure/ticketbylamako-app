<?php

declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');

$scenario = $argv[1] ?? 'active';
if ($scenario !== 'missing-constant') {
    define('TBL_TICKERA_PHASE_S_ISOLATED_CLONE', true);
}
$_SERVER['HTTP_HOST'] = $scenario === 'staging-host'
    ? 'staging.ticketbylamako.com'
    : 'phase-s.local.invalid';

$filters = [];
$actions = [
    'plugins_loaded' => [21 => ['tbl_checkin_facts_install_schema']],
];

function add_filter(string $tag, $callback, int $priority): void {
    $GLOBALS['filters'][$tag][$priority][] = $callback;
}
function add_action(string $tag, $callback, int $priority): void {
    $GLOBALS['actions'][$tag][$priority][] = $callback;
}
function remove_action(string $tag, $callback, int $priority): bool {
    $callbacks = &$GLOBALS['actions'][$tag][$priority];
    $index = array_search($callback, $callbacks ?? [], true);
    if ($index === false) return false;
    unset($callbacks[$index]);
    return true;
}

require dirname(__DIR__, 2) . '/scripts/tbl-tickera-phase-s-isolation.php';

foreach ($actions['plugins_loaded'][PHP_INT_MIN] ?? [] as $callback) {
    $callback();
}

echo json_encode([
    'version' => defined('TBL_TICKERA_PHASE_S_ISOLATION_VERSION')
        ? TBL_TICKERA_PHASE_S_ISOLATION_VERSION
        : null,
    'qualified' => function_exists('tbl_tickera_phase_s_isolated_clone_is_qualified')
        && tbl_tickera_phase_s_isolated_clone_is_qualified(),
    'active' => function_exists('tbl_tickera_phase_s_isolation_state')
        && tbl_tickera_phase_s_isolated_clone_is_qualified(),
    'state' => function_exists('tbl_tickera_phase_s_isolation_state')
        ? tbl_tickera_phase_s_isolation_state()
        : null,
    'filterPriorities' => (object) array_map(
        static fn(array $priorities): array => array_map(
            static fn($priority): string => (int) $priority === PHP_INT_MIN ? 'PHP_INT_MIN' : (string) $priority,
            array_keys($priorities)
        ),
        $filters
    ),
    'checkinRemaining' => array_values($actions['plugins_loaded'][21] ?? []),
], JSON_UNESCAPED_SLASHES) . "\n";
