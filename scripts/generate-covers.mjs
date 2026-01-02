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
  const base = filename.replace(/\.[^.]+$/, "");
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

  let data;

  if (manhwaFiles.length || manhuaFiles.length) {
    data = {
      // Thêm order/sections để UI luôn render đúng thứ tự (manhwa trước, manhua sau)
      // ngay cả khi phía client có sort keys.
      order: ["manhwa", "manhua"],
      sections: [
        {
          type: "manhwa",
          items: manhwaFiles.map((f) => ({ file: `manhwa/${f}`, title: titleFromFilename(f) })),
        },
        {
          type: "manhua",
          items: manhuaFiles.map((f) => ({ file: `manhua/${f}`, title: titleFromFilename(f) })),
        },
      ],
      manhwa: manhwaFiles.map((f) => ({ file: `manhwa/${f}`, title: titleFromFilename(f) })),
      manhua: manhuaFiles.map((f) => ({ file: `manhua/${f}`, title: titleFromFilename(f) })),
    };
  } else {
    // fallback: quét cover/ như script cũ của bạn :contentReference[oaicite:2]{index=2}
    const rootFiles = await readImagesIn(COVER_DIR);
    data = {
      order: ["manhwa", "manhua"],
      sections: [
        {
          type: "manhwa",
          items: rootFiles.map((f) => ({ file: f, title: titleFromFilename(f) })),
        },
        { type: "manhua", items: [] },
      ],
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
