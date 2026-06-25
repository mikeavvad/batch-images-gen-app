import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const mode = process.argv[2];
const cwd = process.cwd();
const needsSafeCopy = cwd.includes('#');
const safeCwd = needsSafeCopy ? mkdtempSync(join(tmpdir(), 'social-post-pack-generator-')) : cwd;

const commandBuilders = {
  dev: () => [
    [bin('svelte-kit'), ['sync']],
    [bin('vite'), ['dev']]
  ],
  preview: () => [
    [bin('svelte-kit'), ['sync']],
    [bin('vite'), ['preview']]
  ],
  build: () => [
    [bin('svelte-kit'), ['sync']],
    [bin('vite'), ['build']]
  ],
  check: () => [
    [bin('svelte-kit'), ['sync']],
    [bin('svelte-check'), ['--tsconfig', './tsconfig.json']]
  ],
  test: () => [
    [bin('svelte-kit'), ['sync']],
    [bin('vitest'), ['run', '--config', './vitest.config.ts']]
  ]
};

if (!commandBuilders[mode]) {
  console.error(`Unknown script mode: ${mode ?? '(missing)'}`);
  process.exit(1);
}

if (needsSafeCopy) {
  cpSync(cwd, safeCwd, {
    recursive: true,
    filter: (source) => {
      const relative = source.slice(cwd.length + 1);
      if (!relative) {
        return true;
      }

      const segments = relative.split('/');
      const name = segments[segments.length - 1];
      return ![
        '.git',
        '.svelte-kit',
        '.vercel',
        'build',
        'coverage',
        'node_modules'
      ].includes(name) && !name.startsWith('.env');
    }
  });

  cpSync(join(cwd, 'node_modules'), join(safeCwd, 'node_modules'), {
    recursive: true,
    verbatimSymlinks: true
  });
}

let exitCode = 0;

try {
  for (const [command, args] of commandBuilders[mode]()) {
    if (exitCode !== 0) {
      break;
    }

    const status = await run(command, args);
    if (status !== 0) {
      exitCode = status ?? 1;
      break;
    }
  }
} finally {
  if (!['dev', 'preview'].includes(mode)) {
    cleanupSafeCopy();
  }
}

if (exitCode !== 0) {
  process.exit(exitCode);
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: safeCwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: process.env.CI ?? 'true'
      }
    });

    child.on('exit', resolve);
    child.on('error', (error) => {
      console.error(error.message);
      resolve(1);
    });
  });
}

function bin(name) {
  const extension = process.platform === 'win32' ? '.cmd' : '';
  return join(safeCwd, 'node_modules', '.bin', `${name}${extension}`);
}

function cleanupSafeCopy() {
  if (needsSafeCopy) {
    rmSync(safeCwd, { force: true, recursive: true });
  }
}
