const { engines } = require('../../../package.json');

// Simple numeric minima: this script can explain the requirement on old Node.
function atLeast(actual, minimum) {
    const left = actual.split('.').map(Number);
    const right = minimum.replace(/^>=/, '').split('.').map(Number);
    for (let index = 0; index < 3; index++) {
        if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
    }
    return !actual.includes('-');
}

function checkRuntime() {
    if (!atLeast(process.versions.node, engines.node)) {
        console.error(
            `Puro requires Node.js ${engines.node}. Installed: ${process.versions.node}. Download: https://nodejs.org/en/download/current`,
        );
        return false;
    }
    const npmVersion = /npm\/([^ ]+)/.exec(process.env.npm_config_user_agent || '')?.[1];
    if (npmVersion && !atLeast(npmVersion, engines.npm)) {
        console.error(
            `Puro requires npm ${engines.npm}. Installed: ${npmVersion}. Update with npm install -g npm@latest.`,
        );
        return false;
    }
    return true;
}

function assertRuntime() {
    if (!checkRuntime()) throw new Error('Unsupported Node.js or npm version. See the requirement above.');
}

module.exports = { atLeast, checkRuntime, assertRuntime };
