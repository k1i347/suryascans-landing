import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const COVER_DIR = "cover";
const OUT_FILE = path.join(COVER_DIR, "covers.json");
const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isImage(file) {
  return exts.has(path.extname(file).toLowerCase());
}

function titleFromFilename(filename) {
  // bỏ extension
  let base = filename.replace(/\.[^.]+$/, "");

  // Một số file bị dính "đuôi" extension trong tên (vd: Global-Martial-Artsjpg.jpg)
  // => cắt bỏ nếu phần cuối tên file trùng với 1 extension ảnh phổ biến.
  // Lặp để xử lý trường hợp dính nhiều lần.
  const extLike = /(jpg|jpeg|png|webp|gif)$/i;
  while (extLike.test(base) && base.length > 4) {
    base = base.replace(extLike, "");
  }
  // đổi - _ thành khoảng trắng, gom khoảng trắng
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

async function readImagesIn(folder) {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter(isImage)
    .sort((a, b) => a.localeCompare(b, "en"));
}

async function main() {
  // ưu tiên 2 folder manhwa/manhua; nếu không có thì fallback quét root cover/
  const manhwaDir = path.join(COVER_DIR, "manhwa");
  const manhuaDir = path.join(COVER_DIR, "manhua");

  const [manhwaFiles, manhuaFiles] = await Promise.all([
    readImagesIn(manhwaDir),
    readImagesIn(manhuaDir),
  ]);

  // Output đúng format bạn yêu cầu: chỉ có 2 key "manhwa" và "manhua".
  // Thứ tự key trong file JSON được giữ theo thứ tự chèn (manhwa trước, manhua sau).
  let data;

  if (manhwaFiles.length || manhuaFiles.length) {
    data = {
      manhwa: manhwaFiles.map((f) => ({ file: `manhwa/${f}`, title: titleFromFilename(f) })),
      manhua: manhuaFiles.map((f) => ({ file: `manhua/${f}`, title: titleFromFilename(f) })),
    };
  } else {
    // fallback: nếu không có folder con manhwa/manhua thì quét trực tiếp cover/
    const rootFiles = await readImagesIn(COVER_DIR);
    data = {
      manhwa: rootFiles.map((f) => ({ file: f, title: titleFromFilename(f) })),
      manhua: [],
    };
  }

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[generate-covers] Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("[generate-covers] ERROR:", err);
  process.exit(1);
});
