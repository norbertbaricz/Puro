module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    rules: {
        // Code Quality
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-console': 'off', // Discord bots need console for logging
        'prefer-const': 'warn',
        'no-var': 'error',
        
        // Best Practices
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-return-await': 'warn',
        'require-await': 'warn',
        
        // Async/Promise
        'no-async-promise-executor': 'error',
        'no-promise-executor-return': 'warn',
        'prefer-promise-reject-errors': 'warn',
        
        // Style
        'indent': ['error', 4, { SwitchCase: 1 }],
        'quotes': ['error', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'space-before-function-paren': ['error', {
            anonymous: 'never',
            named: 'never',
            asyncArrow: 'always'
        }],
        
        // ES6+
        'arrow-spacing': 'error',
        'no-duplicate-imports': 'error',
        'prefer-arrow-callback': 'warn',
        'prefer-template': 'warn',
        
        // Node.js specific
        'no-path-concat': 'error',
        'handle-callback-err': 'warn'
    },
    ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'coverage/',
        '*.min.js'
    ]
};
