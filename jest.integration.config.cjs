module.exports = {
  ...require('./jest.config.cjs'),
  testPathIgnorePatterns: [],
  testMatch: ['**/*.integration.spec.ts'],
  testTimeout: 30000,
};
