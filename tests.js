// tests.js: the known-answer tests for kitchen-converter, as data.
// The same list runs in Node (node tests.js) and on the phone (tests.html).
//
// Each test keeps the original id, input, expect and source from conversion-data.json
// (or from the T08 results for the core tests), plus:
//   call    the function call it was translated into, by hand; this exact text is run
//   checks  how the answer is compared, at the precision the expected value shows:
//           {rel: x}         number, within 1e-9 relative (full-precision constants)
//           {dp: n, want: x} number rounded to n decimals equals x (137 g -> dp 0)
//           {text: 's'}      text, ignoring spacing, case, ½-style fractions and dash style
//           {eq: x}          exactly equal (dial numbers, null for "no result")
//           field: 'name'    compare that field of the answer instead of the whole answer
//   pending a reason, naming the plan idea it waits on (not a failure)
(function (root) {
  'use strict';

  var TESTS = [
    // ── Core: the copied Fast_Conversion unit core gives the live app's answers (T08) ──
    { group: 'core', id: 'C1', input: '25.4mm', expect: '1 in', source: 'core: inch = 0.0254 m',
      call: "H.top('25.4mm')", checks: [{ text: '1 in' }] },
    { group: 'core', id: 'C2', input: '72f', expect: '22.2222 °C', source: 'core: (F − 32) × 5 ÷ 9, six significant figures',
      call: "H.top('72f')", checks: [{ text: '22.2222 °C' }] },
    { group: 'core', id: 'C3', input: '1 3/8', expect: '1.375 in, then 34.925 mm', source: 'core: a bare fraction reads as inches',
      call: "H.top('1 3/8') + ', then ' + H.second('1 3/8')", checks: [{ text: '1.375 in, then 34.925 mm' }] },
    { group: 'core', id: 'C4', input: '5\' 7"', expect: '1701.8 mm', source: 'core: 67 in × 25.4',
      call: "H.top('5\\' 7\"')", checks: [{ text: '1701.8 mm' }] },
    { group: 'core', id: 'C5', input: '1 cup', expect: '236.588 mL', source: 'core: 0.2365882365 L, matches NIST (T03)',
      call: "H.top('1 cup')", checks: [{ text: '236.588 mL' }] },
    { group: 'core', id: 'C6', input: '2 lb', expect: '0.907185 kg', source: 'core: 0.45359237 kg per lb',
      call: "H.top('2 lb')", checks: [{ text: '0.907185 kg' }] },
    { group: 'core', id: 'C7', input: '40psi>kpa', expect: '275.79 kPa', source: 'core: 6894.757293168361 Pa per psi',
      call: "H.top('40psi>kpa')", checks: [{ text: '275.79 kPa' }] },

    // ── Units (conversion-data.json) ──
    { group: 'units', id: 'U1', input: '1 cup_us -> mL', expect: '236.5882365', source: 'nist_hb44_c',
      call: "K.volumeMl(1, 'cup_us')", checks: [{ rel: 236.5882365 }] },
    { group: 'units', id: 'U2', input: '1 cup_us_label -> mL', expect: '240', source: 'cfr_101_9',
      call: "K.volumeMl(1, 'cup_us_label')", checks: [{ rel: 240 }] },
    { group: 'units', id: 'U3', input: '1 cup_metric -> mL', expect: '250', source: 'ca_sfcr_241',
      call: "K.volumeMl(1, 'cup_metric')", checks: [{ rel: 250 }] },
    { group: 'units', id: 'U4', input: '1 tbsp_au -> mL', expect: '20', source: 'aww_conversions',
      call: "K.volumeMl(1, 'tbsp_au')", checks: [{ rel: 20 }] },
    { group: 'units', id: 'U5', input: '1 cup_metric -> tbsp_au', expect: '12.5', source: 'U3 and U4',
      call: "K.volumeMl(1, 'cup_metric') / K.unitMl('tbsp_au')", checks: [{ rel: 12.5 }] },
    { group: 'units', id: 'U6', input: '1 tbsp_us -> tsp_us', expect: '3 exactly', source: 'nist_hb44_c',
      call: "K.volumeMl(1, 'tbsp_us') / K.unitMl('tsp_us')", checks: [{ eq: 3 }] },
    { group: 'units', id: 'U7', input: '1 tbsp_us -> mL', expect: '14.78676478125', source: 'nist_hb44_c',
      call: "K.volumeMl(1, 'tbsp_us')", checks: [{ rel: 14.78676478125 }] },
    { group: 'units', id: 'U8', input: '1 floz_imperial -> mL', expect: '28.4130625', source: 'uk_wma_sch1',
      call: "K.volumeMl(1, 'floz_imperial')", checks: [{ rel: 28.4130625 }] },
    { group: 'units', id: 'U9', input: '1 gal_us -> mL', expect: '3785.411784', source: 'nist_hb44_c',
      call: "K.volumeMl(1, 'gal_us')", checks: [{ rel: 3785.411784 }] },
    { group: 'units', id: 'U10', input: '16 oz -> g', expect: '453.59237', source: 'nist_hb44_c',
      call: "K.toGrams(16, 'oz')", checks: [{ rel: 453.59237 }] },
    { group: 'units', id: 'U11', input: '1 cup_us -> cup_metric', expect: '0.946352946', source: 'U1 and U3',
      call: "K.volumeMl(1, 'cup_us') / K.unitMl('cup_metric')", checks: [{ rel: 0.946352946 }] },
    { group: 'units', id: 'U12', input: '1/3 cup_us -> measurable', expect: '5 tbsp + 1 tsp', source: 'nist_hb44_c',
      note: 'Run with spoons only. With the full measure set the provisional rule answers ⅓ cup (test B1); which form the screen shows is idea 6.',
      call: "K.measurable(K.volumeMl(1/3, 'cup_us'), { measures: H.SPOONS }).text", checks: [{ text: '5 tbsp + 1 tsp' }] },

    // ── Flour ──
    { group: 'flour', id: 'F1', input: '2 cup_us flour_ap (default)', expect: '260 g', source: 'milkstreet',
      call: "K.toGrams(2, 'cup_us', 'flour_ap')", checks: [{ dp: 0, want: 260 }] },
    { group: 'flour', id: 'F2', input: '2 cup_us flour_ap, ka_120', expect: '240 g', source: 'ka_chart',
      call: "K.toGrams(2, 'cup_us', 'flour_ap', { convention: 'ka_120' })", checks: [{ dp: 0, want: 240 }] },
    { group: 'flour', id: 'F3', input: '2 cup_us flour_ap, atk_142', expect: '284 g', source: 'atk_chart',
      call: "K.toGrams(2, 'cup_us', 'flour_ap', { convention: 'atk_142' })", checks: [{ dp: 0, want: 284 }] },
    { group: 'flour', id: 'F4', input: '1 cup_metric flour_ap (default)', expect: '137 g (137.37)', source: 'milkstreet',
      call: "K.toGrams(1, 'cup_metric', 'flour_ap')", checks: [{ dp: 0, want: 137 }, { dp: 2, want: 137.37 }] },
    { group: 'flour', id: 'F5', input: '1 cup_metric flour_ap, aww_150', expect: '150 g', source: 'aww',
      call: "K.toGrams(1, 'cup_metric', 'flour_ap', { convention: 'aww_150' })", checks: [{ dp: 0, want: 150 }] },
    { group: 'flour', id: 'F6', input: '1 cup_us flour_ap, aww_150', expect: '142 g (141.95)', source: 'aww',
      call: "K.toGrams(1, 'cup_us', 'flour_ap', { convention: 'aww_150' })", checks: [{ dp: 0, want: 142 }, { dp: 2, want: 141.95 }] },
    { group: 'flour', id: 'F7', input: '1 cup_us_label flour_ap (default)', expect: '132 g (131.87)', source: 'milkstreet',
      call: "K.toGrams(1, 'cup_us_label', 'flour_ap')", checks: [{ dp: 0, want: 132 }, { dp: 2, want: 131.87 }] },
    { group: 'flour', id: 'F8', input: '1 cup_metric flour_ap, ka_120', expect: '127 g (126.80)', source: 'ka_chart',
      call: "K.toGrams(1, 'cup_metric', 'flour_ap', { convention: 'ka_120' })", checks: [{ dp: 0, want: 127 }, { dp: 2, want: 126.80 }] },
    { group: 'flour', id: 'F9', input: '1 cup_us flour_ap, se_128', expect: '128 g (127.6)', source: 'seriouseats_aol',
      call: "K.toGrams(1, 'cup_us', 'flour_ap', { convention: 'se_128' })", checks: [{ dp: 0, want: 128 }, { dp: 1, want: 127.6 }] },
    { group: 'flour', id: 'F10', input: '3 cup_us flour_bread, brm_144', expect: '432 g', source: 'brm_chart',
      call: "K.toGrams(3, 'cup_us', 'flour_bread', { convention: 'brm_144' })", checks: [{ dp: 0, want: 432 }] },
    { group: 'flour', id: 'F11', input: '260 g flour_ap -> cup_us (default)', expect: '2.00 cups', source: 'milkstreet',
      call: "K.fromGrams(260, 'cup_us', 'flour_ap')", checks: [{ dp: 2, want: 2 }] },
    { group: 'flour', id: 'F12', input: '300 g flour_ap -> cup_metric, aww_150', expect: '2.00 cups', source: 'aww',
      call: "K.fromGrams(300, 'cup_metric', 'flour_ap', { convention: 'aww_150' })", checks: [{ dp: 2, want: 2 }] },
    { group: 'flour', id: 'F13', input: '1 cup_us flour_ap, usda_125', expect: '125 g', source: 'usda_hg72',
      call: "K.toGrams(1, 'cup_us', 'flour_ap', { convention: 'usda_125' })", checks: [{ dp: 0, want: 125 }] },

    // ── Other ingredients ──
    { group: 'ingredients', id: 'I1', input: '2 cup_us sugar_granulated, King Arthur', expect: '396 g', source: 'ka_chart',
      call: "K.toGrams(2, 'cup_us', 'sugar_granulated', { convention: 'King Arthur' })", checks: [{ dp: 0, want: 396 }] },
    { group: 'ingredients', id: 'I2', input: '1 cup_us sugar_granulated (default)', expect: '200 g', source: 'usda_hg72',
      call: "K.toGrams(1, 'cup_us', 'sugar_granulated')", checks: [{ dp: 0, want: 200 }] },
    { group: 'ingredients', id: 'I3', input: '1 cup_us sugar_brown (default, USDA packed)', expect: '220 g', source: 'usda_hg72',
      call: "K.toGrams(1, 'cup_us', 'sugar_brown')", checks: [{ dp: 0, want: 220 }] },
    { group: 'ingredients', id: 'I4', input: '1 cup_us honey, King Arthur (21 g per tbsp)', expect: '336 g', source: 'ka_chart',
      call: "K.toGrams(1, 'cup_us', 'honey', { convention: 'King Arthur' })", checks: [{ dp: 0, want: 336 }] },
    { group: 'ingredients', id: 'I5', input: '1 cup_us milk (default)', expect: '244 g', source: 'usda_hg72',
      call: "K.toGrams(1, 'cup_us', 'milk')", checks: [{ dp: 0, want: 244 }] },
    { group: 'ingredients', id: 'I6', input: '1 cup_metric milk (default)', expect: '258 g (257.83)', source: 'usda_hg72',
      call: "K.toGrams(1, 'cup_metric', 'milk')", checks: [{ dp: 0, want: 258 }, { dp: 2, want: 257.83 }] },
    { group: 'ingredients', id: 'I7', input: '2.25 tsp_us yeast_instant (default)', expect: '7 g', source: 'ka_chart',
      call: "K.toGrams(2.25, 'tsp_us', 'yeast_instant')", checks: [{ dp: 0, want: 7 }] },
    { group: 'ingredients', id: 'I8', input: '1 cup_us chocolate_chips, Milk Street', expect: '164 g', source: 'ms_mixins',
      call: "K.toGrams(1, 'cup_us', 'chocolate_chips', { convention: 'Milk Street' })", checks: [{ dp: 0, want: 164 }] },
    { group: 'ingredients', id: 'I9', input: '0.5 cup_us peanut_butter, King Arthur', expect: '135 g', source: 'ka_chart',
      call: "K.toGrams(0.5, 'cup_us', 'peanut_butter', { convention: 'King Arthur' })", checks: [{ dp: 0, want: 135 }] },
    { group: 'ingredients', id: 'I10', input: '1 cup_us cocoa, ATK', expect: '85 g', source: 'atk_chart',
      call: "K.toGrams(1, 'cup_us', 'cocoa', { convention: \"America's Test Kitchen\" })", checks: [{ dp: 0, want: 85 }] },
    { group: 'ingredients', id: 'I11', input: '1 tbsp_us oil_olive, USDA tbsp', expect: '14 g', source: 'usda_hg72',
      call: "K.toGrams(1, 'tbsp_us', 'oil_olive', { convention: 'USDA, tbsp' })", checks: [{ dp: 0, want: 14 }] },
    { group: 'ingredients', id: 'I12', input: '0.5 cup_us_label oats_old_fashioned (default)', expect: '40 g', source: 'label_quaker_oats',
      call: "K.toGrams(0.5, 'cup_us_label', 'oats_old_fashioned')", checks: [{ dp: 0, want: 40 }] },
    { group: 'ingredients', id: 'I13', input: '1 cup_us oats_old_fashioned (default)', expect: '79 g (78.86)', source: 'label_quaker_oats',
      call: "K.toGrams(1, 'cup_us', 'oats_old_fashioned')", checks: [{ dp: 0, want: 79 }, { dp: 2, want: 78.86 }] },
    { group: 'ingredients', id: 'I14', input: '1 cup_us water (default)', expect: '237 g', source: 'usda_hg72',
      call: "K.toGrams(1, 'cup_us', 'water')", checks: [{ dp: 0, want: 237 }] },
    { group: 'ingredients', id: 'I15', input: '1 stick butter', expect: '113 g', source: 'usda_hg72',
      call: 'K.stickButter(1)', checks: [{ dp: 0, want: 113 }] },

    // ── Salt ──
    { group: 'salt', id: 'S1', input: '1 tbsp_us salt_table (default, label)', expect: '18.0 g', source: 'morton_label_table',
      call: "K.toGrams(1, 'tbsp_us', 'salt_table')", checks: [{ dp: 1, want: 18.0 }] },
    { group: 'salt', id: 'S2', input: '1 tsp_us salt_morton_kosher (default, label)', expect: '4.8 g', source: 'morton_label_kosher',
      call: "K.toGrams(1, 'tsp_us', 'salt_morton_kosher')", checks: [{ dp: 1, want: 4.8 }] },
    { group: 'salt', id: 'S3', input: '1 tsp_us salt_diamond_crystal (default, label)', expect: '2.8 g', source: 'dc_sellsheet',
      call: "K.toGrams(1, 'tsp_us', 'salt_diamond_crystal')", checks: [{ dp: 1, want: 2.8 }] },
    { group: 'salt', id: 'S4', input: '1 tsp salt_table -> salt_morton_kosher, equal weight (labels)', expect: '1.25 tsp', source: 'labels; matches morton_chart',
      call: "K.saltSwap(1, 'tsp_us', 'salt_table', 'salt_morton_kosher')", checks: [{ dp: 2, want: 1.25 }] },
    { group: 'salt', id: 'S5', input: '1 tsp salt_table -> salt_diamond_crystal, equal weight (labels)', expect: '2.143 tsp, shown as 2 1/8 tsp', source: 'labels',
      call: "(n => ({ tsp: n, shown: K.measurable(K.volumeMl(n, 'tsp_us')).text }))(K.saltSwap(1, 'tsp_us', 'salt_table', 'salt_diamond_crystal'))",
      checks: [{ field: 'tsp', dp: 3, want: 2.143 }, { field: 'shown', text: '2 1/8 tsp' }] },
    { group: 'salt', id: 'S6', input: "1 tbsp_us salt_table, America's Test Kitchen", expect: '23 g', source: 'atk_salt',
      call: "K.toGrams(1, 'tbsp_us', 'salt_table', { convention: \"America's Test Kitchen\" })", checks: [{ dp: 0, want: 23 }] },
    { group: 'salt', id: 'S7', input: '1 tbsp_us salt_diamond_crystal, King Arthur', expect: '8 g', source: 'ka_chart',
      call: "K.toGrams(1, 'tbsp_us', 'salt_diamond_crystal', { convention: 'King Arthur' })", checks: [{ dp: 0, want: 8 }] },
    { group: 'salt', id: 'S8', input: '1 tbsp_metric salt_table (default, label)', expect: '18.3 g (18.26)', source: 'morton_label_table',
      call: "K.toGrams(1, 'tbsp_metric', 'salt_table')", checks: [{ dp: 1, want: 18.3 }, { dp: 2, want: 18.26 }] },
    { group: 'salt', id: 'S9', input: '1 tbsp salt_morton_kosher (KA) -> salt_diamond_crystal (KA), equal weight', expect: '2 tbsp', source: 'ka_chart',
      call: "K.saltSwap(1, 'tbsp_us', 'salt_morton_kosher', 'salt_diamond_crystal', { fromConvention: 'King Arthur / ATK', toConvention: 'King Arthur' })",
      checks: [{ dp: 0, want: 2 }] },
    { group: 'salt', id: 'S10', input: '10 g salt_diamond_crystal (default) -> tsp_us', expect: '3.57 tsp', source: 'dc_sellsheet',
      call: "K.fromGrams(10, 'tsp_us', 'salt_diamond_crystal')", checks: [{ dp: 2, want: 3.57 }] },

    // ── Oven (oven.js from T07) ──
    { group: 'oven', id: 'O1', input: '350 F', expect: 'dial 180 C, exact 176.7 C, gas 4, fan 325 F / 160 C', source: 'which_oven, hoover_fan, ka_convection',
      call: "Oven.oven(350, 'F')", checks: [{ field: 'c', eq: 180 }, { field: 'exactC', dp: 1, want: 176.7 }, { field: 'gas', text: '4' }, { field: 'fanF', eq: 325 }, { field: 'fanC', eq: 160 }] },
    { group: 'oven', id: 'O2', input: '180 C', expect: 'dial 350 F, exact 356 F, fan 160 C', source: 'which_oven, recipetin_pair',
      call: "Oven.oven(180, 'C')", checks: [{ field: 'f', eq: 350 }, { field: 'exactF', dp: 0, want: 356 }, { field: 'fanC', eq: 160 }] },
    { group: 'oven', id: 'O3', input: 'gas 4', expect: '350 F, 180 C, fan 160 C', source: 'which_oven, hoover_fan, aeg_uk_oven',
      call: "Oven.oven(4, 'gas')", checks: [{ field: 'f', eq: 350 }, { field: 'c', eq: 180 }, { field: 'fanC', eq: 160 }] },
    { group: 'oven', id: 'O4', input: 'gas 1/2', expect: '250 F, 120 C', source: 'hoover_fan, wiki_gas_mark',
      call: "Oven.oven(1/2, 'gas')", checks: [{ field: 'f', eq: 250 }, { field: 'c', eq: 120 }] },
    { group: 'oven', id: 'O5', input: 'gas 9', expect: '475 F, 240 C, fan 220 C', source: 'which_oven, hoover_fan',
      call: "Oven.oven(9, 'gas')", checks: [{ field: 'f', eq: 475 }, { field: 'c', eq: 240 }, { field: 'fanC', eq: 220 }] },
    { group: 'oven', id: 'O6', input: '220 C', expect: 'gas 7, 425 F, fan 200 C', source: 'which_oven, hoover_fan, gbc_conv',
      call: "Oven.oven(220, 'C')", checks: [{ field: 'gas', text: '7' }, { field: 'f', eq: 425 }, { field: 'fanC', eq: 200 }] },
    { group: 'oven', id: 'O7', input: '170 C', expect: 'gas 3-4', source: 'disputed: smeg_uk_oven 3.5, wiki_gas_mark 3',
      call: "Oven.oven(170, 'C')", checks: [{ field: 'gas', text: '3-4' }] },
    { group: 'oven', id: 'O8', input: '325 F', expect: 'dial 160 C', source: 'which_oven, hoover_fan (wiki_gas_mark says 170)',
      call: "Oven.oven(325, 'F')", checks: [{ field: 'c', eq: 160 }] },
    { group: 'oven', id: 'O9', input: '375 F fan', expect: '350 F / 170 C', source: 'ka_convection, which_oven',
      call: "Oven.oven(375, 'F')", checks: [{ field: 'fanF', eq: 350 }, { field: 'fanC', eq: 170 }] },
    { group: 'oven', id: 'O10', input: 'fan, 200 C', expect: '180 C', source: 'hoover_fan',
      call: "Oven.oven(200, 'C')", checks: [{ field: 'fanC', eq: 180 }] },
    { group: 'oven', id: 'O11', input: 'gas 1', expect: '275 F, 140 C', source: 'which_oven, hoover_fan, gbc_conv',
      call: "Oven.oven(1, 'gas')", checks: [{ field: 'f', eq: 275 }, { field: 'c', eq: 140 }] },
    { group: 'oven', id: 'O12', input: 'gas 2.5', expect: 'no result', source: 'not a printed mark',
      call: "Oven.oven(2.5, 'gas')", checks: [{ eq: null }] },
    { group: 'oven', id: 'O13', input: '365 F (off the table)', expect: 'dial 185 C, exact 185.0 C', source: 'off_table_rule',
      call: "Oven.oven(365, 'F')", checks: [{ field: 'c', eq: 185 }, { field: 'exactC', dp: 1, want: 185.0 }] },

    // ── Added by B01: code paths the 63 data tests do not reach. Expected values follow from the data file. ──
    { group: 'b01', id: 'B1', input: '1/3 cup_us -> measurable, full measure set', expect: '⅓ cup', source: 'plain rule, provisional (idea 6)',
      call: "K.measurable(K.volumeMl(1/3, 'cup_us')).text", checks: [{ text: '1/3 cup' }] },
    { group: 'b01', id: 'B2', input: '1/3 cup_metric -> measurable, metric standard', expect: '⅓ cup', source: 'plain rule, provisional (idea 6); 250 mL cup (ca_sfcr_241)',
      call: "K.measurable(K.volumeMl(1/3, 'cup_metric'), { cupStandard: 'metric' }).text", checks: [{ text: '1/3 cup' }] },
    { group: 'b01', id: 'B3', input: '1 cup (metric standard) flour_ap (default)', expect: '137 g', source: 'milkstreet; cup resolved through cup_standard.sets.metric',
      call: "K.toGrams(1, 'cup', 'flour_ap', { cupStandard: 'metric' })", checks: [{ dp: 0, want: 137 }] },
    { group: 'b01', id: 'B4', input: '1 cup_us flour_selfraising (default)', expect: '130 g', source: 'default_follows flour_ap -> milkstreet',
      call: "K.toGrams(1, 'cup_us', 'flour_selfraising')", checks: [{ dp: 0, want: 130 }] },
    { group: 'b01', id: 'B5', input: '1 tsp_us salt_fine_sea (default)', expect: '6.0 g', source: 'same_as salt_table (morton_chart) -> morton_label_table',
      call: "K.toGrams(1, 'tsp_us', 'salt_fine_sea')", checks: [{ dp: 1, want: 6.0 }] },
    { group: 'b01', id: 'B6', input: '1.5 tsp_us salt_dc_baking (default)', expect: '6.0 g', source: 'ratio_to salt_table 1.5 (dc_baking_salt) -> morton_label_table',
      call: "K.toGrams(1.5, 'tsp_us', 'salt_dc_baking')", checks: [{ dp: 1, want: 6.0 }] },
    { group: 'b01', id: 'B7', input: '1 cup_us flour_ap, alias ka', expect: '120 g', source: 'flour_ap aliases -> ka_120 (ka_chart)',
      call: "K.toGrams(1, 'cup_us', 'flour_ap', { convention: 'ka' })", checks: [{ dp: 0, want: 120 }] }

    // ── Added by B02: the parser. Each: typed line, the request fields it must produce, and why. ──
  ].concat([
    pt('P1', '2 c flour', { kind: 'amount', qty: 2, unit: 'cup', ingredient: 'flour_ap', unknown: [] }, 'whole number; "c" is cup; "flour" means all-purpose (K.WORDS)'),
    pt('P2', '1.5 cups sugar', { qty: 1.5, unit: 'cup', ingredient: 'sugar_granulated' }, 'decimal; plural unit; "sugar" means granulated'),
    pt('P3', '1 1/2 cups sugar', { qty: 1.5, qtyText: '1 1/2', unit: 'cup' }, 'mixed number with a space'),
    pt('P4', '1½ tbsp butter', { qty: 1.5, qtyText: '1½', unit: 'tbsp', ingredient: 'butter' }, 'whole number glued to a fraction character'),
    pt('P5', '½ tsp salt', { qty: 0.5, unit: 'tsp', ingredient: 'salt_table' }, 'fraction character alone; plain "salt" means table salt'),
    pt('P6', '2-3 tbsp honey', { qty: 2, qtyText: '2-3', range: [2, 3], unit: 'tbsp', ingredient: 'honey' }, 'range: takes the first amount and notes the range'),
    pt('P7', '1-1/2 cups milk', { qty: 1.5, range: null, unit: 'cup', ingredient: 'milk' }, 'hyphenated mixed number is not a range'),
    pt('P8', '2 to 3 cups flour', { qty: 2, range: [2, 3], target: null, ingredient: 'flour_ap' }, '"to" followed by a number is a range, not a target'),
    pt('P9', '2 T flour', { unit: 'tbsp' }, 'capital T is tablespoon'),
    pt('P10', '2 t salt', { unit: 'tsp' }, 'small t is teaspoon'),
    pt('P11', '250 ml milk', { qty: 250, unit: 'ml', ingredient: 'milk' }, 'millilitres'),
    pt('P12', '1 l water', { unit: 'l', ingredient: 'water' }, 'litres'),
    pt('P13', '100 g butter', { unit: 'g', ingredient: 'butter' }, 'grams; "butter" is not peanut butter (K.WORDS)'),
    pt('P14', '1 kg flour', { unit: 'kg' }, 'kilograms'),
    pt('P15', '4 oz chocolate chips', { unit: 'oz', ingredient: 'chocolate_chips' }, 'ounces; plural ingredient words match the name'),
    pt('P16', '1 lb butter', { unit: 'lb' }, 'pounds'),
    pt('P17', '2 sticks butter', { qty: 2, unit: 'stick', ingredient: 'butter' }, 'sticks'),
    pt('P18', '1 stick', { unit: 'stick', ingredient: 'butter' }, 'a stick with no ingredient means butter, and a note says so'),
    pt('P19', '2 fl oz milk', { unit: 'floz_us', unitText: 'fl oz' }, 'two-word unit, US fluid ounce'),
    pt('P20', '1 metric cup flour', { unit: 'cup_metric', ingredient: 'flour_ap' }, 'cup word picks the 250 mL cup whatever the setting'),
    pt('P21', '1 us cup flour', { unit: 'cup_us' }, 'cup word: US customary cup'),
    pt('P22', '1 label cup oats', { unit: 'cup_us_label', ingredient: 'oats_old_fashioned' }, 'cup word: 240 mL label cup; "oats" matches the name'),
    pt('P23', '1 au tbsp butter', { unit: 'tbsp_au' }, 'cup word: 20 mL Australian tablespoon'),
    pt('P24', '1 cup ap', { ingredient: 'flour_ap' }, '"ap" means all-purpose flour'),
    pt('P25', '1 cup bread flour', { ingredient: 'flour_bread', candidates: ['flour_bread'] }, 'two-word ingredient wins over "flour" alone (longest match)'),
    pt('P26', '1 cup brown sugar', { ingredient: 'sugar_brown' }, 'brown sugar'),
    pt('P27', '1 cup icing sugar', { ingredient: 'sugar_confectioners' }, 'icing sugar'),
    pt('P28', '1 cup powdered sugar', { ingredient: 'sugar_confectioners' }, 'powdered sugar'),
    pt('P29', '1 tsp kosher salt', { ingredient: 'salt_diamond_crystal', candidates: ['salt_diamond_crystal', 'salt_morton_kosher', 'salt_windsor_kosher'] },
      'ambiguous: every kosher salt returned, data-file rank order (Diamond Crystal 34, Morton 35, Windsor unranked)'),
    pt('P30', '2 c flour ka', { convention: 'ka_120', conventionText: 'ka', unknown: [] }, 'author word from the data file aliases'),
    pt('P31', '1 cup flour atk', { convention: 'atk_142' }, 'author word atk'),
    pt('P32', '1 cup flour sally', { convention: 'sallys_125' }, 'author word sally'),
    pt('P33', '1 cup sugar ka', { convention: 'King Arthur' }, 'author word on an ingredient with no aliases: label starts with King Arthur'),
    pt('P34', '1 cup brown sugar sally', { convention: null, unknown: ['sally'] }, 'no Sally\'s value for brown sugar: reported, not guessed'),
    pt('P35', '350f', { kind: 'temp', temp: { scale: 'F', value: 350, fan: false } }, 'Fahrenheit glued to the number'),
    pt('P36', '350 F', { kind: 'temp', temp: { scale: 'F', value: 350, fan: false } }, 'Fahrenheit with a space and capital'),
    pt('P37', '180c', { kind: 'temp', temp: { scale: 'C', value: 180, fan: false } }, 'Celsius: bare c at 20 or more'),
    pt('P38', '2c', { kind: 'amount', unit: 'cup', temp: null }, 'bare c under 20 is cups, and a note says so'),
    pt('P39', 'gas 4', { kind: 'temp', temp: { scale: 'gas', value: 4, fan: false }, qtySpan: [4, 5] }, 'gas mark'),
    pt('P40', 'gas 1/2', { kind: 'temp', temp: { scale: 'gas', value: 0.5, fan: false } }, 'gas mark below 1'),
    pt('P41', 'fan 180c', { kind: 'temp', temp: { scale: 'C', value: 180, fan: true } }, 'fan-oven temperature'),
    pt('P42', '2 c flour > g', { target: { unit: 'g', ingredient: null } }, 'target after >'),
    pt('P43', '100 g butter to tbsp', { unit: 'g', ingredient: 'butter', target: { unit: 'tbsp' } }, 'target after "to"'),
    pt('P44', '1 cup flour in grams', { target: { unit: 'g' } }, 'target after "in"'),
    pt('P45', '1 tsp table salt > diamond', { ingredient: 'salt_table', target: { ingredient: 'salt_diamond_crystal', candidates: ['salt_diamond_crystal', 'salt_dc_baking'] } },
      'ingredient target (salt swap); "diamond" names two salts, both returned'),
    pt('P46', '350°F > °C', { kind: 'temp', target: { scale: 'C' } }, 'degree signs and a scale target (default pin 2)'),
    pt('P47', '2 cups flur', { ingredient: null, unknown: ['flur'], suggest: { flur: ['flour'] } }, 'misspelt word reported with a suggestion, not used'),
    pt('P48', '1 tsp table salt diamond', { ingredient: 'salt_table', unknown: ['diamond'] }, 'second ingredient without > is not understood'),
    pt('P49', '350', { kind: 'number', unit: null }, 'a number alone: asks for a unit'),
    { group: 'parse', id: 'P50', input: 'every ingredient by its full name', expect: 'each resolves to itself only', source: 'alternative buttons rewrite the line with this phrase',
      call: "K.data.ingredients.filter(function (i) { var r = P.parse('1 cup ' + P.canonical(i.id)); return r.ingredient !== i.id || r.candidates.length !== 1; }).map(function (i) { return i.id; }).join(', ') || 'none'",
      checks: [{ text: 'none' }] },
    { group: 'parse', id: 'P51', input: 'pin templates', expect: '# c flour > g | gas # | # tbsp > mL', source: 'long-press pins the line with its amount as #',
      call: "[P.template(P.parse('2 c flour > g')), P.template(P.parse('gas 4')), P.template(P.parse('flour')).replace('# flour', 'x'), P.fill('# tbsp > mL', '1')].join(' | ')",
      checks: [{ text: '# c flour > g | gas # | x | 1 tbsp > mL' }] },

    // ── Added by B02: end to end. Typed line in, the text the screen shows out (answer.js, as app.js draws it). ──
    et('E1', '2 c flour', '260 g', 'milkstreet (F1)', { assume: 'All-purpose / plain flour · 130 g per US cup' }),
    et('E2', '350f', '180°C', 'which_oven, ka_convection (O1)', { sub: 'exact 176.7°C · gas 4 · fan 325°F / 160°C' }),
    et('E3', 'gas 4', '350°F · 180°C', 'which_oven (O3)', { sub: 'fan 325°F / 160°C' }),
    et('E4', '1 stick butter', '113 g', 'usda_hg72 (I15)', { assume: '1 stick = ½ US cup' }),
    et('E5', '2 c flour ka', '240 g', 'ka_chart (F2)', { assume: 'King Arthur, spooned' }),
    et('E6', '1 tsp table salt > diamond', '2⅛ tsp Diamond Crystal kosher salt', 'labels (S5)', { sub: '2.143 tsp · 6.0 g · equal weight', alts: 'Diamond Crystal Baking Salt' }),
    et('E7', '1 metric cup flour', '137 g', 'milkstreet, ca_sfcr_241 (F4)', { assume: 'metric cup (250 mL)' }),
    et('E8', 'fan 180c', '375°F fan', 'which_oven pair 200°C = 400°F, fan drops ka_convection and hoover_fan', { sub: 'conventional 200°C · 400°F · gas 6' }),
    et('E9', 'gas 1/2', '250°F · 120°C', 'hoover_fan, wiki_gas_mark (O4)', {}),
    et('E10', '180c', '350°F', 'which_oven (O2)', { notes: 'read as °C' }),
    et('E11', '2 c brown sugar', '440 g', 'usda_hg72: 220 g per cup packed (I3)', {}),
    et('E12', '100 g butter to tbsp', '7 tbsp + ¼ tsp', 'usda_hg72: 113 g per ½ cup; measurable rule provisional', { sub: '7.08 tbsp' }),
    et('E13', '260 g flour > cups', '2 cups', 'milkstreet (F11)', { sub: '2.00 cups' }),
    et('E14', '1 tsp kosher salt', '2.8 g', 'dc_sellsheet (S3); ambiguity shown', { alts: 'Morton kosher salt, Windsor kosher salt (Canada)', notes: 'could be 3' }),
    et('E15', '2 cups flur', '473 mL', 'nist_hb44_c; flur not used', { notes: 'Not understood: flur (flour?)', warn: true }),
    et('E16', '1½ cups sugar', '300 g', 'usda_hg72: 200 g per cup (I2)', {}),
    et('E17', '2-3 tbsp honey', '42 g', 'usda_hg72: 339 g per cup; first amount of the range', { notes: 'Range 2-3' }),
    et('E18', '1 tbsp', '14.8 mL', 'nist_hb44_c (U7)', {}),
    et('E19', '2 eggs', '100 g', 'usda_hg72: 50 g each', {}),
    et('E20', '1 T salt', '18 g', 'morton_label_table (S1)', {}),
    et('E21', '1 t salt', '6.0 g', 'morton_label_table: 1.5 g per ¼ tsp', {}),
    et('E22', '1 tsp table salt > morton', '1¼ tsp Morton kosher salt', 'labels (S4)', {}),
    et('E23', '1 au tbsp butter', '19 g', 'aww_conversions 20 mL; usda_hg72 butter', {}),
    et('E24', 'gas 2.5', '', 'not a printed mark (O12)', { notes: 'not a printed gas mark', warn: true }),
    et('E25', '1 cup bread flour atk', '137 g', 'milkstreet default; ATK has no bread flour value', { notes: 'no atk value', warn: true }),
    et('E26', '2 cups flour > g', '260 g', 'default pin 1', {}),
    et('E27', '350°F > °C', '180°C', 'default pin 2', {}),
    et('E28', '1 tbsp > mL', '14.8 mL', 'default pin 3', {}),
    et('E29', '1 sticks butter > g', '113 g', 'default pin 4', {}),

    // ── Added by D01: answers changed in answer.js. Values from the sources named; the wording is display only. ──
    et('D1', '300 g butter > sticks', '2.65 sticks', 'usda_hg72: 113 g per ½ cup = 1 stick (I15); was shown in cups', { sub: '21.2 tbsp' }),
    et('D2', '113 g butter > sticks', '1 stick', 'usda_hg72: 113 g per stick', { sub: '8 tbsp' }),
    et('D3', '57 g butter > sticks', '½ stick', 'usda_hg72; whole, half and quarter sticks within 1% read as fractions', {}),
    et('D4', '1 cup sugar > sticks', '', 'sticks are butter only', { notes: 'Sticks are for butter only', warn: true }),
    et('D5', '350 g sugar', '1¾ cups', 'usda_hg72: 200 g per cup; 1 cup + ½ cup + ¼ cup now reads as one mixed number', { sub: '1.75 cups' }),
    et('D6', '300 g flour', '2¼ cups + 2¾ tsp', 'milkstreet 130 g per cup; same measures as before, cups joined', { sub: '2.31 cups' }),
    et('D7', '180 g sugar', '½ cup + ⅓ cup + 1 tbsp + ¼ tsp', 'usda_hg72; ½ + ⅓ cup has no single fraction, so it stays as two', {}),

    // ── Added by D01: likely.js, what a typed line most likely means. Ranking rules are judgment (likely.js);
    //    every number shown comes from the sources already tested above. Format "label = big answer". ──
    lt('L1', '350', '350°F = 180°C', 'typical dial value (325–450°F) beats a weight; which_oven pair (O1)'),
    lt('L2', '180', '180°C = 350°F', 'typical °C dial value; which_oven pair (O2)'),
    lt('L3', '200', '200°C = 400°F', 'typical °C dial value beats 200 g; which_oven pair 200°C = 400°F'),
    lt('L4', '300', '300 g flour = 2¼ cups + 2¾ tsp', '300°F is not a typical dial value, so the weight wins; milkstreet 130 g per cup'),
    lt('L5', '2', '2 cups flour = 260 g', 'cups flour is the most common conversion; milkstreet (F1)'),
    lt('L6', '½', '½ cup flour = 65 g', 'a typed fraction is never grams, mL or a temperature; milkstreet'),
    lt('L7', '1 1/2', '1 1/2 cups flour = 195 g', 'mixed number with a slash; milkstreet'),
    lt('L8', '350 f', '350°F = 180°C', 'one letter that starts a unit means that unit, not "flour"', { list: 1 }),
    lt('L9', '2 f', '2 fl oz = 59.1 mL', '"f" is a unit letter; 2°F is not an oven setting, so fl oz; nist_hb44_c 29.57 mL'),
    lt('L10', '2 s', '2 sticks butter = 226 g', '"s" is a unit letter (stick); usda_hg72'),
    lt('L11', '2 su', '2 cups sugar = 400 g', 'two letters may name an ingredient; usda_hg72 200 g per cup'),
    lt('L12', '100 b', '100 g butter = 0.88 sticks', '"b" starts no unit, so it may name an ingredient; usda_hg72'),
    lt('L13', '2 c', '2 cups = 473 mL', 'exact reading (parser: c under 20 is cups); nist_hb44_c', { has: '2 cups flour = 260 g' }),
    lt('L14', '180 c', '180°C = 350°F', 'exact reading (parser: c at 20 or more is °C)'),
    lt('L15', '1 t', '1 tsp = 4.9 mL', 'exact reading (parser: small t is tsp); tbsp still listed', { has: '1 tbsp = 14.8 mL' }),
    lt('L16', '2 c flour', '2 cups flour = 260 g', 'exact reading first; the same flour in ounces is listed, and "2 cups flour = 260 g" only once', { has: '2 cups flour = 9.2 oz', count: ['2 cups flour = 260 g', 1] }),
    lt('L17', 'gas 4', 'gas 4 = 350°F · 180°C', 'exact reading; which_oven'),
    lt('L18', '350°', '350°F = 180°C', 'a degree sign keeps only temperatures; 350°C is past the 290°C range', { list: 1 }),
    lt('L19', '250 m', '250 mL = 1 cup + 2¾ tsp', '"m" is a unit letter (mL); nist_hb44_c'),
    lt('L20', '200', '200 g flour = 1½ cups + 1⅞ tsp', 'after tapping "200 g flour" once for 200, it comes first for 200', { picks: { 'g flour>cup@200': 1, 'g flour>cup': 1 } }),
    lt('L30', '20½', '20½ oz = 581 g', 'a typed fraction is never read as grams (else 20½ g flour would lead); nist oz 28.35 g'),
    lt('L21', '350', '350°F = 180°C', 'a tap for 200 does not move 350', { picks: { 'g flour>cup@200': 1, 'g flour>cup': 1 } }),
    { group: 'likely', id: 'L22', input: 'tile "# cups flour > g", 300, mode A (as pinned)', expect: '300 cups flour = 39000 g, plausibility 0',
      source: 'Justin\'s version: the typed number goes into the tile as pinned', call: "H.tile('# cups flour > g', '300', 'A')", checks: [{ text: '300 cups flour = 39000 g · 0' }] },
    { group: 'likely', id: 'L23', input: 'tile "# cups flour > g", 300, mode B (most likely way)', expect: '300 g flour = 2¼ cups + 2¾ tsp',
      source: 'the reverse of the tile when the number fits it better', call: "H.tile('# cups flour > g', '300', 'B')", checks: [{ has: '300 g flour = 2¼ cups + 2¾ tsp' }] },
    { group: 'likely', id: 'L24', input: 'tile "#°F > °C", 180, mode B', expect: '180°C = 350°F', source: 'which_oven (O2)',
      call: "H.tile('#°F > °C', '180', 'B')", checks: [{ has: '180°C = 350°F' }] },
    { group: 'likely', id: 'L25', input: 'tile "#°F > °C", 350, mode B', expect: '350°F = 180°C (pinned way kept)', source: 'which_oven (O1)',
      call: "H.tile('#°F > °C', '350', 'B')", checks: [{ has: '350°F = 180°C' }] },
    { group: 'likely', id: 'L26', input: 'tile "# sticks butter > g", 113, mode B', expect: '113 g butter = 1 stick', source: 'usda_hg72',
      call: "H.tile('# sticks butter > g', '113', 'B')", checks: [{ has: '113 g butter = 1 stick' }] },
    { group: 'likely', id: 'L27', input: 'tile "# tbsp > mL", 30, mode B', expect: '30 mL = 2 tbsp + ⅛ tsp', source: 'nist_hb44_c 14.79 mL per tbsp',
      call: "H.tile('# tbsp > mL', '30', 'B')", checks: [{ has: '30 mL = 2 tbsp + ⅛ tsp' }] },
    { group: 'likely', id: 'L28', input: 'reverse of three templates', expect: '# g flour ka > cups | # g kosher salt > tsp | none',
      source: 'reverse keeps the typed ingredient and author words; gas has no reverse',
      call: "[H.L.reverse('# cups flour ka > g'), H.L.reverse('# tsp kosher salt'), H.L.reverse('gas #') || 'none'].join(' | ')",
      checks: [{ text: '# g flour ka > cups | # g kosher salt > tsp | none' }] },
    { group: 'likely', id: 'L29', input: 'every template, filled with 2', expect: 'none has a word the parser does not know',
      source: 'templates are typed lines, so the tested parser and answer code do all the work',
      call: "H.L.TEMPLATES.filter(function (t) { return P.parse(P.fill(t[1], '2')).unknown.length; }).map(function (t) { return t[0]; }).join(', ') || 'none'",
      checks: [{ text: 'none' }] }
  ]);

  function pt(id, line, want, why) {
    return { group: 'parse', id: id, input: line, expect: JSON.stringify(want), source: why,
             call: 'P.parse(' + JSON.stringify(line) + ')', checks: [{ sub: want }] };
  }
  function lt(id, line, top, source, more) { // D01: the big answer, and optionally the list
    more = more || {};
    var checks = [{ field: 'top', text: top }];
    if (more.has) checks.push({ field: 'list', has: more.has });
    if (more.list != null) checks.push({ field: 'n', eq: more.list });
    if (more.count) checks.push({ field: 'list', count: more.count });
    return { group: 'likely', id: id, input: line + (more.picks ? ' (after taps ' + JSON.stringify(more.picks) + ')' : ''),
             expect: top + (more.has ? '; listed: ' + more.has : '') + (more.list != null ? '; ' + more.list + ' row(s)' : ''),
             source: source, call: 'H.likely(' + JSON.stringify(line) + ', ' + JSON.stringify(more.picks || null) + ')', checks: checks };
  }
  function et(id, line, main, source, more) {
    var checks = [{ field: 'main', text: main }];
    Object.keys(more).forEach(function (k) { checks.push(k === 'warn' ? { field: 'warn', eq: more[k] } : { field: k, has: more[k] }); });
    return { group: 'e2e', id: id, input: line, expect: main + Object.keys(more).map(function (k) { return '; ' + k + ' ' + more[k]; }).join(''),
             source: source, call: 'H.e2e(' + JSON.stringify(line) + ')', checks: checks };
  }

  // Helpers the calls may use. H.top and H.second read the core's first and second answer
  // exactly as the live app shows them: number, space, unit label.
  function helpers(env) {
    function ans(s, i) { var r = env.UC.rows(env.UC.parse(s))[i]; return r.show + (r.unit ? ' ' + r.unit : ''); }
    return {
      top: function (s) { return ans(s, 0); },
      second: function (s) { return ans(s, 1); },
      // the text app.js draws for a typed line
      e2e: function (line) {
        var a = env.A.show(line);
        return { main: a.main, sub: a.sub, assume: a.assumption.join(' | '), notes: a.notes.join(' | '),
                 alts: a.alts.map(function (x) { return x.name; }).join(', '), warn: a.warn };
      },
      // D01: what likely.js puts first for a typed line, and every row ("label = answer")
      likely: function (line, picks) {
        var r = env.L.rank(line, { picks: picks || undefined });
        var rows = r.list.map(function (c) { return c.label + ' = ' + c.answer.main; });
        return { top: rows[0] || '', list: rows.join(' | '), n: rows.length };
      },
      tile: function (tpl, qty, mode) {
        var t = env.L.tile(tpl, qty, mode);
        return t.label + ' = ' + t.answer.main + (t.plaus === 0 ? ' · 0' : '');
      },
      L: env.L,
      SPOONS: ['tbsp', 'tsp', '1/2 tsp', '1/4 tsp', '1/8 tsp']
    };
  }

  var FRAC = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
  function norm(s) {
    return String(s).replace(/(\d?)([½⅓⅔¼¾⅛⅜⅝⅞])/g, function (_, d, f) { return (d ? d + ' ' : ' ') + FRAC[f]; })
      .replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function show(x) {
    if (x === null) return 'no result';
    if (typeof x === 'number') return String(+x.toPrecision(15));
    return String(x);
  }

  // Every field in want must equal the same field in got; nested objects are compared the same way,
  // arrays and plain values exactly. Returns the fields that differ.
  function subset(want, got, path) {
    var miss = [];
    Object.keys(want).forEach(function (k) {
      var w = want[k], g = got == null ? undefined : got[k], p = (path ? path + '.' : '') + k;
      if (w && typeof w === 'object' && !Array.isArray(w)) miss = miss.concat(g && typeof g === 'object' ? subset(w, g, p) : [p + ' got ' + JSON.stringify(g)]);
      else if (JSON.stringify(w) !== JSON.stringify(g === undefined ? null : g)) miss.push(p + ' got ' + JSON.stringify(g));
    });
    return miss;
  }

  function check(c, answer) {
    var v = c.field ? (answer == null ? undefined : answer[c.field]) : answer, ok, got;
    if ('rel' in c) { ok = typeof v === 'number' && Math.abs(v - c.rel) <= 1e-9 * Math.abs(c.rel); got = show(v); }
    else if ('dp' in c) { got = typeof v === 'number' ? v.toFixed(c.dp) : show(v); ok = got === c.want.toFixed(c.dp); }
    else if ('text' in c) { got = show(v); ok = norm(got) === norm(c.text); }
    else if ('has' in c) { got = show(v); ok = norm(got).indexOf(norm(c.has)) >= 0; }
    else if ('count' in c) { got = show(v); ok = norm(got).split(norm(c.count[0])).length - 1 === c.count[1]; got = '"' + c.count[0] + '" ×' + (norm(got).split(norm(c.count[0])).length - 1); }
    else if ('sub' in c) { var miss = subset(c.sub, v); ok = !miss.length; got = ok ? 'all fields match' : miss.join('; '); }
    else { got = show(v); ok = v === c.eq; }
    return { ok: ok, got: (c.field ? c.field + ' ' : '') + got };
  }

  // env: { K, UC, Oven, P, A, L }. opts.groups: run only these groups.
  function run(env, opts) {
    opts = opts || {};
    var H = helpers(env);
    return TESTS.filter(function (t) { return !opts.groups || opts.groups.indexOf(t.group) >= 0; }).map(function (t) {
      var r = { group: t.group, id: t.id, input: t.input, expect: t.expect, source: t.source, call: t.call, note: t.note || '' };
      if (t.pending) { r.status = 'PENDING'; r.got = ''; r.reason = t.pending; return r; }
      try {
        var answer = new Function('K', 'UC', 'Oven', 'H', 'P', 'A', '"use strict"; return (' + t.call + ');')(env.K, env.UC, env.Oven, H, env.P, env.A);
        var res = t.checks.map(function (c) { return check(c, answer); });
        r.got = res.map(function (x) { return x.got; }).join('; ');
        r.status = res.every(function (x) { return x.ok; }) ? 'PASS' : 'FAIL';
      } catch (e) { r.status = 'FAIL'; r.got = 'error: ' + e.message; }
      return r;
    });
  }

  function count(results) {
    var n = { PASS: 0, FAIL: 0, PENDING: 0 };
    results.forEach(function (r) { n[r.status]++; });
    return n;
  }

  var api = { TESTS: TESTS, run: run, count: count, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KCTests = api;

  // node tests.js : run every test against the files in this folder
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var path = require('path'), dir = __dirname;
    var env = {
      UC: require(path.join(dir, 'core.js')),
      Oven: require(path.join(dir, 'oven.js')),
      K: require(path.join(dir, 'kitchen.js')).create(require(path.join(dir, 'conversion-data.json')))
    };
    env.P = require(path.join(dir, 'parse.js')).create(env.K);
    env.A = require(path.join(dir, 'answer.js')).create(env.K, env.Oven, env.P);
    env.L = require(path.join(dir, 'likely.js')).create(env.K, env.P, env.A);
    var results = run(env);
    results.forEach(function (r) {
      console.log((r.status + '   ').slice(0, 8) + (r.id + '    ').slice(0, 5) + r.input + '  |  expect ' + r.expect + '  |  got ' + r.got + (r.reason ? '  |  ' + r.reason : ''));
    });
    var n = count(results);
    console.log('\n' + results.length + ' tests: ' + n.PASS + ' pass, ' + n.FAIL + ' fail, ' + n.PENDING + ' pending');
    process.exitCode = n.FAIL ? 1 : 0;
  }
})(this);
