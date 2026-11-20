# kitchen-converter

Working name. The public name and web address are chosen before launch (see `claude/results/T08-one-app-or-two.md` in the Baking App project). Until then the repo is `justinramsden/kitchen-converter`.

A kitchen unit converter for the phone: cups, spoons, grams and oven temperatures, with every ingredient result showing the weight it assumed. Build steps 1 to 3 are in: the maths and its tests, the parser, and the first screen with pinned rows. Not yet: offline, chips, ingredient picker, recent list, scale.

Open it: `https://justinramsden.github.io/kitchen-converter/`

Trial screen (D01), beside the main one: `https://justinramsden.github.io/kitchen-converter/one.html`. One yellow box: type a number and the most likely conversion shows at once, the pinned tiles fill with the same number, and other meanings are listed under them. Tap any row to make it the answer. Letters after the number narrow it (`350 f`, `2 c`, `100 b`). The tiles can take the number as pinned (version A) or run whichever way the number fits (version B); a switch above them picks.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `app.css`, `app.js` | The screen: the type-anything line with a live result, and pinned rows. Page code only. |
| `one.html`, `one.css`, `one.js` | The one-field trial screen (D01). Shares the pinned tiles (`kc-pins`) with the main screen; its own keys start `kc1-`. Page code only. |
| `likely.js` | What a typed line most likely means (D01): ranks conversion templates by how common they are, how plausible the number is in each unit, and which rows this person tapped before. Also fills a pinned tile with the typed number, as pinned or the more plausible way round. Every weight is judgment, kept at the top of the file. No page code. |
| `parse.js` | Reads one typed line (`2 c flour ka`, `gas 1/2`, `1 tsp table salt > diamond`) into a request. Returns every candidate for an ambiguous word and every word it did not understand. No page code. |
| `answer.js` | Turns a request into the text the screen shows, using `kitchen.js` and `oven.js`. No page code, so the tests check the exact text a person reads. |
| `kitchen.js` | Ingredient maths: cups to grams and back for any cup standard, salt swaps by weight, butter sticks, measurable cups and spoons (provisional until idea 6 reports). Also the short list of typed ingredient words (`flour`, `ap`, `icing sugar`…) and author words (`ka`, `atk`, `sally`). |
| `oven.js` | Oven maths: dial and exact °F/°C, gas marks, fan drop. From task T07. |
| `core.js` | The unit core (`UC`) from Fast_Conversion, copied unchanged from commit 46749ad. Used by the tests only for now. Change it in Fast_Conversion first, then copy it again. |
| `conversion-data.json` | Every unit constant and ingredient weight, each with its source and a verified flag, plus 63 known-answer tests. Copied unchanged from the Baking App project. |
| `tests.js` | Every test as data, so the computer and the phone run the same list. |
| `tests.html` | Runs every test and shows PASS, FAIL or PENDING, with the count at the top. |

Basic idea: the maths, the reading and the wording live in plain functions with no screen code, so the same test list runs on a computer and on a phone, and the screen only draws what those functions return.

## Run the tests

On the phone: open `https://justinramsden.github.io/kitchen-converter/tests.html`. The count at the top should read 0 fail. It must be opened from that web address, not as a downloaded file, because it loads `conversion-data.json` over the web.

On a computer with Node: `node tests.js`.

## Rules

- Plain HTML, CSS and JavaScript. No build step, no libraries.
- Saved-data keys start with `kc-` (`kc-line`, `kc-pins`); the trial screen's own start with `kc1-`. Offline caches will start with `kitchen-`.
- Defaults are the conventions marked `"default": true` in `conversion-data.json`. Every function takes an argument that overrides them.
- The four default pinned rows are provisional until idea 4 reports.
- Any change to conversion code or data comes with known-answer tests.
