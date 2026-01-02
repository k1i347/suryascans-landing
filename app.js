(() => {
  // ===== Config =====
  const COVERS_JSON_URL = "./cover/covers.json"; // dùng relative để không lỗi khi deploy subfolder
  const COVER_BASE_PATH = "./cover/"; // ảnh sẽ là ./cover/<file>
  const DEFAULT_HREF = "https://vanthucac.xyz"; // click cover mở reading site
  const AUTO_PLAY_DELAY = 2000; // ms

  // ===== DOM =====
 const controllers = {
    manhwa: createController("manhwa"),
    manhua: createController("manhua"),
  };

  const hasCarousels = Object.values(controllers).some(Boolean);
  if (!hasCarousels) return;

  // Footer year (nếu bạn có 1 hoặc nhiều chỗ hiển thị năm)
  document.querySelectorAll("#year, .year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

 
  let featuredData = { manhwa: [], manhua: [] };
  let lastColumns = getColumns();

  function createController(type) {
    const viewport = document.getElementById(`carouselViewport-${type}`);
    const track = document.getElementById(`coversTrack-${type}`);
    const dotsWrap = document.getElementById(`carouselDots-${type}`);
    const hint = document.getElementById(`coversHint-${type}`);

    if (!viewport || !track || !dotsWrap || !hint) return null;

    const ctrl = {
      type,
      viewport,
      track,
      dotsWrap,
      hint,
      currentPage: 0,
      columns: getColumns(),
      io: null,
      fallbackScrollHandler: null,
      autoTimer: null,
      pageCount: 0,
    };
     // Tạm dừng auto-play khi người dùng hover/focus
    const pauseEvents = ["mouseenter", "focusin", "touchstart"];
    const resumeEvents = ["mouseleave", "focusout", "touchend", "touchcancel"];

    pauseEvents.forEach((evt) => viewport.addEventListener(evt, () => stopAutoPlay(ctrl)));
    resumeEvents.forEach((evt) => viewport.addEventListener(evt, () => startAutoPlay(ctrl)));

    return ctrl;
  }
  // ===== Helpers =====
  function stripBom(text) {
    return text.replace(/^\uFEFF/, "");
  }

  function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
  }

  function titleFromFilename(filename) {
    const base = filename.replace(/\.[^.]+$/, "");
    return decodeURIComponent(base)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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

    // Format cũ: ["a.webp","b.jpg"] -> coi như manhwa
    if (Array.isArray(raw)) {
      return {
        manhwa: raw
          .filter(isNonEmptyString)
          .map((f) => ({ file: f, title: titleFromFilename(f), href: DEFAULT_HREF })),
        manhua: [],
      };
    }

    return { manhwa: [], manhua: [] };
  }

  function normalizeItem(it) {
    // it có thể là string hoặc object
    if (isNonEmptyString(it)) {
      return { file: it, title: titleFromFilename(it), href: DEFAULT_HREF };
    }
    if (it && typeof it === "object") {
      const file = isNonEmptyString(it.file) ? it.file : null;
      if (!file) return null;

      const title = isNonEmptyString(it.title) ? it.title : titleFromFilename(file);
      const href = isNonEmptyString(it.href) ? it.href : DEFAULT_HREF;

      return { file, title, href };
    }
    return null;
  }

  async function loadCoversJson() {
    const res = await fetch(COVERS_JSON_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    // đọc text để strip BOM, rồi parse
    const text = stripBom(await res.text());
    return JSON.parse(text);
  }

  function setHint(ctrl, text) {
    if (!ctrl) return;
    ctrl.hint.textContent = text || "";
  }

  function setActiveDot(ctrl, index) {
    if (!ctrl) return;
      ctrl.dotsWrap.querySelectorAll(".dot").forEach((d, i) => {
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

  function attachObservers(ctrl) {
    if (!ctrl) return;
    const { viewport, track } = ctrl;

    if (ctrl.io) ctrl.io.disconnect();
    if (ctrl.fallbackScrollHandler) {
      viewport.removeEventListener("scroll", ctrl.fallbackScrollHandler);
      ctrl.fallbackScrollHandler = null;
    }

    const pages = track.querySelectorAll(".carousel-page");
    if (!pages.length) return;

    // IntersectionObserver để bắt card nào đang ở giữa viewport
    if ("IntersectionObserver" in window) {
      ctrl.io = new IntersectionObserver(
        (entries) => {
          let best = null;
          for (const e of entries) {
            if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
          }
          if (best && best.isIntersecting) {
            const idx = Number(best.target.dataset.page);
            if (!Number.isNaN(idx)) setActiveDot(ctrl, idx);
          }
        },
        {
          root: viewport,
          threshold: [0.5, 0.65, 0.8],
        }
      );

        pages.forEach((page) => ctrl.io.observe(page));
      return;
    }

    // Fallback nếu browser quá cũ: dựa trên scroll position
      ctrl.fallbackScrollHandler = () => {
      const rect = viewport.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;

      let bestIdx = 0;
      let bestDist = Infinity;

      pages.forEach((page) => {
        const r = page.getBoundingClientRect();
        const cardCenter = r.left + r.width / 2;
        const dist = Math.abs(cardCenter - centerX);
        const idx = Number(page.dataset.page);
        if (dist < bestDist && !Number.isNaN(idx)) {
          bestDist = dist;
          bestIdx = idx;
        }
      });

      setActiveDot(ctrl, bestIdx);
    };
     viewport.addEventListener("scroll", ctrl.fallbackScrollHandler, { passive: true });
  }

  function renderDots(ctrl, count) {
    if (!ctrl) return;
    ctrl.dotsWrap.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (i === 0 ? " is-active" : "");
      b.setAttribute("aria-label", `Go to page ${i + 1}`);
      b.dataset.index = String(i);
      b.addEventListener("click", () => {
        stopAutoPlay(ctrl);
        goToPage(ctrl, i);
        startAutoPlay(ctrl);
      });
      ctrl.dotsWrap.appendChild(b);
    }
  }

    function renderCarousel(ctrl, items) {
      if (!ctrl) return;
      // items: [{file,title,href}]
      const columns = getColumns();
      ctrl.columns = columns;
      const pages = [];
      for (let i = 0; i < items.length; i += columns) {
      pages.push(items.slice(i, i + columns));
    }

    ctrl.currentPage = 0;
     ctrl.pageCount = pages.length || 1;

    ctrl.track.innerHTML = pages
      .map((pageItems, pageIndex) => {
        const cards = pageItems
          .map((it, idx) => {
            const imgSrc = `${COVER_BASE_PATH}${it.file}`;
            const safeTitle = it.title || `Item ${idx + 1}`;
            const href = it.href || DEFAULT_HREF;

            return `
              <a class="cover-card" role="listitem"
                 href="${href}" target="_blank" rel="noopener"
                 data-index="${idx}" aria-label="${safeTitle}">
                <img src="${imgSrc}" alt="${safeTitle}" loading="lazy" />
                <span class="cover-title">${safeTitle}</span>
              </a>
            `;
          })
          .join("");

        return `<div class="carousel-page" data-page="${pageIndex}" style="--cols:${columns};">${cards}</div>`;
      })
      .join("");

    // reset scroll về đầu
    ctrl.viewport.scrollLeft = 0;
    ctrl.track.style.transform = "translateX(0)";


   renderDots(ctrl, ctrl.pageCount);
    setActiveDot(ctrl, ctrl.currentPage);
    // If only one page, disable pointer events on dots for clarity
     ctrl.dotsWrap.style.pointerEvents = ctrl.pageCount > 1 ? "auto" : "none";
    setHint(
      ctrl,
      items.length
        ? `${items.length} featured ${ctrl.type} series`
        : `No featured ${ctrl.type} items yet.`
    );

    attachObservers(ctrl);
    startAutoPlay(ctrl);
  }

  function goToPage(ctrl, pageIndex) {
    if (!ctrl || !ctrl.track) return;
    const maxPage = Math.max(0, (ctrl.pageCount || 1) - 1);
    ctrl.currentPage = Math.max(0, Math.min(pageIndex, maxPage));
    const offset = -ctrl.currentPage * 100;
    ctrl.track.style.transform = `translateX(${offset}%)`;
    setActiveDot(ctrl, ctrl.currentPage);
  }
     function renderAllCarousels() {
    Object.values(controllers).forEach((ctrl) => {
      if (!ctrl) return;
    const items = featuredData && featuredData[ctrl.type] ? featuredData[ctrl.type] : [];
      renderCarousel(ctrl, items);
    });
  }
function startAutoPlay(ctrl) {
    if (!ctrl || ctrl.pageCount <= 1) return;
    stopAutoPlay(ctrl);
    ctrl.autoTimer = window.setInterval(() => {
      const nextPage = (ctrl.currentPage + 1) % ctrl.pageCount;
      goToPage(ctrl, nextPage);
    }, AUTO_PLAY_DELAY);
  }

  function stopAutoPlay(ctrl) {
    if (!ctrl || !ctrl.autoTimer) return;
    clearInterval(ctrl.autoTimer);
    ctrl.autoTimer = null;
  }

  // ===== Init =====
  async function init() {
    try {
      const raw = await loadCoversJson();
      featuredData = normalizeRawJson(raw);

      renderAllCarousels();

      window.addEventListener("resize", () => {
        const newCols = getColumns();
        if (newCols !== lastColumns) {
          lastColumns = newCols;
          renderAllCarousels();
        }
      });
    } catch (err) {
      console.error("[covers] load failed:", err);
      // giữ đúng style thông báo bạn đang thấy
      Object.values(controllers).forEach((ctrl) => {
        setHint(ctrl, "Could not load /cover/covers.json. Make sure it exists and contains an array of filenames.");
      });    
    }
  }

  init();
})();