import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nextEnvPath = resolve(rootDir, 'next-env.d.ts');
const stableNextEnv = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;

function restoreNextEnv() {
  const current = readFileSync(nextEnvPath, 'utf8');
  if (current !== stableNextEnv) {
    writeFileSync(nextEnvPath, stableNextEnv);
  }
}

const result = spawnSync('next', ['build'], {
  cwd: rootDir,
  env: {
    ...process.env,
    NEXT_DIST_DIR: '.next-build',
  },
  stdio: 'inherit',
});

restoreNextEnv();
process.exit(result.status ?? 1);
