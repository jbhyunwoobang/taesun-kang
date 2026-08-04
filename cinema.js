/* =========================================================
   Kang Tae-sun · 강태선, cinematic layer
   A single fixed WebGL quad renders a flowing sumi-ink field behind the
   full-viewport "plates". It is procedural, so it stays sharp at any
   resolution, unlike the 600px archive photographs, which are treated
   as film rather than upscaled.
   Falls back to a static CSS wash if WebGL is unavailable.
   ========================================================= */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* The hero is a stage too. The cinematic layer used to start below the fold,
     which left the very first screen as flat paper. */
  const plates = Array.from(document.querySelectorAll(".plate, .hero"));
  if (!plates.length) return;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- the ink field ---------------- */
  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uMood;    // 0 paper .. 1 ink
    uniform float uEnergy;  // turbulence
    uniform float uLight;   // radial light flood
    varying vec2  vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 6; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }

    void main(){
      vec2 uv = vUv;
      vec2 p  = vec2(uv.x * (uRes.x / max(uRes.y, 1.0)), uv.y) * 2.15;
      // fast enough to be visibly alive when the page is standing still 
      // the previous 0.042 was a creep you could only see by staring
      float t = uTime * 0.30;

      // domain warp twice, this is what makes it read as ink in water
      vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
      vec2 r = vec2(fbm(p + 3.6 * q + vec2(1.7, 9.2) + t * 0.62),
                    fbm(p + 3.6 * q + vec2(8.3, 2.8) - t * 0.55));
      float f = fbm(p + 3.8 * r + vec2(t * 0.25, -t * 0.18));

      float ink = smoothstep(0.28, 0.98, f + uEnergy * 0.16);

      vec3 paper     = vec3(0.980, 0.969, 0.945);
      vec3 paperInk  = vec3(0.792, 0.737, 0.655);
      vec3 deep      = vec3(0.052, 0.045, 0.037);
      vec3 ember     = vec3(0.608, 0.173, 0.110);

      vec3 lightMix = mix(paper, paperInk, ink);
      vec3 darkMix  = mix(deep, deep + ember * 0.62, ink);
      vec3 col      = mix(lightMix, darkMix, uMood);

      // Light for the liberation plate. Deliberately centred high and wide,
      // OUT of the type's zone: with the peak behind the text the background
      // sweeps through mid-luminance exactly where the words are, and no text
      // colour survives that (measured 2.1:1). Blooming above keeps the copy
      // on held-down ground while the frame still floods.
      float d    = distance(uv * vec2(1.0, 0.72), vec2(0.5, 0.62));
      float glow = exp(-d * d * 3.0) * uLight;
      col += vec3(1.0, 0.875, 0.64) * glow;

      // vignette, then grain, always grain last
      float vig = smoothstep(1.18, 0.22, distance(uv, vec2(0.5)));
      col *= mix(1.0, vig, 0.5);
      float g = hash(uv * uRes + fract(uTime) * vec2(97.3, 31.7));
      col += (g - 0.5) * 0.038;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const canvas = document.createElement("canvas");
  canvas.className = "cinema";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  let gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false });
  } catch (e) { gl = null; }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  let prog = null, uni = null;
  if (gl) {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (vs && fs) {
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
    }
    if (prog) {
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uni = {
        res:    gl.getUniformLocation(prog, "uRes"),
        time:   gl.getUniformLocation(prog, "uTime"),
        mood:   gl.getUniformLocation(prog, "uMood"),
        energy: gl.getUniformLocation(prog, "uEnergy"),
        light:  gl.getUniformLocation(prog, "uLight")
      };
    }
  }

  // no WebGL (or it failed to build): let CSS paint a static wash instead
  if (!prog) { document.body.classList.add("no-cinema-gl"); }

  let vw = 0, vh = 0;
  function resize() {
    // cap the backing store, a 4K canvas of fbm is not worth the watts
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    vw = Math.round(window.innerWidth * dpr);
    vh = Math.round(window.innerHeight * dpr);
    canvas.width = vw; canvas.height = vh;
    if (gl) gl.viewport(0, 0, vw, vh);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  /* ---------------- scroll → plate state ---------------- */
  // current + target so the field eases between plates instead of snapping
  const state = { mood: 0, energy: 0, light: 0, opacity: 0 };
  const target = { mood: 0, energy: 0, light: 0, opacity: 0 };

  function readPlates() {
    const vh2 = window.innerHeight;
    let best = null, bestVis = 0;

    for (let i = 0; i < plates.length; i++) {
      const el = plates[i];
      const r = el.getBoundingClientRect();
      // how much of the viewport this plate currently owns
      const vis = clamp((Math.min(r.bottom, vh2) - Math.max(r.top, 0)) / vh2, 0, 1);
      // progress through the plate's own scroll length
      const p = clamp(-r.top / Math.max(r.height - vh2, 1), 0, 1);
      el.style.setProperty("--pp", p.toFixed(4));
      el.classList.toggle("is-active", vis > 0.5);
      if (vis > bestVis) { bestVis = vis; best = { el: el, p: p }; }
    }

    if (best && bestVis > 0.02) {
      const d = best.el.dataset;
      const p = best.p;
      target.mood    = lerp(parseFloat(d.moodFrom || 0), parseFloat(d.moodTo || 1), p);
      // scrolling hard churns the ink; it settles again when you stop
      target.energy  = lerp(parseFloat(d.energyFrom || 0), parseFloat(d.energyTo || 0), p)
                       + Math.min(velocity * 0.0016, 0.55);
      target.light   = lerp(parseFloat(d.lightFrom || 0), parseFloat(d.lightTo || 0), p);
      // per-stage ceiling: the hero sits under real body text and wants far
      // less of the field than a plate, which is pure image
      target.opacity = Math.min(bestVis * 1.6, parseFloat(d.cineMax || 1));
    } else {
      target.opacity = 0;
    }
  }

  /* scroll velocity, px per frame, decaying, shared with the shader */
  let lastY = window.scrollY, velocity = 0;
  function readVelocity() {
    const y = window.scrollY;
    velocity = Math.abs(y - lastY);
    lastY = y;
  }

  /* ---------------- render ---------------- */
  const t0 = performance.now();
  let queued = false;

  function frame(now) {
    queued = false;
    // ease toward the target so plate-to-plate changes feel like a dissolve
    state.mood    = lerp(state.mood,    target.mood,    0.06);
    state.energy  = lerp(state.energy,  target.energy,  0.06);
    state.light   = lerp(state.light,   target.light,   0.06);
    state.opacity = lerp(state.opacity, target.opacity, 0.10);

    canvas.style.opacity = state.opacity.toFixed(3);

    if (prog && state.opacity > 0.004) {
      gl.uniform2f(uni.res, vw, vh);
      gl.uniform1f(uni.time, (now - t0) / 1000);
      gl.uniform1f(uni.mood, state.mood);
      gl.uniform1f(uni.energy, state.energy);
      gl.uniform1f(uni.light, state.light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // keep animating only while the field is actually on screen
    if (state.opacity > 0.004 || target.opacity > 0.004) request();
  }

  function request() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  function onScroll() { readVelocity(); readPlates(); request(); }

  if (reduce) {
    // no motion: paint one static frame per plate state, never animate
    readPlates();
    state.mood = target.mood; state.energy = target.energy;
    state.light = target.light; state.opacity = target.opacity;
    canvas.style.opacity = state.opacity.toFixed(3);
    if (prog) {
      gl.uniform2f(uni.res, vw, vh);
      gl.uniform1f(uni.time, 12.0);
      gl.uniform1f(uni.mood, state.mood);
      gl.uniform1f(uni.energy, state.energy);
      gl.uniform1f(uni.light, state.light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    window.addEventListener("scroll", () => {
      readPlates();
      canvas.style.opacity = target.opacity.toFixed(3);
    }, { passive: true });
    return;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();
