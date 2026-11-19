/* core.js: the shared unit core (UC) from Fast_Conversion.
   Copied unchanged from the <script id="core"> block of Fast_Conversion's index.html,
   commit 46749ad (2026-11-14), the version held in the Baking App project as index.html.
   The block is identical in commits 696bd53 and 46749ad. Do not edit it here: change
   Fast_Conversion first, then copy again, then run tests.html.
   Only the last line below the block is new: it lets Node load this file with require(). */
/* Units, parsing and maths. No DOM in here. */
const UC = (() => {
  const K0 = 273.15;
  // [id, label, name, factor to the category's base unit (or {to, from}), targets in priority order, typed aliases]
  const CATALOG = [
    ['Length', [ // base: metre
      ['mm', 'mm', 'millimetres', 1e-3, 'in in:frac ft ft:ftin cm thou m', 'mm millimeter millimeters millimetre millimetres'],
      ['cm', 'cm', 'centimetres', 1e-2, 'in in:frac ft ft:ftin mm m', 'cm centimeter centimeters centimetre centimetres'],
      ['m', 'm', 'metres', 1, 'ft ft:ftin in yd cm mm', 'm meter meters metre metres'],
      ['km', 'km', 'kilometres', 1e3, 'mi m ft yd', 'km kilometer kilometers kilometre kilometres'],
      ['um', 'µm', 'micrometres', 1e-6, 'thou mm in', 'um micron microns micrometer micrometers micrometre micrometres'],
      ['in', 'in', 'inches', 0.0254, 'mm in:frac cm ft:ftin ft m thou', 'in " inch inches'],
      ['thou', 'thou', 'thousandths of an inch', 0.0000254, 'mm um in', 'thou thous mil mils'],
      ['ft', 'ft', 'feet', 0.3048, 'm cm mm in yd', "ft ' foot feet"],
      ['yd', 'yd', 'yards', 0.9144, 'm ft in cm', 'yd yds yard yards'],
      ['mi', 'mi', 'miles', 1609.344, 'km m ft yd', 'mi mile miles'],
    ]],
    ['Temperature', [ // base: kelvin
      ['C', '°C', 'degrees Celsius', { to: v => v + K0, from: b => b - K0 }, 'F K', 'c degc celsius centigrade'],
      ['F', '°F', 'degrees Fahrenheit', { to: v => (v - 32) * 5 / 9 + K0, from: b => (b - K0) * 9 / 5 + 32 }, 'C K', 'f degf fahrenheit'],
      ['K', 'K', 'kelvin', 1, 'C F', 'k kelvin'],
    ]],
    ['Weight', [ // base: kilogram
      ['mg', 'mg', 'milligrams', 1e-6, 'g oz', 'mg milligram milligrams'],
      ['g', 'g', 'grams', 1e-3, 'oz lb kg', 'g gram grams'],
      ['kg', 'kg', 'kilograms', 1, 'lb lb:lboz oz g', 'kg kgs kilo kilos kilogram kilograms'],
      ['t', 't', 'tonnes', 1e3, 'lb ton kg', 't tonne tonnes metricton'],
      ['oz', 'oz', 'ounces', 0.028349523125, 'g kg lb', 'oz ounce ounces'],
      ['lb', 'lb', 'pounds', 0.45359237, 'kg g oz', 'lb lbs pound pounds #'],
      ['ton', 'US ton', 'US short tons', 907.18474, 't kg lb', 'ton tons uston shortton'],
    ]],
    ['Volume', [ // base: litre
      ['mL', 'mL', 'millilitres', 1e-3, 'floz tsp tbsp cup L', 'ml cc cm3 milliliter milliliters millilitre millilitres'],
      ['L', 'L', 'litres', 1, 'gal igal qt cup floz mL', 'l liter liters litre litres'],
      ['m3', 'm³', 'cubic metres', 1e3, 'ft3 L gal', 'm3 cubicmeter cubicmeters cubicmetre cubicmetres'],
      ['tsp', 'tsp', 'US teaspoons', 0.00492892159375, 'mL tbsp floz', 'tsp teaspoon teaspoons'],
      ['tbsp', 'tbsp', 'US tablespoons', 0.01478676478125, 'mL tsp floz cup', 'tbsp tbs tablespoon tablespoons'],
      ['floz', 'fl oz', 'US fluid ounces', 0.0295735295625, 'mL L cup tbsp', 'floz fluidounce fluidounces'],
      ['cup', 'cup', 'US cups', 0.2365882365, 'mL L floz tbsp', 'cup cups'],
      ['pt', 'pt', 'US pints', 0.473176473, 'L mL cup qt', 'pt pint pints'],
      ['qt', 'qt', 'US quarts', 0.946352946, 'L mL gal', 'qt quart quarts'],
      ['gal', 'US gal', 'US gallons', 3.785411784, 'L igal qt', 'gal gals gallon gallons usgal'],
      ['igal', 'imp gal', 'imperial gallons', 4.54609, 'L gal', 'igal impgal ukgal imperialgallon imperialgallons'],
      ['in3', 'in³', 'cubic inches', 0.016387064, 'mL L floz', 'in3 cuin ci cubicinch cubicinches'],
      ['ft3', 'ft³', 'cubic feet', 28.316846592, 'L m3 gal', 'ft3 cuft cf cubicfoot cubicfeet'],
    ]],
    ['Torque', [ // base: newton-metre
      ['Nm', 'N·m', 'newton-metres', 1, 'ftlb inlb kgcm', 'nm newtonmeter newtonmeters newtonmetre newtonmetres'],
      ['kgcm', 'kg·cm', 'kilogram-force centimetres', 0.0980665, 'Nm ozin inlb', 'kgcm kgfcm'],
      ['ftlb', 'ft·lb', 'foot-pounds', 1.3558179483314004, 'Nm inlb', 'ftlb ftlbs lbft ftlbf lbfft footpound footpounds'],
      ['inlb', 'in·lb', 'inch-pounds', 0.1129848290276167, 'Nm ftlb kgcm', 'inlb inlbs lbin inlbf lbfin inchpound inchpounds'],
      ['ozin', 'oz·in', 'ounce-inches', 0.00706155181422604, 'kgcm Nm inlb', 'ozin inoz'],
    ]],
    ['Pressure', [ // base: pascal
      ['kPa', 'kPa', 'kilopascals', 1e3, 'psi bar atm', 'kpa kilopascal kilopascals'],
      ['MPa', 'MPa', 'megapascals', 1e6, 'psi bar kPa', 'mpa megapascal megapascals'],
      ['bar', 'bar', 'bar', 1e5, 'psi kPa atm', 'bar bars'],
      ['psi', 'psi', 'pounds per square inch', 6894.757293168361, 'bar kPa MPa', 'psi'],
      ['atm', 'atm', 'atmospheres', 101325, 'psi bar kPa', 'atm atmosphere atmospheres'],
    ]],
    ['Speed', [ // base: metre per second
      ['mm/s', 'mm/s', 'millimetres per second', 1e-3, 'mm/min in/min m/min', 'mm/s mm/sec'],
      ['mm/min', 'mm/min', 'millimetres per minute', 1e-3 / 60, 'in/min mm/s m/min', 'mm/min mmpm'],
      ['m/min', 'm/min', 'metres per minute', 1 / 60, 'ft/min m/s km/h', 'm/min mpm'],
      ['m/s', 'm/s', 'metres per second', 1, 'km/h mph ft/min', 'm/s mps m/sec'],
      ['km/h', 'km/h', 'kilometres per hour', 1 / 3.6, 'mph m/s kn', 'km/h kmh kph kmph km/hr'],
      ['in/min', 'in/min', 'inches per minute', 0.0254 / 60, 'mm/min mm/s', 'in/min ipm'],
      ['ft/min', 'ft/min', 'feet per minute', 0.3048 / 60, 'm/min m/s mph', 'ft/min fpm'],
      ['mph', 'mph', 'miles per hour', 0.44704, 'km/h m/s kn', 'mph mi/h mi/hr'],
      ['kn', 'kn', 'knots', 1852 / 3600, 'km/h mph m/s', 'kn kt kts knot knots'],
    ]],
    ['Area', [ // base: square metre
      ['mm2', 'mm²', 'square millimetres', 1e-6, 'in2 cm2', 'mm2 sqmm'],
      ['cm2', 'cm²', 'square centimetres', 1e-4, 'in2 mm2', 'cm2 sqcm'],
      ['m2', 'm²', 'square metres', 1, 'ft2 in2', 'm2 sqm squaremeter squaremeters squaremetre squaremetres'],
      ['ha', 'ha', 'hectares', 1e4, 'acre m2 ft2', 'ha hectare hectares'],
      ['in2', 'in²', 'square inches', 0.00064516, 'cm2 mm2', 'in2 sqin squareinch squareinches'],
      ['ft2', 'ft²', 'square feet', 0.09290304, 'm2 in2', 'ft2 sqft sf squarefoot squarefeet'],
      ['acre', 'acre', 'acres', 4046.8564224, 'ha m2 ft2', 'acre acres ac'],
    ]],
    ['Power', [ // base: watt
      ['W', 'W', 'watts', 1, 'hp kW', 'w watt watts'],
      ['kW', 'kW', 'kilowatts', 1e3, 'hp W', 'kw kilowatt kilowatts'],
      ['hp', 'hp', 'horsepower', 745.69987158227, 'kW W', 'hp horsepower'],
    ]],
    ['Force', [ // base: newton
      ['N', 'N', 'newtons', 1, 'lbf kgf', 'n newton newtons'],
      ['kgf', 'kgf', 'kilograms-force', 9.80665, 'N lbf', 'kgf'],
      ['lbf', 'lbf', 'pounds-force', 4.4482216152605, 'N kgf', 'lbf'],
    ]],
    ['Angle', [ // base: radian
      ['deg', 'deg', 'degrees', Math.PI / 180, 'rad', 'deg degree degrees'],
      ['rad', 'rad', 'radians', 1, 'deg', 'rad radian radians'],
    ]],
  ];
  // The always-visible table: [row name, metric sources, imperial sources]. Each shows its first target.
  const TABLE = [
    ['Length', 'mm cm m km', 'in ft mi thou'],
    ['Temperature', 'C', 'F'],
    ['Weight', 'g kg', 'oz lb'],
    ['Volume', 'mL L', 'floz gal'],
    ['Torque', 'Nm kgcm', 'ftlb inlb'],
    ['Pressure', 'bar kPa', 'psi'],
    ['Speed', 'km/h mm/min m/min', 'mph in/min ft/min'],
    ['Area', 'm2', 'ft2'],
    ['Power', 'kW', 'hp'],
    ['Force', 'N', 'lbf'],
  ];

  const UNITS = [], BY = {}, ALIAS = new Map(), clashes = [];
  for (const [cat, list] of CATALOG) for (const [id, label, name, f, targets, aliases] of list) {
    const u = {
      id, label, name, cat, targets: targets.split(' '), keys: aliases.split(' '),
      to: typeof f === 'number' ? v => v * f : f.to,
      from: typeof f === 'number' ? b => b / f : f.from,
    };
    UNITS.push(u); BY[id] = u;
    for (const k of u.keys) { if (ALIAS.has(k)) clashes.push(k); ALIAS.set(k, u); }
  }
  const COMMON = new Set(TABLE.flatMap(r => (r[1] + ' ' + r[2]).split(' ')));

  // ── formatting ──
  function fmt(x, sig = 6) {
    if (!Number.isFinite(x)) return '?';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e12 || a < 1e-6) return x.toExponential(Math.min(sig - 1, 4)).replace(/\.?0+e/, 'e').replace('e+', 'e');
    if (a >= 1) return String(parseFloat(x.toFixed(Math.max(0, sig - Math.floor(Math.log10(a)) - 1))));
    return String(parseFloat(x.toPrecision(sig)));
  }
  const group = s => s.replace(/^(-?)(\d{5,})/, (_, sg, d) => sg + d.replace(/\B(?=(\d{3})+$)/g, ' '));
  function fraction(x, den) { // x >= 0, rounded to the nearest 1/den and reduced
    let whole = Math.floor(x), num = Math.round((x - whole) * den), d = den;
    if (num === d) { whole += 1; num = 0; }
    while (num && num % 2 === 0) { num /= 2; d /= 2; }
    return { whole, num, den: d, value: whole + num / d };
  }

  // ── every answer for one reading of the number ──
  function rows(p) {
    const u = p.unit, v = p.value, out = [];
    let list = u.targets;
    // a typed fraction of an inch: lead with the same length as decimal inches
    if (p.frac && u.id === 'in' && !p.ftin) list = ['in', 'mm', 'cm', 'ft', 'ft:ftin', 'thou'];
    if (p.target) list = [p.target.id, ...list.filter(t => t !== p.target.id)];
    for (const t of list) {
      const [tid, mode] = t.split(':');
      const tu = BY[tid], x = tu.from(u.to(v));
      if (!mode) { const s = fmt(x); out.push({ show: group(s), unit: tu.label, copy: s, copyUnit: s + ' ' + tu.label, note: '' }); continue; }
      const a = Math.abs(x), sg = x < 0 ? '-' : '';
      if (!Number.isFinite(a) || a > 1e7) continue;
      const den = p.den || 64;
      if (mode === 'frac') { // inches to the nearest 1/den
        if (p.frac && u.id === 'in') continue;
        const fr = fraction(a, den), err = fr.value - a;
        if (!fr.value) continue;
        const exact = Math.abs(err) < 5e-7;
        if (exact && !fr.num) continue; // same as the decimal row
        const text = sg + (fr.num ? (fr.whole ? fr.whole + ' ' : '') + fr.num + '/' + fr.den : String(fr.whole));
        const off = fmt(u.from(BY.in.to(Math.abs(err))), 2) + ' ' + u.label + (err > 0 ? ' over' : ' under');
        const note = exact ? 'exact' : 'nearest 1/' + den + ', ' + off;
        out.push({ show: text, unit: 'in', copy: text, copyUnit: text + ' in', note, short: exact ? 'exact' : off });
      } else if (mode === 'ftin') { // feet and inches to the nearest 1/16
        const inches = a * 12; // x is in feet here
        if (inches < 12 || p.ftin) continue;
        let ft = Math.floor(inches / 12);
        const fd = Math.min(den, 16), rem = inches - ft * 12, fr = fraction(rem, fd);
        let wh = fr.whole;
        if (wh === 12) { ft += 1; wh = 0; }
        const tail = wh + (fr.num ? ' ' + fr.num + '/' + fr.den : '');
        const plain = sg + ft + "' " + tail + '"';
        out.push({ show: sg + ft + '′ ' + tail + '″', unit: '', copy: plain, copyUnit: plain, note: Math.abs(fr.value - rem) < 1e-9 ? '' : 'to the nearest 1/' + fd + ' in' });
      } else if (mode === 'lboz') { // pounds and ounces
        if (a < 1) continue;
        let lb = Math.floor(a), oz = Math.round((a - lb) * 160) / 10;
        if (oz >= 16) { lb += 1; oz = 0; }
        const text = sg + lb + ' lb ' + oz + ' oz';
        out.push({ show: text, unit: '', copy: text, copyUnit: text, note: '' });
      }
    }
    return out;
  }

  // ── reading what was typed ──
  const norm = t => t.toLowerCase().replace(/\s+per\s+/g, '/').replace(/[µμ]/g, 'u').replace(/²/g, '2').replace(/³/g, '3')
    .replace(/°\s*(?=[a-z])/g, '').replace(/°/g, 'deg').replace(/[\s.\-·*^_]/g, '');
  function resolve(text) {
    const key = norm(text || '');
    if (!key) return { exact: null, cands: [] };
    const exact = ALIAS.get(key) || null;
    const cands = UNITS.filter(u => u !== exact && u.keys.some(k => k.startsWith(key)));
    // best guess first: the unit's own short name starts with what was typed, then units from the main table
    const rank = u => (u.keys[0].startsWith(key) ? 2 : 0) + (COMMON.has(u.id) ? 1 : 0);
    cands.sort((a, b) => rank(b) - rank(a));
    return { exact, cands };
  }
  function splitTarget(text) { // "kg lb", "ft in m": a unit, then the unit wanted
    const i = text.search(/\s/);
    if (i < 0) return null;
    const left = text.slice(0, i), right = text.slice(i).trim().replace(/^(?:in|to|as)\s+(?=\S)/i, '');
    if (!resolve(left).exact) return null;
    const r = resolve(right);
    return r.exact || r.cands.length ? { left, right } : null;
  }
  const Q = String.raw`(?:\d+[ -]+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+\.?\d*|\.\d+)`; // 1 3/8 | 3/8 | 25.4
  const RE_FTIN = new RegExp(String.raw`^(\d+\.?\d*)\s*('|ft|feet|foot)(\s*)(${Q})\s*("|in|inch|inches)?$`, 'i');
  const RE_NUM = new RegExp(String.raw`^(${Q})\s*(.*)$`);
  const tidy = s => s.trim().replace(/\s*\/\s*/, '/').replace(/[ -]+/, ' ');
  function qty(s) {
    let m;
    if ((m = s.match(/^(\d+)[ -]+(\d+)\s*\/\s*(\d+)$/))) return +m[3] ? { v: +m[1] + m[2] / m[3], frac: true } : null;
    if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) return +m[2] ? { v: m[1] / m[2], frac: true } : null;
    const v = parseFloat(s);
    return Number.isFinite(v) ? { v, frac: false } : null;
  }
  function done(p, targetText) {
    if (targetText && p.unit) {
      const r = resolve(targetText);
      const t = r.exact && r.exact.cat === p.unit.cat ? r.exact : r.cands.find(c => c.cat === p.unit.cat);
      if (t && t !== p.unit) p.target = t;
    }
    p.q = p.ftin || !p.unit ? p.shown : p.shown + ' ' + p.unit.label;
    return p;
  }
  // how: empty | pinned (no unit typed) | implied (fraction, so inches) | typed | guess (prefix match) | unknown | badnum
  function parse(raw, pinnedId) {
    const pinned = BY[pinnedId] || BY.mm;
    const p = { value: 1, unit: pinned, how: 'empty', unitText: '', cands: [], numText: '', frac: false, ftin: false, target: null, shown: '1', q: '' };
    let s = String(raw).replace(/[′’‘`´]/g, "'").replace(/[″”“]/g, '"').replace(/''/g, '"').replace(/[−–—]/g, '-').trim();
    if (!s) return done(p);
    let targetText = '';
    let m = s.match(/^(.+?)(?:\s+to(?:\s+|$)|\s*-?>\s*|\s*=\s*)(.*)$/i);
    if (m) { s = m[1].trim(); targetText = m[2].trim(); }
    let neg = false;
    if (/^[-+]/.test(s)) { neg = s[0] === '-'; s = s.slice(1).trim(); }
    s = s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1').replace(/(\d),(?=\d)/g, '$1.');
    const sg = neg ? '-' : '', sign = neg ? -1 : 1;

    m = s.match(RE_FTIN); // 5' 7 1/2"  or  5ft 7in  (but 5ft2 is square feet)
    if (m && (m[2] === "'" || m[3] || m[5])) {
      const q = qty(m[4].trim());
      if (q) {
        p.value = sign * (parseFloat(m[1]) * 12 + q.v);
        p.unit = BY.in; p.how = 'typed'; p.ftin = true; p.frac = q.frac;
        p.numText = fmt(p.value, 10);
        p.shown = sg + m[1] + '′ ' + tidy(m[4]) + '″';
        return done(p, targetText);
      }
    }

    let unitText;
    m = s.match(RE_NUM);
    if (m) {
      const q = qty(m[1].trim());
      if (!q) { p.how = 'badnum'; p.unit = null; p.value = NaN; p.unitText = m[1].trim(); p.shown = '?'; return done(p); }
      p.value = sign * q.v; p.frac = q.frac;
      p.numText = p.shown = q.frac ? sg + tidy(m[1]) : fmt(p.value, 12);
      unitText = m[2].trim();
      if (/^[\d\/.]/.test(unitText)) unitText = ''; // mid-fraction: "1 3", "3/"
      const half = unitText.match(/^(?:(')\s*|(ft|feet|foot)\s+)[\d\s\/.-]+$/i); // mid feet-and-inches: 5' 7 1/
      if (half) unitText = half[1] || half[2];
    } else { unitText = s; p.value = sign; p.shown = sg + '1'; }

    if (!unitText) {
      if (p.frac) { p.unit = BY.in; p.how = 'implied'; } else { p.unit = pinned; p.how = 'pinned'; }
      return done(p, targetText);
    }
    let r = resolve(unitText);
    if (!r.exact && !r.cands.length) {
      const sp = splitTarget(unitText);
      if (sp) { unitText = sp.left; targetText = sp.right; r = resolve(unitText); }
    }
    p.unitText = unitText;
    if (r.exact) { p.unit = r.exact; p.how = 'typed'; p.cands = r.cands; }
    else if (r.cands.length) { p.unit = r.cands[0]; p.how = 'guess'; p.cands = r.cands.slice(1); }
    else { p.unit = null; p.how = 'unknown'; }
    return done(p, targetText);
  }

  return { parse, rows, fmt, norm, resolve, unit: id => BY[id], units: UNITS, catalog: CATALOG, TABLE, clashes };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = UC;
