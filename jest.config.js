/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["**/tests/**/*.test.ts"],
  globals: {
    "ts-jest": {
      tsconfig: {
        // Relax strict to avoid issues with test utility typings
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    },
  },
  testTimeout: 10000,
};
