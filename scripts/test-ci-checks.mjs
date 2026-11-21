// Tests for the CI checks: the trailer check (scripts/check-commits.mjs), the leak scan's symlink and binary rules,
// and the shape of .github/workflows/pages.yml. travel.b.ci@PrompTugal.dinis, 19 Nov 2026 (security@'s controls 6 to 10).
// Node 18+, no dependencies. Throwaway git repositories are made in os.tmpdir() and removed at the end.
// Every key-shaped string is built from parts at run time, so this file does not match the leak scan's patterns.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, copyFileSync, existsSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const checkSrc = readFileSync(join(here, 'check-commits.mjs'), 'utf8');
const leakSrc = join(here, 'leak-scan.mjs');
const scratch = mkdtempSync(join(tmpdir(), 'ci-checks-'));
let fails = 0, passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) passes++;
  else { fails++; console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`); }
};

// ---- throwaway repositories ----
const gitEnv = (date) => ({
  ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid',
  ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
});
const git = (cwd, args, date) => execFileSync('git', args, { cwd, env: gitEnv(date), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let n = 0;
const newRepo = () => {
  const d = join(scratch, `r${++n}`);
  mkdirSync(d);
  git(d, ['init', '-q', '-b', 'main']);
  return d;
};
const GOOD = 'Agent: test@AgentiCCells.dinis';
const commit = (repo, msg, { trailer = GOOD, date, files = {} } = {}) => {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, f)), { recursive: true });
    writeFileSync(join(repo, f), body);
  }
  git(repo, ['add', '-A']);
  const m = trailer ? `${msg}\n\n${trailer}\n` : `${msg}\n`;
  git(repo, ['commit', '-q', '--allow-empty', '-m', m], date);
  return git(repo, ['rev-parse', 'HEAD']);
};
// The checker with its pinned base replaced by this throwaway repository's base. The replacement must happen.
const patched = (base) => {
  const out = checkSrc.replace(/const TRUSTED_BASE = '[0-9a-f]{40}';/, `const TRUSTED_BASE = '${base}';`);
  if (out === checkSrc && !checkSrc.includes(base)) throw new Error('check-commits.mjs has no TRUSTED_BASE constant to replace');
  return out;
};
const runChecker = (repo, script, before, after) => {
  const f = join(scratch, `checker-${++n}.mjs`);
  writeFileSync(f, script);
  const r = spawnSync(process.execPath, [f, before, after], { cwd: repo, env: gitEnv(), encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

// ---- check-commits.mjs ----
{
  const repo = newRepo();
  const base = commit(repo, 'base', { files: { 'a.txt': 'a' } });
  const script = patched(base);

  commit(repo, 'good', { files: { 'b.txt': 'b' } });
  let r = runChecker(repo, script, base, 'HEAD');
  check('a commit with an Agent trailer passes', r.code === 0, r.out);

  commit(repo, 'bare', { trailer: null, files: { 'c.txt': 'c' } });
  r = runChecker(repo, script, base, 'HEAD');
  check('a commit without an Agent trailer fails', r.code === 1 && /no readable Agent/.test(r.out), r.out);
}
{
  const repo = newRepo();
  const base = commit(repo, 'base', { files: { 'a.txt': 'a' } });
  const script = patched(base);
  const tip = commit(repo, 'good', { files: { 'b.txt': 'b' } });
  // An orphan commit with a valid trailer and a backdated date: ancestry alone decides, so it must fail.
  git(repo, ['checkout', '-q', '--orphan', 'other']);
  git(repo, ['rm', '-rfq', '--cached', '.']);
  const orphan = commit(repo, 'orphan', { date: '2001-01-01T00:00:00Z', files: { 'o.txt': 'o' } });
  let r = runChecker(repo, script, base, orphan);
  check('an orphan commit with a valid trailer and an old date fails', r.code === 1 && /no parent/.test(r.out), r.out);
  r = runChecker(repo, script, '0'.repeat(40), orphan);
  check('an orphan commit fails when there is no usable before', r.code === 1 && /no parent/.test(r.out), r.out);

  // A merge of an unrelated history: the merge has two parents, the other history's root has none.
  git(repo, ['checkout', '-q', 'main']);
  git(repo, ['merge', '-q', '--allow-unrelated-histories', '--no-ff', '-m', `merge\n\n${GOOD}`, 'other'], undefined);
  r = runChecker(repo, script, base, 'HEAD');
  check('a merge of an unrelated history fails', r.code === 1 && /no parent/.test(r.out), r.out);
  check('the merge test really merged', tip !== git(repo, ['rev-parse', 'HEAD']));
}
{
  // Control 7: the checker must run from the base copy. A commit that deletes the checker and adds an untrailered
  // commit passes nothing when the base's copy is the one that runs.
  const repo = newRepo();
  const seed = commit(repo, 'seed', { files: { 'a.txt': 'a' } });
  const withChecker = patched(seed);
  writeFileSync(join(repo, 'x'), '');   // keep git quiet about an empty add
  const base = commit(repo, 'base with the checker', { files: { 'scripts/check-commits.mjs': withChecker } });
  const script = patched(base);
  const baseCopy = git(repo, ['show', `${base}:scripts/check-commits.mjs`]);
  check('the base commit holds the checker', baseCopy.includes('TRUSTED_BASE'));
  git(repo, ['rm', '-q', 'scripts/check-commits.mjs']);
  commit(repo, 'delete the checker');
  commit(repo, 'untrailered', { trailer: null, files: { 'd.txt': 'd' } });
  const r = runChecker(repo, script, base, 'HEAD');
  check('deleting the checker does not save an untrailered commit (run from the base copy)', r.code === 1 && /no readable Agent/.test(r.out), r.out);
}
{
  // Ancestors of the base are skipped, whatever they hold; commits after it are checked.
  const repo = newRepo();
  commit(repo, 'old and bare', { trailer: null, files: { 'a.txt': 'a' } });
  const base = commit(repo, 'base and bare', { trailer: null, files: { 'b.txt': 'b' } });
  const script = patched(base);
  let r = runChecker(repo, script, '0'.repeat(40), 'HEAD');
  check('ancestors of the base are skipped, the root included', r.code === 0 && /2 in the trusted base skipped/.test(r.out), r.out);
  commit(repo, 'after', { files: { 'c.txt': 'c' } });
  r = runChecker(repo, script, '0'.repeat(40), 'HEAD');
  check('a good commit after the base is checked', r.code === 0 && /\(1 commits checked/.test(r.out), r.out);
  // A commit's date or name never earns a skip.
  commit(repo, 'old date, bare', { trailer: null, date: '2001-01-01T00:00:00Z', files: { 'd.txt': 'd' } });
  r = runChecker(repo, script, '0'.repeat(40), 'HEAD');
  check('a backdated commit after the base is still checked', r.code === 1, r.out);
  // A base that is not in the clone fails closed.
  const other = newRepo();
  commit(other, 'x');
  r = runChecker(other, script, '0'.repeat(40), 'HEAD');
  check('a base missing from the clone fails', r.code === 1 && /trusted base/.test(r.out), r.out);
}

// ---- leak-scan.mjs ----
const leakRepo = () => {
  const repo = newRepo();
  mkdirSync(join(repo, 'scripts'));
  copyFileSync(leakSrc, join(repo, 'scripts', 'leak-scan.mjs'));
  mkdirSync(join(repo, '_site'));
  writeFileSync(join(repo, '_site', 'index.html'), '<p>hello</p>\n');
  writeFileSync(join(repo, 'a.txt'), 'plain text\n');
  return repo;
};
const runLeak = (repo) => {
  const r = spawnSync(process.execPath, [join(repo, 'scripts', 'leak-scan.mjs')], { cwd: repo, env: gitEnv(), encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
{
  const repo = leakRepo();
  git(repo, ['add', '-A']);
  const r = runLeak(repo);
  check('the leak scan passes a clean throwaway repository', r.code === 0 && /^OK/.test(r.out), r.out);
}
{
  const repo = leakRepo();
  symlinkSync('/etc/hostname', join(repo, 'link'));
  git(repo, ['add', '-A']);
  const r = runLeak(repo);
  check('a tracked symlink fails the leak scan', r.code === 1 && /symlink/.test(r.out), r.out);
}
{
  const repo = leakRepo();
  symlinkSync(join(repo, 'a.txt'), join(repo, '_site', 'link.html'));
  const r = runLeak(repo);
  check('a symlink in _site fails the leak scan', r.code === 1 && /symlink/.test(r.out), r.out);
}
{
  const repo = leakRepo();
  mkdirSync(join(repo, 'elsewhere'));
  rmSync(join(repo, '_site'), { recursive: true });
  symlinkSync(join(repo, 'elsewhere'), join(repo, '_site'));
  const r = runLeak(repo);
  check('a symlinked _site fails the leak scan', r.code === 1, r.out);
}
{
  const repo = leakRepo();
  const D = '-'.repeat(5);
  const bin = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), Buffer.from(`${D}BEGIN OPENSSH PRIVATE KEY${D}\n`, 'latin1'), Buffer.from([0, 1, 2, 3])]);
  writeFileSync(join(repo, 'image.png'), bin);
  git(repo, ['add', '-A']);
  const r = runLeak(repo);
  check('a binary file holding a private-key header fails', r.code === 1 && /image\.png/.test(r.out) && /private key block/.test(r.out), r.out);
}

// ---- .github/workflows/pages.yml ----
{
  const raw = readFileSync(join(repoRoot, '.github/workflows/pages.yml'), 'utf8');
  const rawLines = raw.split('\n');
  const code = rawLines.filter((l) => !/^\s*#/.test(l)).join('\n');   // the real steps, not comments
  const must = (name, re) => check(`pages.yml has ${name}`, re.test(code));
  must('GIT_ATTR_SOURCE', /^\s*GIT_ATTR_SOURCE:\s*4b825dc642cb6eb9a060e54bf8d69288fbee4904\s*$/m);
  must('GIT_NO_REPLACE_OBJECTS', /^\s*GIT_NO_REPLACE_OBJECTS:/m);
  must('an empty NODE_OPTIONS', /^\s*NODE_OPTIONS:\s*(''|"")\s*$/m);
  must('is-shallow-repository', /rev-parse --is-shallow-repository/);
  must('merge-base --is-ancestor', /merge-base --is-ancestor/);
  must('diff-tree -m --raw -z', /diff-tree -r -m --raw -z/);
  must('ls-tree -z', /ls-tree -r -z/);
  must('find -type l', /find "\$GITHUB_WORKSPACE" -type l -print0/);
  must('a pinned 40-hex TRUSTED_BASE', /^\s*TRUSTED_BASE:\s*[0-9a-f]{40}\s*$/m);
  must('the node path recorded', /command -v node/);
  must('the artifact download', /actions\/download-artifact@v4/);
  must('the tar listing', /tar [^\n]*-tvf/);
  must('persist-credentials false', /persist-credentials: false/);
  must('fetch-depth 0', /fetch-depth: 0/);
  must('read-only permissions for the security job', /permissions:\n\s+contents: read\n\s+actions: read/);
  check('pages.yml has no node -e', !/node -e|node --eval/.test(code));
  check('pages.yml sets no control over A by input', !/inputs\.|github\.event\.inputs/.test(code));

  // Parse the jobs: keys at two spaces under jobs:.
  const jobs = {};
  let cur = null, inJobs = false;
  for (const l of code.split('\n')) {
    if (/^jobs:\s*$/.test(l)) { inJobs = true; continue; }
    if (inJobs && /^\S/.test(l)) inJobs = false;
    const m = inJobs && l.match(/^ {2}([a-z][a-z0-9_-]*):\s*$/);
    if (m) { cur = m[1]; jobs[cur] = []; continue; }
    if (cur && inJobs) jobs[cur].push(l);
  }
  const jobText = (j) => (jobs[j] || []).join('\n');
  check('pages.yml has the four jobs', ['build', 'security', 'deploy', 'tag'].every((j) => jobs[j]));
  const needs = (j) => (jobText(j).match(/^ {4}needs:\s*(.+)$/m) || [])[1] || '';
  const needsAll = (j, names) => names.every((x) => new RegExp(`\\b${x}\\b`).test(needs(j)));
  check('security needs build', needsAll('security', ['build']));
  check('deploy needs [build, security]', /^\[\s*build\s*,\s*security\s*\]$/.test(needs('deploy').trim()), needs('deploy'));
  check('tag needs security (and build and deploy)', needsAll('tag', ['build', 'security', 'deploy']));
  for (const j of ['security', 'deploy', 'tag']) {
    const ifLine = (jobText(j).match(/^ {4}if:\s*(.+)$/m) || [])[1] || '';
    check(`${j} runs only on refs/heads/dev`, ifLine.includes("github.ref == 'refs/heads/dev'"), ifLine);
  }
  check('tag still waits for the security result', /needs\.security\.result == 'success'/.test(jobText('tag')));
  check('the security job runs no pushed code (no node scripts/ outside the A copies)', !/node scripts\/(build|validate|pull|test-ci-checks)/.test(jobText('security')) && !/\bnpm\b|\bnpx\b/.test(jobText('security')));
  check('the build job runs the new tests', /node scripts\/test-ci-checks\.mjs/.test(jobText('build')) && /node scripts\/test-leak-scan\.mjs/.test(jobText('build')));

  // bash -n over every run: block (indentation-aware; ${{ }} expressions replaced, as the runner does before bash).
  const blocks = [];
  for (let i = 0; i < rawLines.length; i++) {
    const m = rawLines[i].match(/^(\s*)(?:- )?run:\s*(.*)$/);
    if (!m) continue;
    const keyIndent = rawLines[i].match(/^\s*/)[0].length + (/^\s*- run:/.test(rawLines[i]) ? 2 : 0);
    if (/^[|>][-+]?\s*$/.test(m[2])) {
      const body = [];
      let indent = null;
      for (let j = i + 1; j < rawLines.length; j++) {
        const l = rawLines[j];
        if (l.trim() === '') { body.push(''); continue; }
        const ind = l.match(/^\s*/)[0].length;
        if (ind <= keyIndent) break;
        if (indent === null) indent = ind;
        body.push(l.slice(indent));
      }
      blocks.push({ line: i + 1, text: body.join('\n') + '\n' });
    } else if (m[2]) {
      blocks.push({ line: i + 1, text: m[2] + '\n' });
    }
  }
  check('pages.yml has run blocks to check', blocks.length >= 10, String(blocks.length));
  for (const b of blocks) {
    const text = b.text.replace(/\$\{\{[^}]*\}\}/g, 'X');
    const r = spawnSync('bash', ['-n'], { input: text, encoding: 'utf8' });
    check(`bash -n on the run block at line ${b.line}`, r.status === 0, r.stderr);
  }
}

// ---- the security job's run blocks, executed ----
// The real `run:` blocks of the `security` job are cut out of pages.yml at test time (no YAML library) and run under
// bash against throwaway repositories and fake inputs. Each case asserts the exit code and a substring of the message.
{
  const wf = readFileSync(join(repoRoot, '.github/workflows/pages.yml'), 'utf8').split('\n');
  const s0 = wf.findIndex((l) => /^  security:\s*$/.test(l));
  let s1 = wf.findIndex((l, i) => i > s0 && /^  [A-Za-z_-]+:\s*$/.test(l));
  if (s1 < 0) s1 = wf.length;
  const job = wf.slice(s0, s1);
  const stepRun = (prefix) => {
    const i = job.findIndex((l) => /^ {6}- name:/.test(l) && l.replace(/^ {6}- name:\s*/, '').replace(/^"|"$/g, '').startsWith(prefix));
    if (i < 0) throw new Error(`no security step named ${prefix}`);
    const r = job.findIndex((l, k) => k > i && /^ {8}run: \|\s*$/.test(l));
    const nextStep = job.findIndex((l, k) => k > i && /^ {6}- /.test(l));
    if (r < 0 || (nextStep >= 0 && nextStep < r)) throw new Error(`step ${prefix} has no run block`);
    const body = [];
    for (let k = r + 1; k < job.length; k++) {
      if (job[k].trim() === '') { body.push(''); continue; }
      if (!job[k].startsWith('          ')) break;
      body.push(job[k].slice(10));
    }
    return body.join('\n') + '\n';
  };
  const blk = {
    c12: stepRun('Checks 1 and 2'), c3: stepRun('Check 3'), c46: stepRun('Checks 4 to 6'),
    c7: stepRun('Check 7'), c8pre: stepRun('Check 8, before'), c8: stepRun('Check 8: vet'),
  };
  check('security blocks extracted', Object.values(blk).every((t) => t.length > 100 || t === blk.c8pre));

  const SHA40 = (c) => c.repeat(40);
  const BASE40 = SHA40('b');
  // A workspace repository plus a separate RUNNER_TEMP; returns the environment the blocks expect.
  const mkEnv = (repo, extra = {}) => {
    const rt = join(scratch, `rt${++n}`);
    mkdirSync(rt);
    return {
      ...gitEnv(), GITHUB_WORKSPACE: repo, RUNNER_TEMP: rt, GITHUB_RUN_ID: '100', GITHUB_REPOSITORY: 'o/r',
      GITHUB_API_URL: 'https://api.invalid', GH_TOKEN: 'not-a-token', NODE_BIN: process.execPath, TRUSTED_BASE: BASE40,
      GIT_ATTR_SOURCE: '4b825dc642cb6eb9a060e54bf8d69288fbee4904', GIT_NO_REPLACE_OBJECTS: '1', NODE_OPTIONS: '', ...extra,
    };
  };
  const runBlock = (text, env, cwd) => {
    const f = join(scratch, `block-${++n}.sh`);
    writeFileSync(f, text);
    const r = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', f], { cwd: cwd || env.GITHUB_WORKSPACE, env, encoding: 'utf8', timeout: 60000 });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const expectFail = (name, r, msg) => check(name, r.code !== 0 && r.out.includes(msg), `code ${r.code}, wanted "${msg}", got: ${r.out.slice(0, 300)}`);
  const expectPass = (name, r, msg) => check(name, r.code === 0 && r.out.includes(msg), `code ${r.code}, wanted "${msg}", got: ${r.out.slice(0, 300)}`);
  const head = (repo) => git(repo, ['rev-parse', 'HEAD']);
  const setAnchor = (env, a) => writeFileSync(join(env.RUNNER_TEMP, 'anchor.sha'), a + '\n');

  // ---- checks 1 and 2 ----
  {
    const r = newRepo(); commit(r, 'one', { files: { 'a.txt': '1' } });
    let env = mkEnv(r, { GITHUB_SHA: head(r) });
    expectPass('c12: a clean full clone passes', runBlock(blk.c12, env), 'checks 1 and 2 passed');
    env = mkEnv(r, { GITHUB_SHA: SHA40('1') });
    expectFail('c12: HEAD not the pushed commit fails', runBlock(blk.c12, env), 'HEAD is not the pushed commit');

    const src = newRepo(); commit(src, 'one', { files: { 'a.txt': '1' } }); commit(src, 'two', { files: { 'a.txt': '2' } });
    const sh = join(scratch, `shallow${++n}`);
    git(scratch, ['clone', '-q', '--depth', '1', `file://${src}`, sh]);
    env = mkEnv(sh, { GITHUB_SHA: head(sh) });
    expectFail('c12: a shallow clone fails', runBlock(blk.c12, env), 'the clone is shallow');

    for (const [label, file, msg] of [
      ['a pushed _site/x', '_site/x', 'under _site'],
      ['a pushed .gitattributes', '.gitattributes', 'a .gitattributes is pushed'],
      ['a pushed a/.gitattributes', 'a/.gitattributes', 'a .gitattributes is pushed'],
    ]) {
      const q = newRepo(); commit(q, 'one', { files: { 'a.txt': '1', [file]: 'x' } });
      expectFail(`c12: ${label} fails`, runBlock(blk.c12, mkEnv(q, { GITHUB_SHA: head(q) })), msg);
    }
  }

  // ---- check 3, with a fake curl ----
  {
    const bin = join(scratch, `fakebin${++n}`); mkdirSync(bin);
    writeFileSync(join(bin, 'curl'), `#!/bin/bash
# Fake curl: writes the fixture for the URL into the -o file and prints the -w code.
out=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in -o) out=$2; shift 2 ;; -w|-H|--max-time) shift 2 ;; -*) shift ;; *) url=$1; shift ;; esac
done
if [[ "$url" =~ /workflows/pages.yml/runs.*page=([0-9]+) ]]; then key="page\${BASH_REMATCH[1]}"
elif [[ "$url" =~ /actions/runs/([0-9]+)/jobs ]]; then key="jobs-\${BASH_REMATCH[1]}"
else key="unknown"; fi
echo "$url" >> "$FIX/urls.log"
if [ -e "$FIX/code-$key" ]; then echo '{}' > "$out"; cat "$FIX/code-$key"; exit 0; fi
if [ -e "$FIX/$key.json" ]; then cp "$FIX/$key.json" "$out"; printf 200; else echo '{}' > "$out"; printf 404; fi
`, { mode: 0o755 });
    const A1 = SHA40('a'), A2 = SHA40('c'), A3 = SHA40('d');
    const mk = (fix) => {
      const d = join(scratch, `fix${++n}`); mkdirSync(d);
      for (const [k, v] of Object.entries(fix)) writeFileSync(join(d, k), typeof v === 'string' ? v : JSON.stringify(v));
      return d;
    };
    const run = (id, sha, t) => ({ id, head_sha: sha, created_at: t });
    const jobs = (ok) => ({ jobs: [{ name: 'build', conclusion: 'success' }, { name: 'security', conclusion: ok ? 'success' : 'failure' }] });
    const go = (fix) => {
      const r = newRepo(); commit(r, 'x');
      const env = mkEnv(r, { GITHUB_SHA: head(r), FIX: mk(fix), PATH: `${bin}:${process.env.PATH}` });
      const res = runBlock(blk.c3, env);
      let a = ''; try { a = readFileSync(join(env.RUNNER_TEMP, 'anchor.sha'), 'utf8').trim(); } catch { /* none */ }
      return { ...res, a };
    };
    let r = go({ 'page1.json': { workflow_runs: [run(11, A1, '2026-01-01T00:00:00Z')] }, 'jobs-11.json': jobs(false),
      'page2.json': { workflow_runs: [run(12, A2, '2025-12-01T00:00:00Z')] }, 'jobs-12.json': jobs(true) });
    check('c3: a qualifying run on page 2 gives A', r.code === 0 && r.a === A2 && r.out.includes(`A is ${A2}`), `${r.code} ${r.a} ${r.out}`);
    r = go({ 'page1.json': { workflow_runs: [] } });
    check('c3: an empty page takes the bootstrap', r.code === 0 && r.a === BASE40 && r.out.includes('bootstrap: A is the pinned trusted base'), `${r.code} ${r.a} ${r.out}`);
    r = go({ 'page1.json': { workflow_runs: [run(11, A1, '2026-01-01T00:00:00Z')] }, 'jobs-11.json': jobs(false), 'page2.json': { workflow_runs: [] } });
    check('c3: runs without a passing security job take the bootstrap', r.code === 0 && r.a === BASE40, `${r.code} ${r.a} ${r.out}`);
    r = go({ 'code-page1': '500' });
    check('c3: a 500 fails with no bootstrap', r.code !== 0 && r.out.includes('answered 500') && r.a === '' && !r.out.includes('bootstrap: A is'), `${r.code} ${r.a} ${r.out}`);
    r = go({ 'page1.json': { workflow_runs: [run(11, 'xyz', '2026-01-01T00:00:00Z')] }, 'jobs-11.json': jobs(true) });
    check('c3: a head_sha that is not 40 hex digits fails', r.code !== 0 && r.out.includes('head_sha is not 40 hex digits') && r.a === '', `${r.code} ${r.a} ${r.out}`);
    r = go({ 'page1.json': { workflow_runs: [run(100, A1, '2026-03-01T00:00:00Z'), run(11, A3, '2026-01-01T00:00:00Z')] },
      'jobs-100.json': jobs(true), 'jobs-11.json': jobs(true) });
    check('c3: the current run id is excluded', r.code === 0 && r.a === A3, `${r.code} ${r.a} ${r.out}`);
    r = go({ 'page1.json': { workflow_runs: [run(13, A1, '2026-02-01T00:00:00Z'), run(11, A3, '2026-01-01T00:00:00Z')] },
      'jobs-13.json': jobs(false), 'jobs-11.json': jobs(true) });
    check('c3: a run whose security job failed is skipped', r.code === 0 && r.a === A3, `${r.code} ${r.a} ${r.out}`);
    r = go({ 'page1.json': { workflow_runs: [run('x1', A1, '2026-02-01T00:00:00Z')] } });
    check('c3: a run id that is not a number fails', r.code !== 0 && r.out.includes('a run id is not a number'), `${r.code} ${r.out}`);
    r = go({ 'page1.json': { nope: 1 } });
    check('c3: a reply with no workflow_runs array fails', r.code !== 0 && r.out.includes('no workflow_runs array'), `${r.code} ${r.out}`);
  }

  // ---- checks 4 to 6 ----
  {
    // A repository with a base commit; returns the base sha. The block is run with A as given.
    const base = (files = { 'a.txt': '1' }) => { const r = newRepo(); const a = commit(r, 'base', { files }); return { r, a }; };
    const go46 = (r, a) => { const env = mkEnv(r, { GITHUB_SHA: head(r) }); setAnchor(env, a); return runBlock(blk.c46, env); };
    const sym = (r, name, target = 'a.txt') => symlinkSync(target, join(r, name));
    let t = base(); commit(t.r, 'two', { files: { 'b.txt': '2' } });
    expectPass('c46: a clean range passes', go46(t.r, t.a), 'checks 4 to 6 passed');

    t = base(); const main = git(t.r, ['rev-parse', '--abbrev-ref', 'HEAD']);
    git(t.r, ['checkout', '-q', '-b', 'side']); const side = commit(t.r, 'side', { files: { 's.txt': '1' } });
    git(t.r, ['checkout', '-q', main]); commit(t.r, 'main two', { files: { 'm.txt': '1' } });
    expectFail('c46: A not an ancestor fails', go46(t.r, side), 'A is not an ancestor');
    expectFail('c46: A not in the clone fails', go46(t.r, SHA40('e')), 'A is not in this clone');
    expectFail('c46: A not 40 hex digits fails', go46(t.r, 'abc'), 'A is not 40 hex digits');

    t = base(); const m2 = git(t.r, ['rev-parse', '--abbrev-ref', 'HEAD']);
    git(t.r, ['checkout', '-q', '--orphan', 'orph']); git(t.r, ['rm', '-rf', '-q', '.']);
    commit(t.r, 'orphan', { files: { 'o.txt': '1' } });
    git(t.r, ['checkout', '-q', m2]); git(t.r, ['merge', '-q', '--allow-unrelated-histories', '--no-ff', '-m', 'merge orphan\n\n' + GOOD, 'orph']);
    expectFail('c46: an orphan merge in A..AFTER fails', go46(t.r, t.a), 'has no parent');

    t = base(); sym(t.r, 'ln'); commit(t.r, 'add symlink');
    git(t.r, ['rm', '-q', 'ln']); commit(t.r, 'remove symlink');
    expectFail('c46: a symlink added then removed later fails', go46(t.r, t.a), 'adds a symlink');

    t = base(); const m3 = git(t.r, ['rev-parse', '--abbrev-ref', 'HEAD']);
    git(t.r, ['checkout', '-q', '-b', 'x']); commit(t.r, 'x side', { files: { 'x.txt': '1' } });
    git(t.r, ['checkout', '-q', m3]); commit(t.r, 'main side', { files: { 'y.txt': '1' } });
    git(t.r, ['merge', '-q', '--no-ff', '--no-commit', 'x']); sym(t.r, 'mergelink'); git(t.r, ['add', 'mergelink']);
    git(t.r, ['commit', '-q', '-m', 'merge with a link\n\n' + GOOD]);
    git(t.r, ['rm', '-q', 'mergelink']); commit(t.r, 'remove the link');
    expectFail('c46: a symlink added in a merge only fails (needs -m)', go46(t.r, t.a), 'adds a symlink');

    t = base(); git(t.r, ['update-index', '--add', '--cacheinfo', `160000,${SHA40('9')},sub`]);
    git(t.r, ['commit', '-q', '-m', 'gitlink\n\n' + GOOD]);
    expectFail('c46: a gitlink fails', go46(t.r, t.a), 'adds a gitlink');

    t = base(); commit(t.r, 'two'); sym(t.r, 'untracked');
    expectFail('c46: an untracked symlink on disk fails', go46(t.r, t.a), 'the workspace holds a symlink');
    t = base(); commit(t.r, 'two'); symlinkSync('/nonexistent', join(t.r, '.git', 'planted'));
    expectFail('c46: a symlink under .git fails', go46(t.r, t.a), 'the workspace holds a symlink');

    t = base();
    commit(t.r, 'odd names', { files: { 'new\nline.txt': '1', 'sp ace\ttab.txt': '2', "q'uote\"d.txt": '3', 'café.txt': '4', 'old.txt': 'renamed content that is long enough to match' } });
    git(t.r, ['mv', 'old.txt', 'moved\nname.txt']); commit(t.r, 'rename');
    expectPass('c46: odd and newline file names do not cause a false failure', go46(t.r, t.a), 'checks 4 to 6 passed');
  }

  // ---- check 7 ----
  {
    const mkA = (withChecker) => {
      const r = newRepo();
      const files = { 'scripts/leak-scan.mjs': "console.log('A-LEAK-SCAN');\n", 'scripts/README': 'x' };
      if (withChecker) files['scripts/check-commits.mjs'] = "console.log('A-CHECKER-MARKER', process.argv.slice(2).join(' '));\n";
      const a = commit(r, 'base', { files });
      return { r, a };
    };
    let t = mkA(true);
    commit(t.r, 'pushed', { files: {
      'scripts/check-commits.mjs': "console.log('PUSHED-CHECKER'); process.exit(1);\n",
      'scripts/commit-exemptions.json': '{"exempt":["all"]}', 'scripts/test-leak-scan.mjs': "console.log('PUSHED-TEST'); process.exit(1);\n" } });
    let env = mkEnv(t.r, { GITHUB_SHA: head(t.r) }); setAnchor(env, t.a);
    const res = runBlock(blk.c7, env);
    check('c7: the checker from A runs, with its marker, and the pushed exemptions are gone',
      res.code === 0 && res.out.includes(`A-CHECKER-MARKER ${t.a} ${head(t.r)}`) && !res.out.includes('PUSHED') &&
      !existsSync(join(t.r, 'scripts/commit-exemptions.json')) && !existsSync(join(t.r, 'scripts/test-leak-scan.mjs')) &&
      readFileSync(join(t.r, 'scripts/check-commits.mjs'), 'utf8').includes('A-CHECKER-MARKER'), `${res.code} ${res.out}`);
    t = mkA(false); commit(t.r, 'pushed', { files: { 'scripts/check-commits.mjs': "console.log('PUSHED-CHECKER');\n" } });
    env = mkEnv(t.r, { GITHUB_SHA: head(t.r) }); setAnchor(env, t.a);
    expectFail('c7: A without scripts/check-commits.mjs fails', runBlock(blk.c7, env), 'A has no scripts/check-commits.mjs');
  }

  // ---- check 8 ----
  {
    const ws = () => { const r = newRepo(); commit(r, 'x'); return r; };
    let r = ws(); let env = mkEnv(r);
    expectPass('c8pre: nothing in the way passes', runBlock(blk.c8pre, env), '');
    mkdirSync(join(env.RUNNER_TEMP, 'pages'));
    expectFail('c8pre: an existing pages directory fails', runBlock(blk.c8pre, env), 'exists before the download');
    env = mkEnv(r); symlinkSync('/nonexistent', join(env.RUNNER_TEMP, 'site'));
    expectFail('c8pre: a dangling site symlink fails', runBlock(blk.c8pre, env), 'exists before the download');

    // Artifact fixtures built with tar from a staging directory.
    const stage = () => { const d = join(scratch, `stage${++n}`); mkdirSync(d); writeFileSync(join(d, 'index.html'), '<p>hi</p>'); mkdirSync(join(d, 'sub')); writeFileSync(join(d, 'sub', 'p.html'), 'p'); return d; };
    const tarUp = (d, out, extra = [], members = ['.']) => {
      const x = spawnSync('tar', ['-cf', out, ...extra, ...(members.length ? ['-C', d, ...members] : [])], { encoding: 'utf8' });
      if (x.status !== 0) throw new Error('tar failed: ' + x.stderr);
    };
    const stubDir = join(scratch, `stub${++n}`); mkdirSync(stubDir);
    const stub = join(stubDir, 'node-stub');
    writeFileSync(stub, '#!/bin/sh\necho "stub-ran $*" > "$RUNNER_TEMP/stub.log"\n', { mode: 0o755 });
    const go8 = (build, { site = false } = {}) => {
      const repo = ws(); const e = mkEnv(repo, { NODE_BIN: stub });
      mkdirSync(join(e.RUNNER_TEMP, 'pages'));
      if (build) build(join(e.RUNNER_TEMP, 'pages', 'artifact.tar'), e);
      if (site) mkdirSync(join(repo, '_site'));
      const res = runBlock(blk.c8, e);
      return { ...res, repo, e };
    };
    let g = go8((f) => tarUp(stage(), f));
    check('c8: a good artifact passes and the leak scan is called', g.code === 0 && existsSync(join(g.repo, '_site/index.html')) &&
      readFileSync(join(g.e.RUNNER_TEMP, 'stub.log'), 'utf8').includes('stub-ran scripts/leak-scan.mjs'), `${g.code} ${g.out}`);
    g = go8((f) => { const d = stage(); writeFileSync(join(d, 'new\nline.html'), 'n'); tarUp(d, f); });
    check('c8: a member name with a newline is one entry and passes', g.code === 0 && existsSync(join(g.repo, '_site/index.html')), `${g.code} ${g.out}`);
    g = go8((f) => { const d = stage(); symlinkSync('/etc/passwd', join(d, 'sym\nlink')); tarUp(d, f); });
    expectFail('c8: a symlink member with a newline in its name fails', g, 'not a regular file or a directory');
    g = go8((f) => { const d = stage(); symlinkSync('index.html', join(d, 'sym')); tarUp(d, f); });
    expectFail('c8: a symlink member fails', g, 'not a regular file or a directory');
    g = go8((f) => { const d = stage(); linkSync(join(d, 'index.html'), join(d, 'hard')); tarUp(d, f); });
    expectFail('c8: a hard link member fails', g, 'not a regular file or a directory');
    g = go8((f) => { const d = stage(); tarUp(d, f, ['-P'], [join(d, 'index.html')]); });
    expectFail('c8: an absolute member name fails', g, 'an absolute path');
    g = go8((f) => { const d = stage(); tarUp(d, f, ['-P', '--transform=s,^,../,'], ['index.html']); });
    expectFail('c8: a .. member name fails', g, 'a .. component');
    g = go8((f) => tarUp(stage(), f), { site: true });
    expectFail('c8: an existing workspace _site fails', g, 'the workspace already has _site');
    g = go8((f) => tarUp(stage(), f, ['-T', '/dev/null'], []));
    expectFail('c8: an empty tar fails', g, 'the artifact is empty');
    g = go8(null);
    expectFail('c8: a missing artifact fails', g, 'missing or not a regular file');
    g = go8((f) => { const d = stage(); rmSync(join(d, 'index.html')); tarUp(d, f); });
    expectFail('c8: an artifact with no index.html fails', g, 'no index.html');
  }
}

rmSync(scratch, { recursive: true, force: true });
if (fails) { console.error(`test-ci-checks: ${fails} failed, ${passes} passed`); process.exit(1); }
console.log(`test-ci-checks: OK (${passes} checks)`);
