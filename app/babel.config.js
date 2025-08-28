const reanimatedPlugin = require.resolve('react-native-reanimated/plugin');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@env': './src/lib/env.js',
          },
          extensions: [
            '.ios.ts',
            '.android.ts',
            '.native.ts',
            '.web.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.native.tsx',
            '.web.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
        },
      ],
      reanimatedPlugin,
    ],
  };
};
