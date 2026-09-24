# currency-lint

A linter for one specific problem: code that handles money in ways that
look fine until a rounding error, a locale mismatch, or a missing currency
code costs someone real money. It scans source files line by line and
reports findings as `file:line:column: [rule] message`, the same shape
you'd expect from any other linter.

## why

Currency bugs are rarely syntax errors. They're things like:

- adding two `19.99`-style floats directly instead of working in cents
- a number like `1.234.567` that's ambiguous between "one million" and
  a typo, depending on which locale wrote it
- a bare `$100` in a codebase that also touches EUR or GBP amounts,
  with nothing pinning down which currency it actually is

None of these are caught by a type checker or a general-purpose linter,
because the code is syntactically fine. `currency-lint` looks for the
textual patterns instead.

## usage

Build once with the TypeScript compiler (any recent `tsc` works; none is
bundled here):

```
tsc
node dist/cli.js path/to/file.ts another/file.ts
```

Given a file containing:

```ts
const subtotal = 19.99 + 5.00
const revenue = 1.234.567
const price = $100
```

it reports:

```
path/to/file.ts:1:19: [floating-point-arithmetic] currency literals combined with an arithmetic operator; compute in integer minor units (cents) instead
path/to/file.ts:2:19: [ambiguous-decimal-separator] number uses repeated "." groups; write the raw integer or use an explicit thousands separator convention
path/to/file.ts:3:15: [bare-currency-symbol] currency symbol used without an ISO 4217 code (e.g. USD, EUR) on the same line
```

The process exits `1` if any finding was reported, `0` otherwise, so it
can be wired into a CI step directly.

## library use

The rule engine is just pure functions over strings, so you can call it
without touching the filesystem or the CLI at all:

```ts
import { lintText } from './src/linter.js'

const findings = lintText('const total = 9.99 + 0.50\n')
// [{ line: 1, column: 15, ruleId: 'floating-point-arithmetic', ... }]
```

`lintText`, `lintLine`, and every rule's `check` function are pure: same
input, same output, no shared state. That's deliberate, since it's what
makes the rules easy to unit test and easy to add to without breaking
the ones already there.

## rules

| id | flags |
| --- | --- |
| `floating-point-arithmetic` | arithmetic directly on decimal currency literals |
| `ambiguous-decimal-separator` | numbers with repeated dot-separated groups of three digits |
| `bare-currency-symbol` | a currency symbol with no ISO 4217 code anywhere on the line |

## status

Early skeleton. The rule set is intentionally small; see the project
issues for what's planned next.
