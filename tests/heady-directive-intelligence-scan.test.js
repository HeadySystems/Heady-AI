const {
    findDirectiveFiles,
    checkSecretIgnoreCoverage,
} = require('../scripts/heady-directive-intelligence-scan');

describe('heady directive intelligence scan', () => {
    test('findDirectiveFiles captures policy/workflow/law files', () => {
        const files = [
            '03-UNBREAKABLE_LAWS.md',
            'ACTIVE_LAYER_POLICY.md',
            'workflows/auto-mtls-deployment.yaml',
            'src/index.js'
        ];

        const result = findDirectiveFiles(files);
        expect(result).toEqual(expect.arrayContaining([
            '03-UNBREAKABLE_LAWS.md',
            'ACTIVE_LAYER_POLICY.md',
            'workflows/auto-mtls-deployment.yaml',
        ]));
        expect(result).not.toContain('src/index.js');
    });

    test('checkSecretIgnoreCoverage validates expected secret ignore entries', () => {
        const coverage = checkSecretIgnoreCoverage();
        expect(coverage.requiredEntries.length).toBeGreaterThan(0);
        expect(coverage.covered).toBe(true);
        expect(coverage.missingEntries).toHaveLength(0);
    });
});
