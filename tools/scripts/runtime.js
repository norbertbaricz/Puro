const { checkRuntime } = require('../../src/core/runtime/version');

if (!checkRuntime()) process.exitCode = 1;
