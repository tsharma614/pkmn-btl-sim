#!/usr/bin/env node
/**
 * Download animated back GIF sprites from Showdown CDN.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const pokedex = require('../src/data/pokedex.json');
const megaPokedex = require('../src/data/mega-pokemon.json');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sprites', 'ani-back');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

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
  console.log(`Downloading ${ids.length} animated back sprites...`);

  let success = 0, failed = 0;
  const CONCURRENCY = 8;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (id) => {
      const spriteId = toSpriteId(id);
      const dest = path.join(OUT_DIR, `${id}.gif`);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
        success++;
        return;
      }
      const urls = [
        `https://play.pokemonshowdown.com/sprites/ani-back/${spriteId}.gif`,
        `https://play.pokemonshowdown.com/sprites/gen5ani-back/${spriteId}.gif`,
      ];
      for (const url of urls) {
        try {
          await download(url, dest);
          success++;
          return;
        } catch {}
      }
      failed++;
    }));
    process.stdout.write(`\r  ${i + batch.length}/${ids.length} (${success} ok, ${failed} no-gif)`);
  }
  console.log(`\nDone: ${success} downloaded, ${failed} static-only`);
}

main().catch(console.error);
