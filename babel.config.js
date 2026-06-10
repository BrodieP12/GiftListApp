module.exports = function(api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

  return {
    presets: [
      isTest ? 'babel-preset-expo' : ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      ...(isTest ? [] : ['nativewind/babel']),
    ],
    // reanimated's babel plugin is only needed for the app build, not for
    // jest unit tests (and pulling it in during tests requires the native pkg).
    plugins: isTest ? [] : ['react-native-reanimated/plugin'], // MUST be last
  };
};
