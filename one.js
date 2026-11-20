// one.js: the one-field trial screen (D01). Page code only. The guessing is in likely.js, the
// reading in parse.js, the wording in answer.js, the maths in kitchen.js and oven.js.
//
// Everything starts in the one yellow box. Type a number: the most likely conversion shows big at
// once, the pinned tiles fill with the same number, and other meanings are listed under them.
// Tap any tile or row to make it the answer. Letters after the number narrow it ("350 f", "100 b").
//
// Saved on every change, in localStorage:
//   kc1-line  the box        kc1-mode  tiles 'A' (as pinned) or 'B' (most likely way)
//   kc1-pick  the row tapped for the current letters    kc1-picks  how often each row was tapped
//   kc-pins   the pinned tiles, shared with the main screen (index.html)
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K, P, A, L;
  var DEFAULT_PINS = [ // same as app.js, used only if the main screen was never opened
    { tpl: '# cups flour > g', value: '2' }, { tpl: '#°F > °C', value: '350' },
    { tpl: '# tbsp > mL', value: '1' }, { tpl: '# sticks butter > g', value: '1' }
  ];
  var MAX_ROWS = 15;

  function load(key, fallback) { try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: lasts this visit */ } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var state = { line: '', mode: 'A', pick: null, picks: {}, pins: [] };
  var inputs, input; // two boxes: number pad and letter keyboard (iOS will not switch the keyboard of a focused box)

  // what is typed apart from the number: a tapped row stays chosen while only the number changes
  function letters(line) {
    var req = P.parse(line);
    return req.qtySpan ? (req.line.slice(0, req.qtySpan[0]) + '#' + req.line.slice(req.qtySpan[1])).trim() : req.line;
  }

  // ── tap and long-press ──
  // A long-press re-draws the screen; the click that follows the finger lifting must not land on
  // whatever row is now under it, so taps are ignored for a moment after any long-press.
  var lastLong = 0;
  function pressable(btn, onTap, onLong) {
    var timer = 0, sx = 0, sy = 0, fired = false;
    function cancel() { clearTimeout(timer); btn.classList.remove('held'); }
    btn.addEventListener('pointerdown', function (e) {
      fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(timer); btn.classList.add('held');
      timer = setTimeout(function () { fired = true; lastLong = Date.now(); btn.classList.remove('held'); if (navigator.vibrate) navigator.vibrate(15); onLong(); }, 500);
    });
    btn.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) cancel(); });
    btn.addEventListener('pointerup', cancel); btn.addEventListener('pointercancel', cancel); btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); if (!fired) { fired = true; lastLong = Date.now(); cancel(); onLong(); } });
    btn.addEventListener('click', function (e) { if (fired || Date.now() - lastLong < 700) { e.preventDefault(); fired = false; return; } onTap(); });
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

  function pin(tpl, value) {
    if (!tpl) { toast('Nothing to pin yet'); return; }
    if (state.pins.some(function (p) { return p.tpl === tpl; })) { toast('Already a tile'); return; }
    state.pins.push({ tpl: tpl, value: value || '1' }); // new tiles go last; tiles never move on their own
    save('kc-pins', state.pins); render(); toast('Pinned as a tile');
  }

  // ── one screen render ──
  var current = null; // the candidate shown big
  function render() {
    var line = state.line.trim(), opts = { picks: state.picks };
    var r = line ? L.rank(line, opts) : { qtyText: '', list: [], exact: null };
    var qty = r.qtyText;
    if (state.pick && line && state.pick.letters !== letters(line)) { state.pick = null; save('kc1-pick', null); }

    // tiles: the typed number in every pinned tile (or each tile's own number when the box is empty)
    var tiles = state.pins.map(function (p) { return L.tile(p.tpl, qty || p.value, state.mode, opts); });

    // the big answer: the tapped row if it still fits, else the top guess
    var best = null;
    if (state.pick && qty) {
      var c = { key: state.pick.key, tpl: state.pick.tpl, line: P.fill(state.pick.tpl, qty) };
      c.req = P.parse(c.line); c.answer = A.answer(c.req, opts); c.sig = L.sig(c.req);
      c.label = L.tile(state.pick.tpl, qty, 'A').label;
      if (c.answer.main && !c.req.unknown.length) best = c;
    }
    if (!best) best = r.list[0] || null;
    current = best;
    drawBest(best, r, line);

    var tbox = $('tiles'); tbox.textContent = '';
    tiles.forEach(function (t, i) {
      var b = rowButton(t, best && line && t.sig === best.sig);
      if (line && t.plaus === 0) b.classList.add('dim');
      if (t.dir === 'reverse') b.classList.add('rev');
      pressable(b, function () { choose({ key: 'tile', tpl: t.tpl }); }, function () { offerUnpin(b, state.pins[i]); });
      tbox.appendChild(b);
    });

    var shown = {}; tiles.forEach(function (t) { shown[t.sig] = 1; });
    var mbox = $('more'); mbox.textContent = '';
    var rest = r.list.filter(function (c) { return c !== best && !shown[c.sig] && !(best && c.sig === best.sig); }).slice(0, MAX_ROWS);
    rest.forEach(function (c) {
      var b = rowButton(c, false);
      pressable(b, function () { choose(c); }, function () { pin(c.tpl, qty); });
      mbox.appendChild(b);
    });
    $('moreH').hidden = !rest.length;
    document.querySelectorAll('.modebar button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === state.mode); });
  }

  function rowButton(c, picked) {
    var b = el('div', 'row' + (picked ? ' picked' : '')); b.setAttribute('role', 'button'); b.tabIndex = 0;
    b.appendChild(el('span', 'rl', c.label + ' →'));
    b.appendChild(el('span', 'rm', c.answer.main || '—'));
    b.appendChild(el('span', 'rs', c.answer.sub || ''));
    return b;
  }

  function drawBest(best, r, line) {
    var box = $('best'); box.textContent = '';
    if (!line) { box.appendChild(el('p', 'note', 'Type a number. The most likely conversion shows here.')); return; }
    if (!best || !best.answer.main) {
      var a = best ? best.answer : r.exact ? A.answer(r.exact.req) : A.show(line);
      a.notes.forEach(function (t, i) { box.appendChild(el('p', 'note' + (i === 0 && a.warn ? ' warn' : ''), t)); });
      if (!a.notes.length) box.appendChild(el('p', 'note', 'No likely meaning. Add a unit: 350 f, 2 c flour, 100 g butter.'));
      return;
    }
    var a = best.answer;
    box.appendChild(el('p', 'from', best.label + ' ='));
    var main = el('button', 'main', a.main); main.type = 'button';
    main.setAttribute('aria-label', 'Result ' + a.main + '. Tap to copy, long-press to pin.');
    box.appendChild(main);
    box.appendChild(el('p', 'sub', a.sub));
    var ul = el('ul', 'assume'); a.assumption.forEach(function (t) { ul.appendChild(el('li', '', t)); }); box.appendChild(ul);
    a.notes.filter(function (t) { return !/^Add a unit/.test(t); }).forEach(function (t, i) {
      box.appendChild(el('p', 'note' + (i === 0 && a.warn ? ' warn' : ''), t));
    });
    var alts = el('div', 'alts');
    a.alts.forEach(function (alt) {
      var b = el('button', '', alt.name); b.type = 'button';
      b.addEventListener('click', function () { setLine(alt.line); });
      alts.appendChild(b);
    });
    box.appendChild(alts);
    pressable(main, function () { copy(a.copy); }, function () { pin(best.tpl || P.template(best.req), r.qtyText); });
  }

  function choose(c) {
    if (!state.line.trim()) { toast('Type a number first'); input.focus(); return; }
    var qty = P.parse(state.line).qtyText;
    state.pick = { key: c.key, tpl: c.tpl, letters: letters(state.line) };
    save('kc1-pick', state.pick);
    if (c.key && c.key !== 'exact' && c.key !== 'tile') { // learn: this row, for this number and overall
      state.picks[c.key] = (state.picks[c.key] || 0) + 1;
      state.picks[c.key + '@' + qty] = (state.picks[c.key + '@' + qty] || 0) + 1;
      save('kc1-picks', state.picks);
    }
    render();
    window.scrollTo({ top: 0 });
  }

  function offerUnpin(b, p) {
    var u = el('button', 'unpin', 'Unpin'); u.type = 'button';
    u.addEventListener('click', function (e) {
      e.stopPropagation();
      var at = state.pins.indexOf(p); if (at >= 0) state.pins.splice(at, 1);
      save('kc-pins', state.pins); render(); toast('Unpinned');
    });
    b.replaceChild(u, b.firstChild);
    setTimeout(function () { if (u.parentNode) render(); }, 4000);
  }

  function setLine(v) {
    state.line = v; inputs.forEach(function (i) { i.value = v; });
    save('kc1-line', v); render();
  }

  // ── keyboard: number pad first; abc switches to letters and back; extra keys above it ──
  var selectOnFocus = true;
  function switchKeyboard() {
    var from = input, to = from === inputs[0] ? inputs[1] : inputs[0];
    to.value = from.value; to.hidden = false; input = to;
    selectOnFocus = false; to.focus();
    try { to.setSelectionRange(to.value.length, to.value.length); } catch (e) { /* fine */ }
    from.hidden = true;
    document.querySelectorAll('[data-act="kb"]').forEach(function (b) { b.textContent = to === inputs[1] ? '123' : 'abc'; });
  }
  function keys() {
    var bar = $('fracbar'), hideTimer = 0, vv = window.visualViewport;
    function place() { if (!bar.hidden && vv) { bar.style.bottom = 'auto'; bar.style.top = (vv.offsetTop + vv.height - bar.offsetHeight) + 'px'; } }
    inputs.forEach(function (i) {
      i.addEventListener('focus', function () {
        clearTimeout(hideTimer); bar.hidden = false; place();
        if (selectOnFocus && i.value) setTimeout(function () { try { i.setSelectionRange(0, i.value.length); } catch (e) { /* fine */ } }, 0);
        selectOnFocus = true;
      });
      i.addEventListener('blur', function () { hideTimer = setTimeout(function () { bar.hidden = true; }, 150); });
      i.addEventListener('input', function () { state.line = i.value; save('kc1-line', state.line); render(); });
    });
    if (vv) { vv.addEventListener('resize', place); vv.addEventListener('scroll', place); }
    function act(b) {
      if (b.dataset.act === 'kb') { switchKeyboard(); return; }
      if (b.dataset.act === 'clear') { setLine(''); if (document.activeElement !== input) input.focus(); return; }
      var s = input.selectionStart == null ? input.value.length : input.selectionStart, en = input.selectionEnd == null ? s : input.selectionEnd;
      input.setRangeText(b.dataset.f, s, en, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (document.activeElement !== input) input.focus();
    }
    // act on touch and never take focus, so the keyboard stays up (the main screen's pattern)
    var touched = 0;
    bar.addEventListener('touchstart', function (e) { var b = e.target.closest('button'); if (!b) return; e.preventDefault(); touched = Date.now(); act(b); }, { passive: false });
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && Date.now() - touched > 800) act(b); });
  }

  function start(data) {
    K = Kitchen.create(data); P = KParse.create(K); A = KAnswer.create(K, Oven, P); L = KLikely.create(K, P, A);
    inputs = [$('q'), $('qa')]; input = inputs[0];
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!coarse) { inputs[0].setAttribute('inputmode', 'text'); document.querySelector('.key-kb').hidden = true; }
    state.line = load('kc1-line', '');
    state.mode = load('kc1-mode', 'A') === 'B' ? 'B' : 'A';
    state.pick = load('kc1-pick', null);
    state.picks = load('kc1-picks', {}) || {};
    state.pins = load('kc-pins', null);
    if (!Array.isArray(state.pins)) { state.pins = DEFAULT_PINS.map(function (p) { return { tpl: p.tpl, value: p.value }; }); save('kc-pins', state.pins); }
    inputs.forEach(function (i) { i.value = state.line; });
    document.querySelectorAll('.modebar button').forEach(function (b) {
      b.addEventListener('click', function () { state.mode = b.dataset.mode; save('kc1-mode', state.mode); render(); });
    });
    keys(); render();
    if (!coarse) input.focus(); // a phone shows the keyboard only after a tap
  }

  fetch('conversion-data.json').then(function (r) {
    if (!r.ok) throw new Error('conversion-data.json: HTTP ' + r.status);
    return r.json();
  }).then(start).catch(function (e) {
    $('err').hidden = false;
    $('err').textContent = 'Could not load the conversion data (' + e.message + '). Open this page from its web address, not as a file.';
  });
})();
