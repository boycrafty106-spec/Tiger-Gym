/* Tiger Fitness – scroll-scrubbed CIRCLE transition.
 * A circle opens from the centre of the screen and grows until it fills it, then the
 * words "Tiger Fitness" rise in. Isolated module: activates only on [data-tiger-transition]
 * and only if it sits exactly between data-prev and data-next. GSAP + ScrollTrigger are
 * self-hosted (./vendor) and downloaded after the page has loaded and the browser is idle.
 *
 * Options (data-attributes on the section):
 *   data-prev / data-next   selectors of the two sections it must sit between
 *   data-from-size          starting circle diameter as a share of the screen's short side (0.15 – 0.9)
 * Scroll length is CSS: --tt-distance (phones 170svh, desktop 220svh).
 */
(() => {
  'use strict';
  const root = document.querySelector('[data-tiger-transition]');
  if (!root) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prev = root.dataset.prev, next = root.dataset.next;
  if ((prev && !root.previousElementSibling?.matches(prev)) ||
      (next && !root.nextElementSibling?.matches(next))) {
    console.warn('[tiger-transition] not placed between', prev, 'and', next, '- left static.');
    return;
  }

  const stage = root.querySelector('.tiger-transition__stage');
  const circle = root.querySelector('.tiger-transition__circle');
  const title = root.querySelector('.tiger-transition__title');
  const lines = [...title.querySelectorAll('.tt-line')];
  const join = root.querySelector('.tiger-transition__join');
  let fromSize = 0.42;
  let chars = [], tl = null, live = false, lastW = 0, timer = 0, split_done = false;

  // Circle sizes in pixels, read fresh on every refresh so any screen size stays exact.
  const startR = () => Math.min(stage.clientWidth, stage.clientHeight) * fromSize / 2;
  const endR = () => Math.hypot(stage.clientWidth, stage.clientHeight) / 2 + 2; // covers the corners

  function split() {
    if (split_done) return;
    split_done = true;
    lines.forEach((line) => {
      const text = line.textContent; line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      [...text].forEach((c) => {
        const s = document.createElement('span');
        if (c === ' ') s.className = 'tt-sp'; else { s.className = 'tt-ch'; s.textContent = c; chars.push(s); }
        line.appendChild(s);
      });
    });
    const sr = document.createElement('span');
    sr.textContent = 'Tiger Fitness';
    sr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    title.prepend(sr);
  }

  // Type fills ~80% of the width (a circle is narrower at the top and bottom), and
  // JOIN sits comfortably inside the small starting circle.
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w) return;
    title.style.setProperty('--tt-fs', '100px');
    const widest = Math.max(...lines.map((l) => l.scrollWidth)) || 1;
    let fs = 100 * Math.min(w * 0.8, 1300) / widest;
    fs = Math.min(fs, h * 0.3);
    title.style.setProperty('--tt-fs', fs.toFixed(1) + 'px');
    if (join) {
      join.style.setProperty('--tt-join-fs', '100px');
      const r = document.createRange(); r.selectNodeContents(join);
      const jw = r.getBoundingClientRect().width || 1;
      const d = startR() * 2;
      const js = Math.min(100 * d * 0.6 / jw, d * 0.3);
      join.style.setProperty('--tt-join-fs', js.toFixed(1) + 'px');
    }
  }

  function load(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  function build() {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true }); // phone address bar must not re-trigger layout
    fromSize = Math.min(0.9, Math.max(0.15, parseFloat(root.dataset.fromSize) || 0.42));

    root.classList.add('is-live');
    split();
    fit();

    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.3, invalidateOnRefresh: true }
    });
    // The circle opens from the centre until it covers the whole screen.
    tl.fromTo(circle,
      { clipPath: () => `circle(${startR()}px at 50% 50%)` },
      { clipPath: () => `circle(${endR()}px at 50% 50%)`, ease: 'power2.inOut', duration: 0.4 }, 0);
    if (join) tl.fromTo(join, { opacity: 1, yPercent: 0 }, { opacity: 0, yPercent: -18, ease: 'power1.in', duration: 0.17 }, 0.03);
    // Words rise in only once the circle has fully opened, so dark letters never sit on the photo.
    tl.fromTo(chars, { yPercent: 112 }, { yPercent: 0, ease: 'power3.out', duration: 0.2, stagger: 0.014 }, 0.38);
    tl.to({}, { duration: Math.max(0.001, 1 - tl.duration()) }); // readable hold, then natural release
    live = true;

    window.addEventListener('resize', onResize, { passive: true });
    if (document.fonts) document.fonts.ready.then(() => { fit(); window.ScrollTrigger.refresh(); });
  }

  function onResize() {
    clearTimeout(timer);
    timer = setTimeout(() => {          // width only: ignore phone address-bar height changes
      if (stage.clientWidth !== lastW) { lastW = stage.clientWidth; fit(); }
    }, 150);
  }

  function destroy() {
    if (!live) return;
    clearTimeout(timer);
    window.removeEventListener('resize', onResize);
    tl && tl.scrollTrigger && tl.scrollTrigger.kill();
    tl && tl.kill();
    window.gsap && window.gsap.set([circle, join, ...chars].filter(Boolean), { clearProps: 'all' });
    root.classList.remove('is-live');
    live = false;
  }
  window.TigerTransition = { destroy };
  window.addEventListener('pagehide', destroy);

  function start() {
    if (reduce.matches) return;           // static, readable band (CSS)
    lastW = stage.clientWidth;
    Promise.resolve(window.gsap && window.ScrollTrigger ? 0 : load('vendor/gsap.min.js').then(() => load('vendor/ScrollTrigger.min.js')))
      .then(build)
      .catch(() => { /* libraries failed: the static band stays, nothing breaks */ });
  }
  // Wait until the page is fully loaded and the browser is idle, so loading speed is unaffected.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  if (document.readyState === 'complete') idle(start, { timeout: 2500 });
  else window.addEventListener('load', () => idle(start, { timeout: 2500 }), { once: true });
})();
