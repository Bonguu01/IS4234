import { mkdir, writeFile } from 'node:fs/promises';
import { SCENARIOS, scenarioCsv } from '../src/data/scenarios.js';
import { FEEDS } from '../src/domain/imports.js';

for (const scenario of SCENARIOS) {
  const directory = new URL(`../public/samples/${scenario.id}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  for (const [id, source] of Object.entries(scenarioCsv(scenario.id))) {
    if (source) await writeFile(new URL(FEEDS[id].file, directory), source.text + '\r\n');
  }
}
console.log('Generated six scenario bundles; the missing-feed bundle intentionally contains four CSV files.');
