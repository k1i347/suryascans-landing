import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const COVER_DIR = "cover";
const OUT_FILE = path.join(COVER_DIR, "covers.json");

// Các đuôi ảnh được hỗ trợ
const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isImage(file) {
  const ext = path.extname(file).toLowerCase();
  return exts.has(ext);
}

async function main() {
  const files = await readdir(COVER_DIR, { withFileTypes: true });

  // Lấy tất cả file ảnh trong /cover (bỏ qua thư mục con)
  const images = files
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter(isImage)
    .filter((name) => name.toLowerCase() !== "covers.json")
    .sort((a, b) => a.localeCompare(b, "en"));

  // Ghi ra covers.json
  await writeFile(OUT_FILE, JSON.stringify(images, null, 2), "utf-8");

  console.log(`[generate-covers] Found ${images.length} image(s). Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("[generate-covers] ERROR:", err);
  process.exit(1);
});
