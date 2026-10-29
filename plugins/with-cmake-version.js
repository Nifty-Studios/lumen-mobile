// Builds the app's native code with CMake 4.x. Its bundled Ninja (1.12+) handles Windows
// paths over 260 characters, which React Native's codegen object paths exceed; the default
// CMake 3.22 ships Ninja 1.10, which fails with "Filename longer than 260 characters".
const { withAppBuildGradle } = require("expo/config-plugins");

const CMAKE_VERSION = "4.1.2";

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults.contents;
    if (!gradle.includes("externalNativeBuild { cmake { version")) {
      cfg.modResults.contents = gradle.replace(
        /\nandroid\s*\{\n/,
        (m) => `${m}    externalNativeBuild { cmake { version "${CMAKE_VERSION}" } }\n`,
      );
    }
    return cfg;
  });
