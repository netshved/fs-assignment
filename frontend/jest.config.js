/** Unit tests target framework-free logic (reducers, selectors, geometry), so plain ts-jest is enough. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'json'],
  transform: {
    '^.+\\.(ts|mjs)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // @ngrx and @angular ship ESM-only bundles that must be transpiled for Jest.
  transformIgnorePatterns: ['node_modules/(?!(@ngrx|@angular|tslib)/)'],
};
