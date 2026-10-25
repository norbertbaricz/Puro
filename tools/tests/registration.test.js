process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CommandRegistrar, fingerprint } = require('../../src/core/registration/registrar');
const { fixture, command, GUILD_ID, eventually } = require('./helpers');

// Fake REST retains Discord-like payloads; no tests make network requests.
function fakeRest(initial = []) {
    const remote = new Map();
    return {
        gets: [],
        puts: [],
        remote,
        async get(route) {
            this.gets.push(route);
            return remote.get(route) || structuredClone(initial);
        },
        async put(route, { body }) {
            this.puts.push({ route, body: structuredClone(body) });
            remote.set(route, structuredClone(body));
            return body;
        },
    };
}

test('fingerprints ignore API metadata, field ordering, and empty option defaults', () => {
    const desired = [{ name: 'hello', description: 'Hi', options: [{ type: 3, name: 'text', description: 'Text' }] }];
    const remote = [
        {
            id: '123',
            version: '456',
            application_id: GUILD_ID,
            type: 1,
            name: 'hello',
            description: 'Hi',
            nsfw: false,
            contexts: [0, 1, 2],
            integration_types: [0],
            default_member_permissions: null,
            options: [
                {
                    name: 'text',
                    description: 'Text',
                    type: 3,
                    required: false,
                    autocomplete: false,
                    name_localizations: null,
                },
            ],
        },
    ];
    assert.equal(fingerprint(desired, 'global'), fingerprint(remote, 'global'));
});

test('initial schemas synchronize once and execution-only reloads cause no REST PUT', async (t) => {
    const f = await fixture(t);
    const rest = fakeRest();
    const registrar = new CommandRegistrar(f.client, { root: f.root, rest, applicationId: GUILD_ID });
    t.after(() => registrar.stop());
    const file = f.write('commands/a.js', command('hello', 1));
    await f.manager.loadFile(file);
    await registrar.sync();
    assert.equal(rest.puts.length, 1);
    fs.writeFileSync(file, command('hello', 2));
    await f.manager.loadFile(file);
    await registrar.sync();
    assert.equal(rest.puts.length, 1);
    assert.equal(rest.gets.length, 1);
    await f.manager.removeFile(file);
    await registrar.sync();
    assert.equal(rest.puts.length, 2);
    assert.deepEqual(rest.puts[1].body, []);
});

test('unchanged remote commands avoid overwrite even on a fresh process', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(f.write('commands/a.js', command()));
    const rest = fakeRest([{ type: 1, name: 'hello', description: 'Test command' }]);
    const registrar = new CommandRegistrar(f.client, { root: f.root, rest, applicationId: GUILD_ID });
    t.after(() => registrar.stop());
    await registrar.sync();
    assert.equal(rest.puts.length, 0);
});

test('guild development mode merges scoped overrides and removes global-only fields', async (t) => {
    const f = await fixture(t);
    f.client.config.api.registration = 'guild';
    f.client.config.api.guild_id = GUILD_ID;
    await f.manager.loadFile(f.write('commands/a.js', command()));
    await f.manager.loadFile(f.write(`commands/guilds/${GUILD_ID}/a.js`, command('hello', 2)));
    const rest = fakeRest();
    const registrar = new CommandRegistrar(f.client, { root: f.root, rest, applicationId: GUILD_ID });
    t.after(() => registrar.stop());
    await registrar.sync();
    assert.equal(rest.puts.length, 1);
    assert.equal(rest.puts[0].body.length, 1);
    assert.match(rest.puts[0].route, /guilds/);
});

test('saved scope history clears removed guild commands after restarting', async (t) => {
    const f = await fixture(t);
    const rest = fakeRest();
    const file = f.write(`commands/guilds/${GUILD_ID}/a.js`, command());
    await f.manager.loadFile(file);
    const first = new CommandRegistrar(f.client, { root: f.root, rest, applicationId: GUILD_ID });
    await first.sync();
    first.stop();
    await f.manager.removeFile(file);
    const second = new CommandRegistrar(f.client, { root: f.root, rest, applicationId: GUILD_ID });
    t.after(() => second.stop());
    await second.sync();
    assert.deepEqual(rest.puts.at(-1).body, []);
    assert.match(rest.puts.at(-1).route, /guilds/);
});

test('failed registration is reported and retried instead of being marked synchronized', async (t) => {
    const f = await fixture(t);
    f.client.ready = true;
    await f.manager.loadFile(f.write('commands/a.js', command()));
    const rest = fakeRest();
    const put = rest.put.bind(rest);
    let fail = true;
    rest.put = async (...args) => {
        if (fail) throw new Error('Temporary outage');
        return put(...args);
    };
    const registrar = new CommandRegistrar(f.client, { root: f.root, rest, applicationId: GUILD_ID });
    t.after(() => registrar.stop());
    await registrar.sync();
    assert.equal(f.client.registrationStatus.status, 'error');
    assert.ok(registrar.timer);
    fail = false;
    await registrar.sync();
    assert.equal(f.client.registrationStatus.status, 'synced');
    assert.equal(rest.puts.length, 1);
});

test('a save arriving during slow registration schedules the latest schema', async (t) => {
    const f = await fixture(t);
    f.client.ready = true;
    f.client.config.api.sync_debounce_ms = 5;
    const rest = fakeRest();
    const put = rest.put.bind(rest);
    let release;
    rest.put = async (...args) => {
        if (!release)
            await new Promise((resolve) => {
                release = resolve;
            });
        return put(...args);
    };
    const registrar = new CommandRegistrar(f.client, { root: f.root, rest, applicationId: GUILD_ID });
    t.after(() => registrar.stop());
    await f.manager.loadFile(f.write('commands/a.js', command('first')));
    const running = registrar.sync();
    await eventually(() => !!release);
    await f.manager.loadFile(f.write('commands/b.js', command('second')));
    registrar.schedule(0);
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    await running;
    await eventually(() => rest.puts.at(-1)?.body.length === 2);
    assert.equal(rest.puts.length, 2);
});

test('different application IDs never inherit another bot command scopes', async (t) => {
    const f = await fixture(t);
    f.write(
        '.runtime/command-scopes.json',
        JSON.stringify({ applicationId: '999999999999999999', scopes: [GUILD_ID] }),
    );
    const registrar = new CommandRegistrar(f.client, { root: f.root, rest: fakeRest(), applicationId: GUILD_ID });
    t.after(() => registrar.stop());
    assert.equal(registrar.known.size, 0);
    assert.equal(path.basename(registrar.statePath), 'command-scopes.json');
});
