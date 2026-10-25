const { ROOT } = require('../paths');
const fs = require('node:fs/promises');
const path = require('node:path');

// Runtime state is separate from economy balances and source configuration.
let stateFilePath = path.join(ROOT, 'data', 'guild-event-state.json');
let cache = null;
let persistedText = null;
let queue = Promise.resolve();

function configureGuildEventState(options = {}) {
    if (cache) throw new Error('Guild state path cannot change after loading.');
    if (options.path) stateFilePath = path.resolve(options.path);
}

async function loadState() {
    if (cache) return cache;
    await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
    try {
        await fs.writeFile(stateFilePath, '{}\n', { flag: 'wx', mode: 0o600 });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
    const value = JSON.parse(await fs.readFile(stateFilePath, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Guild state must contain a JSON object.');
    cache = value;
    persistedText = JSON.stringify(value, null, 2) + '\n';
    return cache;
}

function withGuildEventState(mutator, { persist = true } = {}) {
    const task = queue.then(async () => {
        const next = structuredClone(await loadState());
        const result = await mutator(next);
        if (persist) {
            const text = JSON.stringify(next, null, 2) + '\n';
            if (text !== persistedText) {
                const temp = `${stateFilePath}.tmp`;
                await fs.writeFile(temp, text, { mode: 0o600 });
                await fs.rename(temp, stateFilePath);
                persistedText = text;
            }
        }
        cache = next;
        return result;
    });
    queue = task.then(
        () => undefined,
        () => undefined,
    );
    return task;
}

module.exports = {
    get stateFilePath() {
        return stateFilePath;
    },
    configureGuildEventState,
    withGuildEventState,
    flushGuildEventState: () => queue,
};
