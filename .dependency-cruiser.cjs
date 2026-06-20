// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ dependency-cruiser config — orphan/dead-module gate        ║
// ║  Scoped to the clean ESM workspace trees (packages, tooling).      ║
// ║  Pairs with knip in tooling/enforcers/orphans.mjs (intersection =  ║
// ║  high-confidence orphan). © 2026 HeadySystems Inc. — Eric Haywood. ║
// ╚══════════════════════════════════════════════════════════════════╝
module.exports = {
  forbidden: [
    {
      name: 'no-orphans',
      comment: 'Module imported by nothing and importing nothing useful — dead weight.',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '\\.(test|spec)\\.(js|mjs|cjs|ts)$',
          '(^|/)(index|main)\\.(js|mjs|cjs|ts)$',
          '\\.d\\.ts$',
          '(^|/)test/',
          '(^|/)__tests__/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|/dist/|/build/|/\\.data/|/fixtures/|/__tests__/|\\.test\\.|\\.spec\\.)' },
    includeOnly: { path: '^(packages|tooling)/' },
  },
};
