import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const media = path.join(root, "media");
const source = path.join(media, "source", "env-lens-approved.png");
const base = sharp(source).ensureAlpha();

await base.clone().resize(512, 512, { fit: "contain" }).png().toFile(path.join(media, "icon-512.png"));
await base.clone().resize(256, 256, { fit: "contain" }).png().toFile(path.join(media, "icon.png"));
console.log("Rendered ENV Lens icons directly from the approved raster source.");
