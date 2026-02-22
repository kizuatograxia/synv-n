const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/e2e/'
  ],
  // Extend transformIgnorePatterns to handle more ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(?:.+?/)?(?:next-auth|@auth)/)',
  ],
  // Coverage threshold enforcement per VISION.md goal: ">80% line coverage"
  // Set to current baseline (65% lines) to prevent regression while working toward 80%
  // These thresholds apply to core library modules (fees, payments, services, middleware, etc.)
  // Frontend pages and components are excluded as they're handled separately
  coverageThreshold: {
    global: {
      statements: 64,
      branches: 50,
      functions: 65,
      lines: 65,
    },
  },
  collectCoverageFrom: [
    'src/lib/**/*.{js,jsx,ts,tsx}',
    '!src/lib/**/*.d.ts',
    '!src/lib/**/*.stories.{js,jsx,ts,tsx}',
    '!src/lib/**/__tests__/**',
  ],
}

module.exports = createJestConfig(customJestConfig)
