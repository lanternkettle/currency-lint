#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { lintText, type Finding } from './linter.js'

function formatFinding(fileName: string, finding: Finding): string {
  return `${fileName}:${finding.line}:${finding.column}: [${finding.ruleId}] ${finding.message}`
}

function main(argv: string[]): number {
  const files = argv.slice(2)
  if (files.length === 0) {
    process.stderr.write('usage: currency-lint <file> [file...]\n')
    return 2
  }

  let findingCount = 0
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const findings = lintText(source)
    for (const finding of findings) {
      process.stdout.write(formatFinding(file, finding) + '\n')
    }
    findingCount += findings.length
  }

  return findingCount > 0 ? 1 : 0
}

process.exitCode = main(process.argv)
