// Keep rules for R8 (release builds shrink code). expo-background-task runs on WorkManager,
// which builds its Room database by reflection: without these rules R8 removes the generated
// WorkDatabase_Impl constructor and Lumen 1.3.0 crashed on launch
// ("NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init> []").

const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const MARK = "# lumen: keep rules";
const RULES = `
${MARK}
-keep class * extends androidx.room.RoomDatabase { <init>(...); }
-keep class androidx.work.** { *; }
-keep class * extends androidx.work.ListenableWorker { <init>(...); }
-keep class expo.modules.backgroundtask.** { *; }
-keep class expo.modules.taskManager.** { *; }
-keep class expo.modules.notifications.** { *; }
-dontwarn androidx.work.**
`;

module.exports = function withKeepRules(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (!text.includes(MARK)) fs.writeFileSync(file, text + RULES);
      return cfg;
    },
  ]);
};
