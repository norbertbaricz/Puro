process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Client, GatewayIntentBits, MessageFlags, Events, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { fixture, GUILD_ID } = require('./helpers');
const { buildPresence, statusTexts } = require('../../src/core/runtime/presence');
const { guardInteraction } = require('../../src/core/ui/guard');
const { privateReply } = require('../../src/core/interactions/respond');
const { safeDeferUpdate } = require('../../src/core/interactions/safety');
const { onCollect, onEnd, linkCollectors } = require('../../src/shared/collectors');
const { latestStable } = require('../../src/shared/versions');
const { atLeast } = require('../../src/core/runtime/version');

// Exercise the installed SDK serializer without opening a Discord connection.
test('custom status sends the exact branding through the actual SDK Gateway packet', async (t) => {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    t.after(() => client.destroy());
    client.config = { status: { type: 'Custom', status: 'idle', texts: ['Serving {servers} servers'] } };
    let packet;
    client.ws.broadcast = (value) => {
        packet = value;
    };
    client.presence.set(buildPresence(client));
    assert.equal(packet.op, 3);
    assert.equal(packet.d.activities[0].type, 4);
    assert.equal(packet.d.activities[0].state, 'Made by Skypixel Framework');
    assert.equal(packet.d.activities[0].name, 'Custom Status');
    client.presence.set(buildPresence(client, 1));
    assert.equal(packet.d.activities[0].state, 'Serving 0 servers');
    assert.deepEqual(statusTexts({ texts: ['Made by Skypixel Framework'] }), ['Made by Skypixel Framework']);
});

test('ready cleanup removes the previous presence timer before reinitialization', async (t) => {
    const f = await fixture(t);
    t.mock.timers.enable({ apis: ['setInterval'] });
    const sent = [];
    f.client.user = { tag: 'Puro', setPresence: (payload) => sent.push(payload) };
    f.client.healthMonitor.stopMonitoring = () => {};
    f.client.healthMonitor.startMonitoring = () => {};
    const ready = require('../../events/core/ready');
    const dispose = await ready.execute(f.client);
    assert.equal(sent[0].activities[0].state, 'Made by Skypixel Framework');
    t.mock.timers.tick(30000);
    assert.equal(sent.length, 2);
    dispose();
    t.mock.timers.tick(60000);
    assert.equal(sent.length, 2);
});

test('stable version selection excludes a latest tag pointing at Node alpha', () => {
    assert.equal(latestStable(['26.12.1', '27.0.0-alpha.0.0.0', '26.13.0', '28.0.0-nightly.1']), '26.13.0');
    assert.equal(latestStable(['9.99.99', '10.0.0', '10.0.1-beta.1']), '10.0.0');
    assert.throws(() => latestStable(['27.0.0-alpha.0.0.0']), /stable release/);
    assert.equal(atLeast('27.0.0-alpha.0.0.0', '>=26.13.0'), false);
});

test('deferred component errors use a private follow-up and do not replace the public game', async (t) => {
    const f = await fixture(t);
    let edited = false;
    let sent;
    const i = {
        client: f.client,
        message: {},
        ephemeral: null,
        async deferUpdate() {
            this.deferred = true;
        },
        async editReply() {
            edited = true;
        },
        async followUp(payload) {
            sent = payload;
        },
    };
    guardInteraction(i);
    await i.deferUpdate();
    await privateReply(i, 'Expected failure', 'error');
    assert.equal(edited, false);
    assert.equal(sent.flags, MessageFlags.Ephemeral);
    assert.match(sent.embeds[0].toJSON().description, /Expected failure/);
});

test('a deferred V2 component update remains V2 when completed with editReply', async (t) => {
    const f = await fixture(t);
    let sent;
    const i = {
        client: f.client,
        message: { flags: { has: () => true } },
        ephemeral: null,
        async deferUpdate() {
            this.deferred = true;
        },
        async editReply(payload) {
            sent = payload;
        },
    };
    guardInteraction(i);
    await i.deferUpdate();
    await i.editReply(f.client.ui.warning('Menu expired.'));
    assert.equal(sent.flags & MessageFlags.IsComponentsV2, MessageFlags.IsComponentsV2);
    assert.deepEqual(sent.embeds, []);
    assert.match(sent.components[0].toJSON().components[0].content, /Menu expired/);
});

test('deferred reply errors edit the response without attempting to change its privacy flags', async (t) => {
    const f = await fixture(t);
    let sent;
    const i = {
        client: f.client,
        deferred: true,
        async editReply(payload) {
            sent = payload;
        },
    };
    await privateReply(i, 'Expected error', 'error');
    assert.equal(sent.flags, undefined);
    assert.match(sent.embeds[0].toJSON().description, /Expected error/);
});

test('related message and button collectors share an ordered queue', async () => {
    const messages = new EventEmitter();
    const buttons = new EventEmitter();
    linkCollectors(messages, buttons);
    const order = [];
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    onCollect(messages, async () => {
        order.push('message');
        await gate;
        order.push('message done');
    });
    onCollect(buttons, () => order.push('button'));
    onEnd(buttons, () => order.push('finished'));
    const first = messages.listeners('collect')[0]();
    const second = buttons.listeners('collect')[0]();
    const last = buttons.listeners('end')[0]();
    await Promise.resolve();
    assert.deepEqual(order, ['message']);
    release();
    await Promise.all([first, second, last]);
    assert.deepEqual(order, ['message', 'message done', 'button', 'finished']);
});

test('deleted response messages are contained while real permission failures remain visible', async (t) => {
    const f = await fixture(t);
    const collector = new EventEmitter();
    collector.client = f.client;
    onCollect(collector, (code) => {
        throw Object.assign(new Error('Expected failure'), { code });
    });
    const run = collector.listeners('collect')[0];
    await run(10008);
    assert.equal(f.client.healthMonitor.errors, 0);
    await run(50013);
    assert.equal(f.client.healthMonitor.errors, 1);
    assert.equal(
        await safeDeferUpdate({
            async deferUpdate() {
                throw { code: '10062' };
            },
        }),
        false,
    );
    await assert.rejects(
        safeDeferUpdate({
            async deferUpdate() {
                throw Object.assign(new Error('Missing permission'), { code: 50013 });
            },
        }),
        /Missing permission/,
    );
});

test('one guild ready failure does not block other guilds or consume its retry', async (t) => {
    const f = await fixture(t);
    const other = '1229630651536375899';
    f.client.guilds.cache.set(GUILD_ID, { id: GUILD_ID });
    f.client.guilds.cache.set(other, { id: other });
    let fail = true;
    const calls = [];
    const record = {
        name: Events.ClientReady,
        scope: [GUILD_ID, other],
        disposers: [],
        listener() {},
        module: {
            once: true,
            async execute(guild) {
                calls.push(guild.id);
                if (guild.id === GUILD_ID && fail) throw new Error('Expected startup failure');
            },
        },
    };
    await f.manager.invoke(record, [f.client]);
    assert.equal(record.initializedGuilds.has(GUILD_ID), false);
    assert.equal(record.initializedGuilds.has(other), true);
    fail = false;
    await f.manager.invoke(record, [f.client]);
    assert.deepEqual(calls, [GUILD_ID, other, GUILD_ID]);
});

test('native V2 payloads still pass through without legacy fields', async (t) => {
    const f = await fixture(t);
    const payload = {
        flags: MessageFlags.IsComponentsV2,
        components: [
            new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('Native card')),
        ],
    };
    assert.equal(f.client.ui.message(payload), payload);
});

test('an unreadable replacement retains the previous live event listener', async (t) => {
    const fs = require('node:fs');
    const f = await fixture(t);
    const file = f.write(
        'events/reload.js',
        "module.exports = {name:'probe',execute(value, client) {client.value=value;}};",
    );
    await f.manager.loadFile(file);
    f.write('events/reload.js', "module.exports = {name:'probe',execute(value, client) {client.value=value*2;}};");
    const original = fs.statSync;
    t.mock.method(fs, 'statSync', (target, ...args) => {
        if (target === file) throw Object.assign(new Error('File is being replaced'), { code: 'ENOENT' });
        return original(target, ...args);
    });
    assert.equal(await f.manager.loadFile(file), false);
    assert.equal(f.client.listenerCount('probe'), 1);
    f.client.emit('probe', 7);
    await Promise.resolve();
    assert.equal(f.client.value, 7);
    assert.equal(f.manager.records.get(file).disposed, undefined);
});

test('expanded presence text stays within 128 UTF-16 units without cutting emoji pairs', async (t) => {
    const f = await fixture(t);
    f.client.config.status.branding = '';
    f.client.config.status.texts = ['🐺'.repeat(100)];
    const text = buildPresence(f.client).activities[0].state;
    assert.ok(text.length <= 128);
    assert.equal(Array.from(text).join(''), text);
    assert.ok(!/[\uD800-\uDBFF]$/.test(text));
});
