const { getDefaultConfig } = require('expo/metro-config');

// Web/Electron note: native-only modules are handled via platform-specific
// source files (e.g. src/services/agora.web.js shadows agora.js on web), so no
// custom module aliasing is needed here.
const config = getDefaultConfig(__dirname);

module.exports = config;
