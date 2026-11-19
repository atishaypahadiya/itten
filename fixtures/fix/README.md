# Fix fixtures

One folder per class of fix that `itten fix` writes (`inspector/fix.js`). Each has:

- `before/`: the page with the defect planted;
- `twin/`: the page as `itten fix` must leave it, written by hand.

`scripts/fix-test.js` copies `before/` beside `base.css` and the text font, serves it on 127.0.0.1, and runs
`itten fix`. It passes when the fixed files equal `twin/` byte for byte, inspecting the fixed page again reports
nothing of that class and nothing new, and a second `itten fix` changes nothing.

`planted/` is a page with a value off the spacing scale, and `planted/fixes.json` holds two fixes written to fail:
one leaves its finding, and one clears it but brings an overflow. Given with `--apply`, both must be reverted, the
page left as it was, and both reported.
