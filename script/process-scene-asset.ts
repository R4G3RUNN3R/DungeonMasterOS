// script/process-scene-asset.ts
//
// One-off/reusable scene-asset ingestion tool (research report's
// "workflow should be machine-enforced" requirement). Takes a raw,
// already-license-cleared source image and produces a compressed WebP
// derivative in client/public/scene-assets/ — never the raw original.
// Raw stock downloads must not be exposed as a downloadable path from
// the app; this script is a local/dev-time step only.
//
// Usage: npx tsx script/process-scene-asset.ts <input-file> <output-id>
//   Writes client/public/scene-assets/<output-id>.webp
//   Prints the resulting width, height, byte size, and sha256 checksum
//   so they can be copied into shared/scene-asset-registry.ts.

import sharp from "sharp";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";

const MAX_DIMENSION = 2560; // well above the 1920x1080 baseline, keeps files reasonable
const WEBP_QUALITY = 82;

async function main() {
  const [, , inputPath, outputId] = process.argv;
  if (!inputPath || !outputId) {
    console.error("Usage: npx tsx script/process-scene-asset.ts <input-file> <output-id>");
    process.exit(1);
  }

  const outDir = path.resolve(import.meta.dirname, "..", "client", "public", "scene-assets");
  const outPath = path.join(outDir, `${outputId}.webp`);

  const image = sharp(inputPath).rotate(); // rotate() auto-applies EXIF orientation
  const meta = await image.metadata();

  const resized = (meta.width ?? 0) > MAX_DIMENSION
    ? image.resize({ width: MAX_DIMENSION, withoutEnlargement: true })
    : image;

  await resized.webp({ quality: WEBP_QUALITY }).toFile(outPath);

  const outMeta = await sharp(outPath).metadata();
  const checksum = createHash("sha256").update(readFileSync(outPath)).digest("hex");

  console.log(JSON.stringify({
    outputId,
    localAssetPath: `/scene-assets/${outputId}.webp`,
    width: outMeta.width,
    height: outMeta.height,
    checksum,
  }, null, 2));
}

main();
