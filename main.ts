// Solmar City — entry packager for the make.fun "Make GTA 6" bounty (gta6-01).
//
// What this program does, in order:
//   1. Stages a clean copy of the playable game (game/) and its screenshots
//      (screenshots/) into the hand-in directory.
//   2. Asks the vendored make.fun library to build the dossier from that staged
//      copy, so the dossier the judge reads describes exactly what was handed in.
//   3. Prints a short summary of the staged entry so a bad stage is obvious
//      before anything is submitted.
//
// The hand-in directory is MAKEFUN_OUTPUT_DIR when set (the scorer's sandbox
// runs with /output); otherwise it defaults to /output. Run it locally with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22+ only, standard library only — no build step, no install.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The competition's own caps, as the scorer's gate states them. The text cap is
// the only one that shapes the dossier's bytes; the rest make this program
// refuse an entry the scorer would refuse, instead of handing in a bad one.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const handIn = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Files and directories below `dir`, counted the way the platform counts them. */
function tally(dir) {
  let entries = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    entries += 1;
    if (st.isDirectory()) {
      const sub = tally(p);
      entries += sub.entries;
      bytes += sub.bytes;
    } else {
      bytes += st.size;
    }
  }
  return { entries, bytes };
}

/** Stage one source tree into the hand-in dir, replacing any stale copy. */
function stageTree(source, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  if (existsSync(source)) cpSync(source, dest, { recursive: true });
}

mkdirSync(handIn, { recursive: true });
stageTree(join(repoRoot, 'game'), join(handIn, 'game'));
stageTree(join(repoRoot, 'screenshots'), join(handIn, 'screenshots'));

// How many screenshots the staged copy holds: the dossier must carry them all.
const shotsExpected = readdirSync(join(handIn, 'screenshots')).filter((n) => /\.(png|jpe?g)$/i.test(n)).length;

// Build the dossier from the staged copy, not from the repo, so the judge's
// rebuild from the same staged files produces the same bytes.
const dossier = buildDossier(handIn, GATE);
writeFileSync(join(handIn, 'dossier.json'), dossier);

// Read the dossier back and check what was actually written, so a truncated
// or corrupt write is caught here instead of by the scorer.
const written = JSON.parse(readFileSync(join(handIn, 'dossier.json'), 'utf8'));
if (written.schema !== 'makefun/dossier/v1') throw new Error(`dossier.json: unexpected schema ${written.schema}`);
if (!Array.isArray(written.images) || written.images.length !== shotsExpected) {
  throw new Error(`dossier.json: holds ${written.images?.length ?? 0} images, expected ${shotsExpected}`);
}

const game = tally(join(handIn, 'game'));
const shots = readdirSync(join(handIn, 'screenshots'))
  .filter((n) => /\.(png|jpe?g)$/i.test(n))
  .sort()
  .map((n) => `${n} (${statSync(join(handIn, 'screenshots', n)).size} bytes)`);
console.log(`staged ${game.entries} game entries (${game.bytes} bytes) and ${shots.length} screenshots into ${handIn}`);
console.log(`screenshots: ${shots.join(', ')}`);
console.log(`dossier.json: ${dossier.length} bytes, schema ${written.schema}, ${written.images.length} images, text ${Buffer.byteLength(written.text, 'utf8')} bytes`);
