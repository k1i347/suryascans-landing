/* app.js — Featured projects: Manhwa/Manhua + Dots + Mobile-friendly carousel */
(() => {
  // ===== Config =====
  const COVERS_JSON_URL = "./cover/covers.json"; // relative để không lỗi khi deploy subfolder
  const COVER_BASE_PATH = "./cover/";            // ảnh sẽ là ./cover/<file>
  const DEFAULT_HREF = "https://vanthucac.xyz";  // click cover mở reading site

  // ===== DOM =====
  const viewport = document.getElementById("carouselViewport");
  const track = document.getElementById("coversTrack");
  const dotsWrap = document.getElementById("carouselDots");
  const hint = document.getElementById("coversHint");
  const tabs = document.querySelectorAll(".projects-controls .pill");

  // Footer year
  document.querySelectorAll("#year, .year").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // Nếu trang chưa có section carousel thì thoát
  if (!viewport || !track || !dotsWrap || !hint) return;

  // ===== State =====
  let featuredData = { manhwa: [], manhua: [] };
  let currentType = "manhwa";
  let currentPage = 0;
  let columns = 5;
  let pagesCount = 1;

  // ===== Helpers =====
  function stripBom(text) {
    return text.replace(/^\uFEFF/, "");
  }

  function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function titleFromFilename(filename) {
    const base = filename.replace(/\.[^.]+$/, "");
    return decodeURIComponent(base)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeItem(item) {
    // Cho phép format cũ: ["a.jpg","b.webp"...]
    if (typeof item === "string") {
      if (!isNonEmptyString(item)) return null;
      return {
        file: item.trim(),
        title: titleFromFilename(item.trim()),
        href: DEFAULT_HREF,
      };
    }

    // Format mới: {file,title,href?}
    if (item && typeof item === "object") {
      const file = isNonEmptyString(item.file) ? item.file.trim() : "";
      if (!file) return null;
      const title = isNonEmptyString(item.title) ? item.title.trim() : titleFromFilename(file);
      const href = isNonEmptyString(item.href) ? item.href.trim() : DEFAULT_HREF;
      return { file, title, href };
    }

    return null;
  }

  function normalizeRawJson(raw) {
    // Format mới: { manhwa:[{file,title,href?}], manhua:[...] }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const manhwa = Array.isArray(raw.manhwa) ? raw.manhwa : [];
      const manhua = Array.isArray(raw.manhua) ? raw.manhua : [];
      return {
        manhwa: manhwa.map(normalizeItem).filter(Boolean),
        manhua: manhua.map(normalizeItem).filter(Boolean),
      };
    }

    // Format cũ: ["file1.jpg","file2.webp"...] => mặc định là manhwa
    if (Array.isArray(raw)) {
      return {
        manhwa: raw.map(normalizeItem).filter(Boolean),
        manhua: [],
      };
    }

    return { manhwa: [], manhua: [] };
  }

  async function loadCoversJson() {
    const res = await fetch(COVERS_JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = stripBom(await res.text());
    return JSON.parse(text);
  }

  function setActiveTab(type) {
    tabs.forEach((btn) => {
      const active = btn.dataset.type === type;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function setHint(text) {
    hint.textContent = text || "";
  }

  function setActiveDot(index) {
    dotsWrap.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("is-active", i === index);
      d.setAttribute("aria-current", i === index ? "true" : "false");
    });
  }

  function getColumns() {
    const w = window.innerWidth;
    if (w <= 680) return 2;
    if (w <= 980) return 3;
    if (w <= 1200) return 4;
    return 5;
  }

  function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  function renderDots(count) {
    dotsWrap.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (i === 0 ? " is-active" : "");
      b.setAttribute("aria-label", `Go to page ${i + 1}`);
      b.dataset.index = String(i);
      b.addEventListener("click", () => goToPage(i));
      dotsWrap.appendChild(b);
    }

    // Nếu chỉ 1 trang thì vô hiệu dots cho “đỡ gây hiểu nhầm”
    dotsWrap.style.pointerEvents = count > 1 ? "auto" : "none";
  }

  function renderCarousel(items, keepItemIndex = 0) {
    columns = getColumns();

    const pages = chunk(items, columns);
    pagesCount = Math.max(1, pages.length);

    // Tính page phù hợp nếu đang giữ vị trí theo item index
    currentPage = Math.floor(Math.max(0, keepItemIndex) / columns);
    if (currentPage > pagesCount - 1) currentPage = pagesCount - 1;

    track.innerHTML = pages
      .map((pageItems, pageIndex) => {
        const cards = pageItems
          .map((it) => {
            const imgSrc = `${COVER_BASE_PATH}${encodeURI(it.file)}`;
            const safeTitle = escapeHtml(it.title || "Untitled");
            const href = escapeHtml(it.href || DEFAULT_HREF);

            return `
              <a class="cover-card" role="listitem"
                 href="${href}" target="_blank" rel="noopener"
                 aria-label="${safeTitle}">
                <img src="${imgSrc}" alt="${safeTitle}" loading="lazy" />
                <span class="cover-title">${safeTitle}</span>
              </a>
            `;
          })
          .join("");

        return `<div class="carousel-page" data-page="${pageIndex}" style="--cols:${columns};">${cards}</div>`;
      })
      .join("");

    // reset transform theo currentPage
    track.style.transform = `translateX(${-currentPage * 100}%)`;

    renderDots(pagesCount);
    setActiveDot(currentPage);

    if (items.length) {
      setHint(
        `${items.length} featured ${currentType} series • Page ${currentPage + 1}/${pagesCount}`
      );
    } else {
      setHint(`No featured ${currentType} items yet.`);
    }
  }

  function goToPage(pageIndex) {
    const maxPage = pagesCount - 1;
    currentPage = Math.max(0, Math.min(pageIndex, maxPage));
    track.style.transform = `translateX(${-currentPage * 100}%)`;
    setActiveDot(currentPage);

    const items = featuredData?.[currentType] || [];
    if (items.length) {
      setHint(
        `${items.length} featured ${currentType} series • Page ${currentPage + 1}/${pagesCount}`
      );
    }
  }

  function switchType(type, keepItemIndex = 0) {
    currentType = type;
    setActiveTab(type);

    const items = featuredData?.[type] || [];
    renderCarousel(items, keepItemIndex);
  }

  // ===== Swipe (mobile) =====
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartT = 0;

  viewport.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartT = Date.now();
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchend",
    (e) => {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const dt = Date.now() - touchStartT;

      // chỉ bắt swipe ngang rõ ràng
      if (Math.abs(dx) < 40) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.8) return;
      if (dt > 700) return;

      if (dx < 0) goToPage(currentPage + 1);
      else goToPage(currentPage - 1);
    },
    { passive: true }
  );

  // ===== Init =====
  async function init() {
    try {
      const raw = await loadCoversJson();
      featuredData = normalizeRawJson(raw);

      // Nếu manhwa rỗng mà manhua có -> mở manhua
      if (
        (!featuredData.manhwa || featuredData.manhwa.length === 0) &&
        featuredData.manhua &&
        featuredData.manhua.length > 0
      ) {
        switchType("manhua", 0);
      } else {
        switchType("manhwa", 0);
      }

      // tab events
      tabs.forEach((btn) => {
        btn.addEventListener("click", () => {
          const type = btn.dataset.type;
          if (type === "manhwa" || type === "manhua") {
            switchType(type, 0);
          }
        });
      });

      // resize => rerender nếu đổi columns, giữ vị trí item đầu trang hiện tại
      window.addEventListener("resize", () => {
        const newCols = getColumns();
        if (newCols !== columns) {
          const keepItemIndex = currentPage * columns;
          switchType(currentType, keepItemIndex);
        }
      });
    } catch (err) {
      console.error("[covers] load failed:", err);
      setHint(
        "Could not load /cover/covers.json. Make sure it exists and contains valid JSON."
      );
    }
  }

  init();
})();
