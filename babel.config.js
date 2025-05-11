module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Explicitly disable reanimated plugin
      // ['react-native-reanimated/plugin']
    ],
  };
}; 