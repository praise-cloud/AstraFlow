/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-device$': '<rootDir>/__mocks__/expo-device.js',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
  },
  setupFiles: ['./jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testEnvironment: 'node',
};
