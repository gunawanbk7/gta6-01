// Solmar Bay — entry program (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from beside this file to
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with buildDossier from the kit's vendored library.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(here, 'game'), join(outDir, 'game'));
copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'));

// The scorer's own caps: only text_max_bytes shapes the dossier bytes; the
// rest refuse an entry the scorer would refuse anyway (too many or too large
// screenshots, too many game files or bytes, or a game path over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
