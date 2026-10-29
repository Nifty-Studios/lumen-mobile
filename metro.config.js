// @lumen/shared is a pnpm link to the sibling ../shared repo, so Metro must watch it.
// Bare imports from inside shared resolve from this app's node_modules, never from shared's
// own dev copies (which would bundle a second drizzle-orm / BlockNote).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, "../shared");
const appOrigin = path.join(__dirname, "package.json");

config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];

const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath.startsWith(sharedRoot + path.sep);
  const bare = !moduleName.startsWith(".") && !path.isAbsolute(moduleName);
  const ctx = fromShared && bare ? { ...context, originModulePath: appOrigin } : context;
  return (resolve ?? ctx.resolveRequest)(ctx, moduleName, platform);
};

module.exports = config;
