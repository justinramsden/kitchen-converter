// kitchen.js: ingredient and kitchen-measure maths for kitchen-converter. No page code.
// Plain JS, no build step. Browser: window.Kitchen. Node: module.exports.
// Every number comes from conversion-data.json, passed in to Kitchen.create(data).
// Every default is the one flagged "default": true in that file, and every function
// takes an argument that overrides it.
//
// Basic idea: an ingredient's weight per cup is stored as its source printed it
// (grams and the measure). Dividing by the measure's millilitres gives grams per mL,
// so one stored value serves every cup size.
(function (root) {
  'use strict';

  // Typed words that name an ingredient, on top of the words in its "name" (B02). Kept here, not in
  // the data file, because they are about typing, not about weights. Each maps to exactly one
  // ingredient id. A word that could mean several ingredients ("kosher salt") is deliberately left
  // out, so the parser returns every candidate instead of picking one.
  var WORDS = {
    'flour': 'flour_ap', 'ap': 'flour_ap', 'ap flour': 'flour_ap', 'all purpose': 'flour_ap', 'plain flour': 'flour_ap',
    'bread flour': 'flour_bread', 'strong flour': 'flour_bread',
    'sugar': 'sugar_granulated', 'white sugar': 'sugar_granulated',
    'brown sugar': 'sugar_brown',
    'icing sugar': 'sugar_confectioners', 'powdered sugar': 'sugar_confectioners', 'confectioners sugar': 'sugar_confectioners',
    'salt': 'salt_table', 'butter': 'butter', 'egg': 'egg_large'
  };
  // Author words that work on any ingredient with a convention label naming that author first
  // ("King Arthur, spooned") or after a slash ("King Arthur / ATK").
  var AUTHORS = { ka: /(^|\/ )King Arthur\b/, atk: /(^|\/ )(America's Test Kitchen|ATK)\b/, sally: /(^|\/ )Sally's\b/ };

  function create(data) {
    var VOL = {}, WT = {}, ING = {};
    data.volume_units_ml.forEach(function (u) { VOL[u.id] = u.ml; });
    data.weight_units_g.forEach(function (u) { WT[u.id] = u.g; });
    data.ingredients.forEach(function (i) { ING[i.id] = i; });
    VOL.mL = VOL.ml = 1; VOL.L = VOL.l = 1000;  // metric volume, by definition
    WT.g = 1; WT.kg = 1000;                      // metric weight, by definition

    var CS = data.cup_standard;
    var SPOON_IDS = { cup: 1, tbsp: 1, tsp: 1 };

    function cupSet(cupStandard) {
      var key = cupStandard || CS.default;
      var set = CS.sets[key];
      if (!set) throw new Error('Unknown cup standard "' + key + '"');
      return set;
    }

    // A unit id in millilitres. "cup", "tbsp" and "tsp" mean the cup standard in use;
    // ids such as cup_us or tbsp_au name one exact measure and ignore the standard.
    function unitMl(unitId, cupStandard) {
      var id = SPOON_IDS[unitId] ? cupSet(cupStandard)[unitId] : unitId;
      if (!(id in VOL)) throw new Error('Not a volume unit: "' + unitId + '"');
      return VOL[id];
    }

    function volumeMl(qty, unitId, cupStandard) {
      return qty * unitMl(unitId, cupStandard);
    }

    function isWeight(unitId) { return unitId in WT; }

    function ingredient(id) {
      var i = ING[id];
      if (!i) throw new Error('Unknown ingredient "' + id + '"');
      return i;
    }

    // Find a convention by its key, its exact label, or an alias in the ingredient's
    // "aliases" (ka, atk, sally). With none given: the one flagged default.
    function convention(ingredientId, keyOrLabel) {
      var ing = ingredient(ingredientId), list = ing.conventions, i;
      if (keyOrLabel == null) {
        for (i = 0; i < list.length; i++) if (list[i].default) return { ing: ing, c: list[i] };
        if (ing.default_follows) return convention(ing.default_follows);
        throw new Error(ingredientId + ' has no default convention');
      }
      var k = ing.aliases && ing.aliases[keyOrLabel] ? ing.aliases[keyOrLabel] : keyOrLabel;
      for (i = 0; i < list.length; i++) if (list[i].key === k || list[i].label === k) return { ing: ing, c: list[i] };
      throw new Error(ingredientId + ' has no convention "' + keyOrLabel + '"');
    }

    // "0.25 tsp_us" -> 0.25 x tsp_us in mL. A measure whose cup size is unstated
    // ("1 cup (size unstated)") or not a volume ("1 each") has no grams per mL.
    function measureMl(measure) {
      var m = /^(\d*\.?\d+)\s+([a-z_]+)$/.exec(measure);
      if (!m || !(m[2] in VOL)) return null;
      return parseFloat(m[1]) * VOL[m[2]];
    }

    // Grams per millilitre for one convention. same_as and ratio_to resolve through
    // their target ingredient's default.
    function gramsPerMl(ingredientId, conventionKeyOrLabel) {
      var r = convention(ingredientId, conventionKeyOrLabel), c = r.c;
      if (c.same_as) return gramsPerMl(c.same_as);
      if (c.ratio_to) return gramsPerMl(c.ratio_to) / c.ratio; // 1 tsp of target = ratio tsp of this
      var ml = measureMl(c.measure);
      if (ml === null) throw new Error(ingredientId + ' "' + (c.key || c.label) + '" has no volume measure (' + c.measure + ')');
      return c.grams / ml;
    }

    // Which convention was used, for the assumption line under a result.
    function assumption(ingredientId, conventionKeyOrLabel) {
      var r = convention(ingredientId, conventionKeyOrLabel);
      return { ingredient: r.ing.id, key: r.c.key || null, label: r.c.label, grams: r.c.grams, measure: r.c.measure,
               source: r.c.source, verified: r.c.verified, gPerMl: gramsPerMl(ingredientId, conventionKeyOrLabel) };
    }

    // opts: { convention, cupStandard }. Weight units need no ingredient.
    function toGrams(qty, unitId, ingredientId, opts) {
      opts = opts || {};
      if (isWeight(unitId)) return qty * WT[unitId];
      return volumeMl(qty, unitId, opts.cupStandard) * gramsPerMl(ingredientId, opts.convention);
    }

    function fromGrams(grams, unitId, ingredientId, opts) {
      opts = opts || {};
      if (isWeight(unitId)) return grams / WT[unitId];
      return grams / gramsPerMl(ingredientId, opts.convention) / unitMl(unitId, opts.cupStandard);
    }

    // Equal by weight: the amount of toId that weighs the same as qty of fromId.
    // opts: { fromConvention, toConvention, cupStandard }. Answer is in the same unit.
    function saltSwap(qty, unitId, fromId, toId, opts) {
      opts = opts || {};
      var g = toGrams(qty, unitId, fromId, { convention: opts.fromConvention, cupStandard: opts.cupStandard });
      return fromGrams(g, unitId, toId, { convention: opts.toConvention, cupStandard: opts.cupStandard });
    }

    // A stick of butter is half a US cup (USDA: 1 stick = 1/2 cup = 113 g). A stick is a
    // product size, so it stays US whatever cup standard is in use.
    // opts: { convention }
    function stickButter(qty, opts) {
      opts = opts || {};
      return toGrams(qty * 0.5, 'cup_us', 'butter', { convention: opts.convention });
    }

    // PROVISIONAL (idea 6 has not reported): the plain rule. Round to the nearest 1/8 tsp,
    // then take the largest real measures first: cup, 1/2, 1/3, 1/4 cup, tbsp, tsp, 1/2, 1/4, 1/8 tsp.
    // opts: { cupStandard, measures } — measures is a list of names from MEASURES to use instead.
    var MEASURES = [
      { name: 'cup', unit: 'cup', part: 1, show: 'cup' }, { name: '1/2 cup', unit: 'cup', part: 1 / 2, show: '½ cup' },
      { name: '1/3 cup', unit: 'cup', part: 1 / 3, show: '⅓ cup' }, { name: '1/4 cup', unit: 'cup', part: 1 / 4, show: '¼ cup' },
      { name: 'tbsp', unit: 'tbsp', part: 1, show: 'tbsp' }, { name: 'tsp', unit: 'tsp', part: 1, show: 'tsp' },
      { name: '1/2 tsp', unit: 'tsp', part: 1 / 2, show: '½ tsp' }, { name: '1/4 tsp', unit: 'tsp', part: 1 / 4, show: '¼ tsp' },
      { name: '1/8 tsp', unit: 'tsp', part: 1 / 8, show: '⅛ tsp' }
    ];
    var EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
    function measurable(ml, opts) {
      opts = opts || {};
      var cs = opts.cupStandard, use = opts.measures;
      var eighth = unitMl('tsp', cs) / 8;
      var left = ml / eighth; // in eighths of a teaspoon
      var parts = [], got = 0, tspEighths = 0;
      MEASURES.forEach(function (m) {
        if (use && use.indexOf(m.name) < 0) return;
        var mMl = m.part * unitMl(m.unit, cs), size = mMl / eighth; // this measure in eighths of a tsp
        // A measure is taken when what is left is within half an eighth of a tsp of it, which is
        // the same as rounding the answer to the nearest 1/8 tsp, but keeps exact thirds of any cup.
        // Whole measures (cup, tbsp, tsp) can repeat; the part measures are used at most once.
        var n = m.part === 1 ? Math.floor((left + 0.5) / size + 1e-9) : (left + 0.5 + 1e-9 >= size ? 1 : 0);
        if (!n) return;
        left = Math.max(0, left - n * size);
        got += n * mMl;
        if (m.unit === 'tsp') { tspEighths += n * m.part * 8; return; }
        parts.push({ measure: m.name, count: n, text: (m.part === 1 ? n + ' ' : '') + m.show + (m.name === 'cup' && n > 1 ? 's' : '') });
      });
      if (tspEighths) { // teaspoon measures read as one mixed number: 2 tsp + 1/8 tsp = 2⅛ tsp
        var whole = Math.floor(tspEighths / 8 + 1e-9), rest = Math.round(tspEighths - whole * 8);
        parts.push({ measure: 'tsp', count: tspEighths / 8, text: (whole ? String(whole) : '') + EIGHTHS[rest] + ' tsp' });
      }
      return { text: parts.map(function (p) { return p.text; }).join(' + ') || '0', parts: parts,
               ml: got, errorMl: got - ml, provisional: true };
    }

    // Typed author words (B02). The ingredient's own "aliases" in the data file win; otherwise the
    // word picks the convention whose label starts with that author's name. No match: null, and the
    // parser reports the word as not understood.
    function authorConvention(ingredientId, word) {
      var ing = ingredient(ingredientId), w = String(word).toLowerCase();
      if (ing.aliases && ing.aliases[w]) return ing.aliases[w];
      var re = AUTHORS[w];
      if (!re) return null;
      for (var i = 0; i < ing.conventions.length; i++) {
        var c = ing.conventions[i];
        if (re.test(c.label)) return c.key || c.label;
      }
      return null;
    }

    return {
      volumeMl: volumeMl, unitMl: unitMl, gramsPerMl: gramsPerMl, assumption: assumption,
      toGrams: toGrams, fromGrams: fromGrams, saltSwap: saltSwap, stickButter: stickButter,
      measurable: measurable, cupSet: cupSet, ingredient: ingredient, data: data,
      isWeight: isWeight, convention: convention, authorConvention: authorConvention,
      WORDS: WORDS, AUTHORS: AUTHORS
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kitchen = api;
})(this);
