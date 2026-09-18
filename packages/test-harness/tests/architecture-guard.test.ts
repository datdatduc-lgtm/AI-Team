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
export const FORBIDDEN_DOMAIN_NODE_BUILTINS = [
  /^(node:)?fs(\/.*)?$/,
  /^(node:)?child_process(\/.*)?$/,
  /^(node:)?net(\/.*)?$/,
  /^(node:)?http(\/.*)?$/,
  /^(node:)?https(\/.*)?$/,
  /^(node:)?crypto(\/.*)?$/,
  /^(node:)?os(\/.*)?$/,
  /^(node:)?path(\/.*)?$/,
  /^(node:)?worker_threads(\/.*)?$/,
];

export function extractAllImportSources(content: string): string[] {
  const sources: string[] = [];

  // Match static import and export ... from statements (including multiline and type imports)
  const staticImportExportRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = staticImportExportRegex.exec(content)) !== null) {
    if (match[1]) sources.push(match[1]);
  }

  // Match dynamic imports: import('...')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    if (match[1]) sources.push(match[1]);
  }

  // Match CommonJS require calls: require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    if (match[1]) sources.push(match[1]);
  }

  return sources;
}

export function checkFileImports(filePath: string, forbiddenPatterns: RegExp[]): string[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const importSources = extractAllImportSources(content);
  const violations: string[] = [];

  for (const source of importSources) {
    for (const forbidden of forbiddenPatterns) {
      if (forbidden.test(source)) {
        violations.push(`File ${filePath} imports forbidden target "${source}" matching pattern ${forbidden}`);
      }
    }
  }

  return violations;
}

export function checkPackageJsonDependencies(
  pkgJsonPath: string,
  allowedWorkspaceDeps: string[]
): string[] {
  if (!fs.existsSync(pkgJsonPath)) return [`Package manifest not found at ${pkgJsonPath}`];
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const violations: string[] = [];

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  for (const dep of Object.keys(allDeps)) {
    if (dep.startsWith('@ai-team/')) {
      if (!allowedWorkspaceDeps.includes(dep)) {
        violations.push(`Illegal workspace dependency "${dep}" in ${pkgJsonPath}`);
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

  it('enforces: directional package.json dependency declarations across all packages', () => {
    // core-domain has 0 workspace deps
    const domainPkg = path.join(monorepoRoot, 'packages/core-domain/package.json');
    expect(checkPackageJsonDependencies(domainPkg, [])).toEqual([]);

    // core-application can only depend on core-domain and ui-contract
    const appPkg = path.join(monorepoRoot, 'packages/core-application/package.json');
    expect(
      checkPackageJsonDependencies(appPkg, [
        '@ai-team/core-domain',
        '@ai-team/ui-contract',
      ])
    ).toEqual([]);

    // core-infrastructure can only depend on core-domain, core-application, and ui-contract
    const infraPkg = path.join(monorepoRoot, 'packages/core-infrastructure/package.json');
    expect(
      checkPackageJsonDependencies(infraPkg, [
        '@ai-team/core-domain',
        '@ai-team/core-application',
        '@ai-team/ui-contract',
      ])
    ).toEqual([]);

    // ui-contract has 0 workspace deps (pure specification + generated artifacts)
    const uiContractPkg = path.join(monorepoRoot, 'packages/ui-contract/package.json');
    expect(checkPackageJsonDependencies(uiContractPkg, [])).toEqual([]);
  });

  it('enforces: desktop-ui package contains no production implementation in P0', () => {
    const desktopUiDir = path.join(monorepoRoot, 'packages/desktop-ui');
    const files = fs.readdirSync(desktopUiDir);
    // desktop-ui must ONLY contain README.md
    expect(files).toEqual(['README.md']);
  });

  it('fails closed when an illegal static or dynamic import boundary is detected', () => {
    const mockContent = `
      import fs from 'node:fs';
      const infra = await import('@ai-team/core-infrastructure');
      const req = require('sqlite3');
    `;
    const tempTestFile = path.join(monorepoRoot, 'packages/test-harness/temp-violation-test.tmp');
    fs.writeFileSync(tempTestFile, mockContent, 'utf8');

    try {
      const violations = checkFileImports(tempTestFile, [
        /^(node:)?fs/,
        /^@ai-team\/core-infrastructure/,
        /sqlite3/,
      ]);
      expect(violations.length).toBe(3);
    } finally {
      if (fs.existsSync(tempTestFile)) {
        fs.unlinkSync(tempTestFile);
      }
    }
  });

  it('fails closed when package.json contains illegal dependency', () => {
    const mockPkg = {
      name: 'mock-pkg',
      dependencies: {
        '@ai-team/core-infrastructure': 'workspace:*',
      },
    };
    const tempPkgFile = path.join(monorepoRoot, 'packages/test-harness/temp-pkg-test.tmp.json');
    fs.writeFileSync(tempPkgFile, JSON.stringify(mockPkg), 'utf8');

    try {
      const violations = checkPackageJsonDependencies(tempPkgFile, ['@ai-team/core-domain']);
      expect(violations.length).toBe(1);
      expect(violations[0]).toContain('@ai-team/core-infrastructure');
    } finally {
      if (fs.existsSync(tempPkgFile)) {
        fs.unlinkSync(tempPkgFile);
      }
    }
  });
});
