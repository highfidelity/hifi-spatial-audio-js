module.exports = {
    projects: [
        {
            preset: 'ts-jest',
            displayName: 'node',
            testEnvironment: 'node',
            testMatch: ['**.test.ts',],
            globalTeardown: './tests/testUtilities/globalTeardown.js',
            moduleNameMapper: {
                "^jose/(.*)$": "<rootDir>/node_modules/jose/dist/node/cjs/$1"
            }
        }
    ]
};