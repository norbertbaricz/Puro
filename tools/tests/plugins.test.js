const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Events } = require('discord.js');
const { fixture, command, eventually, GUILD_ID } = require('./helpers');

test('nested JS/CJS commands load while ignored files stay inactive', async (t) => {
    const f = await fixture(t);
    f.write('commands/Deep/Nested/hello.js', command('hello'));
    f.write('commands/Other/wave.cjs', command('wave'));
    f.write('commands/_draft.js', 'invalid draft');
    f.write('commands/.hidden.js', 'invalid hidden');
    f.write('commands/example.test.js', 'invalid test');
    await f.manager.scan();
    assert.deepEqual([...f.client.commands.keys()].sort(), ['hello', 'wave']);
});

test('invalid edits retain last working command and report source errors', async (t) => {
    const f = await fixture(t);
    const file = f.write('commands/a.js', command('hello', 1));
    await f.manager.loadFile(file);
    fs.writeFileSync(file, 'module.exports = { syntax: ;');
    assert.equal(await f.manager.loadFile(file), false);
    assert.equal(f.client.commands.get('hello').execute(), 1);
    assert.equal(f.manager.details.get(file).retained, true);
    fs.writeFileSync(file, command('hello', 2));
    assert.equal(await f.manager.loadFile(file), true);
    assert.equal(f.client.commands.get('hello').execute(), 2);
});

test('duplicate command names cannot overwrite the active command', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(f.write('commands/a.js', command('hello', 1)));
    const duplicate = f.write('commands/b.js', command('hello', 99));
    assert.equal(await f.manager.loadFile(duplicate), false);
    assert.equal(f.client.commands.get('hello').execute(), 1);
});

test('deleting and disabling commands removes them from execution and registration', async (t) => {
    const f = await fixture(t);
    const file = f.write('commands/a.js', command());
    await f.manager.loadFile(file);
    fs.writeFileSync(file, 'module.exports = { enabled: false };');
    await f.manager.loadFile(file);
    assert.equal(f.client.commands.size, 0);
    fs.writeFileSync(file, command());
    await f.manager.loadFile(file);
    fs.unlinkSync(file);
    await f.manager.loadFile(file);
    assert.equal(f.manager.registrationTargets().get('global').length, 0);
});

test('event reload replaces listeners and catches asynchronous failures', async (t) => {
    const f = await fixture(t);
    const file = f.write(
        'events/a.js',
        "module.exports = { name: 'testEvent', async execute(client) { client.hit = (client.hit || 0) + 1; } };",
    );
    await f.manager.loadFile(file);
    await f.manager.loadFile(file);
    assert.equal(f.client.listenerCount('testEvent'), 1);
    f.client.emit('testEvent');
    assert.equal(f.client.hit, 1);
    fs.writeFileSync(
        file,
        "module.exports = { name: 'testEvent', async execute() { throw new Error('expected failure'); } };",
    );
    await f.manager.loadFile(file);
    f.client.emit('testEvent');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.client.healthMonitor.errors, 1);
    await f.manager.removeFile(file);
    assert.equal(f.client.listenerCount('testEvent'), 0);
});

test('ready events initialize immediately and dispose before replacement/removal', async (t) => {
    const f = await fixture(t);
    f.client.ready = true;
    const file = f.write(
        'events/ready.js',
        "module.exports = { name: 'clientReady', once: true, async execute(client) { client.active = (client.active || 0) + 1; return () => { client.active--; }; } };",
    );
    await f.manager.loadFile(file);
    assert.equal(f.client.active, 1);
    await f.manager.loadFile(file);
    assert.equal(f.client.active, 1);
    await f.manager.removeFile(file);
    assert.equal(f.client.active, 0);
});

test('ready cleanup waits for asynchronous initialization to finish', async (t) => {
    const f = await fixture(t);
    const file = f.write(
        'events/ready.js',
        "module.exports = { name: 'clientReady', once: true, async execute(client) { await new Promise(r => setTimeout(r, 25)); client.active = true; return () => { client.active = false; }; } };",
    );
    await f.manager.loadFile(file);
    f.client.emit(Events.ClientReady, f.client);
    await f.manager.removeFile(file);
    assert.equal(f.client.active, false);
});

test('guild modules are free and cannot execute in an unrelated guild', async (t) => {
    const f = await fixture(t, { guilds: [{ id: GUILD_ID, slug: 'lunar', name: 'The Lunar Pack' }] });
    await f.manager.loadFile(f.write('commands/guilds/lunar/a.js', command()));
    assert.equal(f.client.commands.size, 0);
    assert.equal(f.client.guildCommands.get(GUILD_ID).size, 1);
    await f.manager.loadFile(
        f.write(
            'events/guilds/lunar/a.js',
            "module.exports = { name: 'guildTest', once: true, execute(value, client) { client.hit = value.guild.id; } };",
        ),
    );
    f.client.emit('guildTest', { guild: { id: '999999999999999999' } });
    assert.equal(f.client.hit, undefined);
    f.client.emit('guildTest', { guild: { id: GUILD_ID } });
    assert.equal(f.client.hit, GUILD_ID);
});

test('numeric guild folders work without a config directory entry', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(f.write(`commands/guilds/${GUILD_ID}/a.js`, command()));
    assert.equal(f.client.guildCommands.get(GUILD_ID).size, 1);
});

test('unknown guild aliases fail visibly instead of leaking into global scope', async (t) => {
    const f = await fixture(t);
    assert.equal(await f.manager.loadFile(f.write('commands/guilds/unknown/a.js', command())), false);
    assert.equal(f.client.commands.size, 0);
});

test('slash, user, and message commands can share a name', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(f.write('commands/a.js', command('hello')));
    for (const type of [2, 3])
        await f.manager.loadFile(
            f.write(
                `commands/${type}.js`,
                `module.exports = { data: {name:'hello',type:${type}}, execute() { return ${type}; } };`,
            ),
        );
    assert.equal(f.client.commands.size, 1);
    assert.equal(f.client.contextMenus.size, 2);
    assert.equal(f.manager.findCommand({ commandName: 'hello', commandType: 3 }).execute(), 3);
});

test('components match exact IDs before prefixes and support modal/select handlers', async (t) => {
    const f = await fixture(t);
    for (const [name, type, id, prefix] of [
        ['prefix', 'button', 'demo:', true],
        ['exact', 'button', 'demo:one', false],
        ['modal', 'modal', 'form', false],
        ['select', 'selectMenu', 'choice', false],
    ]) {
        await f.manager.loadFile(
            f.write(
                `components/${name}.js`,
                `module.exports = { type: '${type}', customId: '${id}', prefix: ${prefix}, execute() { return '${name}'; } };`,
            ),
        );
    }
    const interaction = (type, customId) => ({
        customId,
        isButton: () => type === 'button',
        isModalSubmit: () => type === 'modal',
        isAnySelectMenu: () => type === 'selectMenu',
    });
    assert.equal(f.manager.findComponent(interaction('button', 'demo:one')).execute(), 'exact');
    assert.equal(f.manager.findComponent(interaction('button', 'demo:two')).execute(), 'prefix');
    assert.equal(f.manager.findComponent(interaction('modal', 'form')).execute(), 'modal');
    assert.equal(f.manager.findComponent(interaction('selectMenu', 'choice')).execute(), 'select');
});

test('real file watcher handles creation, edits, invalid saves, nested folders, and deletion', async (t) => {
    const f = await fixture(t);
    f.client.config.hot_reload = {
        enabled: true,
        debounce_ms: 20,
        write_stability_ms: 50,
        polling: false,
        polling_interval_ms: 100,
    };
    await f.manager.start();
    const file = f.write('commands/new/nested/hello.js', command('hello', 1));
    await eventually(() => f.client.commands.has('hello'));
    fs.writeFileSync(file, command('hello', 2));
    await eventually(() => f.client.commands.get('hello')?.execute() === 2);
    fs.writeFileSync(file, 'invalid ! syntax');
    await eventually(() => f.manager.details.get(file)?.status === 'error');
    assert.equal(f.client.commands.get('hello').execute(), 2);
    fs.unlinkSync(file);
    await eventually(() => !f.client.commands.has('hello'));
    await f.manager.stop();
    assert.equal(f.client.eventNames().length, 0);
});

test('invalid config keeps the active configuration and modules', async (t) => {
    const f = await fixture(t);
    const previous = f.client.config;
    f.write('config.yml', 'colors: [invalid');
    assert.equal(await f.manager.reloadConfig(), false);
    assert.equal(f.client.config, previous);
});

test('removing guild configuration unloads its scoped listeners and commands', async (t) => {
    const f = await fixture(t, { guilds: [{ id: GUILD_ID, slug: 'lunar' }] });
    await f.manager.loadFile(f.write('commands/guilds/lunar/a.js', command()));
    f.write('config.yml', 'guilds: []\n');
    assert.equal(await f.manager.reloadConfig(), true);
    assert.equal(f.client.guildCommands.size, 0);
    assert.equal(f.client.commands.size, 0);
});

test('scoped ready tasks initialize for a matching guild joined after startup', async (t) => {
    const f = await fixture(t);
    f.client.ready = true;
    const file = f.write(
        `events/guilds/${GUILD_ID}/ready.js`,
        "module.exports = { name:'clientReady',once:true,execute(guild,client) { client.starts = (client.starts || 0) + 1; return () => client.starts--; } };",
    );
    await f.manager.loadFile(file);
    assert.equal(f.client.starts, undefined);
    const guild = { id: GUILD_ID };
    f.client.guilds.cache.set(GUILD_ID, guild);
    f.client.emit(Events.GuildCreate, guild);
    await f.manager.queue;
    assert.equal(f.client.starts, 1);
    f.client.emit(Events.GuildCreate, guild);
    await f.manager.queue;
    assert.equal(f.client.starts, 1);
    await f.manager.removeFile(file);
    assert.equal(f.client.starts, 0);
});

test('repeated CommonJS reloads do not retain obsolete modules in the parent cache', async (t) => {
    const f = await fixture(t);
    const file = f.write('commands/cache.js', command('hello'));
    for (let index = 0; index < 25; index++) {
        fs.writeFileSync(file, command('hello', index));
        await f.manager.loadFile(file);
    }
    const parent = require.cache[file].parent;
    assert.equal(parent.children.filter((child) => child.id === file).length, 1);
    const previous = require.cache[file];
    fs.writeFileSync(file, 'invalid syntax !');
    await f.manager.loadFile(file);
    assert.equal(require.cache[file], previous);
    assert.equal(parent.children.filter((child) => child.id === file).length, 1);
    await f.manager.removeFile(file);
    assert.equal(parent.children.filter((child) => child.id === file).length, 0);
});
