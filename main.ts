// Solmar Bay — hand-in program for the make.fun gta6-01 entry.
//
// What it does, in plain terms: it gathers the finished game (the static
// files under game/ and the screenshots under screenshots/) into the output
// directory the grader reads, then writes dossier.json there. The dossier is
// produced by the kit's vendored library, vendor/makefun-game.ts, using the
// scorer's own caps, so the file the judge sees matches what the library
// computes from exactly these files.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR set, e.g.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader the output directory is /output.
//
// Node 22+, standard library only. No network, no third-party packages.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps for this competition (see the kit's starter notes and
// competition.yaml): dossier text cap, screenshot count/size, game limits.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function countEntries(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    total += 1;
    if (statSync(full).isDirectory()) total += countEntries(full);
  }
  return total;
}

function listShots(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort();
}

function main(): void {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    console.error('solmar: game/ is missing — nothing to hand in');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const shots = listShots(join(outDir, 'screenshots'));
  console.log(
    `solmar: handed in ${countEntries(join(outDir, 'game'))} game entries, ` +
      `${shots.length} screenshot(s) [${shots.join(', ')}], ` +
      `dossier.json ${dossier.length} bytes -> ${outDir}`,
  );
}

main();
