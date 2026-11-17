// Solmar Bay — make.fun program/v1 entrypoint (Node 22, standard library only).
//
// The game itself is plain static files under game/ (index.html plus ES modules,
// no build step, no network request). This program hands it in: it copies game/
// and screenshots/ from beside this file into /output (or MAKEFUN_OUTPUT_DIR
// outside the grader) and writes /output/dossier.json with buildDossier from the
// vendored make.fun library, so the judge can read the entry.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (gate.json): text_max_bytes shapes the dossier bytes;
// the rest refuse an entry the scorer would refuse — more than 4 screenshots or
// one over 256 KiB, more than 993 files in game/ or 48 MiB of game files in all,
// or a path under game/ over 1000 bytes. game/ counts beside /output's own
// 1000-entry cap, its screenshots/ and dossier.json.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
