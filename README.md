# kitchen-converter

Working name. The public name and web address are chosen before launch (see `claude/results/T08-one-app-or-two.md` in the Baking App project). Until then the repo is `justinramsden/kitchen-converter`.

A kitchen unit converter for the phone: cups, spoons, grams and oven temperatures, with every ingredient result showing the weight it assumed. This is build step 1: the maths and its tests. There is no app screen yet.

## Files

| File | What it is |
| --- | --- |
| `core.js` | The unit core (`UC`) from Fast_Conversion, copied unchanged from commit 46749ad. Parses what you type and converts lengths, volumes, weights, temperatures and more. Change it in Fast_Conversion first, then copy it again. |
| `conversion-data.json` | Every unit constant and ingredient weight, each with its source and a verified flag, plus 63 known-answer tests. Copied unchanged from the Baking App project. |
| `oven.js` | Oven row: dial and exact °F/°C, gas marks, fan drop. From task T07, unchanged. |
| `kitchen.js` | Ingredient maths: cups to grams and back for any cup standard, salt swaps by weight, butter sticks, and measurable cups and spoons (provisional until idea 6 reports). No page code. |
| `tests.js` | Every test as data, so the computer and the phone run the same list. |
| `tests.html` | Runs every test and shows PASS, FAIL or PENDING, with the count at the top. Also lists the offline caches it can see. |

Basic idea: the app's maths lives in plain functions with no screen code, so the same test list can run on a computer and on a phone before any button exists.

## Run the tests

On the phone: open `https://justinramsden.github.io/kitchen-converter/tests.html`. The count at the top should read 0 fail. It must be opened from that web address, not as a downloaded file, because it loads `conversion-data.json` over the web.

On a computer with Node: `node tests.js`.

## Rules

- Plain HTML, CSS and JavaScript. No build step, no libraries.
- Saved-data keys start with `kc-`. Offline caches start with `kitchen-`.
- Defaults are the conventions marked `"default": true` in `conversion-data.json`. Every function takes an argument that overrides them.
- Any change to conversion code or data comes with known-answer tests.
