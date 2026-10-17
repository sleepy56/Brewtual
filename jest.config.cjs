module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/server', '<rootDir>/test/integration'],
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  clearMocks: true,
};
