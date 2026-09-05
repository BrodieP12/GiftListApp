module.exports = function(api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

  return {
    presets: [
      isTest ? 'babel-preset-expo' : ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      ...(isTest ? [] : ['nativewind/babel']),
    ],
    plugins: ['react-native-reanimated/plugin'], // MUST be last
  };
};
