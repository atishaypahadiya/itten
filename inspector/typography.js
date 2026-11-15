// Runs inside the page through page.evaluate. It must stay self-contained:
// no imports and no references to anything outside this function.
//
// Typographic finish, measured on the rendered lines of each text block.
// A text block is a visible element whose children are all inline, with
// text of its own. Its lines are read word by word from the layout, so a
// paragraph split across columns, a hyphenated word and a forced break are
// all seen as the reader sees them. Where a check asks whether a property
// would help (text-wrap: balance or pretty, hyphens: auto), the property is
// set on the element for a moment, the lines are read again, and the
// element is put back as it was.
//
// Returns { issues, optical }: findings in the same shape as collect.js,
// and the display-type candidates whose glyph edges inspect.js measures
// from pixels.

export function typography(opts) {
  const want = new Set(opts.checks || []);
  const system = opts.system || null;
  const sx = window.scrollX, sy = window.scrollY;
  const issues = [], optical = [];
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  const pct = (v) => Math.round(v * 100);

  // Selectors and labels, as collect.js makes them, so findings merge.
  const selCache = new Map();
  const sel = (el) => {
    if (selCache.has(el)) return selCache.get(el);
    let s;
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && document.querySelectorAll('#' + el.id).length === 1) s = '#' + el.id;
    else if (el === document.documentElement) s = 'html';
    else if (el === document.body) s = 'body';
    else {
      const p = el.parentElement, tag = el.localName;
      let part = tag;
      if (p) {
        const same = [...p.children].filter((c) => c.localName === tag);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
      }
      s = (p ? sel(p) + ' > ' : '') + part;
    }
    selCache.set(el, s);
    return s;
  };
  const label = (el) => {
    let t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (t.length > 40) t = t.slice(0, 39) + '…';
    const cls = el.classList && el.classList[0] ? '.' + el.classList[0] : '';
    return el.localName + cls + (t ? ` "${t}"` : '');
  };
  const P = (q) => [r2(q.left + sx), r2(q.top + sy), r2(q.width), r2(q.height)];
  const live = (el, check) => {
    const h = el.closest('[data-itten-ignore]');
    if (!h) return true;
    const v = h.getAttribute('data-itten-ignore').split(/\s+/);
    return !v.includes(check) && !v.includes('all');
  };
  const report = (check, severity, el, message, marks = []) => issues.push({
    check, severity, key: sel(el), message, count: 1,
    elements: [{ sel: sel(el), label: label(el), rect: P(el.getBoundingClientRect()) }], marks, crop: marks.length ? 'marks' : 'union',
  });

  // ------------------------------------------------------------ text blocks
  const GRAPHIC = 'svg, canvas, img, video, picture, iframe, object, embed, math, audio, [role="img"]';
  const SKIP = new Set(['script', 'style', 'template', 'noscript', 'textarea', 'select', 'option', 'input', 'button', 'pre', 'code']);
  const inGraphic = (el) => !!el.closest(GRAPHIC) || (!!el.closest('figure') && !el.closest('figcaption'));
  const blocks = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (SKIP.has(el.localName) || blocks.length >= 800) continue;
    const s = getComputedStyle(el);
    if (!/^(block|list-item|flow-root|table-cell|table-caption)$/.test(s.display)) continue;
    if (s.visibility !== 'visible' || !el.getClientRects().length) continue;
    // Only leaf blocks: every child inline, and some text directly or in an inline child.
    if ([...el.children].some((c) => !/^(inline|contents|none)$/.test(getComputedStyle(c).display) && c.localName !== 'br')) continue;
    if (!(el.innerText || '').trim()) continue;
    if (inGraphic(el)) continue;
    blocks.push({ el, s });
  }

  // The words of a block, in reading order, as rects; and where the text
  // breaks by force (<br>). Atomic inlines (inline-block and the like) are
  // skipped: their insides are a block of their own.
  const range = document.createRange();
  const words = (el) => {
    const out = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.nodeType === 1) {
          if (n.localName === 'br') return NodeFilter.FILTER_ACCEPT;
          const d = getComputedStyle(n).display;
          return d === 'none' || /^inline-/.test(d) || SKIP.has(n.localName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let n = walker.nextNode(); n && out.length < 600; n = walker.nextNode()) {
      if (n.nodeType === 1) { if (out.length) out.at(-1).brAfter = true; continue; }
      const re = /\S+/g;
      let m;
      while ((m = re.exec(n.data)) && out.length < 600) {
        range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
        const rects = [...range.getClientRects()].filter((q) => q.width > 0 && q.height > 0);
        rects.forEach((q, i) => out.push({ text: m[0], left: q.left, right: q.right, top: q.top, bottom: q.bottom, piece: i, node: n, start: m.index }));
      }
    }
    return out;
  };
  // Lines from word rects: a new line when the vertical centre moves by more
  // than half the font size, down to the next line or up to a new column.
  const lines = (el, fs) => {
    const ws = words(el), out = [];
    for (const w of ws) {
      const c = (w.top + w.bottom) / 2;
      const L = out.at(-1);
      if (L && Math.abs(c - L.c) < fs / 2) {
        L.left = Math.min(L.left, w.left); L.right = Math.max(L.right, w.right); L.words.push(w);
        if (w.brAfter) L.forced = true;
      } else out.push({ c, left: w.left, right: w.right, top: w.top, bottom: w.bottom, words: [w], forced: !!w.brAfter });
    }
    for (const L of out) { L.top = Math.min(...L.words.map((w) => w.top)); L.bottom = Math.max(...L.words.map((w) => w.bottom)); }
    return out;
  };
  const content = (el, s) => {
    const q = el.getBoundingClientRect();
    const left = q.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
    const right = q.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight);
    return { left, right, width: right - left };
  };
  // Set some properties for a moment, run fn, and put the element back.
  const withStyle = (el, props, fn) => {
    const saved = Object.keys(props).map((k) => [k, el.style.getPropertyValue(k), el.style.getPropertyPriority(k)]);
    for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v, 'important');
    try { return fn(); } finally {
      for (const [k, v, p] of saved) { if (v) el.style.setProperty(k, v, p); else el.style.removeProperty(k); }
      if (!el.getAttribute('style')) el.removeAttribute('style');
    }
  };
  // Plain wrapping computes as auto (or stable); balance and pretty are the two that rebalance lines.
  const wrapStyle = (s) => { const v = s.textWrapStyle || s.textWrap || 'auto'; return /balance|pretty/.test(v) ? v.match(/balance|pretty/)[0] : 'plain'; };
  const hyphenated = (el, s) => s.hyphens === 'auto' && !!(el.closest('[lang]')?.getAttribute('lang') || '').trim();
  const ragged = (s) => /^(start|left|right|end|-webkit-left|-webkit-right)$/.test(s.textAlign);
  // How far each line falls short of the measure, as a share of it.
  const shortfall = (L, box, s) => (/right|end/.test(s.textAlign) && s.direction === 'ltr' ? L.left - box.left : box.right - L.right) / box.width;
  const HEADING = (el) => /^h[1-6]$/.test(el.localName) || el.getAttribute('role') === 'heading';
  const multicol = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.columnCount !== 'auto' || s.columnWidth !== 'auto') return a; } return null; };

  const OPEN = /^[“‘"'«‹„‚(\[]/;
  // Letters whose ink does not reach their side bearing: round and pointed
  // shapes. At display sizes they read as indented unless they overhang.
  const ROUND = /^[OCGQSoceadgqsAVWYTJvwy0369@]/;
  const hang = system?.type?.hangingPunctuation;

  let tested = 0;
  for (const { el, s } of blocks) {
    const fs = parseFloat(s.fontSize);
    const L = lines(el, fs);
    if (!L.length) continue;
    const box = content(el, s);
    if (box.width < fs * 4) continue;
    const last = L.at(-1);
    const head = HEADING(el);
    const mark = (ln) => ({ x1: ln.left + sx, y1: ln.top + sy, x2: ln.right + sx, y2: ln.bottom + sy });

    // Widows and short last lines. Where a paragraph wraps plainly, set
    // text-wrap: pretty on it for a moment: a last line that improves is
    // reported as text-wrap-pretty (the fix is one property). A one-word
    // last line that remains, with pretty set or tried, is a widow (the fix
    // is the copy, the measure or a no-break space).
    const plain = wrapStyle(s) === 'plain';
    const fill = (ln) => (ln.right - ln.left) / box.width;
    // Widows and rag are judged against a real measure. Where full lines
    // average under 20 characters every line is a fragment, and the fault
    // is the measure, not the break.
    const full = L.slice(0, -1);
    const chars = full.length ? full.reduce((n, ln) => n + ln.words.reduce((m, w) => m + w.text.length, 0) + ln.words.length - 1, 0) / full.length : 0;
    const narrow = chars < 20;
    const oneWord = (ls) => ls.length >= 2 && ls.at(-1).words.length === 1 && ls.at(-1).words[0].piece === 0 && !ls.at(-2).forced;
    let pretty = null;
    if (!head && !narrow && L.length >= 2 && plain && ragged(s) && (oneWord(L) || fill(last) < 1 / 3) && tested < 250 && (want.has('text-wrap-pretty') || want.has('widow'))) {
      tested++;
      pretty = withStyle(el, { 'text-wrap': 'pretty' }, () => lines(el, fs));
    }
    const prettyHelps = !!pretty && pretty.length <= L.length + 1 && ((oneWord(L) && !oneWord(pretty)) || (!oneWord(L) && fill(pretty.at(-1)) >= 1 / 3 && fill(pretty.at(-1)) - fill(last) >= 0.1));
    // A citation ends on its link by convention, and a link cannot be
    // joined to the word before it; a last line that is a URL or DOI is not
    // judged.
    const link = /^(https?:\/\/|www\.|doi:)|^[\w-]+(\.[\w-]+)+\/\S/i;
    if (want.has('widow') && !head && !narrow && oneWord(L) && !link.test(last.words[0].text) && !prettyHelps && live(el, 'widow')) {
      const w = last.words[0].text;
      report('widow', 'warning', el, `The last line holds one word, "${w.length > 24 ? w.slice(0, 23) + '…' : w}", under ${L.length - 1} full line${L.length > 2 ? 's' : ''}${plain ? ', and text-wrap: pretty does not move it' : ', with text-wrap: pretty set'}. Change the measure or the copy, or join the last two words with a no-break space.`, [mark(last)]);
    }
    if (want.has('text-wrap-pretty') && prettyHelps && live(el, 'text-wrap-pretty')) {
      const pl = pretty.at(-1);
      report('text-wrap-pretty', 'info', el, oneWord(L)
        ? `The last line holds one word, "${last.words[0].text}"; with text-wrap: pretty it would hold ${pl.words.length} and fill ${pct(fill(pl))}% of the measure.`
        : `The last line fills ${pct(fill(last))}% of the measure; with text-wrap: pretty it would fill ${pct(fill(pl))}%.`, [mark(last)]);
    }

    // Orphans: a paragraph split across columns with one line on one side.
    if (want.has('orphan') && L.length >= 2 && live(el, 'orphan') && multicol(el)) {
      const parts = [];
      for (const ln of L) { const p = parts.at(-1); if (p && ln.top >= p.at(-1).top - 1) p.push(ln); else parts.push([ln]); }
      if (parts.length > 1) {
        const lone = parts.findIndex((p) => p.length === 1);
        if (lone >= 0) report('orphan', 'warning', el, `The paragraph breaks across ${parts.length} columns as ${parts.map((p) => p.length).join(' + ')} lines, leaving one line ${lone === 0 ? 'at the foot of a column' : 'at the head of the next'}. Keep at least two lines on each side: orphans and widows of 2, the default, or break-inside: avoid.`, [mark(parts[lone][0])]);
      }
    }

    if (tested >= 250) continue;

    // Headings that would break more evenly with text-wrap: balance.
    if (want.has('text-wrap-balance') && head && L.length >= 2 && wrapStyle(s) !== 'balance' && live(el, 'text-wrap-balance')) {
      tested++;
      const widths = (ls) => ls.map((ln) => ln.right - ln.left);
      const ratio = (ws) => Math.min(...ws) / Math.max(...ws);
      const now = widths(L);
      if (ratio(now) < 0.6) {
        const after = withStyle(el, { 'text-wrap': 'balance' }, () => widths(lines(el, fs)));
        if (after.length <= now.length + 1 && ratio(after) >= 0.6 && ratio(after) - ratio(now) >= 0.3) {
          report('text-wrap-balance', 'info', el, `The heading breaks into lines of ${now.map(Math.round).join(', ')} px; with text-wrap: balance they would be ${after.map(Math.round).join(', ')} px.`, [mark(last)]);
        }
      }
    }

    // Rag: a line, other than the last or one ended by force, that stops far
    // short of the measure, where hyphenation would fill it.
    if (want.has('rag') && !head && !narrow && L.length >= 3 && ragged(s) && !hyphenated(el, s) && live(el, 'rag')) {
      const holes = L.slice(0, -1).map((ln, i) => ({ ln, i, d: ln.forced ? 0 : shortfall(ln, box, s) }));
      const worst = holes.reduce((a, b) => (b.d > a.d ? b : a));
      if (worst.d > 0.25) {
        const lang = (el.closest('[lang]')?.getAttribute('lang') || '').trim();
        tested++;
        let d2 = null;
        if (lang) {
          const after = withStyle(el, { hyphens: 'auto', '-webkit-hyphens': 'auto' }, () => lines(el, fs));
          d2 = Math.max(0, ...after.slice(0, -1).filter((ln) => !ln.forced).map((ln) => shortfall(ln, box, s)));
        }
        if (d2 === null || worst.d - d2 >= 0.1) {
          report('rag', 'warning', el, `Line ${worst.i + 1} of ${L.length} ends ${pct(worst.d)}% short of the measure, a hole in the rag.${d2 === null ? ' The text has no lang, so hyphenation cannot help; set one, then hyphens: auto.' : ` With hyphens: auto the deepest hole would be ${pct(d2)}%.`}`, [mark(worst.ln)]);
        }
      }
    }

    // Justified text in a narrow measure without hyphenation: word spaces
    // stretch. Natural space width from the font; actual from the line.
    if (want.has('hyphenation') && /justify/.test(s.textAlign) && L.length >= 2 && !hyphenated(el, s) && live(el, 'hyphenation')) {
      const cv = typography.cv || (typography.cv = document.createElement('canvas').getContext('2d'));
      cv.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const space = cv.measureText(' ').width + parseFloat(s.wordSpacing || 0) + (parseFloat(s.letterSpacing) || 0);
      let worst = { r: 0, i: -1 };
      L.slice(0, -1).forEach((ln, i) => {
        if (ln.forced || ln.words.length < 2) return;
        const ink = ln.words.reduce((t, w) => t + (w.right - w.left), 0);
        const r = (ln.right - ln.left - ink) / (ln.words.length - 1) / space;
        if (r > worst.r) worst = { r, i, ln };
      });
      const chars = Math.round((el.innerText || '').length / L.length);
      if (worst.r > 1.5) {
        report('hyphenation', 'warning', el, `Justified text, about ${chars} characters a line, without hyphenation: on line ${worst.i + 1} the word spaces stretch to ${r1(worst.r)} times their natural width. Set hyphens: auto${(el.closest('[lang]')?.getAttribute('lang') || '').trim() ? '' : ' with a lang on the page'}, or set the text ragged.`, [mark(worst.ln)]);
      }
    }

    // Hanging punctuation, where the system declares it: an opening quote or
    // bracket at the start of a block hangs into the margin.
    if (want.has('hanging-punctuation') && hang && live(el, 'hanging-punctuation')) {
      const w0 = L[0].words[0];
      if (w0 && w0.piece === 0 && OPEN.test(w0.text) && Math.abs(L[0].left - box.left) < fs * 1.5) {
        range.setStart(w0.node, w0.start); range.setEnd(w0.node, w0.start + 1);
        const q = range.getBoundingClientRect();
        const out = box.left - q.left;
        if (out < q.width * 0.5) {
          report('hanging-punctuation', 'warning', el, `The opening ${w0.text[0]} sits inside the measure (${r1(Math.max(0, out))} of its ${r1(q.width)} px outside the text edge). The system hangs punctuation: pull it into the margin, for example with text-indent: -${r2(q.width / fs)}em.`, [{ x1: q.left + sx, y1: q.top + sy, x2: q.right + sx, y2: q.bottom + sy }]);
        }
      }
    }

    // Display type that starts with a round or pointed letter: hand its
    // first glyph, and the first glyph of the text it aligns with, to
    // inspect.js to measure their ink.
    if (want.has('optical-margin') && fs >= 32 && /^(start|left)$/.test(s.textAlign) && live(el, 'optical-margin')) {
      const w0 = L[0].words[0];
      if (w0 && ROUND.test(w0.text)) {
        const sib = [el.nextElementSibling, el.previousElementSibling].map((x) => x && blocks.find((b) => b.el === x)).find((b) => b && parseFloat(b.s.fontSize) < fs * 0.6 && Math.abs(content(b.el, b.s).left - box.left) <= 1);
        if (sib) {
          const fl = (b) => { const ws = words(b.el); return ws[0]; };
          const r0 = fl(sib);
          range.setStart(w0.node, w0.start); range.setEnd(w0.node, w0.start + 1);
          const q = range.getBoundingClientRect();
          range.setStart(r0.node, r0.start); range.setEnd(r0.node, r0.start + 1);
          const qr = range.getBoundingClientRect();
          optical.push({
            el: { sel: sel(el), label: label(el), rect: P(el.getBoundingClientRect()) }, ref: { sel: sel(sib.el), label: label(sib.el) },
            letter: w0.text[0], refLetter: r0.text[0], fs, edge: r1(box.left + sx),
            glyph: P(q), refGlyph: P(qr),
          });
        }
      }
    }
  }
  return { issues, optical };
}
