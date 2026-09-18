import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../../..');

function getAllTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkFileImports(filePath: string, forbiddenPatterns: RegExp[]): string[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations: string[] = [];

  // Match import statements: import ... from '...' or import('...')
  const importRegex = /(?:import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const importSource = match[1] || match[2];
    if (!importSource) continue;

    for (const forbidden of forbiddenPatterns) {
      if (forbidden.test(importSource)) {
        violations.push(`File ${filePath} imports forbidden target "${importSource}" matching ${forbidden}`);
      }
    }
  }

  return violations;
}

describe('Architecture Boundary Guard Tests (Strict Enforce)', () => {
  it('enforces: core-domain has ZERO dependencies on other packages or direct Node I/O', () => {
    const domainSrc = path.join(monorepoRoot, 'packages/core-domain/src');
    const tsFiles = getAllTsFiles(domainSrc);
    expect(tsFiles.length).toBeGreaterThan(0);

    const forbidden = [
      /^@ai-team\/core-application/,
      /^@ai-team\/core-infrastructure/,
      /^@ai-team\/desktop-ui/,
      /^@ai-team\/test-harness/,
      /^\.\.?\/(core-application|core-infrastructure|desktop-ui)/,
      /^(node:)?fs(\/.*)?$/,
      /^(node:)?child_process(\/.*)?$/,
      /^(node:)?net(\/.*)?$/,
      /^(node:)?http(\/.*)?$/,
      /^(node:)?https(\/.*)?$/,
      /sqlite3/,
      /better-sqlite3/,
    ];

    const allViolations: string[] = [];
    for (const file of tsFiles) {
      const violations = checkFileImports(file, forbidden);
      allViolations.push(...violations);
    }

    expect(allViolations).toEqual([]);
  });

  it('enforces: core-application only depends on core-domain and ui-contract', () => {
    const appSrc = path.join(monorepoRoot, 'packages/core-application/src');
    const tsFiles = getAllTsFiles(appSrc);
    expect(tsFiles.length).toBeGreaterThan(0);

    const forbidden = [
      /^@ai-team\/core-infrastructure/,
      /^@ai-team\/desktop-ui/,
      /^@ai-team\/test-harness/,
      /^(node:)?fs(\/.*)?$/,
      /^(node:)?child_process(\/.*)?$/,
      /^(node:)?net(\/.*)?$/,
      /sqlite3/,
      /better-sqlite3/,
    ];

    const allViolations: string[] = [];
    for (const file of tsFiles) {
      const violations = checkFileImports(file, forbidden);
      allViolations.push(...violations);
    }

    expect(allViolations).toEqual([]);
  });

  it('enforces: desktop-ui package contains no production implementation in P0', () => {
    const desktopUiDir = path.join(monorepoRoot, 'packages/desktop-ui');
    const files = fs.readdirSync(desktopUiDir);
    // desktop-ui must ONLY contain README.md
    expect(files).toEqual(['README.md']);
  });

  it('fails closed when an illegal import boundary is detected', () => {
    // Synthetic check test to ensure violation detection logic works
    const mockContentWithIllegalImport = `
      import fs from 'node:fs';
      import { something } from '@ai-team/core-infrastructure';
    `;
    const tempTestFile = path.join(monorepoRoot, 'packages/test-harness/temp-violation-test.tmp');
    fs.writeFileSync(tempTestFile, mockContentWithIllegalImport, 'utf8');

    try {
      const violations = checkFileImports(tempTestFile, [
        /^(node:)?fs/,
        /^@ai-team\/core-infrastructure/,
      ]);
      expect(violations.length).toBe(2);
    } finally {
      if (fs.existsSync(tempTestFile)) {
        fs.unlinkSync(tempTestFile);
      }
    }
  });
});
