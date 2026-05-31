/* =========================================================
   Kang Tae-sun · 강태선 — interactions
   ========================================================= */
(function () {
  "use strict";
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const body = document.body;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Preloader ---------- */
  window.addEventListener("load", () => {
    const pre = $("#preloader");
    if (pre) setTimeout(() => pre.classList.add("is-done"), 550);
  });

  /* ---------- Language toggle (EN / KO) ---------- */
  const STORE_LANG = "kts-lang";
  const STORE_THEME = "kts-theme";

  function applyLang(lang) {
    body.setAttribute("data-lang", lang);
    document.documentElement.setAttribute("lang", lang);
    $$(".i18n").forEach((el) => {
      const val = el.getAttribute("data-" + lang);
      if (val == null) return;
      // allow inline markup authored in the data-* attribute
      if (/[<&]/.test(val)) el.innerHTML = val;
      else el.textContent = val;
    });
    // OG locale hint
    const og = $('meta[property="og:locale"]');
    if (og) og.setAttribute("content", lang === "ko" ? "ko_KR" : "en_US");
    try { localStorage.setItem(STORE_LANG, lang); } catch (e) {}
  }

  function initLang() {
    let lang = "en";
    try {
      const stored = localStorage.getItem(STORE_LANG);
      if (stored === "ko" || stored === "en") lang = stored;
      else if ((navigator.language || "").toLowerCase().startsWith("ko")) lang = "ko";
    } catch (e) {}
    applyLang(lang);
  }

  $("#langToggle")?.addEventListener("click", () => {
    applyLang(body.getAttribute("data-lang") === "ko" ? "en" : "ko");
  });
  $("#footerLang")?.addEventListener("click", (e) => {
    e.preventDefault();
    applyLang(body.getAttribute("data-lang") === "ko" ? "en" : "ko");
  });

  /* ---------- Theme toggle ---------- */
  function applyTheme(t) {
    body.setAttribute("data-theme", t);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#15161e" : "#f4ede0");
    try { localStorage.setItem(STORE_THEME, t); } catch (e) {}
  }
  (function initTheme() {
    let t = "light";
    try {
      t = localStorage.getItem(STORE_THEME) ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch (e) {}
    applyTheme(t === "dark" ? "dark" : "light");
  })();
  $("#themeToggle")?.addEventListener("click", () => {
    applyTheme(body.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  initLang();

  /* ---------- Smooth scroll + mobile menu ---------- */
  const nav = $("#nav");
  const navLinks = $("#navLinks");
  const burger = $("#navBurger");

  function closeMenu() {
    navLinks?.classList.remove("is-open");
    burger?.setAttribute("aria-expanded", "false");
  }
  burger?.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });

  $$("[data-scroll]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      const target = href === "#top" ? document.body : $(href);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const top = href === "#top" ? 0 : target.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---------- Nav: shrink + hide-on-scroll + progress ---------- */
  const progress = $("#readingProgress");
  const toTop = $("#toTop");
  let lastY = window.scrollY;

  function onScroll() {
    const y = window.scrollY;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";

    nav?.classList.toggle("is-scrolled", y > 30);
    if (y > 560 && y > lastY) nav?.classList.add("is-hidden");
    else nav?.classList.remove("is-hidden");
    lastY = y;

    toTop?.classList.toggle("is-visible", y > 700);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  toTop?.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
  );

  /* ---------- Scrollspy (active nav link) ---------- */
  const sections = $$("main section[id]");
  const linkMap = {};
  $$("#navLinks a").forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    linkMap[id] = a;
  });
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          $$("#navLinks a").forEach((a) => a.classList.remove("is-current"));
          linkMap[en.target.id]?.classList.add("is-current");
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((s) => spy.observe(s));

  /* ---------- Reveal on scroll ---------- */
  const revealer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          obs.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  $$(".reveal").forEach((el, i) => {
    // light stagger within a row
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    revealer.observe(el);
  });

  /* ---------- Animated counters ---------- */
  const counters = $$("[data-count]");
  const cObs = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const end = parseInt(el.getAttribute("data-count"), 10);
        const start = end - 90; // animate the last stretch of years for a ticking feel
        obs.unobserve(el);
        if (reduce || document.hidden) { el.textContent = end; return; }
        const dur = 1300, t0 = performance.now();
        function tick(now) {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(start + (end - start) * eased);
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = end;
        }
        requestAnimationFrame(tick);
        // safety net: guarantee the correct final value even if rAF is throttled/paused
        setTimeout(() => { el.textContent = end; }, dur + 250);
      });
    },
    { threshold: 0.6 }
  );
  counters.forEach((c) => cObs.observe(c));

  /* ---------- Timeline filter ---------- */
  const chips = $$(".chip");
  const tlItems = $$(".tl");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      const f = chip.getAttribute("data-filter");
      tlItems.forEach((it) => {
        const match = f === "all" || it.getAttribute("data-certainty") === f;
        it.classList.toggle("is-dim", !match);
      });
    });
  });

  /* ---------- Network map ---------- */
  const stage = $("#networkStage");
  const linksSvg = $("#networkLinks");
  const panelTitle = $("#networkPanelTitle");
  const panelBody = $("#networkPanelBody");

  function drawLinks() {
    if (!stage || !linksSvg) return;
    const rect = stage.getBoundingClientRect();
    linksSvg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    const center = $(".node--center", stage);
    if (!center) return;
    const cx = (parseFloat(center.style.left) / 100) * rect.width;
    const cy = (parseFloat(center.style.top) / 100) * rect.height;
    let html = "";
    $$(".node:not(.node--center)", stage).forEach((n) => {
      const x = (parseFloat(n.style.left) / 100) * rect.width;
      const y = (parseFloat(n.style.top) / 100) * rect.height;
      html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" />`;
    });
    linksSvg.innerHTML = html;
  }

  function selectNode(node) {
    $$(".node", stage).forEach((n) => n.classList.remove("is-active"));
    node.classList.add("is-active");
    const lang = body.getAttribute("data-lang");
    const title = node.getAttribute("data-title-" + lang) || node.getAttribute("data-title-en") || "";
    const bodyTxt =
      node.getAttribute("data-body-" + lang) ||
      node.getAttribute("data-body-en") ||
      (lang === "ko" ? "강태선과 직접 연결된 인물·개념입니다." : "A person or idea directly tied to Kang.");
    if (panelTitle) { panelTitle.textContent = title; panelTitle.classList.remove("i18n"); }
    if (panelBody)  { panelBody.textContent = bodyTxt; panelBody.classList.remove("i18n"); }
  }

  if (stage) {
    $$(".node", stage).forEach((n) =>
      n.addEventListener("click", () => selectNode(n))
    );
    drawLinks();
    window.addEventListener("resize", drawLinks);
    // redraw once fonts/layout settle
    setTimeout(drawLinks, 400);
    window.addEventListener("load", drawLinks);
  }

  /* ---------- Footer year ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* keep network panel text in sync when language changes after a node was picked */
  $("#langToggle")?.addEventListener("click", () => {
    const active = $(".node.is-active", stage || document);
    if (active) selectNode(active);
  });
})();
