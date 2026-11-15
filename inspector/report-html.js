// Renders report.json as a single static HTML page.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const HEADINGS = { error: 'Errors', warning: 'Warnings', info: 'Information' };
const NOTES = {
  error: 'An accessibility floor or a rendering failure. Fix these first.',
  warning: 'A departure from the system or from an up-close rule. Fix it, or log it in docs/itten-overrides.md with a reason.',
  info: 'Worth knowing; not a defect on its own.',
};

const ENGINES = { chromium: 'Chromium', webkit: 'WebKit', firefox: 'Firefox' };
function engineSection(r) {
  const e = r.engines;
  if (!e) return '';
  const ran = Object.keys(e.browsers);
  const notRun = Object.entries(e.notRun).map(([n, why]) => `${ENGINES[n]} was not run: ${esc(why)}.`).join(' ');
  const cell = (d, n) => {
    if (d.render && d.render[n]) return d.render[n];
    return d.found[n] ? 'found' : 'not found';
  };
  const rows = e.differences.map((d) => {
    const it = r.issues.find((i) => i.id === d.id);
    return `<tr><td><a href="#${d.id}">${d.id}</a> ${esc(it ? it.title : d.check)}</td>${ran.map((n) => `<td>${esc(cell(d, n))}</td>`).join('')}</tr>`;
  }).join('');
  return `<section>
    <h2>Engines</h2>
    <p>The layout checks ran again in ${ran.filter((n) => n !== 'chromium').map((n) => `${ENGINES[n]} ${esc(e.browsers[n])}`).join(' and ') || 'no other engine'} at ${e.widths.join(', ')} px, light. ${notRun}</p>
    ${e.differences.length ? `<p>Findings that differ between engines at those widths:</p>
    <table><thead><tr><th>Finding</th>${ran.map((n) => `<th>${ENGINES[n]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>` : '<p>Every engine found the same layout findings.</p>'}
  </section>`;
}

export function renderHtml(r) {
  const checks = Object.entries(r.summary.byCheck).filter(([, c]) => c.error + c.warning + c.info);
  const table = checks.length ? `
    <table>
      <thead><tr><th>Check</th><th class="n">Errors</th><th class="n">Warnings</th><th class="n">Info</th></tr></thead>
      <tbody>${checks.map(([id, c]) => `<tr><td><code>${id}</code></td><td class="n">${c.error || ''}</td><td class="n">${c.warning || ''}</td><td class="n">${c.info || ''}</td></tr>`).join('')}</tbody>
    </table>` : '<p>No findings.</p>';

  const issue = (it) => `
    <article id="${it.id}">
      <h3>${esc(it.title)}</h3>
      <p>${esc(it.message)}</p>
      <p class="meta">${esc(it.rule)} · ${it.id} · seen at ${Object.entries(it.seen).map(([m, w]) => `${esc(m)}: ${esc(w)} px`).join('; ')}${it.count > it.elements.length ? ` · ${it.count} occurrences, ${it.elements.length} listed` : ''}</p>
      <ul class="els">${it.elements.map((e) => `<li><code>${esc(e.sel)}</code> <span class="lbl">${esc(e.label)}</span></li>`).join('')}</ul>
      ${it.crops.map((c) => `<figure><img src="${esc(c.path)}" alt="Crop of ${esc(it.title.toLowerCase())} at ${esc(c.at)}, zoomed ${c.zoom} times" loading="lazy"><figcaption>${esc(c.at)}, ${c.zoom}×. Magenta: the elements involved. Blue: the edges compared.</figcaption></figure>`).join('')}
    </article>`;

  const sections = ['error', 'warning', 'info'].map((sev) => {
    const items = r.issues.filter((i) => i.severity === sev);
    if (!items.length) return '';
    return `<section><h2>${HEADINGS[sev]} (${items.length})</h2><p class="note">${NOTES[sev]}</p>${items.map(issue).join('')}</section>`;
  }).join('');

  const dist = (a) => a.map(([v, n]) => `${v} (${n})`).join(', ') || 'none';
  const fluid = (g) => g.length ? g.map((x) => `${x.lo} to ${x.hi} px on ${plural(x.elements, 'element')}`).join('; ') : 'none';
  const most = (k) => Math.max(0, ...r.distinct.perWidth.map((p) => p[k]));
  const ts = r.textScaling;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inspection report</title>
<style>
  :root { color-scheme: light dark; --ink: #1b1b1b; --muted: #5c5c5c; --ground: #ffffff; --rule: #d9d9d9; --code: #f3f3f3; }
  @media (prefers-color-scheme: dark) { :root { --ink: #ececec; --muted: #a8a8a8; --ground: #151515; --rule: #3a3a3a; --code: #222222; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--ink); font: 16px/24px system-ui, sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 32px 16px 96px; }
  h1 { font-size: 32px; line-height: 40px; margin: 0 0 8px; }
  h2 { font-size: 24px; line-height: 32px; margin: 64px 0 8px; }
  h3 { font-size: 18px; line-height: 24px; margin: 0 0 8px; }
  p { margin: 0 0 8px; }
  .meta, .note, .lbl, figcaption { color: var(--muted); font-size: 14px; line-height: 20px; }
  .note { margin-bottom: 24px; }
  article { margin: 0 0 48px; }
  code { font: 13px/20px ui-monospace, monospace; background: var(--code); padding: 0 4px; border-radius: 4px; overflow-wrap: anywhere; }
  ul { margin: 0 0 8px; padding-left: 20px; }
  .els li { margin: 0 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--rule); }
  .n { text-align: right; font-variant-numeric: tabular-nums; width: 96px; }
  figure { margin: 16px 0 0; }
  img { display: block; max-width: 100%; height: auto; image-rendering: pixelated; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
  dt { color: var(--muted); }
  dd { margin: 0; }
</style>
</head>
<body>
<main>
  <h1>Inspection report</h1>
  <p><a href="${esc(r.url)}">${esc(r.url)}</a></p>
  <p class="meta">${esc(r.date)} · ${esc(r.environment.browser)} on ${esc(r.environment.platform)} · ${r.mode === 'system' ? `checked against <code>${esc(r.system)}</code>` : 'no system file: distinct-value mode'}</p>
  <p>${plural(r.summary.error, 'error')}, ${plural(r.summary.warning, 'warning')}, ${r.summary.info} info. Widths ${esc(r.sweep.widths)} px in light; contrast and fonts at ${r.sweep.keyWidths.join(', ')} px in light and dark; overflow, clipping and overlap again at 200% text; hairlines again at 2×.</p>
  ${table}
  ${sections}
  <section>
    <h2>Values in use</h2>
    <p class="note">Fixed values keep their size as the viewport changes; the number in brackets is how many elements use each. Fluid values follow the viewport width (clamp, vw, percentages) and are listed as ranges.</p>
    <dl>
      <dt>Font sizes</dt><dd>${most('fontSizes')} at most at any one width, ${r.distinct.fontSizes.length} across the sweep</dd>
      <dt>Fixed</dt><dd>${esc(dist(r.distinct.fixed.fontSizes))}</dd>
      <dt>Fluid</dt><dd>${esc(fluid(r.distinct.fluid.fontSizes))}</dd>
      <dt>Spacing</dt><dd>${most('spacing')} at most at any one width, ${r.distinct.spacing.length} across the sweep</dd>
      <dt>Fixed</dt><dd>${esc(dist(r.distinct.fixed.spacing))}</dd>
      <dt>Fluid</dt><dd>${esc(fluid(r.distinct.fluid.spacing))}</dd>
      ${r.mode === 'distinct' ? `<dt>Radii</dt><dd>${esc(dist(r.distinct.radii))}</dd>` : ''}
      ${r.distinct.svgTextSizes.length ? `<dt>Inside svg</dt><dd>text sizes ${esc(dist(r.distinct.svgTextSizes))}, not judged</dd>` : ''}
    </dl>
    <h3 style="margin-top:24px">Fonts rendered</h3>
    <ul>${r.renderedFonts.map((f) => `<li><code>${esc(f.requested)}</code> ${esc(f.weight)}${f.style !== 'normal' ? ' ' + esc(f.style) : ''}: ${esc(f.rendered.join('; '))}</li>`).join('')}</ul>
    ${ts ? `<p>At ${ts.width} px with the browser's text size doubled, ${ts.unchanged} of ${ts.measured} text elements kept their size, which means they are set in px and ignore the setting.</p>` : ''}
  </section>
  ${engineSection(r)}
  <section>
    <h2>Coverage</h2>
    <p>${r.coverage.elements} visible elements, ${r.coverage.text} with text. ${r.coverage.ignored} element and check pairs skipped by <code>data-itten-ignore</code>. ${r.coverage.contrastSamples} background pixels sampled for contrast; ${r.coverage.contrastSkipped} text elements skipped (transparent or clipped-to-background text).</p>
    <h3>Not judged</h3>
    <ul>${r.notJudged.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    ${r.pageErrors.length ? `<h3>Script errors on the page</h3><ul>${r.pageErrors.map((e) => `<li><code>${esc(e)}</code></li>`).join('')}</ul>` : ''}
  </section>
</main>
</body>
</html>
`;
}
