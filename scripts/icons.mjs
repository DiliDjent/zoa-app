import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'static', 'icons');
mkdirSync(iconsDir, { recursive: true });
const svg = readFileSync(join(iconsDir, 'icon.svg'));

const sizes = [192, 512];
for (const size of sizes) {
  await sharp(svg, { density: 400 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(iconsDir, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}

// Maskable: Motiv auf 80 % verkleinert, damit Android es beliebig beschneiden kann
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#16283f' }
})
  .composite([{ input: await sharp(svg, { density: 400 }).resize(410, 410).png().toBuffer(), gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(join(iconsDir, 'icon-maskable-512.png'));
console.log('icon-maskable-512.png');

await sharp(svg, { density: 400 }).resize(180, 180).png().toFile(join(iconsDir, 'apple-touch-icon.png'));
console.log('apple-touch-icon.png');
