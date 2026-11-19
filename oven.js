// oven.js: oven temperature row for Fast_Conversion kitchen mode.
// Plain JS, no build step. Works in the browser (window.Oven) and in Node (module.exports).
// Sources and verified flags live in conversion-data.json; this file holds only the numbers.
(function (root) {
  'use strict';

  // Exact conversions (definition of the two scales).
  function fToC(f) { return (f - 32) * 5 / 9; }
  function cToF(c) { return c * 9 / 5 + 32; }

  // Pairs publishers print side by side (°F, °C conventional). Source rows: Which?, Hoover UK,
  // AEG UK, Great British Chefs, Women's Weekly AU. 325 and 475 are disputed (see results file).
  var DIAL_PAIRS = [
    [225, 110], [250, 120], [275, 140], [300, 150], [325, 160], [350, 180],
    [375, 190], [400, 200], [425, 220], [450, 230], [475, 240], [500, 260]
  ];

  var FAN_DROP_F = 25; // King Arthur, GE Auto Recipe Conversion
  var FAN_DROP_C = 20; // Which?, Hoover UK, Nigella, Bakeclub (AU)

  function round5(x) { return Math.round(x / 5) * 5; }

  // The number to set on the dial.
  function dialC(f) {
    for (var i = 0; i < DIAL_PAIRS.length; i++) if (DIAL_PAIRS[i][0] === f) return DIAL_PAIRS[i][1];
    return round5(fToC(f));
  }
  function dialF(c) {
    for (var i = 0; i < DIAL_PAIRS.length; i++) if (DIAL_PAIRS[i][1] === c) return DIAL_PAIRS[i][0];
    return round5(cToF(c));
  }

  // Gas mark: mark 1 = 275°F, +25°F per mark; below 1 the marks halve per 25°F step.
  var GAS = [
    { mark: 0.25, label: '¼', f: 225 }, { mark: 0.5, label: '½', f: 250 },
    { mark: 1, label: '1', f: 275 }, { mark: 2, label: '2', f: 300 }, { mark: 3, label: '3', f: 325 },
    { mark: 4, label: '4', f: 350 }, { mark: 5, label: '5', f: 375 }, { mark: 6, label: '6', f: 400 },
    { mark: 7, label: '7', f: 425 }, { mark: 8, label: '8', f: 450 }, { mark: 9, label: '9', f: 475 },
    { mark: 10, label: '10', f: 500 }
  ];

  function gasToF(mark) {
    for (var i = 0; i < GAS.length; i++) if (GAS[i].mark === mark) return GAS[i].f;
    return null; // not a printed mark
  }

  // Within a quarter step (6.25°F) of a mark: that mark. Otherwise the two neighbours, e.g. "3–4".
  function gasFromF(f) {
    if (f < 225 - 6.25 || f > 500 + 6.25) return null;
    for (var i = 0; i < GAS.length; i++) if (Math.abs(f - GAS[i].f) <= 6.25) return GAS[i].label;
    for (var j = 0; j < GAS.length - 1; j++)
      if (f > GAS[j].f && f < GAS[j + 1].f) return GAS[j].label + '–' + GAS[j + 1].label;
    return null;
  }
  function gasFromC(c) { return gasFromF(dialF(c)); }

  // One call per keystroke. unit: 'F', 'C' or 'gas'. Returns everything the row shows.
  function oven(value, unit) {
    var f, c, exactF, exactC;
    if (unit === 'gas') {
      f = gasToF(value);
      if (f === null) return null;
      c = dialC(f); exactF = f; exactC = fToC(f);
      return { f: f, c: c, exactC: exactC, gas: gasFromF(f), fanF: f - FAN_DROP_F, fanC: c - FAN_DROP_C };
    }
    if (unit === 'F') {
      f = value; c = dialC(f); exactC = fToC(f);
      return { f: f, c: c, exactC: exactC, gas: gasFromF(f), fanF: f - FAN_DROP_F, fanC: c - FAN_DROP_C };
    }
    c = value; f = dialF(c); exactF = cToF(c);
    return { f: f, c: c, exactF: exactF, gas: gasFromC(c), fanF: f - FAN_DROP_F, fanC: c - FAN_DROP_C };
  }

  var api = { fToC: fToC, cToF: cToF, dialC: dialC, dialF: dialF, gasToF: gasToF,
              gasFromF: gasFromF, gasFromC: gasFromC, oven: oven,
              FAN_DROP_F: FAN_DROP_F, FAN_DROP_C: FAN_DROP_C, DIAL_PAIRS: DIAL_PAIRS, GAS: GAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Oven = api;
})(this);
