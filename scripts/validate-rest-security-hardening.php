<?php

declare(strict_types=1);

/**
 * Token-aware release gate for the REST session/cookie MU guard.
 *
 * This deliberately validates PHP semantics instead of source formatting so
 * harmless whitespace changes cannot trigger a deployment rollback.
 */

/**
 * @return list<array{id: int|null, text: string}>
 */
function tbl_guard_significant_tokens(string $source): array {
    $tokens = token_get_all($source, TOKEN_PARSE);
    $result = [];

    foreach ($tokens as $token) {
        if (is_array($token)) {
            if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT, T_OPEN_TAG, T_CLOSE_TAG], true)) {
                continue;
            }

            $result[] = [
                'id'   => $token[0],
                'text' => $token[1],
            ];
            continue;
        }

        $result[] = [
            'id'   => null,
            'text' => $token,
        ];
    }

    return $result;
}

/**
 * @param list<array{id: int|null, text: string}> $tokens
 * @return array{arguments: list<list<array{id: int|null, text: string}>>, close: int}|null
 */
function tbl_guard_parse_call_arguments(array $tokens, int $open_index): ?array {
    if (($tokens[$open_index]['text'] ?? null) !== '(') {
        return null;
    }

    $depth     = 0;
    $arguments = [[]];

    for ($index = $open_index; $index < count($tokens); $index++) {
        $text = $tokens[$index]['text'];

        if ($text === '(' || $text === '[' || $text === '{') {
            $depth++;
            if ($index !== $open_index) {
                $arguments[array_key_last($arguments)][] = $tokens[$index];
            }
            continue;
        }

        if ($text === ')' || $text === ']' || $text === '}') {
            $depth--;
            if ($depth === 0 && $text === ')') {
                return [
                    'arguments' => $arguments,
                    'close'     => $index,
                ];
            }
            if ($depth < 0) {
                return null;
            }
            $arguments[array_key_last($arguments)][] = $tokens[$index];
            continue;
        }

        if ($text === ',' && $depth === 1) {
            $arguments[] = [];
            continue;
        }

        if ($index !== $open_index) {
            $arguments[array_key_last($arguments)][] = $tokens[$index];
        }
    }

    return null;
}

/**
 * @param list<array{id: int|null, text: string}> $tokens
 */
function tbl_guard_is_direct_call(array $tokens, int $index, string $name): bool {
    if (
        ($tokens[$index]['id'] ?? null) !== T_STRING
        || strcasecmp($tokens[$index]['text'], $name) !== 0
        || ($tokens[$index + 1]['text'] ?? null) !== '('
    ) {
        return false;
    }

    $previous_id = $tokens[$index - 1]['id'] ?? null;
    return ! in_array($previous_id, [T_FUNCTION, T_OBJECT_OPERATOR, T_DOUBLE_COLON], true);
}

/**
 * @param list<array{id: int|null, text: string}> $argument
 */
function tbl_guard_string_literal(array $argument): ?string {
    if (count($argument) !== 1 || ($argument[0]['id'] ?? null) !== T_CONSTANT_ENCAPSED_STRING) {
        return null;
    }

    $literal = $argument[0]['text'];
    if (strlen($literal) < 2) {
        return null;
    }

    $quote = $literal[0];
    $value = substr($literal, 1, -1);

    if ($quote === "'") {
        return str_replace(["\\\\", "\\'"], ["\\", "'"], $value);
    }
    if ($quote === '"') {
        return stripcslashes($value);
    }

    return null;
}

/**
 * @param list<array{id: int|null, text: string}> $argument
 */
function tbl_guard_constant_name(array $argument): ?string {
    if (count($argument) !== 1 || ($argument[0]['id'] ?? null) !== T_STRING) {
        return null;
    }

    return $argument[0]['text'];
}

/**
 * @return list<string>
 */
function tbl_guard_validate_source(string $source): array {
    try {
        $tokens = tbl_guard_significant_tokens($source);
    } catch (ParseError $error) {
        return ['invalid PHP syntax: ' . $error->getMessage()];
    }

    $strict_mode  = false;
    $cookies_only = false;
    $tickera_hook = false;
    $session_start_calls = 0;

    for ($index = 0; $index < count($tokens); $index++) {
        if (tbl_guard_is_direct_call($tokens, $index, 'session_start')) {
            $session_start_calls++;
            continue;
        }

        if (tbl_guard_is_direct_call($tokens, $index, 'ini_set')) {
            $call = tbl_guard_parse_call_arguments($tokens, $index + 1);
            if ($call === null || count($call['arguments']) < 2) {
                continue;
            }

            $setting = tbl_guard_string_literal($call['arguments'][0]);
            $value   = tbl_guard_string_literal($call['arguments'][1]);
            if ($setting === 'session.use_strict_mode' && $value === '1') {
                $strict_mode = true;
            }
            if ($setting === 'session.use_only_cookies' && $value === '1') {
                $cookies_only = true;
            }
            $index = $call['close'];
            continue;
        }

        if (tbl_guard_is_direct_call($tokens, $index, 'add_action')) {
            $call = tbl_guard_parse_call_arguments($tokens, $index + 1);
            if ($call === null || count($call['arguments']) < 3) {
                continue;
            }

            if (
                tbl_guard_string_literal($call['arguments'][0]) === 'tickera_before_session_start'
                && tbl_guard_string_literal($call['arguments'][1]) === 'tbl_rest_harden_php_session_cookie'
                && tbl_guard_constant_name($call['arguments'][2]) === 'PHP_INT_MIN'
            ) {
                $tickera_hook = true;
            }
            $index = $call['close'];
        }
    }

    $failures = [];
    if (! $strict_mode) {
        $failures[] = "missing ini_set('session.use_strict_mode', '1')";
    }
    if (! $cookies_only) {
        $failures[] = "missing ini_set('session.use_only_cookies', '1')";
    }
    if (! $tickera_hook) {
        $failures[] = 'missing earliest Tickera session hardening hook';
    }
    if ($session_start_calls !== 0) {
        $failures[] = 'session_start calls=' . $session_start_calls;
    }

    return $failures;
}

function tbl_guard_validator_main(array $arguments): int {
    if (count($arguments) !== 2) {
        fwrite(STDERR, "Usage: php validate-rest-security-hardening.php <guard.php>\n");
        return 2;
    }

    $source = @file_get_contents($arguments[1]);
    if ($source === false) {
        fwrite(STDERR, "FAIL unable to read guard source\n");
        return 1;
    }

    $failures = tbl_guard_validate_source($source);
    if ($failures !== []) {
        fwrite(STDERR, 'FAIL ' . implode('; ', $failures) . "\n");
        return 1;
    }

    fwrite(
        STDOUT,
        'PASS strict_mode=1 cookies_only=1 tickera_hook=1 session_start=0 sha256=' . hash('sha256', $source) . "\n"
    );
    return 0;
}

exit(tbl_guard_validator_main($argv));
