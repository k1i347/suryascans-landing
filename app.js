// Year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Carousel elements
const track = document.getElementById("coversTrack");
const hint = document.getElementById("coversHint");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let covers = [];
let index = 0;
let timer = null;
let isHovering = false;

// Convert filename -> title
function filenameToTitle(filename) {
  // remove extension
  const base = filename.replace(/\.[^/.]+$/, "");
  // replace _ and - with spaces
  const spaced = base.replace(/[_-]+/g, " ").trim();
  // optional: keep as-is (looks clean if you name files properly)
  return spaced;
}
async function loadFeatured() {
  const res = await fetch("./cover/covers.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load covers.json");
  return await res.json();
}

function renderCarousel(items) {
  // items: [{file,title}]
  track.innerHTML = items.map((it, idx) => `
    <a class="cover-card" role="listitem"
       href="https://vanthucac.xyz" target="_blank" rel="noopener"
       data-index="${idx}" aria-label="${it.title}">
      <img src="./cover/${it.file}" alt="${it.title}" loading="lazy"/>
    </a>
  `).join("");

  // ... (phần dots + observer y như mình gửi trước)
}

let featuredData;

async function init() {
  featuredData = await loadFeatured();
  renderCarousel(featuredData.manhwa || []);
  // setActiveTab("manhwa") ...
}

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type; // "manhwa" | "manhua"
    renderCarousel((featuredData && featuredData[type]) || []);
  });
});

init();


function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startAutoRotate() {
  clearTimer();
  if (covers.length <= 5) return; // only auto-rotate if > 5

  timer = setInterval(() => {
    if (isHovering) return;
    goNext();
  }, 3200);
}

// Measure one step width (cover width + gap)
function getStepWidth() {
  const first = track.querySelector(".cover-item");
  if (!first) return 0;

  const style = getComputedStyle(track);
  const gap = parseFloat(style.columnGap || style.gap || "14") || 14;

  // offsetWidth includes border
  return first.offsetWidth + gap;
}

// Update transform translateX based on index
function renderPosition() {
  const step = getStepWidth();
  const x = -(index * step);
  track.style.transform = `translateX(${x}px)`;
}

function clampIndex() {
  // max index so that we still show 5 items worth space.
  // We don't know exactly how many are visible on responsive, so we compute based on viewport width.
  const viewport = document.getElementById("carouselViewport");
  const step = getStepWidth();
  if (!viewport || !step) return;

  const visibleCount = Math.max(1, Math.floor((viewport.clientWidth + 14) / step));
  const maxIndex = Math.max(0, covers.length - visibleCount);

  if (index > maxIndex) index = 0;
  if (index < 0) index = maxIndex;
}

function goNext() {
  index += 1;
  clampIndex();
  renderPosition();
}
function goPrev() {
  index -= 1;
  clampIndex();
  renderPosition();
}

function buildCovers(list) {
  covers = list;
  track.innerHTML = "";
  index = 0;

  // create items
  for (const file of covers) {
    const title = filenameToTitle(file);

    // link default -> reading site (you can change per-title later if you want)
    const a = document.createElement("a");
    a.className = "cover-item";
    a.href = "https://vanthucac.xyz";
    a.rel = "noopener";
    a.target = "_blank";
    a.setAttribute("role", "listitem");
    a.setAttribute("aria-label", title);

    const img = document.createElement("img");
    img.src = `./cover/${file}`;
    img.alt = title;
    img.loading = "lazy";

    const cap = document.createElement("span");
    cap.className = "cover-title";
    cap.textContent = title;

    a.appendChild(img);
    a.appendChild(cap);
    track.appendChild(a);
  }

  // hover pause
  track.addEventListener("mouseenter", () => { isHovering = true; });
  track.addEventListener("mouseleave", () => { isHovering = false; });

  // arrows
  prevBtn?.addEventListener("click", () => {
    clearTimer();
    goPrev();
    startAutoRotate();
  });
  nextBtn?.addEventListener("click", () => {
    clearTimer();
    goNext();
    startAutoRotate();
  });

  // initial layout
  requestAnimationFrame(() => {
    clampIndex();
    renderPosition();
    startAutoRotate();
  });

  // helpful hint


  // Re-render on resize
  window.addEventListener("resize", () => {
    clampIndex();
    renderPosition();
  });
}

async function loadCovers() {
  try {
    const res = await fetch("./cover/covers.json", { cache: "no-store" });
    if (!res.ok) throw new Error("covers.json not found or unreadable");
    const list = await res.json();

    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("covers.json is empty or not an array");
    }

    buildCovers(list);
  } catch (err) {
    console.error(err);
    if (hint) {
      hint.textContent =
        "Could not load /cover/covers.json. Make sure it exists and contains an array of filenames.";
    }
  }
}

loadCovers();
