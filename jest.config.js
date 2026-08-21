module.exports = {
  testMatch: ['**/tests/**/*.test.js'],
  modulePathIgnorePatterns: [
    '<rootDir>/.claude/worktrees/',
    '<rootDir>/extensions/vscode-extension/'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/.claude/worktrees/',
    '<rootDir>/extensions/vscode-extension/',
    'octree-manager.test.js',
    'buddy-system.test.js',
    'liquid-colab-services.test.js',
    'spatial-embedder.test.js',
    'cross-device-sync.runtime.test.js'
  ]
};
