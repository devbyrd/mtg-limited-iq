module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow longer subject lines for descriptive commits
    'header-max-length': [1, 'always', 120],
  },
};
