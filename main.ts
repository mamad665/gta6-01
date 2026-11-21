// Solmar City — dossier builder. Run: MAKEFUN_OUTPUT_DIR=out node main.ts
// Writes dossier.json describing the game for the make.fun entry.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(root, 'out');

function listFiles(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p, rel));
    else out.push({ path: rel, bytes: st.size, lines: readFileSync(p, 'utf8').split('\n').length });
  }
  return out;
}

const gameDir = join(root, 'game');
const files = listFiles(gameDir);
const totalLines = files.reduce((s, f) => s + f.lines, 0);
const totalBytes = files.reduce((s, f) => s + f.bytes, 0);

const shotDir = join(root, 'screenshots');
const shots = [];
if (existsSync(shotDir)) {
  for (const name of readdirSync(shotDir).sort()) {
    if (!/\.(jpg|jpeg|png)$/i.test(name)) continue;
    const buf = readFileSync(join(shotDir, name));
    const ext = name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    shots.push({ name, bytes: buf.length, data: `data:image/${ext};base64,${buf.toString('base64')}` });
  }
}

const dossier = {
  title: 'Solmar City — Open-World Crime',
  competition: 'gta6-01',
  description: 'A top-down 2D open-world crime game set in the fictional coastal city of Solmar. Play Marco Vale, a wheelman working four chained jobs for Rosa Delgado: run packages, steal a Comet GT, make a quiet drop, and intercept a bank van — while the Solmar PD hunts you down with a wanted-star system.',
  howToPlay: 'WASD to move and drive, E to enter or steal a car, F to punch, G or click to shoot, P to pause, M to mute. Follow the gold star marker to complete each job. Watch your health and wanted stars.',
  features: [
    'Open world: road grid city with buildings, park, beach, pier, docks and 8 named landmarks',
    'Drive and steal cars (E), traffic AI that follows roads, pedestrians that flee gunfire',
    'Wanted-star system with police chase AI, ramming, and BUSTED arrests',
    'Four chained story missions for Rosa Delgado with payouts $500 / $800 / $1,200 / $2,500',
    'Combat: punching and pistol with ammo, muzzle tracers, hit reactions',
    'HUD with cash, health, wanted stars, live minimap, objective tracker and toasts',
    'Title, pause, BUSTED, WASTED and story-end screens; save/load via localStorage',
    'Synthesized WebAudio SFX: gunshots, siren, pickup chimes, mission jingles',
  ],
  tech: 'Vanilla ES modules, no libraries, no network, canvas 2D rendering at 1280x720.',
  files,
  stats: { totalFiles: files.length, totalLines, totalBytes, screenshots: shots.length },
  screenshots: shots,
  entrypoint: 'game/index.html',
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2));
const size = statSync(join(outDir, 'dossier.json')).size;
console.log(`dossier.json: ${size} bytes, ${files.length} files, ${totalLines} lines, ${shots.length} screenshots`);
if (size > 1572864) {
  console.error('ERROR: dossier exceeds the 1.5 MiB cap');
  process.exit(1);
}
