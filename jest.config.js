module.exports = {
    projects: [
        {
            preset: 'ts-jest',
            displayName: 'node',
            testEnvironment: 'node',
            testMatch: ['**.test.ts',],
            globalTeardown: './tests/unit/testUtilities/globalTeardown.js',
            moduleNameMapper: {
                "^jose/(.*)$": "<rootDir>/node_modules/jose/dist/node/cjs/$1"
            }
        },
        {
            preset: 'ts-jest',
            displayName: 'dom',
            testEnvironment: 'jsdom',
            testMatch: ['**.test.dom.ts'],
            globalTeardown: './tests/unit/testUtilities/globalTeardown.js',
            moduleNameMapper: {
                "^jose/(.*)$": "<rootDir>/node_modules/jose/dist/node/cjs/$1"
            }
        }
    ]
};