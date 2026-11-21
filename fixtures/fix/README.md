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

`reach/` is not a class. `reach/page/` plants ten short last lines, each where `text-wrap` may or may not be
written, and one size off the scale, and `reach/twin/` is the page as `itten fix` must leave it:

- one of five `.note` blocks: guided, the rule reaches four without the finding (the allowance is 2);
- a block only the universal rule matches: guided, and `base.css` is not edited;
- one of two `.pair` blocks: written on `.pair`, within the allowance;
- a line that wraps only under `@media (max-width: 480px)`: written inside that media query;
- a block seen at every width whose last rule is inside a media query: written on its base rule;
- a block whose only rule is inside a media query: guided;
- a block whose only rule is nested (`& > div`), a selector the page cannot be asked on its own: guided, its
  reach unknown;
- a size one step off the type scale, set by a nested rule: guided, though the step is known, since the reach
  of the rule that holds the value cannot be read;
- two `.dup` blocks, the second with a narrower rule of its own: written once on `.dup`, the second `covered`;
- a table cell holding a sentence: a finding, written on its class. The cells that hold one number or one word
  are decoys and must not be reported.

The control: with no allowance, the block among five is planned.
