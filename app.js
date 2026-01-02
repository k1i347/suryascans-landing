/* app.js — Featured projects: Manhwa/Manhua + Dots + Mobile-friendly carousel */

(() => {
  // ===== Config =====
  const COVERS_JSON_URL = "./cover/covers.json"; // dùng relative để không lỗi khi deploy subfolder
  const COVER_BASE_PATH = "./cover/";            // ảnh sẽ là ./cover/<file>
  const DEFAULT_HREF = "https://vanthucac.xyz";  // click cover mở reading site

  // ===== DOM =====
  const viewport = document.getElementById("carouselViewport");
  const track = document.getElementById("coversTrack");
  const dotsWrap = document.getElementById("carouselDots");
  const hint = document.getElementById("coversHint");
  const tabs = document.querySelectorAll(".projects-controls .pill");

  // Footer year (nếu bạn có 1 hoặc nhiều chỗ hiển thị năm)
  document.querySelectorAll("#year, .year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Nếu trang chưa gắn section carousel mới thì thôi
  if (!viewport || !track || !dotsWrap || !hint) return;

  let featuredData = { manhwa: [], manhua: [] };
  let currentType = "manhwa";
  let currentPage = 0;
  let columns = 5;

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
    if (io) io.disconnect();
    const cards = track.querySelectorAll(".cover-card");
    if (!cards.length) return;

    // IntersectionObserver để bắt card nào đang ở giữa viewport
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          let best = null;
          for (const e of entries) {
            if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
          }
          if (best && best.isIntersecting) {
            const idx = Number(best.target.dataset.index);
            if (!Number.isNaN(idx)) setActiveDot(idx);
          }
        },
        {
          root: viewport,
          threshold: [0.5, 0.65, 0.8],
        }
      );

      cards.forEach((c) => io.observe(c));
      return;
    }

    // Fallback nếu browser quá cũ: dựa trên scroll position
    viewport.addEventListener(
      "scroll",
      () => {
        const rect = viewport.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;

        let bestIdx = 0;
        let bestDist = Infinity;

        cards.forEach((card) => {
          const r = card.getBoundingClientRect();
          const cardCenter = r.left + r.width / 2;
          const dist = Math.abs(cardCenter - centerX);
          const idx = Number(card.dataset.index);
          if (dist < bestDist && !Number.isNaN(idx)) {
            bestDist = dist;
            bestIdx = idx;
          }
        });

        setActiveDot(bestIdx);
      },
      { passive: true }
    );
  }

  function renderDots(count) {
    dotsWrap.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (i === 0 ? " is-active" : "");
       b.setAttribute("aria-label", `Go to page ${i + 1}`);
      b.dataset.index = String(i);
      b.addEventListener("click", () => {
          goToPage(i);
      });
      dotsWrap.appendChild(b);
    }
  }

  function renderCarousel(items) {
    // items: [{file,title,href}]
  columns = getColumns();
    const pages = [];
    for (let i = 0; i < items.length; i += columns) {
      pages.push(items.slice(i, i + columns));
    }

    currentPage = 0;

    track.innerHTML = pages
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
    viewport.scrollLeft = 0;
      track.style.transform = "translateX(0)";

  renderDots(pages.length || 1);
    setActiveDot(currentPage);

    setHint(items.length ? `${items.length} featured ${currentType} series` : `No featured ${currentType} items yet.`);
  }
    // If only one page, disable pointer events on dots for clarity
    dotsWrap.style.pointerEvents = pages.length > 1 ? "auto" : "none";
  

  function goToPage(pageIndex) {
    const pages = track.querySelectorAll(".carousel-page");
    if (!pages.length) return;
    const maxPage = pages.length - 1;
    currentPage = Math.max(0, Math.min(pageIndex, maxPage));
    const offset = -currentPage * 100;
    track.style.transform = `translateX(${offset}%)`;
    setActiveDot(currentPage);
  }
  function switchType(type) {
    currentType = type;
    setActiveTab(type);

    const items = (featuredData && featuredData[type]) ? featuredData[type] : [];
    renderCarousel(items);
  }

  // ===== Init =====
  async function init() {
    try {
      const raw = await loadCoversJson();
      featuredData = normalizeRawJson(raw);

      // Nếu manhwa rỗng mà manhua có -> mở manhua luôn
      if ((!featuredData.manhwa || featuredData.manhwa.length === 0) && featuredData.manhua && featuredData.manhua.length > 0) {
        switchType("manhua");
      } else {
        switchType("manhwa");
      }

      // tab events
      tabs.forEach((btn) => {
        btn.addEventListener("click", () => {
          const type = btn.dataset.type;
          if (type === "manhwa" || type === "manhua") {
            switchType(type);
          }
        });
      });
            window.addEventListener("resize", () => {
        const newCols = getColumns();
        if (newCols !== columns) {
          switchType(currentType);
        }
      });
    } catch (err) {
      console.error("[covers] load failed:", err);
      // giữ đúng style thông báo bạn đang thấy
      setHint("Could not load /cover/covers.json. Make sure it exists and contains an array of filenames.");
    }
  }

  init();
})();
