const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function store(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puro-guild-state-'));
    delete require.cache[require.resolve('../../src/services/guild-state')];
    const state = require('../../src/services/guild-state');
    state.configureGuildEventState({ path: path.join(root, 'guilds.json') });
    t.after(() => fs.rmSync(root, { force: true, recursive: true }));
    return state;
}

test('invalid guild JSON fails without erasing existing state', async (t) => {
    const state = store(t);
    fs.writeFileSync(state.stateFilePath, '{ invalid state');
    await assert.rejects(
        state.withGuildEventState((data) => {
            data.new = true;
        }),
    );
    assert.equal(fs.readFileSync(state.stateFilePath, 'utf8'), '{ invalid state');
});

test('guild mutations are serialized and persist through atomic replacement', async (t) => {
    const state = store(t);
    await Promise.all(
        Array.from({ length: 20 }, () =>
            state.withGuildEventState((data) => {
                data.count = (data.count || 0) + 1;
            }),
        ),
    );
    assert.equal(JSON.parse(fs.readFileSync(state.stateFilePath, 'utf8')).count, 20);
    assert.equal(fs.existsSync(`${state.stateFilePath}.tmp`), false);
});

test('a failed guild mutation does not change cached or persisted state', async (t) => {
    const state = store(t);
    await state.withGuildEventState((data) => {
        data.count = 1;
    });
    await assert.rejects(
        state.withGuildEventState((data) => {
            data.count = 999;
            throw new Error('Expected');
        }),
    );
    assert.equal(await state.withGuildEventState((data) => data.count, { persist: false }), 1);
});

test('unchanged guild-state polling does not rewrite its JSON file', async (t) => {
    const state = store(t);
    await state.withGuildEventState((data) => {
        data.count = 1;
    });
    fs.utimesSync(state.stateFilePath, new Date(0), new Date(0));
    await state.withGuildEventState((data) => data.count);
    assert.equal(fs.statSync(state.stateFilePath).mtimeMs, 0);
});
