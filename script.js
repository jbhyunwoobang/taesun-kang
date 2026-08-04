/* =========================================================
   Kang Tae-sun · 강태선, interactions
   ========================================================= */
(function () {
  "use strict";
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const body = document.body;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- Preloader ---------- */
  (function preloader() {
    const pre = $("#preloader");
    if (!pre) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pre.classList.add("is-done");
      // releases the hero entrance, which is held paused until the curtain lifts
      body.classList.add("is-ready");
    };
    window.addEventListener("load", () => setTimeout(finish, reduce ? 0 : 360));
    // never strand the page behind the curtain if `load` is slow or never fires
    setTimeout(finish, 2600);
  })();

  /* ---------- Line splitting ----------
     Wraps each rendered line in an overflow-clipped box so the line can slide
     up from behind its own edge. Only ever applied to plain-text elements 
     anything with inline markup would lose it. Re-runs after a language swap
     (applyLang rewrites innerHTML) and after a resize (lines re-wrap). */
  const LINE_TARGETS = ".section__title,.quote-feature__text,.wordcard__ko,.hero__honor-ko";

  function splitLines(el) {
    const raw = el.dataset.raw || el.textContent;
    if (!raw.trim()) return;
    el.dataset.raw = raw;

    // 1. lay the text out as individual words so we can read their line boxes
    el.textContent = "";
    const words = raw.trim().split(/\s+/);
    words.forEach((w, i) => {
      const s = document.createElement("span");
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });

    // 2. group the words by the line box they landed on
    const lines = [];
    let top = null, cur = null;
    Array.from(el.children).forEach((s) => {
      if (top === null || Math.abs(s.offsetTop - top) > 2) {
        top = s.offsetTop; cur = []; lines.push(cur);
      }
      cur.push(s.textContent);
    });

    // 3. rebuild as one clipped box per line
    el.textContent = "";
    lines.forEach((group, i) => {
      const line = document.createElement("span");
      line.className = "ln";
      const inner = document.createElement("span");
      inner.className = "ln__i";
      inner.style.transitionDelay = i * 90 + "ms";
      inner.textContent = group.join(" ");
      line.appendChild(inner);
      el.appendChild(line);
      // the break used to be a space; keep one in the text so copying the
      // quote doesn't run the words together ("정신을버려야"). Whitespace
      // between block boxes collapses, so nothing is rendered.
      if (i < lines.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }

  function applySplits() {
    if (reduce) return;
    $$(LINE_TARGETS).forEach((el) => {
      splitLines(el);
      // a re-split wipes the revealed state off the new nodes; restore it
      const host = el.closest(".reveal");
      if (host && host.classList.contains("is-in")) el.classList.add("is-in");
    });
  }


  /* ---------- Language toggle (EN / KO) ---------- */
  const STORE_LANG = "kts-lang";

  function applyLang(lang) {
    body.setAttribute("data-lang", lang);
    document.documentElement.setAttribute("lang", lang);
    $$(".i18n").forEach((el) => {
      const val = el.getAttribute("data-" + lang);
      if (val == null) return;
      // allow inline markup authored in the data-* attribute
      if (/[<&]/.test(val)) el.innerHTML = val;
      else el.textContent = val;
      // the cached pre-split text belongs to the outgoing language
      delete el.dataset.raw;
    });
    // OG locale hint
    const og = $('meta[property="og:locale"]');
    if (og) og.setAttribute("content", lang === "ko" ? "ko_KR" : "en_US");
    try { localStorage.setItem(STORE_LANG, lang); } catch (e) {}
    if (typeof applySplits === "function") applySplits();
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

  initLang();

  /* ---------- Split the hero name into per-character cells ----------
     Only runs on elements without .i18n, applyLang() rewrites i18n
     nodes wholesale and would discard the spans. */
  $$("[data-split]").forEach((el) => {
    if (el.classList.contains("i18n")) return;
    const chars = Array.from(el.textContent.trim());
    el.textContent = "";
    // no aria-hidden / aria-label: the spans still hold real text nodes, so the
    // heading keeps its accessible name without needing a labelling workaround
    chars.forEach((c, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c;
      s.style.animationDelay = (0.2 + i * 0.1).toFixed(2) + "s";
      el.appendChild(s);
    });
  });

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

  /* ---------- Reveal on scroll ----------
     Variants live in CSS via [data-anim]; JS only decides *when*. */
  // stagger siblings inside a grid so a row arrives as a phrase, not a block
  [".gallery", ".words-grid", ".idea-grid", ".bio"].forEach((sel) => {
    $$(sel).forEach((group) => {
      $$(":scope > .reveal", group).forEach((el, i) => {
        el.style.transitionDelay = Math.min(i, 5) * 80 + "ms";
      });
    });
  });

  const revealer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          obs.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".reveal").forEach((el) => revealer.observe(el));

  /* Ink chapters: the paper sheet peels away as the section arrives.
     Fires earlier than the content reveals so the ground is dark by the
     time anything needs to be read against it. */
  const chapters = $$(".section--dark,.section--words");
  if (chapters.length && !reduce && "IntersectionObserver" in window) {
    const unveil = (el) => el.classList.remove("is-veiled");
    const veiler = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          unveil(en.target);
          obs.unobserve(en.target);
        });
      },
      { rootMargin: "-8% 0px -20% 0px", threshold: 0 }
    );
    chapters.forEach((s) => {
      // only veil what is still well below the fold, anything already on
      // screen must never be covered up
      if (s.getBoundingClientRect().top > window.innerHeight * 0.9) {
        s.classList.add("is-veiled");
      }
      veiler.observe(s);
      // belt and braces: if the observer never delivers, drop the veil anyway
      setTimeout(() => unveil(s), 12000);
    });
  }

  // the constellation draws itself once the figure is on screen
  const netFig = $(".network");
  if (netFig) {
    new IntersectionObserver(
      (en, obs) => {
        if (en[0].isIntersecting) { netFig.classList.add("is-in"); obs.disconnect(); }
      },
      { threshold: 0.25 }
    ).observe(netFig);
  }

  /* ---------- Scroll-linked motion ----------
     One rAF-throttled pass: hero parallax, chronology spine, gallery drift. */
  const hero = $(".hero");
  const tlList = $("#timelineList");
  const galleryImgs = $$(".gallery__frame img");
  // [element, travel-in-px], negative travel moves against the scroll
  const drifters = [];
  // travel is deliberately large, ±40px reads as nothing on a 1400px screen
  $$(".section__head").forEach((el) => drifters.push([el, -150]));
  $$(".wordcard__ko").forEach((el) => drifters.push([el, -110]));
  $$(".film__stage").forEach((el) => drifters.push([el, -90]));
  $$(".bio__chapter").forEach((el, i) => drifters.push([el, i % 2 ? -110 : -60]));
  $$(".idea").forEach((el, i) => drifters.push([el, -60 - i * 34]));
  $$(".tl__meta").forEach((el) => drifters.push([el, -52]));
  $$(".stat").forEach((el, i) => drifters.push([el, -40 - i * 26]));
  // deliberately not the factcard: it is position:sticky, and drifting it
  // while it is pinned reads as jitter rather than depth

  /* Every measurement is taken before any style is written. Interleaving the
     two makes each read force a fresh layout, which is ~20 synchronous
     reflows per frame on this page. Read pass, then write pass. */
  const pending = [];
  /* Scroll velocity, normalised and decaying. This is what makes a page feel
     alive under the hand: content leans into a fast flick and springs back. */
  let velY = window.scrollY, vel = 0, velSmooth = 0;

  function scrollFX() {
    const vh = window.innerHeight;
    const y = window.scrollY;
    const docH = document.documentElement.scrollHeight;
    pending.length = 0;

    const dy = y - velY;
    velY = y;
    vel = dy;
    // ease toward the raw delta, then normalise against a brisk flick (~90px)
    velSmooth += (vel - velSmooth) * 0.18;
    const vn = clamp(velSmooth / 90, -1, 1);
    pending.push([document.documentElement, "--vel", vn.toFixed(4)]);
    pending.push([document.documentElement, "--velabs", Math.abs(vn).toFixed(4)]);

    /* ---- read pass ---- */
    if (hero) {
      pending.push([hero, "--hp", clamp(y / (hero.offsetHeight || vh), 0, 1).toFixed(4)]);
    }
    if (tlList) {
      const r = tlList.getBoundingClientRect();
      // the spine is drawn to wherever a reading eye would be, 60% down the viewport
      const p = clamp((vh * 0.6 - r.top) / (r.height || 1), 0, 1);
      pending.push([tlList, "--tl-p", p.toFixed(4)]);
    }
    // in-frame photo drift: the plate holds still while the image breathes inside it
    for (let i = 0; i < galleryImgs.length; i++) {
      const img = galleryImgs[i];
      const r = img.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;  // offscreen: skip
      const centre = (r.top + r.height / 2) / vh;          // 0 top … 1 bottom
      pending.push([img, "--drift", ((centre - 0.5) * 34).toFixed(2) + "px"]);
    }
    // everything else moves a little slower than the page, which reads as depth
    for (let i = 0; i < drifters.length; i++) {
      const el = drifters[i][0], travel = drifters[i][1];
      const r = el.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) continue;
      const centre = (r.top + r.height / 2) / vh;
      pending.push([el, "--par", ((centre - 0.5) * travel).toFixed(2) + "px"]);
    }
    // reading progress, drawn as a ring around the back-to-top button
    if (toTop) {
      const h = docH - vh;
      pending.push([toTop, "--ring", (h > 0 ? (y / h) * 100 : 0).toFixed(1)]);
    }

    /* ---- write pass ---- */
    for (let i = 0; i < pending.length; i++) {
      pending[i][0].style.setProperty(pending[i][1], pending[i][2]);
    }
  }

  let ticking = false;
  function tick() {
    ticking = false;
    scrollFX();
    // Scroll events stop firing the moment the finger lifts, so the loop has
    // to keep itself alive or the page would stay frozen mid-lean.
    if (Math.abs(velSmooth) > 0.4) queue();
  }
  function queue() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(tick);
  }
  function onScrollAll() {
    onScroll();
    if (reduce) return;
    queue();
  }
  window.addEventListener("scroll", onScrollAll, { passive: true });
  window.addEventListener("resize", onScrollAll, { passive: true });
  onScroll();
  if (!reduce) scrollFX();

  /* Lines are grouped by measured position, so they must be re-measured once
     the webfonts land and again whenever the text re-wraps. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(applySplits);
  window.addEventListener("load", applySplits);
  let reSplit;
  window.addEventListener("resize", () => {
    clearTimeout(reSplit);
    reSplit = setTimeout(applySplits, 220);
  }, { passive: true });

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
    if (!rect.width) return;
    linksSvg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    const center = $(".node--center", stage);
    if (!center) return;
    const cx = (parseFloat(center.style.left) / 100) * rect.width;
    const cy = (parseFloat(center.style.top) / 100) * rect.height;
    let html = "";
    $$(".node:not(.node--center)", stage).forEach((n, i) => {
      const x = (parseFloat(n.style.left) / 100) * rect.width;
      const y = (parseFloat(n.style.top) / 100) * rect.height;
      // each thread grows outward from Kang at the centre
      html +=
        `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" ` +
        `style="transform-origin:${cx}px ${cy}px;transition-delay:${120 + i * 90}ms" />`;
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

  /* ---------- Lightbox ---------- */
  const lightbox = $("#lightbox");
  const lbImg = $("#lightboxImg");
  const lbCap = $("#lightboxCap");
  function openLightbox(full, alt, cap) {
    if (!lightbox) return;
    lbImg.src = full; lbImg.alt = alt || "";
    lbCap.textContent = cap || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    body.style.overflow = "hidden";
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    body.style.overflow = "";
  }
  $$(".gallery__item").forEach((fig) => {
    $(".gallery__frame", fig)?.addEventListener("click", () => {
      openLightbox(fig.getAttribute("data-full"), $("img", fig)?.alt, $(".gallery__cap", fig)?.textContent);
    });
  });
  $("#lightboxClose")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

  /* ---------- Footer year ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* keep network panel text in sync when language changes after a node was picked */
  $("#langToggle")?.addEventListener("click", () => {
    const active = $(".node.is-active", stage || document);
    if (active) selectNode(active);
  });

  /* ---------- Film / moving-image archive ---------- */
  (function film() {
    const tabs = $$(".film__tab");
    const panels = $$(".film__panel");
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.getAttribute("data-film-tab");
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", String(on));
        });
        panels.forEach((p) =>
          p.classList.toggle("is-active", p.getAttribute("data-film-panel") === key)
        );
      });
    });

    function playStage(stage) {
      const id = stage.getAttribute("data-yt");
      if (!id || stage.classList.contains("is-playing")) return;
      const iframe = document.createElement("iframe");
      iframe.src =
        "https://www.youtube-nocookie.com/embed/" +
        id +
        "?autoplay=1&rel=0&modestbranding=1";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.setAttribute("title", "Kang Tae-sun video");
      stage.appendChild(iframe);
      stage.classList.add("is-playing");
    }

    $$(".film__stage").forEach((stage) => {
      stage.addEventListener("click", () => playStage(stage));
    });

    $$(".film__item").forEach((item) => {
      item.addEventListener("click", () => {
        const panel = item.closest(".film__panel");
        const stage = $(".film__stage", panel);
        if (!stage) return;
        $("iframe", stage)?.remove();
        stage.classList.remove("is-playing");

        stage.setAttribute("data-yt", item.getAttribute("data-yt"));
        const img = $(".film__thumb", stage);
        const thumb = item.getAttribute("data-thumb");
        if (img && thumb) img.src = thumb;

        const tag = $(".film__stage-tag", stage);
        const title = $(".film__stage-title", stage);
        const lang = body.getAttribute("data-lang") || "en";
        if (tag) {
          tag.setAttribute("data-en", item.getAttribute("data-tag-en"));
          tag.setAttribute("data-ko", item.getAttribute("data-tag-ko"));
          tag.textContent = item.getAttribute("data-tag-" + lang) || item.getAttribute("data-tag-en");
        }
        if (title) {
          title.setAttribute("data-en", item.getAttribute("data-title-en"));
          title.setAttribute("data-ko", item.getAttribute("data-title-ko"));
          title.textContent = item.getAttribute("data-title-" + lang) || item.getAttribute("data-title-en");
        }

        $$(".film__item", panel).forEach((i) => i.classList.toggle("is-current", i === item));
      });
    });
  })();
})();
