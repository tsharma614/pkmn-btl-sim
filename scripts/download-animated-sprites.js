#!/usr/bin/env node
/**
 * Download animated GIF sprites from Showdown CDN.
 * Front sprites only (back sprites use static PNGs to save space).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const pokedex = require('../src/data/pokedex.json');
const megaPokedex = require('../src/data/mega-pokemon.json');

const ANI_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'ani');
if (!fs.existsSync(ANI_DIR)) fs.mkdirSync(ANI_DIR, { recursive: true });

const NOT_MEGA = new Set(['yanmega']);
function toSpriteId(id) {
  if (!NOT_MEGA.has(id)) {
    const megaMatch = id.match(/^(.+?)(mega[xy]?)$/);
    if (megaMatch) return megaMatch[1] + '-' + megaMatch[2];
  }
  const suffixes = ['alola', 'galar', 'hisui', 'paldea'];
  for (const suffix of suffixes) {
    if (id.endsWith(suffix) && id.length > suffix.length) {
      return id.slice(0, -suffix.length) + '-' + suffix;
    }
  }
  return id;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'PBSim/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  const allSpecies = [...Object.values(pokedex), ...Object.values(megaPokedex)];
  const ids = allSpecies.map(s => s.id);
  console.log(`Downloading ${ids.length} animated front sprites...`);

  let success = 0, fallbackGen5 = 0, failed = 0;
  const CONCURRENCY = 8;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (id) => {
      const spriteId = toSpriteId(id);
      const dest = path.join(ANI_DIR, `${id}.gif`);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
        success++;
        return;
      }
      // Try ani/ first, then gen5ani/
      const urls = [
        `https://play.pokemonshowdown.com/sprites/ani/${spriteId}.gif`,
        `https://play.pokemonshowdown.com/sprites/gen5ani/${spriteId}.gif`,
      ];
      for (let j = 0; j < urls.length; j++) {
        try {
          await download(urls[j], dest);
          if (j === 0) success++;
          else fallbackGen5++;
          return;
        } catch {}
      }
      // No animated sprite available — will fallback to static PNG at runtime
      failed++;
    }));
    process.stdout.write(`\r  ${i + batch.length}/${ids.length} (${success} ani, ${fallbackGen5} gen5ani, ${failed} no-gif)`);
  }
  console.log(`\nDone: ${success} animated, ${fallbackGen5} gen5 fallback, ${failed} static-only`);
}

main().catch(console.error);
