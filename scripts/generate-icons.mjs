import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');
const svgBuffer = readFileSync(resolve(assetsDir, 'pokeball.svg'));

const icons = [
  { name: 'icon.png', size: 1024 },
  { name: 'splash-icon.png', size: 1024 },
  { name: 'android-icon-foreground.png', size: 1024 },
  { name: 'favicon.png', size: 48 },
];

for (const { name, size } of icons) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(assetsDir, name));
  console.log(`Generated ${name} (${size}x${size})`);
}

// Android background — solid color matching app background
await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 26, g: 26, b: 46, alpha: 1 } }
})
  .png()
  .toFile(resolve(assetsDir, 'android-icon-background.png'));
console.log('Generated android-icon-background.png (512x512)');

// Android monochrome — white pokeball on transparent
// Use the same SVG but make everything white/black for monochrome
const monoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="none"/>
  <circle cx="512" cy="512" r="480" fill="#222"/>
  <clipPath id="topHalf"><rect x="0" y="0" width="1024" height="512"/></clipPath>
  <circle cx="512" cy="512" r="450" fill="#fff" clip-path="url(#topHalf)"/>
  <clipPath id="bottomHalf"><rect x="0" y="512" width="1024" height="512"/></clipPath>
  <circle cx="512" cy="512" r="450" fill="#fff" clip-path="url(#bottomHalf)"/>
  <rect x="32" y="484" width="960" height="56" fill="#222"/>
  <circle cx="512" cy="512" r="72" fill="#222"/>
  <circle cx="512" cy="512" r="60" fill="#444"/>
  <circle cx="512" cy="512" r="46" fill="#fff"/>
</svg>`;

await sharp(Buffer.from(monoSvg))
  .resize(432, 432)
  .png()
  .toFile(resolve(assetsDir, 'android-icon-monochrome.png'));
console.log('Generated android-icon-monochrome.png (432x432)');

console.log('\nAll icons generated!');
