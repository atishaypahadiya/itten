// Tests the ITTEN action's parts that run without a browser: the baseline
// comparison and the fail-on gate, page addressing, the static server, the
// Markdown and the report's text (grouped notes in document order, broken
// words at every width), and the pull request comment against a local stand-in for the
// GitHub API (one comment, edited on later runs; forks and read-only tokens
// fall back to the job summary without failing).
// Usage: node scripts/action-test.js   Exports run() for scripts/check.js.

import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compare, failing, writeBaseline, readBaseline } from '../inspector/baseline.js';
import { render, marker } from './action/markdown.js';
import { upsertComment, main as report } from './action/report.js';
import { pageUrl, pageName, slug, parsePages, measuredWidths } from './action/run.js';
import { start } from './serve.js';
import { brokenWordMessage } from '../inspector/inspect.js';
import { renderHtml } from '../inspector/report-html.js';
import { compareVersions } from './compare-versions.mjs';
import { readArgs } from '../inspector/usage.js';

const issue = (id, check, key, severity, sel = '#a') => ({ id, fingerprint: `${check}|${key}`, check, title: check, rule: '', severity, message: `${check} message. More.`, elements: [{ sel }] });
const reportOf = (url, issues) => ({ url, date: '2026-11-15T00:00:00Z', version: 'test', system: 'itten.system.json', sweep: { widths: '320, 768, 1440, 1920' }, issues });

export async function run() {
  const fails = [];
  const ok = (cond, what) => { if (!cond) fails.push(what); };
  const dir = mkdtempSync(join(tmpdir(), 'itten-action-test-'));
  try {
    // Baseline: write two pages, then compare a later run of one of them.
    const file = join(dir, 'itten-baseline.json');
    writeBaseline(file, reportOf('http://127.0.0.1:1/', [issue('i001', 'contrast', '#a', 'error'), issue('i002', 'radius', 'all', 'warning'), issue('i003', 'overlap', '#c', 'error')]), '/');
    writeBaseline(file, reportOf('http://127.0.0.1:1/about/', [issue('i001', 'contrast', '#z', 'error')]), '/about/');
    const b = readBaseline(file);
    ok(Object.keys(b.pages).join() === '/,/about/', 'the baseline keeps one entry per page');
    const later = reportOf('https://example.org/site/', [issue('i001', 'contrast', '#a', 'warning'), issue('i002', 'radius', 'all', 'error'), issue('i003', 'spacing-scale', 'fixed|13', 'warning')]);
    later.baseline = compare(later, b, 'itten-baseline.json', '/');
    const c = later.baseline;
    ok(c.found && c.new.join() === 'i003', `new findings: expected i003, got ${c.new}`);
    ok(c.fixed.length === 1 && c.fixed[0].check === 'overlap', 'fixed findings: expected the overlap');
    ok(c.worse.length === 1 && c.worse[0].id === 'i002' && c.better[0]?.id === 'i001', 'severity changes are told apart');
    ok(failing(later, 'errors').map((i) => i.id).join() === 'i002', 'fail-on errors counts the error that got worse, not the old ones');
    ok(failing(later, 'warnings').map((i) => i.id).join() === 'i002,i003', 'fail-on warnings counts new warnings too');
    ok(failing(later, 'never').length === 0, 'fail-on never fails nothing');
    const plain = reportOf('http://x/', later.issues);
    ok(failing(plain, 'errors').length === 1 && failing(plain, 'warning').length === 3, 'without a baseline every finding counts');
    ok(!compare(later, b, 'f', '/missing/').found, 'a page without an entry is reported as such');

    // Pages are relative to the URL, including a URL with a path.
    ok(pageUrl('https://example.org/site', '/') === 'https://example.org/site/', 'page "/" under a site path');
    ok(pageUrl('https://example.org/site/', '/about/') === 'https://example.org/site/about/', 'page "/about/" under a site path');
    ok(pageUrl('http://127.0.0.1:9/', 'https://other.org/x') === 'https://other.org/x', 'a full URL is kept');
    ok(pageName('fixtures/index.html') === '/fixtures/index.html' && slug('/') === 'index' && slug('/a/b.html') === 'a-b.html', 'page names and folders');
    ok(parsePages('/\n/about/, /blog/\n').join() === '/,/about/,/blog/', 'pages split on lines and commas');

    // The static server: index files, extensionless pages, 404, no dotfiles.
    const site = join(dir, 'site');
    mkdirSync(join(site, 'about'), { recursive: true });
    writeFileSync(join(site, 'index.html'), 'home');
    writeFileSync(join(site, 'about', 'index.html'), 'about');
    writeFileSync(join(site, 'contact.html'), 'contact');
    writeFileSync(join(site, '.env'), 'secret');
    const srv = await start(0, site);
    const base = `http://127.0.0.1:${srv.address().port}`;
    const get = async (p) => { const r = await fetch(base + p, { redirect: 'follow' }); return `${r.status} ${await r.text()}`; };
    ok(await get('/') === '200 home', 'serves index.html at /');
    ok(await get('/about') === '200 about', 'redirects a directory to its index');
    ok(await get('/contact') === '200 contact', 'serves an extensionless page');
    ok((await get('/nope.html')).startsWith('404'), 'answers 404 for a missing file');
    ok((await get('/.env')).startsWith('403'), 'refuses dotfiles');
    srv.close();

    // Comparing two versions on the same pages (scripts/compare-versions.mjs): new and gone findings, the
    // widths a version added, a fluid fingerprint that changed on the same element, timing findings from a
    // run marked unreliable, and two different site builds, which are not compared.
    const cv = join(dir, 'versions');
    const put = (v, mode, page, report, meta) => {
      mkdirSync(join(cv, v, mode, page), { recursive: true });
      writeFileSync(join(cv, v, mode, page, 'report.json'), JSON.stringify(report));
      writeFileSync(join(cv, v, mode, page, 'meta.json'), JSON.stringify(meta));
    };
    const vr = (widths, issues) => ({ url: 'http://127.0.0.1:8080/runs/', version: 'x', sweep: { widths }, summary: { error: 0, warning: issues.length, info: 0 }, issues });
    const seen = (f, w, crop) => ({ ...f, seen: { light: w }, crops: crop ? [{ path: `crops/${crop}` }] : [] });
    put('v1', 'quick', 'runs', vr('320, 768, 1440, 1920', [
      seen(issue('i001', 'widow', '#a', 'warning'), '768'),
      seen(issue('i002', 'spacing-scale', 'fluid|16,21,40,40', 'warning', '#gutter'), '320, 768, 1440, 1920'),
      seen(issue('i003', 'overflow', 'spill|#t', 'warning', '#t'), '320', 'i003-1.png'),
    ]), { version: '0.1', workers: 1, build: 'b1' });
    put('v2', 'quick', 'runs', vr('320, 768, 899, 900, 1440, 1920', [
      seen(issue('i001', 'widow', '#a', 'warning'), '768'),
      seen(issue('i002', 'spacing-scale', 'fluid|16,21,36,37,40,40', 'warning', '#gutter'), '320, 768, 899, 900, 1440, 1920'),
      seen(issue('i004', 'rag', '#caption', 'warning', '#caption'), '900', 'i004-1.png'),
      seen(issue('i005', 'frame-timing', 'loaf|#scene', 'warning', '#scene'), '1440'),
    ]), { version: '0.2', workers: 4, build: 'b1', timing: 'unreliable' });
    put('v1', 'full', 'runs', vr('320–1920', []), { build: 'b1' });
    put('v2', 'full', 'runs', vr('320–1920', []), { build: 'b2' });
    const vc = compareVersions(cv, { a: 'v1', b: 'v2' });
    const sect = vc.markdown.split('\n## ').find((x) => x.startsWith('quick')) ?? '';
    ok(/New 1, gone 1, more severe 0, less severe 0\./.test(sect), `versions: one new (the rag), one gone (the overflow), the fluid gutter matched across widths: ${sect.match(/New \d+, gone \d+[^.]*/)?.[0]}`);
    ok(/\| i004 \| warning \| rag \| `#caption` \| light 900 \| yes \|/.test(sect), 'a finding seen only at a width the newer version added is marked so');
    ok(/\| i003 \| warning \| overflow \|/.test(sect) && /Unreliable, not reported: v2 i005 frame-timing/.test(sect) && !/\| i005 /.test(sect), 'gone findings listed; a timing finding from an unreliable run is held back, not reported');
    ok(vc.copies.some(([f, t]) => f.endsWith(join('v2', 'quick', 'runs', 'crops', 'i004-1.png')) && t === join('crops', 'v2', 'quick', 'runs', 'i004-1.png')) && vc.copies.some(([, t]) => t.endsWith('i003-1.png')), 'the crops of new and gone findings are linked and copied');
    ok(!vc.sameBuild && /Not compared: v1 measured site build `b1` and v2 `b2`/.test(vc.markdown), 'two different site builds are not compared');

    // Markdown: the marker, mentions defused, the note without a baseline.
    const s = {
      name: 'itten-report', version: 'test', mode: 'quick', failOn: 'errors', system: 'itten.system.json', baseline: null, problems: [],
      totals: { error: 1, warning: 0, info: 0, new: 0, fixed: 0, failing: 1 },
      pages: [{ page: '/', dir: 'index', summary: { error: 1, warning: 0, info: 0 }, failing: 1, baseline: null, engines: { ran: ['chromium', 'webkit'], notRun: {} },
        top: [{ id: 'i001', check: 'contrast', title: 'Text contrast', severity: 'error', message: 'Text "@someone <b>" fails. More.', element: '#a' }] }],
    };
    const md = render(s, { forComment: true });
    ok(md.startsWith(marker('itten-report')), 'the comment starts with its marker');
    ok(!md.includes('@someone') && !md.includes('<b>'), 'page text cannot mention people or open HTML');
    ok(/No baseline/.test(md) && /This check fails: 1 error in all/.test(md), 'states the verdict and the missing baseline');
    // The widths in the comment are the widths each page ran at, from its report.
    // fixtures/index.html in quick mode: its breakpoints at 432 and 1000 px add
    // 431, 432, 999 and 1000 (0.3.5's self-test, 17 November 2026).
    const said = (md) => [...md.matchAll(/at ((?:\d+(?:–\d+)?(?:, | and )?)+) px/g)].map((m) => m[1].split(/, | and /).join(', '));
    const bp = { sweep: { widths: '320, 431, 432, 768, 999, 1000, 1440, 1920' } };
    const one = render({ ...s, pages: [{ ...s.pages[0], widths: measuredWidths(bp) }] });
    ok(said(one)[0] === bp.sweep.widths, `the comment gives the widths the page ran at: ${said(one)[0]} against ${bp.sweep.widths}`);
    const other = { sweep: { widths: '320, 479, 480, 768, 1440, 1920' } };
    const two = render({ ...s, pages: [{ ...s.pages[0], widths: measuredWidths(bp) }, { ...s.pages[0], page: '/about/', widths: measuredWidths(other) }] });
    const per = [...two.matchAll(/Widths on `([^`]+)`: ([^.]+) px\./g)].map((m) => [m[1], m[2].split(/, | and /).join(', ')]);
    ok(per.length === 2 && per[0][1] === bp.sweep.widths && per[1][0] === '/about/' && per[1][1] === other.sweep.widths && /2 pages at the widths below/.test(two), `pages with their own widths each get theirs: ${JSON.stringify(per)}`);
    ok(/at 320–1920 px/.test(render({ ...s, mode: 'full', pages: [{ ...s.pages[0], widths: measuredWidths({ sweep: { widths: '320–1920' } }) }] })), 'a full sweep gives its range');
    ok(/either side of each breakpoint/.test(render(s)), 'a summary without widths describes quick mode as it runs');
    const part = render({ ...s, pages: [{ ...s.pages[0], status: 'partial', reason: '2 steps timed out.' }] });
    ok(/Partial run on `[^`]+`: 2 steps timed out\. Its findings are real but do not cover the whole page\./.test(part) && !/Partial run/.test(render(s)), 'a partial run is stated under the table, and only then');
    ok(render({ ...s, pages: Array(400).fill(s.pages[0]) }, { limit: 5000 }).length <= 5000, 'the comment is cut to the limit');
    // Info findings repeated across one table's cells: one line, naming the cells.
    const cell = (n) => ({ id: `i00${n}`, check: 'text-wrap-pretty', title: 'Last line with one word', severity: 'info', message: `The last line holds one word, "w${n}". More.`, element: `#t > table > tbody > tr:nth-of-type(${n}) > td:nth-of-type(2)` });
    const g = render({ ...s, baseline: 'itten-baseline.json', pages: [{ ...s.pages[0], baseline: { found: true, new: [cell(1), cell(2), cell(3), { ...s.pages[0].top[0] }], worse: [], fixed: [], sameWidths: true } }] });
    ok(/Info · Last line with one word: 3 cells in `#t > table` \(row 1, cell 2; row 2, cell 2; row 3, cell 2\)/.test(g) && !/"w2"/.test(g), 'repeated info findings in one table are one line');
    ok(/Error · Text contrast/.test(g), 'an error next to them stays a line of its own');
    // In document order, whatever order the sweep found them in: the header
    // row, the body, the footer.
    const at = (n, sel, order) => ({ id: `i10${n}`, check: 'text-wrap-pretty', title: 'Last line with one word', severity: 'info', message: `The last line holds one word, "v${n}". More.`, element: `#t > table > ${sel}`, order });
    const ordered = [at(1, 'tfoot > tr > td', 40), at(2, 'tbody > tr:nth-of-type(2) > td:nth-of-type(2)', 20), at(3, 'tbody > tr:nth-of-type(1) > td:nth-of-type(2)', 12), at(4, 'thead > tr > th:nth-of-type(2)', 5)];
    const o = render({ ...s, baseline: 'itten-baseline.json', pages: [{ ...s.pages[0], baseline: { found: true, new: ordered, worse: [], fixed: [], sameWidths: true } }] });
    ok(/4 cells in `#t > table` \(header row 1, cell 2; row 1, cell 2; row 2, cell 2; footer row 1, cell 1\)/.test(o), 'a grouped note lists its cells in document order');
    const o2 = render({ ...s, baseline: 'itten-baseline.json', pages: [{ ...s.pages[0], baseline: { found: true, new: ordered.map(({ order, ...f }) => f), worse: [], fixed: [], sameWidths: true } }] });
    ok(/\(header row 1, cell 2; row 1, cell 2; row 2, cell 2; footer row 1, cell 1\)/.test(o2), 'without recorded positions, header rows come first and footer rows last');
    const html = renderHtml({ url: 'http://x/', version: 'test', date: '2026-11-15T00:00:00Z', mode: 'system', system: 'itten.system.json', environment: { browser: 'Chromium', platform: 'test' },
      sweep: { widths: '320', keyWidths: [320] }, summary: { error: 0, warning: 0, info: 4, byCheck: {} }, pageErrors: [], renderedFonts: [], engines: null, motion: null, textScaling: null,
      distinct: { perWidth: [], sweep: { fontSizes: 0, spacing: 0 }, fixed: { fontSizes: [], spacing: [] }, fluid: { fontSizes: [], spacing: [] }, radii: [], svgTextSizes: [] },
      coverage: { elements: 0, text: 0, ignored: 0, contrastSamples: 0, contrastSkipped: 0 }, notJudged: [], issues: ordered.map((f, i) => ({ ...f, rule: 'CRF-23', seen: { light: '320' }, count: 1, crops: [], elements: [{ sel: f.element, label: 'td', order: f.order }] })) });
    const rowsAt = [...html.matchAll(/<li id="i10\d">([^:]+):/g)].map((m) => m[1]);
    ok(rowsAt.join(' | ') === 'header row 1, cell 2 | row 1, cell 2 | row 2, cell 2 | footer row 1, cell 1', `report.html lists a grouped note's cells in document order (${rowsAt.join(' | ')})`);
    // Broken words, at every width that broke them, not only the first.
    const bw = brokenWordMessage([
      { at: '320 px', words: ["Bouvar|d's", 'observ|ations'], cells: [62, 70], advice: 'Give the column room.' },
      { at: '360 px', words: ["Bouvar|d's", 'observ|ations'], cells: [70, 81], advice: 'Give the column room.' },
      { at: '1440 px', words: ["Bouvar|d's"], cells: [93, 93], advice: 'Give the column room.' },
      { at: '320 px in WebKit', words: ['refer|ence'], cells: [62, 62], advice: 'Give the column room.' },
    ]);
    ok(bw === `3 words are broken without a hyphen in table cells 62 to 93 px wide. At 320 and 360 px: "Bouvar|d's", "observ|ations"; at 1440 px: "Bouvar|d's"; at 320 px in WebKit: "refer|ence". Give the column room.`, `a broken-word finding lists the words at each width (${bw})`);

    // The comment, against a stand-in for the GitHub API.
    const comments = [];
    let nextId = 1, deny = false, posts = 0, patches = 0;
    for (let i = 0; i < 120; i++) comments.push({ id: nextId++, body: `other comment ${i}` });
    const api = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const u = new URL(req.url, 'http://x');
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.headers.authorization !== 'Bearer t0ken') return send(401, { message: 'Bad credentials' });
      if (deny && req.method !== 'GET') return send(403, { message: 'Resource not accessible by integration' });
      if (req.method === 'GET' && /\/issues\/7\/comments$/.test(u.pathname)) {
        const per = Number(u.searchParams.get('per_page')), page = Number(u.searchParams.get('page'));
        return send(200, comments.slice((page - 1) * per, page * per));
      }
      if (req.method === 'POST' && /\/issues\/7\/comments$/.test(u.pathname)) { posts++; const c = { id: nextId++, body: JSON.parse(body).body }; comments.push(c); return send(201, c); }
      const m = u.pathname.match(/\/issues\/comments\/(\d+)$/);
      if (req.method === 'PATCH' && m) { patches++; const c = comments.find((x) => x.id === Number(m[1])); c.body = JSON.parse(body).body; return send(200, c); }
      send(404, { message: 'Not Found' });
    });
    await new Promise((r) => api.listen(0, '127.0.0.1', r));
    const env = {
      GITHUB_API_URL: `http://127.0.0.1:${api.address().port}`, GITHUB_TOKEN: 't0ken', GITHUB_REPOSITORY: 'owner/project', GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: join(dir, 'event.json'), GITHUB_STEP_SUMMARY: join(dir, 'step-summary.md'), GITHUB_RUN_ID: '42', ITTEN_OUT: join(dir, 'out'), ITTEN_COMMENT: 'true',
    };
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    const log = console.log; console.log = () => {};
    try {
      mkdirSync(env.ITTEN_OUT, { recursive: true });
      writeFileSync(join(env.ITTEN_OUT, 'summary.json'), JSON.stringify(s));
      const event = (headRepo) => writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify({ pull_request: { number: 7, head: { repo: { full_name: headRepo } } } }));
      event('owner/project');
      const r1 = await report();
      const r2 = await report();
      ok(r1.action === 'created' && r2.action === 'updated' && r1.id === r2.id, `a second run edits the first comment (got ${r1.action}, ${r2.action})`);
      ok(posts === 1 && patches === 1 && comments.filter((x) => x.body.includes(marker('itten-report'))).length === 1, 'exactly one comment exists after two runs, past the first page of comments');
      writeFileSync(join(env.ITTEN_OUT, 'summary.json'), JSON.stringify({ ...s, name: 'docs' }));
      const r3 = await report();
      ok(r3.action === 'created' && posts === 2, 'a second use of the action with another name keeps its own comment');
      writeFileSync(join(env.ITTEN_OUT, 'summary.json'), JSON.stringify(s));
      event('someone/fork');
      rmSync(env.GITHUB_STEP_SUMMARY, { force: true });
      const r4 = await report();
      ok(r4.action === 'skipped' && /fork/.test(r4.why) && posts === 2 && patches === 1, 'a fork pull request is not commented on');
      ok(/No comment on the pull request: the pull request comes from a fork/.test(readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8')), 'the job summary says why there is no comment');
      event('owner/project');
      deny = true;
      const r5 = await report();
      ok(r5.action === 'skipped' && /pull-requests: write/.test(r5.why), 'a read-only token falls back to the job summary');
      deny = false;
      process.env.GITHUB_EVENT_NAME = 'push';
      ok((await report()).action === 'skipped', 'a push is not commented on');
      ok(upsertComment && true, 'exports the comment function');
    } finally {
      console.log = log;
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      api.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return fails;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  readArgs(process.argv.slice(2), { name: 'action-test.js', usage: 'node scripts/action-test.js' });
  const fails = await run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `\n${fails.length} failure(s).` : 'Action tests passed.');
  process.exit(fails.length ? 1 : 0);
}
