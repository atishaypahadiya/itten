// Tests the ITTEN action's parts that run without a browser: the baseline
// comparison and the fail-on gate, page addressing, the static server, the
// Markdown, and the pull request comment against a local stand-in for the
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
import { pageUrl, pageName, slug, parsePages } from './action/run.js';
import { start } from './serve.js';

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
    ok(render({ ...s, pages: Array(400).fill(s.pages[0]) }, { limit: 5000 }).length <= 5000, 'the comment is cut to the limit');

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
  const fails = await run();
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(fails.length ? `\n${fails.length} failure(s).` : 'Action tests passed.');
  process.exit(fails.length ? 1 : 0);
}
