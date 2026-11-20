// app.js: the kitchen-converter screen. Page code only; the maths is in kitchen.js and oven.js,
// the reading in parse.js and the wording in answer.js.
// Saved on every change, in localStorage, under keys starting "kc-":
//   kc-line  the type-anything line          kc-pins  the pinned rows, [{ tpl, value }]
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K, P, A;

  // PROVISIONAL default pins, until idea 4 (which four ship as defaults) reports.
  // Each pin is a whole conversion: a template with "#" where the row's number goes.
  var DEFAULT_PINS = [
    { tpl: '# cups flour > g', value: '2' },
    { tpl: '#°F > °C', value: '350' },
    { tpl: '# tbsp > mL', value: '1' },
    { tpl: '# sticks butter > g', value: '1' }
  ];

  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: lasts this visit */ }
  }

  var state = { line: '', pins: [] };

  // ── drawing one answer into a box ──
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function drawAnswer(box, a, onAlt) {
    box.textContent = '';
    var main = el('button', 'main', a.main);
    main.type = 'button';
    main.setAttribute('aria-label', a.main ? 'Result ' + a.main + '. Tap to copy, long-press to pin.' : '');
    box.appendChild(main);
    box.appendChild(el('p', 'sub', a.sub));
    var ul = el('ul', 'assume');
    a.assumption.forEach(function (t) { ul.appendChild(el('li', '', t)); });
    box.appendChild(ul);
    a.notes.forEach(function (t, i) { box.appendChild(el('p', 'note' + (a.warn && i === 0 && a.unknown.length ? ' warn' : ''), t)); });
    if (a.warn && !a.unknown.length && a.notes.length) box.lastChild.classList.add('warn');
    var alts = el('div', 'alts');
    a.alts.forEach(function (alt) {
      var b = el('button', '', alt.name); b.type = 'button';
      b.addEventListener('click', function () { onAlt(alt.line); });
      alts.appendChild(b);
    });
    box.appendChild(alts);
    return main;
  }

  // ── long-press and tap on a result ──
  function pressable(btn, onTap, onLong) {
    var timer = 0, sx = 0, sy = 0, fired = false;
    function cancel() { clearTimeout(timer); btn.classList.remove('held'); }
    btn.addEventListener('pointerdown', function (e) {
      fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(timer);
      btn.classList.add('held');
      timer = setTimeout(function () { fired = true; btn.classList.remove('held'); if (navigator.vibrate) navigator.vibrate(15); onLong(); }, 500);
    });
    btn.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) cancel(); });
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); if (!fired) { fired = true; cancel(); onLong(); } });
    btn.addEventListener('click', function (e) { if (fired) { e.preventDefault(); fired = false; return; } onTap(); });
  }

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast'); t.textContent = text; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1600);
  }
  function copy(text) {
    if (!text) return;
    var done = function () { toast('Copied ' + text); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy blocked: ' + text); }
      ta.remove();
    }
  }

  // ── the type-anything line ──
  function renderLine() {
    var req = P.parse(state.line), a = A.answer(req);
    var main = drawAnswer($('out'), a, function (line) { $('line').value = state.line = line; save('kc-line', line); renderLine(); });
    pressable(main, function () { copy(a.copy); }, function () { pinFrom(req, a); });
  }
  function pinFrom(req, a) {
    if (!a.main) { toast('Nothing to pin yet'); return; }
    var tpl = P.template(req), value = req.qtyText || '1';
    if (state.pins.some(function (p) { return p.tpl === tpl; })) { toast('Already pinned'); return; }
    state.pins.push({ tpl: tpl, value: value }); // new pins go last; pinned rows never move on their own
    save('kc-pins', state.pins);
    renderPins();
    toast('Pinned');
  }

  // ── pinned rows ──
  function label(tpl) { return tpl.replace('#', '').replace(/\s*>\s*/, ' → ').replace(/\s+/g, ' ').trim(); }

  function renderPins() {
    var box = $('pins'); box.textContent = '';
    state.pins.forEach(function (pin, i) { box.appendChild(pinRow(pin, i)); });
  }
  function pinRow(pin, i) {
    var row = el('div', 'pin'), top = el('div', 'prow'), detail = el('div', 'detail');
    var num = el('input', 'num');
    num.type = 'text'; num.inputMode = 'decimal'; num.value = pin.value; num.placeholder = '1';
    num.autocomplete = 'off'; num.setAttribute('autocorrect', 'off'); num.spellcheck = false; num.enterKeyHint = 'done';
    num.setAttribute('aria-label', 'Amount for ' + label(pin.tpl));
    var lbl = el('span', 'lbl', label(pin.tpl));
    var res = el('div', 'res-pin');
    top.appendChild(num); top.appendChild(lbl); top.appendChild(res);
    row.appendChild(top); row.appendChild(detail);

    function draw() {
      var req = P.parse(P.fill(pin.tpl, pin.value)), a = pin.value.trim() ? A.answer(req) : { main: '', sub: '', assumption: [], notes: [], alts: [], unknown: [], warn: false, copy: '' };
      var tmp = el('div');
      var main = drawAnswer(tmp, a, function (line) { pin.tpl = P.template(P.parse(line)); save('kc-pins', state.pins); renderPins(); });
      res.textContent = ''; res.appendChild(main);
      detail.textContent = ''; while (tmp.childNodes.length) detail.appendChild(tmp.childNodes[0]);
      pressable(main, function () { copy(a.copy); }, function () { offerUnpin(); });
    }
    function offerUnpin() {
      var b = el('button', 'unpin', 'Unpin'); b.type = 'button';
      b.addEventListener('click', function () {
        var at = state.pins.indexOf(pin); if (at >= 0) state.pins.splice(at, 1);
        save('kc-pins', state.pins); renderPins(); toast('Unpinned');
      });
      top.replaceChild(b, lbl);
      setTimeout(function () { if (b.parentNode) top.replaceChild(lbl, b); }, 4000);
    }
    num.addEventListener('input', function () { pin.value = num.value; save('kc-pins', state.pins); draw(); });
    draw();
    return row;
  }

  // ── fraction bar above the keyboard ──
  function fractionBar() {
    var bar = $('fracbar'), field = null, hideTimer = 0, vv = window.visualViewport;
    function place() {
      if (bar.hidden) return;
      if (vv) { bar.style.bottom = 'auto'; bar.style.top = (vv.offsetTop + vv.height - bar.offsetHeight) + 'px'; }
    }
    // A pinned row being typed in moves to the top of what is visible, so the keyboard and this bar
    // never cover its field or result. The extra bottom room (body.typing) lets even the last row get there.
    var liftRow = null;
    function lift() {
      if (!liftRow) return;
      var top = liftRow.getBoundingClientRect().top - (vv ? vv.offsetTop : 0);
      if (Math.abs(top - 8) > 2) window.scrollTo(0, window.scrollY + top - 8);
    }
    document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (t.tagName !== 'INPUT') return;
      field = t; clearTimeout(hideTimer); bar.hidden = false;
      liftRow = t.closest('.pin');
      document.body.classList.toggle('typing', !!liftRow);
      lift(); setTimeout(lift, 350); // again once the keyboard has finished opening
      place();
    });
    document.addEventListener('focusout', function () {
      hideTimer = setTimeout(function () { bar.hidden = true; liftRow = null; document.body.classList.remove('typing'); }, 150);
    });
    if (vv) {
      var lastH = vv.height;
      vv.addEventListener('resize', function () { place(); if (vv.height < lastH) lift(); lastH = vv.height; });
      vv.addEventListener('scroll', place);
    }
    function insert(b) {
      if (!field) return;
      var s = field.selectionStart == null ? field.value.length : field.selectionStart, en = field.selectionEnd == null ? s : field.selectionEnd;
      field.setRangeText(b.dataset.f, s, en, 'end');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      if (document.activeElement !== field) field.focus();
    }
    // Same pattern as Fast_Conversion's extra keys: act on touch and never take focus, so the keyboard stays up.
    var touched = 0;
    bar.addEventListener('touchstart', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      e.preventDefault(); touched = Date.now(); insert(b);
    }, { passive: false });
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (Date.now() - touched > 800) insert(b);
    });
  }

  function start(data) {
    K = Kitchen.create(data); P = KParse.create(K); A = KAnswer.create(K, Oven, P);
    state.line = load('kc-line', '');
    state.pins = load('kc-pins', null);
    if (!Array.isArray(state.pins)) { // first visit: save the defaults, so a later change to them never moves this person's rows
      state.pins = DEFAULT_PINS.map(function (p) { return { tpl: p.tpl, value: p.value }; });
      save('kc-pins', state.pins);
    }
    $('line').value = state.line;
    $('line').addEventListener('input', function (e) { state.line = e.target.value; save('kc-line', state.line); renderLine(); });
    renderLine(); renderPins(); fractionBar();
    // A phone shows the keyboard only after a tap, so focus the line only where there is a real keyboard.
    if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) $('line').focus();
  }

  fetch('conversion-data.json').then(function (r) {
    if (!r.ok) throw new Error('conversion-data.json: HTTP ' + r.status);
    return r.json();
  }).then(start).catch(function (e) {
    $('err').hidden = false;
    $('err').textContent = 'Could not load the conversion data (' + e.message + '). Open this page from its web address, not as a file.';
  });
})();
