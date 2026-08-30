<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/scripts/qa-tickera-stateless-rest-runtime.php';

$GLOBALS['tbl_tickera_runtime_probe_state'] = [
    'runtime' => [
        'wpRoot' => '/srv/tbl-phase-s-clone/current',
        'invocationIdSha256' => str_repeat('a', 64),
    ],
    'instrumentation' => [
        'wp_shutdown_seen' => false,
    ],
    'hook' => [
        'sequence' => [],
    ],
    'session' => [],
    'report' => [
        'attempts' => 0,
        'emitted' => false,
        'intendedExitCode' => null,
    ],
    'reportEmitted' => false,
];

register_shutdown_function(static function (): void {
    $GLOBALS['tbl_tickera_runtime_probe_state']['instrumentation']['wp_shutdown_seen'] = true;
    $GLOBALS['tbl_tickera_runtime_probe_state']['hook']['sequence'][] = 'wp_shutdown';
});

$GLOBALS['tbl_tickera_runtime_probe_reporter'] = new TBL_Tickera_Runtime_Probe_Reporter();
