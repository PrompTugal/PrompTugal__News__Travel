// Tests for the CI checks: the trailer check (scripts/check-commits.mjs), the leak scan's symlink and binary rules,
// and the shape of .github/workflows/pages.yml. travel.b.ci@PrompTugal.dinis, 19 Nov 2026 (security@'s controls 6 to 10).
// Node 18+, no dependencies. Throwaway git repositories are made in os.tmpdir() and removed at the end.
// Every key-shaped string is built from parts at run time, so this file does not match the leak scan's patterns.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, copyFileSync } from 'node:fs';
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

rmSync(scratch, { recursive: true, force: true });
if (fails) { console.error(`test-ci-checks: ${fails} failed, ${passes} passed`); process.exit(1); }
console.log(`test-ci-checks: OK (${passes} checks)`);
