// Signs release builds with the key in a properties file kept outside the repo (path in
// LUMEN_SIGNING, default C:/Lumen/stored/keys/lumen-release.properties). Without the file,
// release builds fall back to the debug key, as Expo's template does.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// lumen release signing";

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;
    gradle = gradle.replace(
      /signingConfigs\s*\{/,
      (m) => `${m}
        ${MARK}
        release {
            def props = new Properties()
            def file = new File(System.getenv("LUMEN_SIGNING") ?: "C:/Lumen/stored/keys/lumen-release.properties")
            if (file.exists()) {
                file.withInputStream { props.load(it) }
                storeFile new File(props.storeFile)
                storePassword props.storePassword
                keyAlias props.keyAlias
                keyPassword props.keyPassword
            }
        }`,
    );
    // The release build type uses it when the key is there.
    gradle = gradle.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig (signingConfigs.release.storeFile ? signingConfigs.release : signingConfigs.debug)`,
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
