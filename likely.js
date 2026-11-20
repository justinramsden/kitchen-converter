// likely.js: what a typed line most likely means (D01, the one-field trial). No page code.
// Plain JS, no build step. Browser: window.KLikely. Node: module.exports.
//
// Basic idea: every common conversion is a template with "#" for the number ("# g flour > cups").
// For what is typed, each template that fits the typed letters gets a score:
//   how common the conversion is (TEMPLATES) × how plausible the number is in that unit (plaus)
//   × what this person picked before for that number (picks).
// The line read exactly by parse.js is one more candidate, with a bonus. The top score is the big
// answer; the rest are the list under it. Every weight here is judgment, kept in one place to tune.
//
// KLikely.create(K, P, A) -> { rank(line, opts), tile(tpl, qtyText, mode, opts), reverse(tpl), plaus, ... }
// opts: { picks: { key: count, 'key@number': count }, cupStandard }
(function (root) {
  'use strict';

  // How common each conversion is, 0 to 1 [judgment: no usage data yet]. Earlier rows win ties.
  var TEMPLATES = [
    ['F>C', '#°F', 1.0],
    ['C>F', '#°C', 0.95],
    ['cup flour>g', '# cups flour > g', 1.0],
    ['g flour>cup', '# g flour > cups', 0.95],
    ['ml>cup', '# mL > cups', 0.85],
    ['stick butter>g', '# sticks butter > g', 0.85],
    ['tbsp>ml', '# tbsp > mL', 0.8],
    ['cup>ml', '# cups > mL', 0.8],
    ['cup sugar>g', '# cups sugar > g', 0.8],
    ['g sugar>cup', '# g sugar > cups', 0.8],
    ['g butter>stick', '# g butter > sticks', 0.75],
    ['oz>g', '# oz > g', 0.75],
    ['g>oz', '# g > oz', 0.7],
    ['tbsp butter>g', '# tbsp butter > g', 0.6],
    ['cup brown>g', '# cups brown sugar > g', 0.6],
    ['g brown>cup', '# g brown sugar > cups', 0.6],
    ['tsp>ml', '# tsp > mL', 0.6],
    ['lb>g', '# lb > g', 0.6],
    ['g butter>tbsp', '# g butter > tbsp', 0.55],
    ['cup butter>g', '# cups butter > g', 0.5],
    ['kg>lb', '# kg > lb', 0.5],
    ['l>cup', '# L > cups', 0.5],
    ['floz>ml', '# fl oz > mL', 0.5],
    ['ml>tbsp', '# mL > tbsp', 0.45],
    ['tsp salt>g', '# tsp salt > g', 0.45],
    ['cup icing>g', '# cups icing sugar > g', 0.45],
    ['g icing>cup', '# g icing sugar > cups', 0.45],
    ['cup flour>oz', '# cups flour > oz', 0.4],
    ['gas', 'gas #', 0.4],
    ['egg>g', '# eggs', 0.35]
  ];
  var STATIC_ING = { flour_ap: 1, butter: 1, sugar_granulated: 1, sugar_brown: 1, sugar_confectioners: 1, salt_table: 1, egg_large: 1 };
  var EXACT_BONUS = 1.3; // the line read exactly beats a template when its number is plausible

  // Where recipe amounts usually fall, per unit [judgment]: [min, max, best from, best to, rule].
  // Outside min..max scores 0, inside the best range 1, elsewhere 0.5.
  // whole: a typed fraction (½, 1/2) is not read in this unit. integer: whole numbers only.
  var RANGE = {
    cup: [1 / 8, 12, 1 / 4, 4], tbsp: [1 / 2, 16, 1, 4], tsp: [1 / 8, 8, 1 / 4, 3], stick: [1 / 4, 6, 1 / 2, 2],
    ml: [5, 4000, 30, 1000, 'whole'], l: [1 / 4, 5, 1 / 2, 2], floz: [1, 64, 2, 16],
    g: [1, 5000, 20, 1000, 'whole'], kg: [1 / 4, 5, 1 / 2, 2], oz: [1 / 2, 64, 1, 16], lb: [1 / 4, 10, 1 / 2, 4],
    each: [1, 24, 1, 6, 'integer']
  };
  // Oven numbers [judgment]. A typical dial setting scores 1.1, so it beats a weight of the same
  // number; another multiple of 25°F or 10°C in range 0.6 (a weight wins); any other value 0.25 or 0.1.
  var OVEN = {
    F: { min: 200, max: 550, typical: [325, 350, 375, 400, 425, 450], step: 25 },
    C: { min: 90, max: 290, typical: [150, 160, 170, 175, 180, 190, 200, 210, 220, 230], step: 10 }
  };
  var GAS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  var CLASS = { cup: 'cup', cup_us: 'cup', cup_metric: 'cup', cup_us_label: 'cup', cup_japan: 'cup',
    tbsp: 'tbsp', tbsp_us: 'tbsp', tbsp_metric: 'tbsp', tbsp_au: 'tbsp', tsp: 'tsp', tsp_us: 'tsp', tsp_metric: 'tsp',
    ml: 'ml', l: 'l', floz_us: 'floz', g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', stick: 'stick' };
  // Words that name each unit, for matching first letters ("350 f", "2 cu", "250 m").
  var ALIASES = {
    cup: ['c', 'cup', 'cups'], tbsp: ['tbsp', 'tbs', 'tbl', 'tablespoon', 'tablespoons'], tsp: ['tsp', 'teaspoon', 'teaspoons'],
    ml: ['ml', 'mls', 'millilitre', 'milliliter', 'millilitres', 'milliliters'], l: ['l', 'litre', 'liter', 'litres', 'liters'],
    floz: ['fl', 'fluid', 'oz', 'ounce', 'ounces'], g: ['g', 'gr', 'gram', 'grams'], kg: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'],
    oz: ['oz', 'ounce', 'ounces'], lb: ['lb', 'lbs', 'pound', 'pounds'], stick: ['stick', 'sticks'],
    F: ['f', 'fahrenheit', 'deg', 'degree', 'degrees'], C: ['c', 'celsius', 'centigrade', 'deg', 'degree', 'degrees'],
    gas: ['gas', 'mark'], each: []
  };
  var STD_ALIAS = { cup_metric: 'metric', tbsp_metric: 'metric', tsp_metric: 'metric', cup_us: 'us', tbsp_us: 'us', tsp_us: 'us',
    cup_us_label: 'label', tbsp_au: 'au', cup_japan: 'japan' };
  var UNIT_TEXT = { cup: 'cups', tbsp: 'tbsp', tsp: 'tsp', ml: 'mL', l: 'L', floz_us: 'fl oz', g: 'g', kg: 'kg', oz: 'oz', lb: 'lb',
    stick: 'sticks', cup_us: 'us cups', cup_metric: 'metric cups', cup_us_label: 'label cups', tbsp_us: 'us tbsp',
    tbsp_metric: 'metric tbsp', tbsp_au: 'au tbsp', tsp_us: 'us tsp', tsp_metric: 'metric tsp' };
  var WEIGHT = { g: 1, kg: 1, oz: 1, lb: 1 };
  // A single typed letter that starts a unit word (c, f, g, l, m, o, s, t …) means a unit, as in
  // "350 f" or "2 c": it may not match an ingredient instead. Other letters ("100 b") may.
  var INITIALS = {};
  Object.keys(ALIASES).forEach(function (k) { ALIASES[k].forEach(function (w) { INITIALS[w.charAt(0)] = 1; }); });
  Object.keys(STD_ALIAS).forEach(function (k) { INITIALS[STD_ALIAS[k].charAt(0)] = 1; });
  var SHOW = { cup: ['cup', 'cups'], tbsp: ['tbsp', 'tbsp'], tsp: ['tsp', 'tsp'], ml: ['mL', 'mL'], l: ['L', 'L'], floz_us: ['fl oz', 'fl oz'],
    g: ['g', 'g'], kg: ['kg', 'kg'], oz: ['oz', 'oz'], lb: ['lb', 'lb'], stick: ['stick', 'sticks'],
    cup_us: ['US cup', 'US cups'], cup_metric: ['metric cup', 'metric cups'], cup_us_label: ['label cup', 'label cups'],
    cup_japan: ['Japanese cup', 'Japanese cups'], tbsp_us: ['US tbsp', 'US tbsp'], tbsp_metric: ['metric tbsp', 'metric tbsp'],
    tbsp_au: ['AU tbsp', 'AU tbsp'], tsp_us: ['US tsp', 'US tsp'], tsp_metric: ['metric tsp', 'metric tsp'] };
  var FRACTION = /[\/½⅓⅔¼¾⅛⅜⅝⅞]/;

  function plaus(cls, n, typedFraction) {
    if (n == null || !isFinite(n) || n <= 0) return 0;
    var o = OVEN[cls];
    if (o) {
      if (typedFraction || n < o.min || n > o.max) return 0;
      if (o.typical.indexOf(n) >= 0) return 1.1;
      if (n % o.step === 0) return 0.6;
      return n % 5 === 0 ? 0.25 : 0.1;
    }
    if (cls === 'gas') return GAS.indexOf(n) >= 0 ? 1 : 0;
    var r = RANGE[cls];
    if (!r) return 0;
    if (typedFraction && r[4]) return 0;
    if (r[4] === 'integer' && n !== Math.round(n)) return 0;
    if (n < r[0] - 1e-9 || n > r[1] + 1e-9) return 0;
    return n >= r[2] - 1e-9 && n <= r[3] + 1e-9 ? 1 : 0.5;
  }

  function create(K, P, A) {
    var cache = {};

    function classOf(req) {
      if (req.temp) return req.temp.scale;
      if (req.unit) return CLASS[req.unit] || null;
      return req.ingredient ? 'each' : null;
    }
    // The unit the answer comes out in when none is typed (the same choices answer.js makes).
    function defaultTarget(req) {
      var u = req.unit, ing = req.ingredient;
      if (!u) return ing ? 'g' : null;
      if (WEIGHT[u]) return ing ? 'cup' : u === 'g' ? 'oz' : u === 'kg' ? 'lb' : 'g';
      if (ing) return 'g';
      return u === 'ml' || u === 'l' ? 'cup' : 'ml';
    }
    function targetOf(req) {
      if (req.temp) { var t = req.target && req.target.scale; return t || (req.temp.scale === 'F' ? 'C' : req.temp.scale === 'C' ? 'F' : ''); }
      if (req.target) return req.target.ingredient ? 'ing:' + req.target.ingredient : req.target.unit;
      return defaultTarget(req);
    }
    // Two candidates with the same signature give the same answer; the list keeps only the higher.
    function sig(req) {
      if (req.temp) return 'T' + req.temp.scale + (req.temp.fan ? 'fan' : '') + '>' + targetOf(req);
      return (req.unit || 'each') + ':' + (req.ingredient || '') + ':' + (req.convention || '') + '>' + targetOf(req);
    }
    function plausReq(req, qtyText) {
      var cls = classOf(req);
      if (cls === 'stick' && req.ingredient !== 'butter') return 0;
      return plaus(cls, req.qty, FRACTION.test(qtyText || ''));
    }

    function ingWords(id) {
      var ing = K.ingredient(id), out = P.words(ing.name).concat(String(ing.name).toLowerCase().split(/[^a-z]+/));
      Object.keys(K.WORDS).forEach(function (w) { if (K.WORDS[w] === id) out = out.concat(w.split(' ')); });
      return out.filter(Boolean);
    }
    function unitWords(req, which) {
      var u = which === 'to' ? targetOf(req) : null, cls = which === 'to' ? (CLASS[u] || u) : classOf(req);
      var w = (ALIASES[cls] || []).slice();
      var exact = which === 'to' ? u : req.unit;
      if (STD_ALIAS[exact]) w.push(STD_ALIAS[exact]);
      return w;
    }
    // Words a typed letter can match: left of ">" the unit and ingredient, right of ">" the target unit.
    function wordsOf(req) {
      var unit = unitWords(req, 'from');
      return { unit: unit, from: req.ingredient ? unit.concat(ingWords(req.ingredient)) : unit, to: unitWords(req, 'to') };
    }
    function prefixOf(t, words) { return words.some(function (w) { return w.indexOf(t) === 0; }); }
    function matchesFrom(tokens, w) {
      return tokens.every(function (t) { return t.length === 1 && INITIALS[t] ? prefixOf(t, w.unit) : prefixOf(t, w.from); });
    }
    function matchesTo(tokens, w) { return tokens.every(function (t) { return prefixOf(t, w.to); }); }

    // What was typed: the number, and the letters left and right of ">".
    function typedParts(req) {
      var line = req.line, rest = req.qtySpan ? line.slice(0, req.qtySpan[0]) + ' ' + line.slice(req.qtySpan[1]) : line;
      var gi = rest.indexOf('>'), left = gi >= 0 ? rest.slice(0, gi) : rest, right = gi >= 0 ? rest.slice(gi + 1) : '';
      var deg = /°|\bdeg/i.test(left);
      function toks(s) { return s.toLowerCase().replace(/['’]s\b/g, ' ').split(/[^a-z]+/).filter(Boolean); }
      return { left: toks(left), right: toks(right), deg: deg, arrow: gi >= 0 };
    }

    // "½ cups flour" reads "½ cup flour": one or less is singular.
    function singular(text, qtyText) {
      var n = P.qtyValue(String(qtyText || '').split('-')[0]);
      return n <= 1 ? text.replace(/\b(cup|stick|egg)s\b/, '$1') : text;
    }
    function labelOf(tpl, qtyText) { return singular(P.fill(tpl.split('>')[0], qtyText).replace(/\s+/g, ' ').trim(), qtyText); }
    // What the exact reading of a line says it is: "2 c flour" -> "2 cups flour", "350f" -> "350°F".
    function exactLabel(req) {
      var q = req.qtyText || '1', n = req.qty;
      if (req.temp) return req.temp.scale === 'gas' ? 'gas ' + q : (req.temp.fan ? 'fan ' : '') + q + '°' + req.temp.scale;
      var u = SHOW[req.unit], ing = req.ingredientText ? ' ' + req.ingredientText + (req.conventionText ? ' ' + req.conventionText : '') : '';
      if (!u) return req.line.split('>')[0].trim();
      return q + ' ' + u[n > 1 ? 1 : 0] + ing;
    }

    function build(key, tpl, pop, qtyText, label) {
      var line = P.fill(tpl, qtyText), req = P.parse(line);
      return { key: key, tpl: tpl, line: line, req: req, pop: pop, label: label || labelOf(tpl, qtyText) };
    }
    function staticWords(key, tpl) {
      if (!cache[key]) cache[key] = wordsOf(P.parse(P.fill(tpl, '1')));
      return cache[key];
    }

    // Templates for ingredients the static list leaves out, made only when a typed word names one.
    function dynamic(typed, qtyText) {
      if (!typed.left.length) return [];
      var out = [];
      K.data.ingredients.forEach(function (ing) {
        if (STATIC_ING[ing.id]) return;
        var iw = ingWords(ing.id);
        if (!typed.left.some(function (t) { return !(t.length === 1 && INITIALS[t]) && prefixOf(t, iw); })) return;
        var c = K.convention(ing.id).c, m = /(tsp|tbsp|cup|each)/.exec(c.measure || '');
        var unit = m ? m[1] : 'cup';
        if (unit === 'each') return;
        var canon = P.canonical(ing.id), name = ing.name.charAt(0).toLowerCase() + ing.name.slice(1);
        var pop = ing.rank != null ? Math.max(0.12, 0.5 - ing.rank * 0.008) : 0.12;
        var uText = unit === 'cup' ? 'cups' : unit;
        out.push(build(uText + ' ' + ing.id + '>g', '# ' + uText + ' ' + canon + ' > g', pop, qtyText, singular(qtyText + ' ' + uText + ' ' + name, qtyText)));
        out.push(build('g ' + ing.id + '>' + unit, '# g ' + canon + ' > ' + uText, pop * 0.95, qtyText, qtyText + ' g ' + name));
      });
      return out;
    }

    function learned(key, qtyText, picks) {
      if (!picks) return 1;
      var exact = Math.min(picks[key + '@' + qtyText] || 0, 3), any = Math.min(picks[key] || 0, 5);
      return (1 + 0.6 * exact) * (1 + 0.1 * any);
    }

    // rank(line) -> { qtyText, n, exact, list: [{ key, line, label, score, plaus, answer, req }] }
    function rank(line, opts) {
      opts = opts || {};
      var req = P.parse(line), out = { qtyText: req.qtyText, n: req.qty, exact: null, list: [] };
      var complete = (req.kind === 'amount' || req.kind === 'temp') && !req.unknown.length;
      if (complete) out.exact = { key: 'exact', tpl: P.template(req), line: req.line, req: req, pop: EXACT_BONUS,
        label: exactLabel(req) };
      if (!req.qtySpan) { // no number typed: nothing to guess
        if (out.exact) { out.exact.answer = A.answer(req, opts); out.exact.score = 1; out.list = [out.exact]; }
        return out;
      }
      var typed = typedParts(req), qt = req.qtyText, cands = [];
      TEMPLATES.forEach(function (t) {
        var w = staticWords(t[0], t[1]);
        if (!matchesFrom(typed.left, w) || !matchesTo(typed.right, w)) return;
        if (typed.deg && !/^(F|C)>/.test(t[0])) return;
        cands.push(build(t[0], t[1], t[2], qt));
      });
      dynamic(typed, qt).forEach(function (c) {
        var w = wordsOf(c.req);
        if (matchesFrom(typed.left, w) && matchesTo(typed.right, w)) cands.push(c);
      });
      if (out.exact) cands.unshift(out.exact);
      cands.forEach(function (c, i) {
        c.plaus = plausReq(c.req, qt);
        c.score = c.pop * c.plaus * (c.key === 'exact' ? 1 : learned(c.key, qt, opts.picks));
        c.order = i;
        c.sig = sig(c.req);
      });
      var live = cands.filter(function (c) { return c.score > 0 && !c.req.unknown.length; });
      if (!live.length && out.exact) { out.exact.score = 0; live = [out.exact]; } // nothing plausible: still show the exact reading
      live.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
      var seen = {};
      live.forEach(function (c) {
        if (seen[c.sig]) return;
        c.answer = A.answer(c.req, opts);
        if (!c.answer.main || (c.answer.warn && c.key !== 'exact')) return;
        // a template whose answer comes out far past its unit's range ("250 mL = 16.9 tbsp") is left out
        var sm = /^(\d+(?:\.\d+)?) (tbsp|tsp|cups?)\b/.exec(c.answer.sub || ''), r = sm && RANGE[sm[2].replace(/s$/, '')];
        if (c.key !== 'exact' && r && +sm[1] > r[1]) return;
        var shown = c.label + '|' + c.answer.main;
        if (seen[shown]) return;
        seen[c.sig] = 1; seen[shown] = 1;
        out.list.push(c);
      });
      return out;
    }

    // The reverse of a template: "# cups flour > g" -> "# g flour > cups". null where there is none.
    function reverse(tpl) {
      var req = P.parse(P.fill(tpl, '1'));
      if (req.temp) {
        var s = req.temp.scale, t = req.target && req.target.scale;
        if (s === 'gas' || req.temp.fan || (t && t !== 'F' && t !== 'C')) return null;
        var other = s === 'F' ? 'C' : 'F';
        return '#°' + other + ' > °' + s;
      }
      if (req.kind !== 'amount' || !req.unit || (req.target && req.target.ingredient)) return null;
      var to = targetOf(req);
      if (!UNIT_TEXT[to] || !UNIT_TEXT[req.unit]) return null;
      var it = req.ingredientText || (req.ingredient ? P.canonical(req.ingredient) : '');
      var ing = it ? ' ' + it + (req.conventionText ? ' ' + req.conventionText : '') : '';
      return '# ' + UNIT_TEXT[to] + ing + ' > ' + UNIT_TEXT[req.unit];
    }

    // A pinned tile filled with the typed number.
    // Mode A: as pinned, whatever the number. Mode B: the pinned way or its reverse, whichever the
    // number is more plausible in (a tie keeps the pinned way).
    function tile(tpl, qtyText, mode, opts) {
      var line = P.fill(tpl, qtyText), req = P.parse(line);
      var t = { tpl: tpl, dir: 'pinned', line: line, req: req, plaus: plausReq(req, qtyText) };
      if (mode === 'B') {
        var rt = reverse(tpl);
        if (rt) {
          var rl = P.fill(rt, qtyText), rr = P.parse(rl), pr = plausReq(rr, qtyText);
          if (pr > t.plaus) t = { tpl: rt, dir: 'reverse', line: rl, req: rr, plaus: pr };
        }
      }
      t.label = labelOf(t.tpl, qtyText);
      t.answer = A.answer(t.req, opts || {});
      t.sig = sig(t.req);
      return t;
    }

    return { rank: rank, tile: tile, reverse: reverse, plaus: plaus, sig: sig, defaultTarget: defaultTarget,
             TEMPLATES: TEMPLATES, RANGE: RANGE, OVEN: OVEN };
  }

  var api = { create: create, plaus: plaus, TEMPLATES: TEMPLATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KLikely = api;
})(this);
