module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'no-console': 'off',
    'no-underscore-dangle': 'off',
    'comma-dangle': 'off',
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: ['**/_story.jsx', '**/*.test.js', '**/*.spec.js']
    }]
  },
};
