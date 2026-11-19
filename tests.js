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
    { group: 'flour', id: 'F11', input: '260 g flour_ap -> cup_us (default)', expect: '2 cups', source: 'milkstreet',
      call: "K.fromGrams(260, 'cup_us', 'flour_ap')", checks: [{ dp: 0, want: 2 }] },
    { group: 'flour', id: 'F12', input: '300 g flour_ap -> cup_metric, aww_150', expect: '2 cups', source: 'aww',
      call: "K.fromGrams(300, 'cup_metric', 'flour_ap', { convention: 'aww_150' })", checks: [{ dp: 0, want: 2 }] },
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
  ];

  // Helpers the calls may use. H.top and H.second read the core's first and second answer
  // exactly as the live app shows them: number, space, unit label.
  function helpers(env) {
    function ans(s, i) { var r = env.UC.rows(env.UC.parse(s))[i]; return r.show + (r.unit ? ' ' + r.unit : ''); }
    return {
      top: function (s) { return ans(s, 0); },
      second: function (s) { return ans(s, 1); },
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

  function check(c, answer) {
    var v = c.field ? (answer == null ? undefined : answer[c.field]) : answer, ok, got;
    if ('rel' in c) { ok = typeof v === 'number' && Math.abs(v - c.rel) <= 1e-9 * Math.abs(c.rel); got = show(v); }
    else if ('dp' in c) { got = typeof v === 'number' ? v.toFixed(c.dp) : show(v); ok = got === c.want.toFixed(c.dp); }
    else if ('text' in c) { got = show(v); ok = norm(got) === norm(c.text); }
    else { got = show(v); ok = v === c.eq; }
    return { ok: ok, got: (c.field ? c.field + ' ' : '') + got };
  }

  // env: { K, UC, Oven }. opts.groups: run only these groups.
  function run(env, opts) {
    opts = opts || {};
    var H = helpers(env);
    return TESTS.filter(function (t) { return !opts.groups || opts.groups.indexOf(t.group) >= 0; }).map(function (t) {
      var r = { group: t.group, id: t.id, input: t.input, expect: t.expect, source: t.source, call: t.call, note: t.note || '' };
      if (t.pending) { r.status = 'PENDING'; r.got = ''; r.reason = t.pending; return r; }
      try {
        var answer = new Function('K', 'UC', 'Oven', 'H', '"use strict"; return (' + t.call + ');')(env.K, env.UC, env.Oven, H);
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
    var results = run(env);
    results.forEach(function (r) {
      console.log((r.status + '   ').slice(0, 8) + (r.id + '    ').slice(0, 5) + r.input + '  |  expect ' + r.expect + '  |  got ' + r.got + (r.reason ? '  |  ' + r.reason : ''));
    });
    var n = count(results);
    console.log('\n' + results.length + ' tests: ' + n.PASS + ' pass, ' + n.FAIL + ' fail, ' + n.PENDING + ' pending');
    process.exitCode = n.FAIL ? 1 : 0;
  }
})(this);
