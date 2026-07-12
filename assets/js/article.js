// article.js — scroll reveal, TOC scrollspy, code-copy, doodle-arrow draw-in, counters.
// Reveal/draw-in technique adapted from github.com/Pratchaya0/html-ppt (runtime.js
// re-triggers data-anim on slide-active); here re-implemented with IntersectionObserver
// since this is a scrolling article, not a slide deck.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    initTopProgress();
    initReveal();
    initDoodleArrows();
    initCounters();
    initToc();
    initCodeCopy();
    initExpandable();
  });

  // ---------- top scroll-progress bar ----------
  function initTopProgress() {
    var bar = document.querySelector('.topbar > span');
    if (!bar) return;
    function update() {
      var h = document.documentElement;
      var scrollTop = h.scrollTop || document.body.scrollTop;
      var height = h.scrollHeight - h.clientHeight;
      var pct = height > 0 ? (scrollTop / height) * 100 : 0;
      bar.style.width = pct + '%';
    }
    document.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ---------- scroll reveal for [data-reveal] ----------
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.style.opacity = '1'; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var anim = el.getAttribute('data-reveal') || 'fade-up';
        var delay = el.getAttribute('data-reveal-delay');
        if (delay) el.style.animationDelay = delay + 'ms';
        el.classList.add('anim-' + anim);
        el.style.opacity = '';
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---------- hand-drawn arrow draw-in ----------
  // Measures each .doodle-draw path's real length so the stroke-dasharray
  // matches exactly, then flips .is-drawn when it scrolls into view.
  function initDoodleArrows() {
    var paths = document.querySelectorAll('.doodle-draw');
    paths.forEach(function (p) {
      try {
        var len = Math.ceil(p.getTotalLength());
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
      } catch (e) { /* not a path-like element */ }
    });
    if (reduceMotion || !('IntersectionObserver' in window)) {
      paths.forEach(function (p) { p.classList.add('is-drawn'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-drawn');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    paths.forEach(function (p) { io.observe(p); });
  }

  // ---------- counter-up ----------
  function initCounters() {
    var counters = document.querySelectorAll('.counter[data-to]');
    function run(el) {
      var target = parseFloat(el.getAttribute('data-to'));
      var dur = parseInt(el.getAttribute('data-dur') || '1200', 10);
      var start = null;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toString();
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    if (reduceMotion || !('IntersectionObserver' in window)) {
      counters.forEach(function (el) { el.textContent = el.getAttribute('data-to'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { io.observe(el); });
  }

  // ---------- TOC: scrollspy + mobile drawer ----------
  function initToc() {
    var chapters = Array.prototype.slice.call(document.querySelectorAll('.chapter[id]'));
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a, .toc-drawer a'));
    if (!chapters.length || !links.length) return;

    function setActive(id) {
      links.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
      chapters.forEach(function (ch) { io.observe(ch); });
    }

    var btn = document.querySelector('.toc-mobile-btn');
    var drawer = document.querySelector('.toc-drawer');
    if (btn && drawer) {
      btn.addEventListener('click', function () { drawer.classList.add('open'); });
      var closeBtn = drawer.querySelector('.close-row button');
      if (closeBtn) closeBtn.addEventListener('click', function () { drawer.classList.remove('open'); });
      drawer.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { drawer.classList.remove('open'); });
      });
    }
  }

  // ---------- copy button on code blocks ----------
  function initCodeCopy() {
    document.querySelectorAll('.code-block').forEach(function (block) {
      var btn = block.querySelector('.copy-btn');
      var code = block.querySelector('pre code');
      if (!btn || !code) return;
      btn.addEventListener('click', function () {
        var text = code.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { flash(btn); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta);
          flash(btn);
        }
      });
    });
    function flash(btn) {
      var old = btn.textContent;
      btn.textContent = 'copied!';
      setTimeout(function () { btn.textContent = old; }, 1400);
    }
  }

  // ---------- expand button + modal: view diagrams/tables at full desktop layout on mobile ----------
  function initExpandable() {
    // wrap any bare chapter table that isn't already inside .table-scroll
    document.querySelectorAll('.chapter table').forEach(function (table) {
      if (table.closest('.table-scroll')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    var targets = Array.prototype.slice.call(document.querySelectorAll('figure.diagram, .table-scroll'));
    if (!targets.length) return;

    var modal = document.createElement('div');
    modal.className = 'expand-modal';
    modal.innerHTML = '<button class="expand-close" aria-label="ปิด" type="button">✕</button><div class="expand-panel"></div>';
    document.body.appendChild(modal);
    var panel = modal.querySelector('.expand-panel');
    var closeBtn = modal.querySelector('.expand-close');

    function openModal(target) {
      panel.innerHTML = '';
      panel.appendChild(target.cloneNode(true));
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    targets.forEach(function (el) {
      var btn = document.createElement('button');
      btn.className = 'expand-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'ขยายดูแนวนอน');
      btn.textContent = '⤢';
      btn.addEventListener('click', function () { openModal(el); });
      el.appendChild(btn);
    });
  }
})();
