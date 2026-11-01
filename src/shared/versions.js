// Accept released semantic versions only; registry latest tags can point to alphas.
const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

function latestStable(versions) {
    const values = Array.isArray(versions) ? versions.flat(Infinity) : [versions];
    const stable = values.filter((value) => typeof value === 'string' && STABLE_VERSION.test(value));
    stable.sort((a, b) => {
        const left = a.split('.').map(Number);
        const right = b.split('.').map(Number);
        for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return left[index] - right[index];
        return 0;
    });
    if (!stable.length) throw new Error('The registry did not return a stable release.');
    return stable.at(-1);
}

module.exports = { STABLE_VERSION, latestStable };
