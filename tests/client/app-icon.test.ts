import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 2 — App icon', () => {
  const assetsDir = path.resolve(__dirname, '../../assets');

  const requiredIcons = [
    { name: 'icon.png', minSize: 5000 },
    { name: 'splash-icon.png', minSize: 5000 },
    { name: 'android-icon-foreground.png', minSize: 5000 },
    { name: 'android-icon-background.png', minSize: 200 },
    { name: 'android-icon-monochrome.png', minSize: 200 },
    { name: 'favicon.png', minSize: 100 },
  ];

  for (const { name, minSize } of requiredIcons) {
    it(`${name} exists and is a valid PNG`, () => {
      const filePath = path.join(assetsDir, name);
      expect(fs.existsSync(filePath), `${name} should exist`).toBe(true);
      const buf = fs.readFileSync(filePath);
      // PNG magic bytes
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50); // P
      expect(buf[2]).toBe(0x4e); // N
      expect(buf[3]).toBe(0x47); // G
      expect(buf.length).toBeGreaterThan(minSize);
    });
  }

  it('SVG source exists', () => {
    expect(fs.existsSync(path.join(assetsDir, 'pokeball.svg'))).toBe(true);
  });

  it('generation script exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../scripts/generate-icons.mjs'))).toBe(true);
  });
});
