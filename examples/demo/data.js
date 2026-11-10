// Synthetic data in the same shape as the dashboard db. In local mode the
// agent rewrites only this file; index.html reloads it every 10 seconds.
window.DASHBOARD = {
  meta: {
    title: 'Migrate storefront to React 19',
    goal: 'Upgrade the storefront from React 17 to React 19 with no visible regressions.',
    started_at: '2026-11-03T09:02:11+01:00',
    updated_at: '2026-11-03T10:41:37+01:00',
    current_step: 's5',
  },
  steps: [
    { id: 's1', order: 1, title: 'Inventory deprecated APIs', status: 'done', tokens: 41200, result: '37 call sites in 12 files' },
    { id: 's2', order: 2, title: 'Add characterization tests', status: 'done', tokens: 88600, result: '24 tests added, all green on React 17' },
    { id: 's3', order: 3, title: 'Upgrade to React 18', status: 'done', tokens: 63900, result: 'Build passes, 2 hydration warnings fixed' },
    { id: 's4', order: 4, title: 'Replace legacy context', status: 'done', tokens: 52300, result: '5 providers rewritten' },
    { id: 's5', order: 5, title: 'Upgrade to React 19', status: 'running', tokens: null, note: 'Fixing ref forwarding in form inputs' },
    { id: 's6', order: 6, title: 'Update the router', status: 'blocked', tokens: null, note: 'Waiting on a decision about route naming' },
    { id: 's7', order: 7, title: 'Run end-to-end suite', status: 'pending', tokens: null },
    { id: 's8', order: 8, title: 'Write the upgrade notes', status: 'pending', tokens: null },
  ],
  questions: [
    {
      id: 'q1', order: 1,
      text: 'Keep the old route names as redirects, or rename everywhere?',
      default: 'Keep redirects for one release',
      answer: null, seen: null, answer_rev: 0,
    },
    {
      id: 'q2', order: 2,
      text: 'The date picker has no React 19 release. Replace it or pin it?',
      default: 'Pin it and open a follow-up',
      answer: 'Replace it with the native input', answer_rev: 1, seen: 1,
    },
  ],
  results: [
    { id: 'r1', step: 's2', title: 'Characterization tests', summary: '24 tests cover checkout, cart and search before any upgrade.' },
    { id: 'r2', step: 's3', title: 'React 18', summary: 'Concurrent rendering on; two hydration mismatches fixed.' },
  ],
  blockers: [
    { id: 'b1', step: 's6', text: 'Route naming decision is open (see question 1). Working on the default meanwhile.', since: '2026-11-03T10:20:05+01:00', resolved: false },
  ],
};
