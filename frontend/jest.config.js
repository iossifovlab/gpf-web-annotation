module.exports = {
  preset: "jest-preset-angular",
  globalSetup: "jest-preset-angular/global-setup",
  setupFilesAfterEnv: ["<rootDir>/setup-jest.ts"],
  modulePaths: ["<rootDir>/src"],
  coverageReporters: ["html", "text", "text-summary", "cobertura"],
  reporters: [
    "default",
    [
      "jest-junit",
      { outputDirectory: "coverage", outputName: "junit-report.xml" },
    ],
  ],
};
