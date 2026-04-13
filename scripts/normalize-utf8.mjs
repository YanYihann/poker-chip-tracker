import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const GB18030_DECODER = new TextDecoder("gb18030");
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".md",
  ".yml",
  ".yaml"
]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === ".git") {
        continue;
      }
      walk(fullPath, out);
      continue;
    }

    for (const ext of TEXT_EXTENSIONS) {
      if (fullPath.endsWith(ext)) {
        out.push(fullPath);
        break;
      }
    }
  }
}

function isValidUtf8(bytes) {
  try {
    UTF8_DECODER.decode(bytes);
    return true;
  } catch {
    return false;
  }
}

const files = [];
walk("src", files);

let convertedCount = 0;

for (const file of files) {
  const bytes = readFileSync(file);
  if (isValidUtf8(bytes)) {
    continue;
  }

  const repaired = GB18030_DECODER.decode(bytes);
  writeFileSync(file, repaired, "utf8");
  convertedCount += 1;
}

if (convertedCount > 0) {
  console.log(`[normalize-utf8] repaired ${convertedCount} file(s).`);
} else {
  console.log("[normalize-utf8] all source files are valid UTF-8.");
}
