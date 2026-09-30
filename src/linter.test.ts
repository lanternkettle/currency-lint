import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lintLine, lintText, rules, type Rule } from './linter.js'

function ruleById(id: string): Rule {
  const rule = rules.find((r) => r.id === id)
  assert.ok(rule, `no rule named ${id}`)
  return rule
}

test('floating-point-arithmetic flags two decimal literals joined by an operator', () => {
  const rule = ruleById('floating-point-arithmetic')
  const findings = rule.check('const total = 9.99 + 0.50', 1)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].line, 1)
  assert.equal(findings[0].column, 15)
  assert.equal(findings[0].ruleId, 'floating-point-arithmetic')
})

test('floating-point-arithmetic handles -, * and missing spaces', () => {
  const rule = ruleById('floating-point-arithmetic')
  assert.equal(rule.check('a = 10.00 - 2.50', 1).length, 1)
  assert.equal(rule.check('a = 10.00*2.50', 1).length, 1)
})

test('floating-point-arithmetic ignores integer minor units and non-money decimals', () => {
  const rule = ruleById('floating-point-arithmetic')
  assert.deepEqual(rule.check('const total = 999 + 50', 1), [])
  assert.deepEqual(rule.check('const ratio = 0.5 + 1.5', 1), [])
  assert.deepEqual(rule.check('const price = 9.99', 1), [])
})

test('ambiguous-decimal-separator flags repeated dot groups of three digits', () => {
  const rule = ruleById('ambiguous-decimal-separator')
  const findings = rule.check('x = 1.234.567', 4)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].line, 4)
  assert.equal(findings[0].column, 5)
  assert.equal(rule.check('x = 1.234.567.890', 1).length, 1)
})

test('ambiguous-decimal-separator ignores a single group and version strings', () => {
  const rule = ruleById('ambiguous-decimal-separator')
  assert.deepEqual(rule.check('x = 1.234', 1), [])
  assert.deepEqual(rule.check('version 1.2.3', 1), [])
  assert.deepEqual(rule.check('x = 1,234,567', 1), [])
})

test('bare-currency-symbol flags a symbol directly before a digit', () => {
  const rule = ruleById('bare-currency-symbol')
  const findings = rule.check('price = $100', 1)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].column, 9)
})

test('bare-currency-symbol allows one space and reports every symbol on the line', () => {
  const rule = ruleById('bare-currency-symbol')
  assert.equal(rule.check('total = € 5', 1).length, 1)
  const findings = rule.check('cost £20 and $5', 1)
  assert.deepEqual(
    findings.map((f) => f.column),
    [6, 14]
  )
})

test('bare-currency-symbol is silent when an ISO code is on the same line', () => {
  const rule = ruleById('bare-currency-symbol')
  assert.deepEqual(rule.check('price = $100 // USD', 1), [])
  assert.deepEqual(rule.check('EUR: €5', 1), [])
})

test('bare-currency-symbol ignores symbols not followed by a digit', () => {
  const rule = ruleById('bare-currency-symbol')
  assert.deepEqual(rule.check('const el = $("#price")', 1), [])
  assert.deepEqual(rule.check('`${amount}`', 1), [])
})

test('lintLine only runs the rules it is given', () => {
  const only = [ruleById('bare-currency-symbol')]
  const findings = lintLine('a = 9.99 + 0.50 + $5', 1, only)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].ruleId, 'bare-currency-symbol')
})

test('lintText returns nothing for empty and clean input', () => {
  assert.deepEqual(lintText(''), [])
  assert.deepEqual(lintText('const cents = 1999\n'), [])
})

test('lintText sorts findings from different rules by column within a line', () => {
  // the ambiguous-separator rule is listed before bare-currency-symbol, so
  // without sorting its finding at column 6 would come out first
  const findings = lintText('$5 + 1.234.567')
  assert.deepEqual(
    findings.map((f) => [f.column, f.ruleId]),
    [
      [1, 'bare-currency-symbol'],
      [6, 'ambiguous-decimal-separator'],
    ]
  )
})

test('lintText numbers lines from 1 and accepts LF, CRLF and CR endings', () => {
  const source = 'ok = 1\r\nprice = $1\rtotal = 1.000.000\nlast = 2.00 + 3.00'
  const findings = lintText(source)
  assert.deepEqual(
    findings.map((f) => [f.line, f.ruleId]),
    [
      [2, 'bare-currency-symbol'],
      [3, 'ambiguous-decimal-separator'],
      [4, 'floating-point-arithmetic'],
    ]
  )
})

test('lintText orders by line before column', () => {
  const findings = lintText('x = 1.234.567\n$5')
  assert.deepEqual(
    findings.map((f) => f.line),
    [1, 2]
  )
})
