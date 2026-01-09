(() => {
  const SNAPSHOT_PATHS = [
    "./dist/comics.snapshot.json",
    "./assets/data/comics.snapshot.json",
  ];
  const PLACEHOLDER_IMAGE = "./assets/logo.png";
  const AUTO_PLAY_DELAY = 3200;
  const LOAD_BATCH = 12;

  const controllers = {
    manhwa: createController("manhwa"),
    manhua: createController("manhua"),
  };

  const allProjectsGrid = document.getElementById("allProjects");
  const loadMoreBtn = document.getElementById("btnLoadMore");

  const hasCarousels = Object.values(controllers).some(Boolean);
  if (!hasCarousels) return;

  document.querySelectorAll("#year, .year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  let featuredData = {
    manhwa: [],
    manhwaTotal: 0,
    manhua: [],
    manhuaTotal: 0,
  };
  let remainingItems = [];
  let renderedCount = 0;
  let lastColumns = getColumns();

  function createController(type) {
    const viewport = document.getElementById(`carouselViewport-${type}`);
    const track = document.getElementById(`coversTrack-${type}`);
    const dotsWrap = document.getElementById(`carouselDots-${type}`);
    const hint = document.getElementById(`coversHint-${type}`);

    if (!viewport || !track || !dotsWrap || !hint) return null;

    viewport.style.overflowX = "auto";
    viewport.style.scrollBehavior = "smooth";

    return {
      type,
      viewport,
      track,
      dotsWrap,
      hint,
      currentPage: 0,
      pageCount: 0,
      columns: getColumns(),
      scrollHandler: null,
      rafId: null,
      autoTimer: null,
    };
  }

  function stripBom(text) {
    return text.replace(/^\uFEFF/, "");
  }

  function safeText(val) {
    return typeof val === "string" ? val.trim() : "";
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const text = stripBom(await res.text());
    return JSON.parse(text);
  }

  async function loadSnapshot() {
    let lastError = null;
    for (const url of SNAPSHOT_PATHS) {
      try {
        return await fetchJson(url);
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) throw lastError;
    throw new Error("Snapshot not found");
  }

  function normalizeItem(it) {
    if (!it || typeof it !== "object") return null;
    const title = safeText(it.title) || "Untitled";
    const genre = safeText(it.genre).toLowerCase();
    const cover = safeText(it.cover) || PLACEHOLDER_IMAGE;
    const url = safeText(it.url) || "#";
    const id = safeText(it.id) || safeText(it.slug) || url || title;
    const viewsNum = Number(it.views);
    const views = Number.isFinite(viewsNum) ? viewsNum : 0;
    if (genre !== "manhwa" && genre !== "manhua") return null;
    if (!id) return null;

    return { id, title, genre, cover, url, views };
  }

  function sortByViews(a, b) {
    const byViews = (b?.views || 0) - (a?.views || 0);
    if (byViews !== 0) return byViews;
    return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  }

  function prepareData(items) {
    const normalized = Array.isArray(items)
      ? items.map(normalizeItem).filter(Boolean)
      : [];

    const manhwaSorted = normalized
      .filter((it) => it.genre === "manhwa")
      .sort(sortByViews);
    const manhuaSorted = normalized
      .filter((it) => it.genre === "manhua")
      .sort(sortByViews);

    const featuredManhwa = manhwaSorted.slice(0, 10);
    const featuredManhua = manhuaSorted.slice(0, 10);
    const featuredIds = new Set(
      [...featuredManhwa, ...featuredManhua].map((it) => it.id)
    );

    const remaining = normalized.filter((it) => !featuredIds.has(it.id));
    return {
      featuredManhwa,
      featuredManhua,
      manhwaTotal: manhwaSorted.length,
      manhuaTotal: manhuaSorted.length,
      remaining,
    };
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

  function createCard(item) {
    const card = document.createElement("a");
    card.className = "cover-card";
    card.role = "listitem";
    card.href = item.url;

    // Click-only navigation (no redirects)
    card.target = "_blank";
    card.rel = "noopener noreferrer external";

    card.setAttribute("aria-label", item.title);

    const img = document.createElement("img");
    img.src = item.cover || PLACEHOLDER_IMAGE;
    img.alt = item.title;
    img.loading = "lazy";
    img.onerror = () => {
      img.onerror = null;
      img.src = PLACEHOLDER_IMAGE;
    };

    const caption = document.createElement("span");
    caption.className = "cover-title";
    caption.textContent = item.title;

    card.appendChild(img);
    card.appendChild(caption);

    return card;
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
    ctrl.dotsWrap.style.pointerEvents = count > 1 ? "auto" : "none";
  }

  function renderCarousel(ctrl, items, totalCount) {
    if (!ctrl) return;

    stopAutoPlay(ctrl);

    ctrl.viewport.scrollTo({ left: 0 });
    ctrl.track.innerHTML = "";

    if (!items.length) {
      ctrl.pageCount = 0;
      setHint(ctrl, "No featured titles yet.");
      renderDots(ctrl, 0);
      return;
    }

    const columns = getColumns();
    ctrl.columns = columns;
    const pages = [];
    for (let i = 0; i < items.length; i += columns) {
      pages.push(items.slice(i, i + columns));
    }

    pages.forEach((pageItems, pageIndex) => {
      const page = document.createElement("div");
      page.className = "carousel-page";
      page.dataset.page = String(pageIndex);
      page.style.setProperty("--cols", columns);

      pageItems.forEach((item) => {
        page.appendChild(createCard(item));
      });

      ctrl.track.appendChild(page);
    });

    ctrl.pageCount = pages.length;
    ctrl.currentPage = 0;

    renderDots(ctrl, ctrl.pageCount);
    setActiveDot(ctrl, ctrl.currentPage);
    const topLabel = Math.min(items.length, 10);
    const hintText = totalCount
      ? `Top ${topLabel} by views • Total: ${totalCount}`
      : `Top ${topLabel} by views`;

    setHint(ctrl, hintText);

    attachScrollSync(ctrl);
    startAutoPlay(ctrl);
  }

  function attachScrollSync(ctrl) {
    if (!ctrl) return;
    if (ctrl.scrollHandler) {
      ctrl.viewport.removeEventListener("scroll", ctrl.scrollHandler);
    }

    ctrl.scrollHandler = () => {
      if (ctrl.rafId) return;
      ctrl.rafId = window.requestAnimationFrame(() => {
        ctrl.rafId = null;
        updateActiveFromScroll(ctrl);
      });
    };

    ctrl.viewport.addEventListener("scroll", ctrl.scrollHandler, {
      passive: true,
    });
  }

  function updateActiveFromScroll(ctrl) {
    const pages = Array.from(ctrl.track.querySelectorAll(".carousel-page"));
    if (!pages.length) return;

    const viewportCenter =
      ctrl.viewport.scrollLeft + ctrl.viewport.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Infinity;

    pages.forEach((page, idx) => {
      const pageCenter = page.offsetLeft + page.offsetWidth / 2;
      const dist = Math.abs(pageCenter - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    ctrl.currentPage = bestIdx;
    setActiveDot(ctrl, bestIdx);
  }

  function goToPage(ctrl, pageIndex) {
    if (!ctrl) return;
    const pages = Array.from(ctrl.track.querySelectorAll(".carousel-page"));
    if (!pages.length) return;

    const maxPage = Math.max(0, pages.length - 1);
    const targetIndex = Math.max(0, Math.min(pageIndex, maxPage));
    const target = pages[targetIndex];

    ctrl.currentPage = targetIndex;
    ctrl.viewport.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
    setActiveDot(ctrl, targetIndex);
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

  function updateLoadMoreState() {
    if (!loadMoreBtn) return;
    const done = renderedCount >= remainingItems.length;
    loadMoreBtn.textContent = done ? "All items shown" : "Load more";
    loadMoreBtn.disabled = done || remainingItems.length === 0;
    loadMoreBtn.setAttribute(
      "aria-disabled",
      loadMoreBtn.disabled ? "true" : "false"
    );
  }

  function renderMoreProjects() {
    if (!allProjectsGrid) return;
    const next = remainingItems.slice(
      renderedCount,
      renderedCount + LOAD_BATCH
    );
    next.forEach((item) => {
      allProjectsGrid.appendChild(createCard(item));
    });
    renderedCount += next.length;
    updateLoadMoreState();
  }

  function resetAllProjects(items) {
    remainingItems = Array.isArray(items) ? items : [];
    renderedCount = 0;

    if (allProjectsGrid) {
      allProjectsGrid.innerHTML = "";
    }

    if (remainingItems.length) {
      renderMoreProjects();
    } else {
      updateLoadMoreState();
    }
  }

  async function init() {
    try {
      const raw = await loadSnapshot();
      const prepared = prepareData(raw?.items);
      featuredData = {
        manhwa: prepared.featuredManhwa,
        manhwaTotal: prepared.manhwaTotal,
        manhua: prepared.featuredManhua,
        manhuaTotal: prepared.manhuaTotal,
      };
      resetAllProjects(prepared.remaining);

      renderAllCarousels();

      window.addEventListener("resize", () => {
        const newCols = getColumns();
        if (newCols !== lastColumns) {
          lastColumns = newCols;
          renderAllCarousels();
        }
      });
    } catch (err) {
      console.error("[featured] load failed:", err);
      Object.values(controllers).forEach((ctrl) => {
        setHint(ctrl, "No featured titles yet.");
      });
      if (loadMoreBtn) {
        loadMoreBtn.textContent = "Failed to load data";
        loadMoreBtn.disabled = true;
      }
    }
  }

  function renderAllCarousels() {
    Object.values(controllers).forEach((ctrl) => {
      if (!ctrl) return;
      const items = featuredData[ctrl.type] || [];
      const totalKey = ctrl.type === "manhwa" ? "manhwaTotal" : "manhuaTotal";
      const totalCount = featuredData[totalKey] || items.length;
      renderCarousel(ctrl, items, totalCount);
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      renderMoreProjects();
    });
  }

  init();
})();
