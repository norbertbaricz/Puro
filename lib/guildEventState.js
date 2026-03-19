const fs = require('fs/promises');
const path = require('path');

const stateFilePath = path.join(__dirname, '..', 'data', 'guild-event-state.json');

let cache = null;
let queue = Promise.resolve();

async function ensureStateFile() {
    await fs.mkdir(path.dirname(stateFilePath), { recursive: true });

    try {
        await fs.access(stateFilePath);
    } catch {
        await fs.writeFile(stateFilePath, '{}\n', 'utf8');
    }
}

async function loadState() {
    await ensureStateFile();

    if (cache) {
        return cache;
    }

    const raw = await fs.readFile(stateFilePath, 'utf8').catch(() => '{}');
    cache = raw.trim() ? JSON.parse(raw) : {};
    return cache;
}

async function persistState(state) {
    cache = state;
    await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function withGuildEventState(mutator, options = {}) {
    const { persist = true } = options;

    const run = async () => {
        const state = await loadState();
        const result = await mutator(state);

        if (persist) {
            await persistState(state);
        } else {
            cache = state;
        }

        return result;
    };

    const task = queue.then(run);
    queue = task.then(
        () => undefined,
        () => undefined
    );
    return task;
}

module.exports = {
    stateFilePath,
    withGuildEventState,
};