import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, '..');
const schemasDir = path.join(packageRoot, 'schemas');
const generatedDir = path.join(packageRoot, 'src', 'generated');

if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

async function runCodegen() {
  const schemaFiles = fs.readdirSync(schemasDir).filter((file) => file.endsWith('.schema.json'));

  const exportStatements = [];

  for (const file of schemaFiles) {
    const filePath = path.join(schemasDir, file);
    const schemaContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const baseName = file.replace('.schema.json', '');

    const typeCode = await compile(schemaContent, schemaContent.title || baseName, {
      bannerComment: `/* AUTO-GENERATED — DO NOT EDIT */\n/* Single Source of Truth: schemas/${file} */`,
      cwd: schemasDir,
      strictIndexSignatures: true,
      format: true,
    });

    const outFileName = `${baseName}.types.ts`;
    const outFilePath = path.join(generatedDir, outFileName);
    fs.writeFileSync(outFilePath, typeCode, 'utf8');
    exportStatements.push(`export * from './${baseName}.types.js';`);
    console.log(`[codegen] Generated: ${outFileName}`);
  }

  const generatedIndex = `/* AUTO-GENERATED — DO NOT EDIT */\n\n${exportStatements.join('\n')}\n`;
  fs.writeFileSync(path.join(generatedDir, 'index.ts'), generatedIndex, 'utf8');
  console.log(`[codegen] Generated: index.ts`);
}

runCodegen().catch((err) => {
  console.error('[codegen] Error generating types:', err);
  process.exit(1);
});
