// Every export here is a pure function: given the same string input it
// always returns the same findings. All filesystem and process access
// (reading files, exit codes, stdout) lives in cli.ts instead, so the
// rules themselves can be tested with plain strings and no fixtures.

export interface Finding {
  line: number
  column: number
  ruleId: string
  message: string
}

export interface Rule {
  id: string
  description: string
  check(line: string, lineNumber: number): Finding[]
}

function findAll(pattern: RegExp, line: string, lineNumber: number, ruleId: string, message: string): Finding[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  const re = new RegExp(pattern.source, flags)
  const findings: Finding[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    findings.push({
      line: lineNumber,
      column: match.index + 1,
      ruleId,
      message,
    })
    // a pattern with only optional pieces can match an empty string,
    // which would otherwise spin the loop forever at the same index
    if (match[0].length === 0) {
      re.lastIndex += 1
    }
  }
  return findings
}

const FLOAT_ARITHMETIC = /\d+\.\d{2}\s*[+\-*]\s*\d+\.\d{2}/
const EUROPEAN_THOUSANDS = /\b\d{1,3}(\.\d{3}){2,}\b/
const CURRENCY_SYMBOL = /[$€£]\s?\d/
const ISO_CODE = /\b[A-Z]{3}\b/

export const rules: Rule[] = [
  {
    id: 'floating-point-arithmetic',
    description: 'arithmetic performed directly on decimal currency literals, which accumulates rounding error',
    check(line, lineNumber) {
      return findAll(
        FLOAT_ARITHMETIC,
        line,
        lineNumber,
        'floating-point-arithmetic',
        'currency literals combined with an arithmetic operator; compute in integer minor units (cents) instead'
      )
    },
  },
  {
    id: 'ambiguous-decimal-separator',
    description: 'a number with repeated dot-separated groups of three digits, ambiguous between a thousands separator and a decimal',
    check(line, lineNumber) {
      return findAll(
        EUROPEAN_THOUSANDS,
        line,
        lineNumber,
        'ambiguous-decimal-separator',
        'number uses repeated "." groups; write the raw integer or use an explicit thousands separator convention'
      )
    },
  },
  {
    id: 'bare-currency-symbol',
    description: 'a currency symbol used with no ISO 4217 code anywhere on the same line',
    check(line, lineNumber) {
      if (ISO_CODE.test(line)) {
        return []
      }
      return findAll(
        CURRENCY_SYMBOL,
        line,
        lineNumber,
        'bare-currency-symbol',
        'currency symbol used without an ISO 4217 code (e.g. USD, EUR) on the same line'
      )
    },
  },
]

export function lintLine(line: string, lineNumber: number, activeRules: Rule[] = rules): Finding[] {
  const findings: Finding[] = []
  for (const rule of activeRules) {
    findings.push(...rule.check(line, lineNumber))
  }
  return findings
}

export function lintText(source: string, activeRules: Rule[] = rules): Finding[] {
  const lines = source.split(/\r\n|\r|\n/)
  const findings: Finding[] = []
  lines.forEach((line, index) => {
    findings.push(...lintLine(line, index + 1, activeRules))
  })
  return findings.sort((a, b) => a.line - b.line || a.column - b.column)
}
