module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    // The build tsconfig pins "types" to node only; tests also need jest globals.
    '^.+\\.ts$': ['ts-jest', { tsconfig: { types: ['jest', 'node'] } }],
  },
};
