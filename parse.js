// parse.js: reads one typed line into a request that kitchen.js and oven.js can answer. No page code.
// Plain JS, no build step. Browser: window.KParse. Node: module.exports.
//
// Basic idea: the line is read left to right in fixed stages (target, temperature, amount, unit,
// ingredient, author word). Each stage takes only the words it knows. Whatever no stage takes is
// returned in `unknown`, so nothing is dropped or guessed without the screen saying so.
//
// KParse.create(K) takes a Kitchen instance (kitchen.js) for the ingredient list, the typed
// ingredient words (K.WORDS) and the cup standards. parse(line) returns:
// {
//   line, kind: 'empty' | 'amount' | 'temp' | 'number' | 'none',
//   qty, qtyText, qtySpan: [start, end] in line | null, range: [lo, hi] | null,
//   unit: 'cup' | 'tbsp' | 'tsp' | 'ml' | 'l' | 'floz_us' | 'g' | 'kg' | 'oz' | 'lb' | 'stick' | an exact
//         data id such as 'cup_metric' or 'tbsp_au' | null,  unitText,
//   ingredient: id | null, candidates: [ids by data-file rank], ingredientText, ingredientSpan,
//   convention: key or label | null, conventionText,
//   temp: { scale: 'F' | 'C' | 'gas', value, fan } | null,
//   target: { unit, unitText, ingredient, candidates, ingredientSpan, convention, scale } | null,
//   unknown: [words], suggest: { word: [close known words] }, notes: [text]
// }
(function (root) {
  'use strict';

  var UF = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
  var UFC = '½⅓⅔¼¾⅛⅜⅝⅞';
  // 1½ | ½ | 1 1/2 | 1-1/2 | 1/2 | 1.5 | .5 | 2
  var Q = '(?:\\d+\\s*[' + UFC + ']|[' + UFC + ']|\\d+[ \\-]+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d*\\.\\d+|\\d+)';
  var RE_QTY = new RegExp('^' + Q);
  var RE_RANGE = new RegExp('^\\s*(?:-|to\\b)\\s*(' + Q + ')', 'i');
  var FAN = '(fan(?:[ -]?forced)?|convection)';
  var RE_GAS = new RegExp('^(?:' + FAN + '\\s+)?gas(?:\\s*mark)?\\s*(' + Q + ')(?:\\s+' + FAN + ')?$');
  var RE_TEMP = new RegExp('^(?:' + FAN + '\\s+)?(' + Q + ')\\s*(°|deg(?:rees?)?)?\\s*(fahrenheit|celsius|f|c)(?:\\s+' + FAN + ')?$');
  var C_CUTOFF = 20; // a bare "c" after a number under 20 reads as cups, 20 and over as °C (judgment)

  function qtyValue(t) {
    var m;
    t = t.trim();
    if ((m = /^(\d+)\s*([½⅓⅔¼¾⅛⅜⅝⅞])$/.exec(t))) return +m[1] + UF[m[2]];
    if ((m = /^([½⅓⅔¼¾⅛⅜⅝⅞])$/.exec(t))) return UF[m[1]];
    if ((m = /^(\d+)[ -]+(\d+)\s*\/\s*(\d+)$/.exec(t))) return +m[3] ? +m[1] + m[2] / m[3] : NaN;
    if ((m = /^(\d+)\s*\/\s*(\d+)$/.exec(t))) return +m[2] ? m[1] / m[2] : NaN;
    return parseFloat(t);
  }

  // Unit words. Single letters T and t are case-sensitive (recipe shorthand); everything else is not.
  var UNIT_WORDS = {
    c: 'cup', cup: 'cup', cups: 'cup',
    tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
    tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
    ml: 'ml', mls: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
    l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
    g: 'g', gram: 'g', grams: 'g', gr: 'g', kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
    oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
    stick: 'stick', sticks: 'stick', floz: 'floz_us'
  };
  var CASE_UNITS = { T: 'tbsp', t: 'tsp' };
  var STD_WORDS = { metric: 'metric', us: 'us', american: 'us', label: 'us_label', au: 'au', aus: 'au', australian: 'au' };
  var SCALE_WORDS = { f: 'F', fahrenheit: 'F', c: 'C', celsius: 'C', gas: 'gas', fan: 'fan' };
  var FILLER = { of: 1, the: 1, a: 1, an: 1 };
  var WEIGHT = { g: 1, kg: 1, oz: 1, lb: 1 };

  function stem(w) { return w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w; }
  // Words of a name or phrase: lower case, punctuation and hyphens are spaces, plurals stemmed.
  function words(s) { return String(s).toLowerCase().replace(/['’]s\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).map(stem); }

  // Split text into tokens with their positions. Punctuation becomes spaces of the same length,
  // so positions stay valid in the original line.
  function tokens(text, offset) {
    var clean = text.replace(/['’]s\b/g, '  ').replace(/(\d)\.(\d)/g, '$1\u0001$2').replace(/[.,;:!?()"'’\/\-]/g, ' ').replace(/\u0001/g, '.');
    var out = [], re = /\S+/g, m;
    while ((m = re.exec(clean))) out.push({ o: m[0], w: m[0].toLowerCase(), s: offset + m.index, e: offset + m.index + m[0].length });
    return out;
  }

  function lev(a, b) { // edit distance, for "did you mean"
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  function create(K) {
    var data = K.data, ING = data.ingredients;
    var RANK = {}, NAMEW = {}, PHRASE = {}, CANON = {}, VOCAB = {};
    ING.forEach(function (ing, i) {
      RANK[ing.id] = ing.rank != null ? ing.rank : 1000 + i; // unranked entries after ranked, in file order
      NAMEW[ing.id] = words(ing.name);
      CANON[ing.id] = String(ing.name).toLowerCase().replace(/['’]s\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      NAMEW[ing.id].forEach(function (w) { VOCAB[w] = 1; });
      String(ing.name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').forEach(function (w) { if (w) VOCAB[w] = 1; });
    });
    Object.keys(K.WORDS).forEach(function (p) { PHRASE[words(p).join(' ')] = K.WORDS[p]; p.split(' ').forEach(function (w) { VOCAB[w] = 1; }); });
    Object.keys(UNIT_WORDS).concat(Object.keys(STD_WORDS), Object.keys(K.AUTHORS), ['gas', 'fan', 'mark', 'celsius', 'fahrenheit'])
      .forEach(function (w) { if (w.length > 1) VOCAB[w] = 1; });
    var VOCAB_LIST = Object.keys(VOCAB);
    var byRank = function (a, b) { return RANK[a] - RANK[b]; };

    function suggest(w) {
      if (w.length < 2 || /^[\d.\/]+$/.test(w)) return [];
      var lim = w.length <= 4 ? 1 : 2;
      return VOCAB_LIST.map(function (v) {
        var d = v.indexOf(w) === 0 && v !== w ? 0.5 : lev(w, v); // a prefix: probably still typing
        return { v: v, d: d };
      }).filter(function (x) { return x.d <= lim && x.v !== w; })
        .sort(function (a, b) { return a.d - b.d || a.v.length - b.v.length; }).slice(0, 3).map(function (x) { return x.v; });
    }

    // Ingredient for a run of words: a typed phrase from K.WORDS first, then names equal to the words,
    // then every name that contains all the words. Returns ids by data-file rank, or null.
    function matchWords(ws) {
      var key = ws.join(' ');
      if (PHRASE[key]) return { ids: [PHRASE[key]], how: 'word' };
      var exact = ING.filter(function (i) { return NAMEW[i.id].join(' ') === key; }).map(function (i) { return i.id; });
      if (exact.length) return { ids: exact.sort(byRank), how: 'name' };
      var sub = ING.filter(function (i) { return ws.every(function (w) { return NAMEW[i.id].indexOf(w) >= 0; }); }).map(function (i) { return i.id; });
      return sub.length ? { ids: sub.sort(byRank), how: 'part' } : null;
    }

    // Find the first ingredient in a token list (longest run of words first). Marks the tokens it used.
    function findIngredient(toks) {
      for (var i = 0; i < toks.length; i++) {
        if (toks[i].used) continue;
        for (var j = toks.length; j > i; j--) {
          var run = toks.slice(i, j);
          if (run.some(function (t) { return t.used; })) continue;
          var ws = run.filter(function (t) { return !FILLER[t.w]; }).map(function (t) { return stem(t.w); });
          if (!ws.length) continue;
          var m = matchWords(ws);
          if (m) {
            run.forEach(function (t) { t.used = true; });
            return { ids: m.ids, how: m.how, text: run.map(function (t) { return t.o; }).join(' '), span: [run[0].s, run[run.length - 1].e] };
          }
        }
      }
      return null;
    }

    // A unit at token i: "metric cup", "au tbsp", "fl oz", "fluid ounces", "T", "cups".
    function unitAt(toks, i) {
      var a = toks[i], b = toks[i + 1];
      if (!a) return null;
      if (b && STD_WORDS[a.w] && /^(c|cups?|tbsps?|tbs|tablespoons?|tsps?|teaspoons?)$/.test(b.w)) {
        var generic = UNIT_WORDS[b.w], std = STD_WORDS[a.w];
        return { unit: data.cup_standard.sets[std][generic], text: a.o + ' ' + b.o, n: 2 };
      }
      if (b && (a.w === 'fl' || a.w === 'fluid') && /^(oz|ounces?)$/.test(b.w)) return { unit: 'floz_us', text: a.o + ' ' + b.o, n: 2 };
      if (CASE_UNITS[a.o]) return { unit: CASE_UNITS[a.o], text: a.o, n: 1 };
      if (UNIT_WORDS[a.w]) return { unit: UNIT_WORDS[a.w], text: a.o, n: 1 };
      return null;
    }

    function addUnknown(req, t) {
      req.unknown.push(t.o);
      var s = K.AUTHORS[t.w] ? [] : suggest(t.w);
      if (s.length) req.suggest[t.o] = s;
    }

    // Leftover words after an ingredient: author words for that ingredient, else not understood.
    function leftovers(req, toks, ingId, into) {
      toks.forEach(function (t) {
        if (t.used || FILLER[t.w]) return;
        var key = ingId ? K.authorConvention(ingId, t.w) : null;
        if (key && !into.convention) { into.convention = key; into.conventionText = t.o; t.used = true; return; }
        if (ingId && K.AUTHORS[t.w]) req.notes.push('"' + t.o + '": no ' + t.o + ' value for ' + K.ingredient(ingId).name);
        addUnknown(req, t);
      });
    }

    function noteCandidates(req, text, ids) {
      if (ids.length < 2) return;
      req.notes.push('"' + text + '" could be ' + ids.length + ': ' + ids.map(function (id) { return K.ingredient(id).name; }).join(', ') +
        '. Showing ' + K.ingredient(ids[0]).name + ' (first in the data file); the others are one tap away.');
    }

    // Right of ">", "to" or "in": a unit, an ingredient (salt swap), an author word, or a scale.
    function parseTarget(req, text, offset, forTemp) {
      var toks = tokens(text, offset), tgt = { unit: null, unitText: '', ingredient: null, candidates: [], ingredientSpan: null, convention: null, conventionText: '', scale: null };
      var bad = [];
      if (forTemp) {
        toks.forEach(function (t) {
          var w = t.w.replace(/^°/, '').replace(/^deg(rees?)?$/, '');
          if (!w) return;
          if (SCALE_WORDS[w] && !tgt.scale) tgt.scale = SCALE_WORDS[w]; else bad.push(t);
        });
        return { tgt: tgt, bad: bad };
      }
      for (var i = 0; i < toks.length; i++) {
        if (tgt.unit) break;
        var u = unitAt(toks, i);
        if (u) { tgt.unit = u.unit; tgt.unitText = u.text; for (var k = 0; k < u.n; k++) toks[i + k].used = true; }
      }
      var f = findIngredient(toks);
      if (f) { tgt.ingredient = f.ids[0]; tgt.candidates = f.ids; tgt.ingredientSpan = f.span; tgt.ingredientText = f.text; }
      toks.forEach(function (t) {
        if (t.used || FILLER[t.w]) return;
        var key = tgt.ingredient ? K.authorConvention(tgt.ingredient, t.w) : null;
        if (key && !tgt.convention) { tgt.convention = key; tgt.conventionText = t.o; t.used = true; return; }
        bad.push(t);
      });
      return { tgt: tgt, bad: bad };
    }

    function empty(line) {
      return { line: line, kind: 'empty', qty: null, qtyText: '', qtySpan: null, range: null, unit: null, unitText: '',
        ingredient: null, candidates: [], ingredientText: '', ingredientSpan: null, convention: null, conventionText: '',
        temp: null, target: null, unknown: [], suggest: {}, notes: [] };
    }

    function parse(raw) {
      var line = String(raw == null ? '' : raw).replace(/[   ]/g, ' ').replace(/[–—−]/g, '-')
        .replace(/\s*(?:->|→|=>|=)\s*/g, ' > ').replace(/\s+/g, ' ').trim();
      var req = empty(line);
      if (!line) return req;

      // 1. Target: everything after ">" (or after "to" / "in" when what follows reads as a target).
      var left = line, rightText = null, rightAt = 0, m;
      var gi = line.indexOf('>');
      if (gi >= 0) { left = line.slice(0, gi); rightText = line.slice(gi + 1); rightAt = gi + 1; }
      else {
        var re = /\s(to|in|into|as)\s+/gi, hits = [];
        while ((m = re.exec(line))) hits.push({ at: m.index, end: m.index + m[0].length });
        for (var h = hits.length - 1; h >= 0; h--) {
          var r = line.slice(hits[h].end);
          if (/^[\d.½⅓⅔¼¾⅛⅜⅝⅞]/.test(r)) continue; // "2 to 3 cups" is a range
          var test = parseTarget(empty(line), r, hits[h].end, false);
          if (!test.bad.length && (test.tgt.unit || test.tgt.ingredient)) { left = line.slice(0, hits[h].at); rightText = r; rightAt = hits[h].end; break; }
          var testT = parseTarget(empty(line), r, hits[h].end, true);
          if (!testT.bad.length && testT.tgt.scale) { left = line.slice(0, hits[h].at); rightText = r; rightAt = hits[h].end; break; }
        }
      }
      var lt = left.replace(/\s+$/, '').toLowerCase();

      // 2. Temperature: 350f, 350 F, 180°C, gas 4, gas 1/2, fan 180c, 200c fan.
      if ((m = RE_GAS.exec(lt))) {
        req.kind = 'temp';
        req.temp = { scale: 'gas', value: qtyValue(m[2]), fan: !!(m[1] || m[3]) };
        setQty(req, m[2], lt.indexOf(m[2], (m[1] || '').length + 3));
        if (req.temp.fan) req.notes.push('Gas marks are for conventional ovens; "fan" is ignored.');
        return finishTemp(req, rightText, rightAt);
      }
      if ((m = RE_TEMP.exec(lt))) {
        var v = qtyValue(m[2]), bareC = m[4] === 'c' && !m[3] && !m[1] && !m[5];
        if (!(bareC && v < C_CUTOFF)) {
          req.kind = 'temp';
          req.temp = { scale: m[4][0] === 'f' ? 'F' : 'C', value: v, fan: !!(m[1] || m[5]) };
          setQty(req, m[2], lt.indexOf(m[2], (m[1] || '').length));
          if (bareC) req.notes.push('"c" read as °C (' + C_CUTOFF + ' or more). For cups type "cup".');
          return finishTemp(req, rightText, rightAt);
        }
        req.notes.push('"c" read as cups (under ' + C_CUTOFF + '). For °C type "°c".');
      }

      // 3. Amount: quantity, optional range, unit, ingredient, author word.
      var rest = left, restAt = 0;
      if ((m = RE_QTY.exec(left))) {
        setQty(req, m[0], 0);
        rest = left.slice(m[0].length); restAt = m[0].length;
        var rm = RE_RANGE.exec(rest);
        if (rm) {
          var hi = qtyValue(rm[1]);
          req.range = [req.qty, hi];
          req.qtySpan[1] = restAt + rm[0].length;
          req.qtyText = line.slice(req.qtySpan[0], req.qtySpan[1]);
          req.notes.push('Range ' + req.qtyText + ': using the first amount, ' + m[0].trim() + '.');
          rest = rest.slice(rm[0].length); restAt += rm[0].length;
        }
      }
      var toks = tokens(rest, restAt);
      if (toks.length) {
        var u = unitAt(toks, 0);
        if (u) { req.unit = u.unit; req.unitText = u.text; for (var k = 0; k < u.n; k++) toks[k].used = true; }
        var f = findIngredient(toks);
        if (f) {
          req.ingredient = f.ids[0]; req.candidates = f.ids; req.ingredientText = f.text; req.ingredientSpan = f.span;
          noteCandidates(req, f.text, f.ids);
        }
        // a second ingredient on the same line is not understood: one per line, ">" for a swap
        var extra = findIngredient(toks);
        if (extra) {
          req.unknown.push(extra.text);
          req.notes.push('One ingredient per line. For a salt swap type ">" before the second salt.');
        }
        leftovers(req, toks, req.ingredient, req);
      }
      if (req.unit === 'stick' && !req.ingredient) {
        req.ingredient = 'butter'; req.candidates = ['butter'];
        req.notes.push('A stick means butter.');
      }
      if (req.qty == null && (req.unit || req.ingredient)) {
        req.qty = 1; req.qtyText = '';
        req.notes.push('No amount typed: using 1.');
      }
      req.kind = req.unit || req.ingredient ? 'amount' : req.qty != null && !req.unknown.length ? 'number' : 'none';

      if (rightText != null && rightText.trim()) {
        var pt = parseTarget(req, rightText, rightAt, false);
        if (pt.tgt.unit || pt.tgt.ingredient) {
          req.target = pt.tgt;
          if (pt.tgt.ingredient) noteCandidates(req, pt.tgt.ingredientText, pt.tgt.candidates);
        }
        pt.bad.forEach(function (t) { addUnknown(req, t); });
      }
      return req;
    }

    function setQty(req, text, at) {
      req.qty = qtyValue(text);
      req.qtyText = text.trim();
      req.qtySpan = [at, at + text.trim().length];
    }

    function finishTemp(req, rightText, rightAt) {
      if (rightText != null && rightText.trim()) {
        var pt = parseTarget(req, rightText, rightAt, true);
        if (pt.tgt.scale) req.target = pt.tgt;
        pt.bad.forEach(function (t) { addUnknown(req, t); });
      }
      return req;
    }

    // For pinning: the line with its amount replaced by "#", and back again.
    function template(req) {
      if (req.qtySpan) return req.line.slice(0, req.qtySpan[0]) + '#' + req.line.slice(req.qtySpan[1]);
      return '# ' + req.line;
    }
    function fill(tpl, value) { return tpl.replace('#', value == null ? '' : String(value)); }

    // For the "one tap away" candidates: the same line with the ingredient words replaced by a
    // phrase that names only that ingredient.
    function withIngredient(req, id, inTarget) {
      var span = inTarget ? req.target && req.target.ingredientSpan : req.ingredientSpan;
      if (!span) return req.line;
      return req.line.slice(0, span[0]) + CANON[id] + req.line.slice(span[1]);
    }

    return { parse: parse, template: template, fill: fill, withIngredient: withIngredient, canonical: function (id) { return CANON[id]; },
             qtyValue: qtyValue, words: words, C_CUTOFF: C_CUTOFF };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KParse = api;
})(this);
