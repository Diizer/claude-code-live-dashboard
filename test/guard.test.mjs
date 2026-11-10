import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'dashboard-builder-guard.mjs');
const OWN_URL = 'https://claude.ai/artifact/own-dashboard';

// Fresh project dir + memory dir per test.
function sandbox({ withUrl = true } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')));
  const cwd = path.join(root, 'project');
  const mem = path.join(root, 'memory');
  fs.mkdirSync(path.join(cwd, '.dashboard'), { recursive: true });
  fs.mkdirSync(mem, { recursive: true });
  if (withUrl) fs.writeFileSync(path.join(cwd, '.dashboard', 'artifact.json'), JSON.stringify({ url: OWN_URL }));
  return { root, cwd, mem };
}

// Returns 'allow' (silent exit), 'deny', or 'error'.
function run(sb, tool_name, tool_input, rawStdin) {
  const res = spawnSync('node', [HOOK], {
    input: rawStdin ?? JSON.stringify({ tool_name, tool_input, cwd: sb.cwd }),
    env: { ...process.env, DASHBOARD_GUARD_MEMORY_DIR: sb.mem },
    encoding: 'utf8',
  });
  if (res.status !== 0) return { verdict: 'error', status: res.status };
  if (!res.stdout.trim()) return { verdict: 'allow' };
  const out = JSON.parse(res.stdout).hookSpecificOutput;
  return { verdict: out.permissionDecision, reason: out.permissionDecisionReason };
}

test('writes inside .dashboard/ are allowed', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Write', { file_path: '.dashboard/index.html' }).verdict, 'allow');
  assert.equal(run(sb, 'Edit', { file_path: path.join(sb.cwd, '.dashboard', 'data.js') }).verdict, 'allow');
});

test('writes to the agent memory dir are allowed', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Write', { file_path: path.join(sb.mem, 'style.md') }).verdict, 'allow');
});

test('writes outside .dashboard/ are denied', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Write', { file_path: 'src/app.js' }).verdict, 'deny');
  assert.equal(run(sb, 'Edit', { file_path: '.dashboard/../package.json' }).verdict, 'deny');
  assert.equal(run(sb, 'Write', { file_path: '/etc/hosts' }).verdict, 'deny');
});

test('a symlink inside .dashboard/ cannot be used to escape', () => {
  const sb = sandbox();
  const outside = path.join(sb.root, 'outside');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(sb.cwd, '.dashboard', 'link'));
  assert.equal(run(sb, 'Write', { file_path: '.dashboard/link/stolen.txt' }).verdict, 'deny');
});

test('a symlinked .dashboard/ is denied', () => {
  const sb = sandbox();
  const real = path.join(sb.root, 'elsewhere');
  fs.mkdirSync(real);
  fs.rmSync(path.join(sb.cwd, '.dashboard'), { recursive: true });
  fs.symlinkSync(real, path.join(sb.cwd, '.dashboard'));
  assert.equal(run(sb, 'Write', { file_path: '.dashboard/index.html' }).verdict, 'deny');
});

test('artifact.json cannot be rewritten by the agent', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Write', { file_path: '.dashboard/artifact.json' }).verdict, 'deny');
  assert.equal(run(sb, 'Edit', { file_path: '.dashboard/artifact.json' }).verdict, 'deny');
});

test('Bash runs only `date -Iseconds`', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Bash', { command: 'date -Iseconds' }).verdict, 'allow');
  assert.equal(run(sb, 'Bash', { command: 'date -Iseconds; rm -rf .' }).verdict, 'deny');
  assert.equal(run(sb, 'Bash', { command: 'cat ~/.ssh/id_rsa' }).verdict, 'deny');
});

test('publishing is left to the caller', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Artifact', { file_path: '.dashboard/index.html' }).verdict, 'deny');
  assert.equal(run(sb, 'Artifact', { action: 'publish', url: OWN_URL }).verdict, 'deny');
  assert.equal(run(sb, 'Artifact', { action: 'delete', url: OWN_URL }).verdict, 'deny');
});

test('Artifact read is limited to the own dashboard', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Artifact', { action: 'read', url: OWN_URL + '/?x=1' }).verdict, 'allow');
  assert.equal(run(sb, 'Artifact', { action: 'read', url: 'https://claude.ai/artifact/someone-else' }).verdict, 'deny');
});

test('ArtifactData is limited to the own dashboard', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'ArtifactData', { url: OWN_URL, action: 'list' }).verdict, 'allow');
  assert.equal(run(sb, 'ArtifactData', { url: 'https://claude.ai/artifact/other', action: 'list' }).verdict, 'deny');
  assert.equal(run(sb, 'ArtifactData', { url: OWN_URL, file_path: '../secrets.json' }).verdict, 'deny');
});

test('ArtifactData is denied before the dashboard URL exists', () => {
  const sb = sandbox({ withUrl: false });
  assert.equal(run(sb, 'ArtifactData', { url: OWN_URL, action: 'list' }).verdict, 'deny');
});

test('reads are allowed, unknown tools are denied', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'Read', { file_path: '/anything' }).verdict, 'allow');
  assert.equal(run(sb, 'WebFetch', { url: 'https://example.com' }).verdict, 'deny');
  assert.equal(run(sb, 'Agent', { prompt: 'do the task' }).verdict, 'deny');
});

test('unreadable hook input blocks the call', () => {
  const sb = sandbox();
  const res = run(sb, null, null, 'not json');
  assert.equal(res.verdict, 'error');
  assert.equal(res.status, 2);
});
