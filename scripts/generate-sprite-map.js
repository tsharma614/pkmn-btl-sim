#!/usr/bin/env node
/**
 * Generate a static require map for all bundled sprites.
 * React Native requires static require() calls, so we generate a literal map.
 */
const fs = require('fs');
const path = require('path');

const pokedex = require('../src/data/pokedex.json');
const megaPokedex = require('../src/data/mega-pokemon.json');

const SPRITES_DIR = path.join(__dirname, '..', 'assets', 'sprites');
const OUT_FILE = path.join(__dirname, '..', 'src', 'client', 'sprite-map.ts');

const allIds = [
  ...Object.values(pokedex).map(s => s.id),
  ...Object.values(megaPokedex).map(s => s.id),
];

const entries = [];
for (const id of allIds) {
  const file = path.join(SPRITES_DIR, `${id}.png`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) {
    entries.push(`  '${id}': require('../../assets/sprites/${id}.png'),`);
  }
}

const content = `/**
 * Auto-generated sprite map — DO NOT EDIT MANUALLY.
 * Run: node scripts/generate-sprite-map.js
 */
import { ImageSourcePropType } from 'react-native';

const SPRITE_MAP: Record<string, ImageSourcePropType> = {
${entries.join('\n')}
};

export default SPRITE_MAP;
`;

fs.writeFileSync(OUT_FILE, content);
console.log(`Generated sprite map with ${entries.length} entries at ${OUT_FILE}`);
