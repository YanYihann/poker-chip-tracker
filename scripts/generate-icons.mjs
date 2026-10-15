import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// The SVG is the source of truth; rerun with `node scripts/generate-icons.mjs`.
const source = await readFile(new URL("../public/brand/poker-chip.svg", import.meta.url));
const rounded = source.toString().replace('<rect width="512" height="512"', '<rect rx="96" width="512" height="512"');
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/app/icon.svg", import.meta.url), rounded);
for (const [size, path] of [
  [180, "../src/app/apple-icon.png"],
  [192, "../public/icons/poker-chip-192.png"],
  [512, "../public/icons/poker-chip-512.png"]
]) {
  await sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(path, import.meta.url)));
}

// ICO directory with PNG frames supports legacy favicon requests as well.
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map((size) => sharp(Buffer.from(rounded)).resize(size, size).png().toBuffer()));
const directory = Buffer.alloc(6 + 16 * frames.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([directory, ...frames]));
console.log("Generated SVG, 16/32/48 px ICO, 180 px Apple icon, and 192/512 px app icons.");
