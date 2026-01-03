import fs from "fs";
import path from "path";

const DATA_URL =
  process.env.VANTHUCAC_DATA_URL ||
  "https://vanthucac.xyz/wp-json/vanthucac/v1/comics?limit=500";

function toNumber(val, fallback = 0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeItem(it = {}) {
  return {
    id: it.id,
    title: it.title,
    genre: it.genre,
    cover: it.cover,
    url: it.url,
    views: toNumber(it.views, 0),
  };
}


function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cardHtml(it) {
  const title = escapeHtml(it.title || "Untitled");
  const cover = escapeHtml(it.cover || "");
  const url = escapeHtml(it.url || "#");

  return `
    <a class="card" href="${url}" target="_blank" rel="noopener">
      <img src="${cover}" alt="${title}" loading="lazy" />
      <div class="title">${title}</div>
    </a>
  `.trim();
}

async function main() {
  // Node 20+ có fetch sẵn
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items.map(normalizeItem) : [];

  // chỉ nhận đúng 2 genre
  const manhua = items.filter((x) => x.genre === "manhua");
  const manhwa = items.filter((x) => x.genre === "manhwa");

  const tpl = fs.readFileSync("templates/index.template.html", "utf8");

  const html = tpl
     .replaceAll(
      "{{UPDATED_AT}}",
      escapeHtml(data.updatedAt || new Date().toISOString())
    )
    .replaceAll("{{MANHUA_COUNT}}", String(manhua.length))
    .replaceAll("{{MANHWA_COUNT}}", String(manhwa.length))
    .replaceAll("{{MANHUA_LIST}}", manhua.map(cardHtml).join("\n"))
    .replaceAll("{{MANHWA_LIST}}", manhwa.map(cardHtml).join("\n"));

  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync(path.join("dist", "index.html"), html, "utf8");

  // (tuỳ chọn) lưu snapshot để debug/đối chiếu
const snapshot = {
    ...data,
    items,
  };

  fs.writeFileSync(
    path.join("dist", "comics.snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );

  fs.mkdirSync(path.join("assets", "data"), { recursive: true });
  fs.writeFileSync(
    path.join("assets", "data", "comics.snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );
  console.log(`[site] Built dist/index.html: manhua=${manhua.length}, manhwa=${manhwa.length}`);
}

main().catch((err) => {
  console.error("[site] ERROR:", err);
  process.exit(1);
});
