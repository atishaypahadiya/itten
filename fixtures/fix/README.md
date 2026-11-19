# Fix fixtures

One folder per class of fix that `itten fix` writes (`inspector/fix.js`). Each has:

- `before/`: the page with the defect planted;
- `twin/`: the page as `itten fix` must leave it, written by hand.

`scripts/fix-test.js` copies `before/` beside `base.css` and the text font, serves it on 127.0.0.1, and runs
`itten fix`. It passes when the fixed files equal `twin/` byte for byte, inspecting the fixed page again reports
nothing of that class and nothing new, and a second `itten fix` changes nothing.

`to-step/` has a padding and a font size one pixel off the scale, each with exactly one step within the tolerance (`spacing.tolerance` and `type.tolerance` in the system file, 1 px by default): both are moved to that step, in the unit they are written in.

`planted/` is a page with a value off the spacing scale and no step within the tolerance (14 px between 12 and 16), so its own fix is guided, and `planted/fixes.json` holds two fixes written to fail:
one leaves its finding, and one clears it but brings an overflow. Given with `--apply`, both must be reverted, the
page left as it was, and both reported.
