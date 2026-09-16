// Expo SDK 52+ configures Metro for monorepos automatically (watchFolders +
// nodeModulesPaths are derived from the pnpm workspace root), so the default
// config resolves @morrow/core and @morrow/tokens straight from their TS source.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
