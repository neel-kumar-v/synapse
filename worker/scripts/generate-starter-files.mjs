#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const starterDir = join(__dirname, '..', 'starter');
const outFile = join(__dirname, '..', 'src', 'starterFiles.generated.ts');

const allFiles = readdirSync(starterDir).filter(f => !f.startsWith('.'));

const starterFiles = allFiles.filter(f => f !== 'studio.html');
const entries = starterFiles.map(name => {
  const content = readFileSync(join(starterDir, name), 'utf-8');
  return `  ${JSON.stringify(name)}: ${JSON.stringify(content)}`;
});

const studioHtml = readFileSync(join(starterDir, 'studio.html'), 'utf-8');

const output = `// Auto-generated from worker/starter/ — do not edit by hand.
// Run: node scripts/generate-starter-files.mjs
export const STARTER_FILES: Record<string, string> = {
${entries.join(',\n')},
};

export const STUDIO_HTML: string = ${JSON.stringify(studioHtml)};
`;

writeFileSync(outFile, output, 'utf-8');
console.log(`Generated ${outFile} with ${starterFiles.length} starter files + studio.html.`);
