module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalTeardown: './tests/utilities/globalTeardown.js'
};