const path = require('node:path');

// All persistent paths are rooted at the project, independent of the launch folder.
const ROOT = path.resolve(__dirname, '..');
module.exports = { ROOT };
