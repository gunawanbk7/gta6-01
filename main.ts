// Solmar Bay — entrypoint for the make.fun "Make GTA 6" competition.
//
// What this file does, in plain terms: it takes the finished game in game/
// and the screenshots in screenshots/, copies them into the output folder
// the grader reads, and writes dossier.json there — the manifest the
// scorer rebuilds and compares byte for byte. It is deliberately boring:
// validate the inputs, copy the trees, build the dossier, print a report.
//
// Run it from the repository root:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// With no MAKEFUN_OUTPUT_DIR set it writes to /output, the grader's folder.

import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

// ------------------------------------------------------------------ limits
//
// These numbers come from the competition's own caps: the game tree may
// hold at most 993 entries and 48 MiB, index.html at most 1 MiB, and each
// screenshot at most 256 KiB with at most four of them. The dossier call
// enforces the same caps again; checking them here first gives a human
// readable failure instead of a stack trace from deep inside the library.

const GAME_MAX_ENTRIES = 993;
const GAME_MAX_BYTES = 48 * 1024 * 1024;
const SHOT_MAX_COUNT = 4;
const SHOT_MAX_BYTES = 256 * 1024;
const DOSSIER_TEXT_MAX_BYTES = 163840;

// ------------------------------------------------------------- small tools

function fail(message: string): never {
  throw new Error(`solmar-bay build: ${message}`);
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

// Walk a directory tree and add up every regular file. Symlinks are not
// followed — the game must be plain files and folders only — and anything
// that is not a file or a directory is rejected outright.
function walkTree(root: string, rel = ''): { files: string[]; bytes: number } {
  const out: { files: string[]; bytes: number } = { files: [], bytes: 0 };
  for (const name of readdirSync(join(root, rel)).sort()) {
    const childRel = rel ? `${rel}/${name}` : name;
    const info = statSync(join(root, childRel), { throwIfNoEntry: false });
    if (!info) fail(`vanished while reading: ${childRel}`);
    if (info.isSymbolicLink()) fail(`symlink found, refusing to copy: ${childRel}`);
    if (info.isDirectory()) {
      const sub = walkTree(root, childRel);
      out.files.push(...sub.files);
      out.bytes += sub.bytes;
    } else if (info.isFile()) {
      out.files.push(childRel);
      out.bytes += info.size;
    } else {
      fail(`not a plain file or directory: ${childRel}`);
    }
  }
  return out;
}

// The screenshots have their own rules, so they get their own check:
// JPEG/PNG/WebP only, each under the size cap, and no more than four.
function checkShots(dir: string): { files: string[]; bytes: number } {
  if (!existsSync(dir)) fail(`missing screenshots/ directory at ${dir}`);
  const names = readdirSync(dir).sort();
  if (names.length === 0) fail('screenshots/ is empty — take real screenshots first');
  if (names.length > SHOT_MAX_COUNT) fail(`too many screenshots: ${names.length} (max ${SHOT_MAX_COUNT})`);
  let bytes = 0;
  for (const name of names) {
    if (!/\.(jpe?g|png|webp)$/i.test(name)) fail(`screenshot is not an image: ${name}`);
    const size = statSync(join(dir, name)).size;
    if (size > SHOT_MAX_BYTES) fail(`screenshot ${name} is ${humanBytes(size)} (max ${humanBytes(SHOT_MAX_BYTES)})`);
    bytes += size;
  }
  return { files: names, bytes };
}

// ------------------------------------------------------------ the build

function buildEntry(): void {
  const repoRoot = resolve(import.meta.dirname ?? '.');
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  // 1. The game has to exist and hold an index.html before anything copies.
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    fail(`no game/ directory in ${repoRoot}`);
  }
  const indexPath = join(gameDir, 'index.html');
  if (!existsSync(indexPath)) fail('game/index.html is missing');
  if (statSync(indexPath).size > 1024 * 1024) fail('game/index.html is over the 1 MiB cap');

  // 2. Measure both trees and fail early with a clear message if a cap
  //    is blown, rather than letting the dossier builder say it later.
  const game = walkTree(gameDir);
  const entries = game.files.length + readdirSync(gameDir).length; // files + dirs, roughly
  if (game.files.length > GAME_MAX_ENTRIES) fail(`game/ has ${game.files.length} files (max ${GAME_MAX_ENTRIES})`);
  if (game.bytes > GAME_MAX_BYTES) fail(`game/ is ${humanBytes(game.bytes)} (max ${humanBytes(GAME_MAX_BYTES)})`);
  const shots = checkShots(shotsDir);

  // 3. Fresh output folder, then copy both trees verbatim.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  // 4. The dossier: the kit library reads the copied trees back and
  //    produces the canonical manifest the scorer compares against.
  const dossier = buildDossier(outDir, {
    text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
    screenshots: { max: SHOT_MAX_COUNT, max_bytes: SHOT_MAX_BYTES },
    game_max_files: GAME_MAX_ENTRIES,
    game_max_bytes: GAME_MAX_BYTES,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  // 5. A short report so a human (or a log) can see what just happened.
  console.log('Solmar Bay — build report');
  console.log(`  repo:        ${repoRoot}`);
  console.log(`  output:      ${outDir}`);
  console.log(`  game files:  ${game.files.length} files, ${humanBytes(game.bytes)} (entries seen: ${entries})`);
  console.log(`  screenshots: ${shots.files.join(', ')} — ${humanBytes(shots.bytes)} total`);
  console.log(`  dossier:     ${humanBytes(dossier.byteLength)} written to dossier.json`);
  console.log('  build OK');
}

buildEntry();
