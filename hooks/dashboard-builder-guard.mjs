#!/usr/bin/env node
// PreToolUse guard for the dashboard-builder subagent.
// Writes: only .dashboard/ and the agent's memory. Artifact: read-only, own
// dashboard. ArtifactData: only the URL in .dashboard/artifact.json. Bash: only `date -Iseconds`.
// Silent exit = no opinion (normal permissions apply); never auto-approves.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MEMORY_DIR = process.env.DASHBOARD_GUARD_MEMORY_DIR
  || path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'agent-memory', 'dashboard-builder');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `dashboard-builder guard: ${reason}`,
    },
  }));
  process.exit(0);
}
const allow = () => process.exit(0);

// Resolve symlinks on the longest existing prefix of p.
function real(p) {
  let cur = path.resolve(p);
  const rest = [];
  while (!fs.existsSync(cur)) {
    rest.unshift(path.basename(cur));
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return path.join(fs.realpathSync(cur), ...rest);
}
function inside(p, dir) {
  const r = path.relative(dir, p);
  return r === '' || (r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r));
}
const normUrl = (u) => String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.stderr.write('dashboard-builder guard: unreadable hook input, denying\n');
  process.exit(2);
}

const tool = input.tool_name || '';
const ti = input.tool_input || {};
const cwd = input.cwd || process.cwd();
// cwd may already be inside .dashboard/: use that dir, not a nested one
const segs = path.resolve(cwd).split(path.sep);
const at = segs.lastIndexOf('.dashboard');
const dashRaw = at > 0 ? segs.slice(0, at + 1).join(path.sep) : path.join(cwd, '.dashboard');
const dashDir = real(dashRaw);
const memDir = real(MEMORY_DIR);
const artifactJson = path.join(dashDir, 'artifact.json');

function dashIsSymlink() {
  try { return fs.lstatSync(dashRaw).isSymbolicLink(); } catch { return false; }
}
function readOwnUrl() {
  try {
    const j = JSON.parse(fs.readFileSync(artifactJson, 'utf8'));
    return j && typeof j.url === 'string' && j.url.trim() ? normUrl(j.url) : null;
  } catch { return null; }
}
const ownUrl = readOwnUrl();

function inDashboard(p) {
  if (typeof p !== 'string' || !p) return false;
  if (dashIsSymlink()) return false;
  return inside(real(path.resolve(cwd, p)), dashDir);
}
function writable(p) {
  if (typeof p !== 'string' || !p) return false;
  const abs = real(path.resolve(cwd, p));
  return inDashboard(p) || inside(abs, memDir);
}
function requireOwn(url, what) {
  if (!ownUrl) deny(`${what}: no dashboard URL in .dashboard/artifact.json yet`);
  if (normUrl(url) !== ownUrl) deny(`${what}: only the own dashboard (${ownUrl}) is allowed`);
}

// artifact.json is written by the caller only, so the target can't be swapped.
function guardArtifactJson(filePath) {
  if (real(path.resolve(cwd, filePath)) === artifactJson) deny('artifact.json is written by the caller');
}

switch (tool) {
  case 'Read':
  case 'ToolSearch':
  case 'SubagentHandback': // report back to the caller
    allow();

  case 'Bash':
    if (String(ti.command || '').trim() === 'date -Iseconds') allow();
    deny('Bash is limited to `date -Iseconds`');

  case 'Write':
    if (!writable(ti.file_path)) deny(`write outside .dashboard/ and agent memory: ${ti.file_path}`);
    guardArtifactJson(ti.file_path);
    allow();

  case 'Edit': {
    if (!writable(ti.file_path)) deny(`edit outside .dashboard/ and agent memory: ${ti.file_path}`);
    guardArtifactJson(ti.file_path);
    allow();
  }

  case 'Artifact': {
    const action = ti.action || 'publish';
    if (action === 'quickstart') allow();
    if (action === 'read') {
      if (ti.type_url && !ti.url) allow();
      requireOwn(ti.url, 'Artifact read');
      allow();
    }
    if (action === 'open') { requireOwn(ti.url, 'Artifact open'); allow(); }
    // the caller publishes: only its own publish arms comment wake-ups
    if (action === 'publish') deny('publishing is done by the caller: reply READY TO PUBLISH');
    deny(`Artifact ${action} is not allowed`);
  }

  case 'ArtifactData':
    requireOwn(ti.url, 'ArtifactData');
    for (const w of Array.isArray(ti.writes) ? ti.writes : []) {
      if (w?.file_path && !inDashboard(w.file_path)) deny(`batch file outside .dashboard/: ${w.file_path}`);
    }
    if (ti.file_path && !inDashboard(ti.file_path)) deny(`file outside .dashboard/: ${ti.file_path}`);
    if (ti.out_dir && !inDashboard(ti.out_dir)) deny(`out_dir outside .dashboard/: ${ti.out_dir}`);
    allow();

  default:
    deny(`tool ${tool} is not allowed for dashboard-builder`);
}
