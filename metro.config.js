const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Map incompatible React Native FS module to a safe empty mock
// because @tensorflow/tfjs-react-native imports it but we don't use the feature
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-fs': path.resolve(__dirname, 'mock-fs.js'),
  'expo-camera': path.resolve(__dirname, 'mock-fs.js'),
};

module.exports = config;
