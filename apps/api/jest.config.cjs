module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/solicitudes.test.ts', '**/*.unit.test.ts'],
  clearMocks: true,
};
