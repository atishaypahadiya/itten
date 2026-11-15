// The ITTEN action's summary as Markdown: for the job summary and for the one
// comment it keeps on a pull request. Plain text and tables, nothing more.

export const marker = (name) => `<!-- itten-action:${name} -->`;

const SEV = { error: 'Error', warning: 'Warning', info: 'Info' };
// Page text quoted in a message must not mention people or open HTML.
const clean = (s) => String(s ?? '').replace(/@/g, '@​').replace(/</g, '&lt;').replace(/\s+/g, ' ').trim();
// The first sentence, at most about 220 characters.
const first = (s) => {
  const t = clean(s);
  let r = t.match(/^.*?\.(?=\s+[A-Z(]|$)/)?.[0] ?? t;
  if (r.length > 220) r = r.slice(0, 220).replace(/\s+\S*$/, '') + ' …';
  return r;
};
const code = (s) => '`' + String(s).replace(/`/g, "'") + '`';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const list = (xs) => xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1) : xs.join('');
const ENGINE = { chromium: 'Chromium', webkit: 'WebKit', firefox: 'Firefox' };

const line = (f, page, many) => `${SEV[f.severity]} · ${clean(f.title ?? f.check)}${many ? ` on ${code(page)}` : ''}: ${first(f.message)}${f.element ? ' ' + code(f.element) : ''}`;

export function render(s, { artifactUrl = '', runUrl = '', note = '', forComment = false, limit = 60000 } = {}) {
  const out = [];
  if (forComment) out.push(marker(s.name));
  out.push('### ITTEN inspection', '');
  if (s.problems?.length) {
    out.push('The run could not finish:', '', ...s.problems.map((p) => `- ${clean(p)}`), '');
  }
  const pages = s.pages ?? [];
  const many = pages.length > 1;
  if (pages.length) {
    const t = s.totals;
    const widths = s.mode === 'full' ? 'every 40 px from 320 to 1920 px' : '320, 768, 1440 and 1920 px';
    const ran = [...new Set(pages.flatMap((p) => p.engines?.ran ?? ['chromium']))].map((e) => ENGINE[e] ?? e);
    out.push(`${plural(pages.length, 'page')} at ${widths}, ${s.system ? `against ${code(s.system)}` : 'without a system file (distinct-value mode)'}, in ${list(ran)}. ${plural(t.error, 'error')}, ${plural(t.warning, 'warning')}, ${t.info} info.`, '');
    const by = s.baseline ? 'new or more severe than in the baseline' : 'in all';
    if (s.failOn === 'never') out.push('This check does not fail the build (fail-on: never).', '');
    else out.push(t.failing ? `This check fails: ${plural(t.failing, s.failOn === 'warnings' ? 'error or warning' : 'error')} ${by} (fail-on: ${s.failOn}).` : `This check passes: no ${s.failOn === 'warnings' ? 'errors or warnings' : 'errors'} ${by} (fail-on: ${s.failOn}).`, '');

    out.push(`| Page | Errors | Warnings | Info${s.baseline ? ' | New | Fixed' : ''} |`, `|---|--:|--:|--:${s.baseline ? '|--:|--:' : ''}|`);
    for (const p of pages) {
      const b = p.baseline;
      out.push(`| ${code(p.page)} | ${p.summary.error} | ${p.summary.warning} | ${p.summary.info}${s.baseline ? ` | ${b?.found ? b.new.length + b.worse.length : 'no entry'} | ${b?.found ? b.fixed.length : ''}` : ''} |`);
    }
    out.push('');

    if (s.baseline) {
      const fresh = pages.flatMap((p) => [...(p.baseline?.new ?? []), ...(p.baseline?.worse ?? [])].map((f) => ({ f, p })));
      const fixed = pages.flatMap((p) => (p.baseline?.fixed ?? []).map((f) => ({ f, p })));
      out.push(`#### New since ${code(s.baseline)}`, '');
      if (fresh.length) out.push(...fresh.slice(0, 15).map(({ f, p }) => `- ${line(f, p.page, many)}${f.was ? ` (was ${f.was})` : ''}`), ...(fresh.length > 15 ? [`- and ${fresh.length - 15} more in the report`] : []));
      else out.push('Nothing new.');
      out.push('', '#### Fixed', '');
      if (fixed.length) out.push(...fixed.slice(0, 15).map(({ f, p }) => `- ${line(f, p.page, many)}`), ...(fixed.length > 15 ? [`- and ${fixed.length - 15} more`] : []));
      else out.push('Nothing fixed.');
      const missing = pages.filter((p) => p.baseline && !p.baseline.found).map((p) => code(p.page));
      if (missing.length) out.push('', `The baseline has no entry for ${list(missing)}, so every finding there counts as new.`);
      if (pages.some((p) => p.baseline?.found && !p.baseline.sameWidths)) out.push('', 'The baseline was taken at other widths than this run, so some differences come from the widths.');
      out.push('');
    } else {
      out.push(`No baseline, so new and fixed findings are not shown. To keep one, run the action once with ${code('write-baseline: true')} and commit the ${code('itten-baseline.json')} from its artifact.`, '');
    }

    const top = pages.flatMap((p) => p.top.map((f) => ({ f, p }))).sort((a, b) => ['error', 'warning'].indexOf(a.f.severity) - ['error', 'warning'].indexOf(b.f.severity)).slice(0, 10);
    if (top.length) out.push('#### Top findings', '', ...top.map(({ f, p }, i) => `${i + 1}. ${line(f, p.page, many)}`), '');
    const notRun = Object.entries(Object.assign({}, ...pages.map((p) => p.engines?.notRun ?? {})));
    if (notRun.length) out.push(...notRun.map(([e, why]) => `${ENGINE[e] ?? e} was not run: ${clean(why)}.`), '');
  }
  const links = [artifactUrl && `[Full report and crops](${artifactUrl})`, runUrl && `[workflow run](${runUrl})`].filter(Boolean);
  if (links.length) out.push(links.join(' · ') + (s.wroteBaseline ? `. The artifact holds a new ${code('itten-baseline.json')}.` : '.'), '');
  if (note) out.push(note, '');
  out.push(`ITTEN ${s.version ?? ''}`.trim());
  let text = out.join('\n');
  if (text.length > limit) text = text.slice(0, limit - 200).replace(/\n[^\n]*$/, '') + '\n\nCut short; the full list is in the report.';
  return text;
}
