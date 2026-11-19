// answer.js: turns a parsed request (parse.js) into the text the screen shows. No page code.
// Plain JS, no build step. Browser: window.KAnswer. Node: module.exports.
//
// Basic idea: parse.js says what was asked, kitchen.js and oven.js do the maths, and this file
// only chooses the answer's form and words. The page and the tests both call show(line), so the
// tests check exactly the text a person reads.
//
// KAnswer.create(K, Oven, P) -> { answer(req, opts), show(line, opts) }. opts: { cupStandard }.
// The answer: { kind, main, sub, assumption: [lines], alts: [{ id, name, line }], notes: [lines],
//               unknown: [words], warn, copy }
(function (root) {
  'use strict';

  var SPOONS = ['tbsp', 'tsp', '1/2 tsp', '1/4 tsp', '1/8 tsp'];
  var FR = { 0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.75: '¾', 0.875: '⅞' };
  var MEASURE_NAMES = {
    cup_us: 'US cup', cup_metric: 'metric cup (250 mL)', cup_us_label: 'label cup (240 mL)', cup_japan: 'Japanese cup (200 mL)',
    tbsp_us: 'US tbsp', tbsp_metric: 'metric tbsp (15 mL)', tbsp_au: 'Australian tbsp (20 mL)',
    tsp_us: 'US tsp', tsp_metric: 'metric tsp (5 mL)', floz_us: 'US fl oz', each: 'each'
  };
  // exact unit ids typed with a cup word, and the cup standard whose measures they belong to
  var EXACT_STD = { cup_us: 'us', tbsp_us: 'us', tsp_us: 'us', cup_metric: 'metric', tbsp_metric: 'metric', tsp_metric: 'metric',
                    cup_us_label: 'us_label', tbsp_au: 'au' };
  var UNIT_SHOW = { cup: 'cup', tbsp: 'tbsp', tsp: 'tsp', ml: 'mL', l: 'L', floz_us: 'fl oz', g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', stick: 'stick' };

  function trim(x, dp) { return String(+x.toFixed(dp)); }
  function amountText(a) { // 0.25 -> ¼, 2.25 -> 2¼
    var w = Math.floor(a + 1e-9), f = +(a - w).toFixed(3);
    if (!f) return String(w);
    if (FR[f]) return (w ? w : '') + FR[f];
    return trim(a, 3);
  }
  function grams(g) { return (Math.abs(g) < 10 ? g.toFixed(1) : String(Math.round(g))) + ' g'; }
  function ml(v) { return (v < 100 ? trim(v, 1) : String(Math.round(v))) + ' mL'; }
  function weightIn(g, unit, WT) {
    var x = g / WT[unit];
    if (unit === 'g') return grams(g);
    if (unit === 'kg') return trim(x, x < 1 ? 3 : 2) + ' kg';
    if (unit === 'oz') return trim(x, x < 1 ? 2 : 1) + ' oz';
    return trim(x, 2) + ' lb';
  }

  function create(K, Oven, P) {
    var data = K.data, WT = { g: 1, kg: 1000 };
    data.weight_units_g.forEach(function (u) { WT[u.id] = u.g; });

    function isVolume(u) { return u && !(u in WT); }
    function unitMl(u, std) { return u === 'stick' ? 0.5 * K.unitMl('cup_us') : K.unitMl(u, std); }
    function stdFor(u, std) { return EXACT_STD[u] || std; }
    function stdDependent(u) { return u === 'cup' || u === 'tbsp' || u === 'tsp'; }

    function measureText(m) {
      var mm = /^(\d*\.?\d+)\s+([a-z_]+)$/.exec(m || '');
      if (!mm) return m;
      var a = parseFloat(mm[1]), name = MEASURE_NAMES[mm[2]] || mm[2];
      return a === 1 ? name : amountText(a) + ' ' + name;
    }

    // One line saying which value was used: "All-purpose / plain flour · 130 g per US cup · Middle of …"
    function assumptionLine(ingId, conv) {
      var r = K.convention(ingId, conv), c = r.c, ing = r.ing, how;
      if (c.same_as) how = 'same as ' + K.ingredient(c.same_as).name.toLowerCase() + ' by spoon';
      else if (c.ratio_to) how = '1 tsp ' + K.ingredient(c.ratio_to).name.toLowerCase() + ' = ' + c.ratio + ' tsp';
      else if (/^1 each$/.test(c.measure)) how = trim(c.grams, 1) + ' g each';
      else how = trim(c.grams, 2) + ' g per ' + measureText(c.measure);
      return ing.name + ' · ' + how + ' · ' + c.label + (c.verified === false ? ' (unverified)' : '');
    }
    function cupLine(u, std) {
      if (u === 'stick') return '1 stick = ½ US cup';
      if (stdDependent(u)) return data.cup_standard.sets[std].label;
      if (EXACT_STD[u]) return 'Typed: ' + (MEASURE_NAMES[u] || u) + ', ' + trim(K.unitMl(u), 2) + ' mL';
      return null;
    }
    function measurableText(vol, u, std) {
      var cs = stdFor(u, std), opts = { cupStandard: cs };
      if (/tbsp|tsp/.test(u)) opts.measures = SPOONS;
      return K.measurable(vol, opts).text;
    }
    function unitWord(u, x) {
      var base = UNIT_SHOW[u] || (MEASURE_NAMES[u] || u);
      if ((u === 'cup' || u === 'stick') && Math.abs(x - 1) > 1e-9) return base + 's';
      return base;
    }

    function answer(req, opts) {
      opts = opts || {};
      var std = opts.cupStandard || data.cup_standard.default;
      var out = { kind: req.kind, main: '', sub: '', assumption: [], alts: [], notes: req.notes.slice(), unknown: req.unknown.slice(), warn: false, copy: '' };
      if (req.unknown.length) {
        out.warn = true;
        out.notes.unshift('Not understood: ' + req.unknown.map(function (w) {
          return w + (req.suggest[w] ? ' (' + req.suggest[w].join('? ') + '?)' : '');
        }).join(', '));
      }
      try {
        if (req.kind === 'temp') temp(req, out);
        else if (req.kind === 'amount') amount(req, out, std);
        else if (req.kind === 'number') out.notes.push('Add a unit or an oven word: 2 c flour, 100 g butter, 350f, gas 4.');
      } catch (e) {
        out.main = ''; out.warn = true; out.notes.push(e.message);
      }
      out.copy = out.main;
      return out;
    }

    function temp(req, out) {
      var t = req.temp, o, tg = req.target && req.target.scale;
      if (t.scale === 'gas') {
        o = Oven.oven(t.value, 'gas');
        if (!o) { out.warn = true; out.notes.push('Gas ' + req.qtyText + ' is not a printed gas mark (¼, ½, 1 to 10).'); return; }
        out.main = tg === 'F' ? o.f + '°F' : tg === 'C' ? o.c + '°C' : tg === 'fan' ? o.fanF + '°F fan · ' + o.fanC + '°C fan' : o.f + '°F · ' + o.c + '°C';
        out.sub = 'fan ' + o.fanF + '°F / ' + o.fanC + '°C';
        return;
      }
      if (t.fan) { // the typed number is a fan-oven temperature: show the other scale's fan setting
        var convT = t.scale === 'F' ? t.value + Oven.FAN_DROP_F : t.value + Oven.FAN_DROP_C;
        o = Oven.oven(convT, t.scale);
        out.main = t.scale === 'F' ? o.fanC + '°C fan' : o.fanF + '°F fan';
        out.sub = 'conventional ' + (t.scale === 'F' ? o.f + '°F · ' + o.c + '°C' : o.c + '°C · ' + o.f + '°F') + (o.gas ? ' · gas ' + o.gas : '');
        out.assumption.push('Fan drop ' + Oven.FAN_DROP_F + '°F / ' + Oven.FAN_DROP_C + '°C (each scale its own convention)');
        return;
      }
      o = Oven.oven(t.value, t.scale);
      var other = t.scale === 'F' ? o.c + '°C' : o.f + '°F';
      if (tg === 'gas') out.main = o.gas ? 'gas ' + o.gas : 'no gas mark';
      else if (tg === 'fan') out.main = o.fanF + '°F fan · ' + o.fanC + '°C fan';
      else out.main = other;
      var exact = t.scale === 'F' ? 'exact ' + o.exactC.toFixed(1) + '°C' : 'exact ' + Math.round(o.exactF) + '°F';
      out.sub = [tg && tg !== (t.scale === 'F' ? 'C' : 'F') ? other : null, exact, o.gas && tg !== 'gas' ? 'gas ' + o.gas : null,
                 tg !== 'fan' ? 'fan ' + o.fanF + '°F / ' + o.fanC + '°C' : null].filter(Boolean).join(' · ');
      out.assumption.push('Dial value: the pair recipes print (350°F = 180°C); off the table, nearest 5');
    }

    function amount(req, out, std) {
      var u = req.unit, ing = req.ingredient, q = req.qty, tg = req.target || {}, conv = req.convention || undefined;
      req.candidates.slice(1).forEach(function (id) { out.alts.push({ id: id, name: K.ingredient(id).name, line: P.withIngredient(req, id, false) }); });
      (tg.candidates || []).slice(1).forEach(function (id) { out.alts.push({ id: id, name: K.ingredient(id).name, line: P.withIngredient(req, id, true) }); });
      if (u === 'stick' && ing !== 'butter') { out.warn = true; out.notes.push('Sticks are for butter only.'); return; }

      // Each (eggs): no unit, and the default value is per item
      if (!u && ing) {
        var c0 = K.convention(ing, conv).c;
        if (/^1 each$/.test(c0.measure)) { out.main = grams(q * c0.grams); out.assumption.push(assumptionLine(ing, conv)); return; }
        out.assumption.push(assumptionLine(ing, conv));
        out.notes.push('Add an amount and a unit: 1 cup ' + req.ingredientText + ', 100 g ' + req.ingredientText + '.');
        return;
      }

      var vol = isVolume(u) ? q * unitMl(u, std) : null;
      var g = !isVolume(u) ? q * WT[u] : ing ? vol * K.gramsPerMl(ing, conv) : null;
      if (ing) out.assumption.push(assumptionLine(ing, conv));
      var cl = cupLine(u, std); if (cl) out.assumption.push(cl);

      // Salt swap: the same weight of another salt
      if (tg.ingredient) {
        if (!ing || !/^salt_/.test(ing) || !/^salt_/.test(tg.ingredient)) {
          out.warn = true; out.notes.push('Swaps by weight work between salts only.');
        } else {
          var tconv = tg.convention || undefined, tMl = g / K.gramsPerMl(tg.ingredient, tconv);
          out.assumption.push(assumptionLine(tg.ingredient, tconv));
          if (tg.unit && !isVolume(tg.unit)) out.main = weightIn(g, tg.unit, WT);
          else if (tg.unit) { out.main = measurableText(tMl, tg.unit, std); out.sub = trim(tMl / unitMl(tg.unit, std), 2) + ' ' + unitWord(tg.unit, 2); }
          else { out.main = measurableText(tMl, isVolume(u) ? u : 'tsp', std); out.sub = trim(tMl / unitMl(isVolume(u) ? u : 'tsp', std), 3) + ' ' + unitWord(isVolume(u) ? u : 'tsp', 2); }
          out.main += ' ' + K.ingredient(tg.ingredient).name;
          out.sub = (out.sub ? out.sub + ' · ' : '') + grams(g) + ' · equal weight';
          var cl2 = tg.unit && cupLine(tg.unit, std); if (cl2 && out.assumption.indexOf(cl2) < 0) out.assumption.push(cl2);
          return;
        }
      }

      var to = tg.unit;
      if (to && !isVolume(to)) { // to a weight
        if (g == null) { out.warn = true; out.notes.push('Add an ingredient to get a weight: ' + req.line.replace(/\s*>.*$/, '') + ' flour > ' + to + '.'); return; }
        out.main = weightIn(g, to, WT);
        return;
      }
      if (to) { // to a volume
        var v = vol != null ? vol : ing ? g / K.gramsPerMl(ing, conv) : null;
        if (v == null) { out.warn = true; out.notes.push('Add an ingredient to turn a weight into cups or spoons.'); return; }
        var cl3 = cupLine(to, std); if (cl3 && out.assumption.indexOf(cl3) < 0) out.assumption.push(cl3);
        var x = v / unitMl(to, std);
        if (to === 'ml' || to === 'l' || to === 'floz_us') { out.main = to === 'ml' ? ml(v) : trim(x, 2) + ' ' + UNIT_SHOW[to]; return; }
        out.main = measurableText(v, to, std);
        out.sub = x.toFixed(2) + ' ' + unitWord(to, x);
        return;
      }
      // No target: the usual other side
      if (isVolume(u) && ing) { out.main = grams(g); return; }
      if (!isVolume(u) && ing) {
        var v2 = g / K.gramsPerMl(ing, conv), c2 = cupLine('cup', std);
        if (out.assumption.indexOf(c2) < 0) out.assumption.push(c2);
        out.main = measurableText(v2, 'cup', std);
        out.sub = (v2 / unitMl('cup', std)).toFixed(2) + ' cups';
        return;
      }
      if (u === 'ml' || u === 'l') {
        var c3 = cupLine('cup', std); if (out.assumption.indexOf(c3) < 0) out.assumption.push(c3);
        out.main = measurableText(vol, 'cup', std); out.sub = (vol / unitMl('cup', std)).toFixed(2) + ' cups';
        return;
      }
      if (isVolume(u)) { out.main = ml(vol); return; }
      out.main = u === 'g' ? weightIn(g, 'oz', WT) : u === 'kg' ? weightIn(g, 'lb', WT) : grams(g);
    }

    function show(line, opts) { return answer(P.parse(line), opts); }

    return { answer: answer, show: show, assumptionLine: assumptionLine, measureText: measureText, SPOONS: SPOONS };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KAnswer = api;
})(this);
