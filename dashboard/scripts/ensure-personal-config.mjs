#!/usr/bin/env node
import { readdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = resolve(__dirname, '..', 'src', 'config');

if (!existsSync(configDir)) process.exit(0);

const examples = readdirSync(configDir).filter((f) => f.endsWith('.example.ts'));
for (const example of examples) {
  const local = example.replace(/\.example\.ts$/, '.local.ts');
  const localPath = join(configDir, local);
  if (!existsSync(localPath)) {
    copyFileSync(join(configDir, example), localPath);
    console.log(`[ensure-personal-config] created ${local} from example`);
  }
}

process.exit(0);
