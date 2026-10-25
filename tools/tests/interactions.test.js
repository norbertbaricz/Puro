process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const { dispatchInteraction } = require('../../src/core/interactions/router');
const { fixture, command } = require('./helpers');

// Interaction doubles model reply/defer state so acknowledgement mistakes fail tests.
function interaction(client, overrides = {}) {
    const result = {
        client,
        commandName: 'hello',
        commandType: 1,
        guildId: null,
        user: { id: '486412940199591967' },
        createdTimestamp: Date.now(),
        replied: false,
        deferred: false,
        responded: false,
        replies: [],
        isChatInputCommand: () => true,
        isContextMenuCommand: () => false,
        isAutocomplete: () => false,
        isButton: () => false,
        isAnySelectMenu: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        async reply(payload) {
            assert.equal(this.replied || this.deferred, false);
            this.replied = true;
            this.replies.push(payload);
        },
        async editReply(payload) {
            assert.equal(this.deferred || this.replied, true);
            this.replied = true;
            this.replies.push(payload);
        },
        async followUp(payload) {
            assert.equal(this.replied || this.deferred, true);
            this.replies.push(payload);
        },
        async deferReply(payload) {
            assert.equal(this.deferred || this.replied, false);
            this.deferred = true;
            this.deferPayload = payload;
        },
        async respond(payload) {
            this.responded = true;
            this.choices = payload;
        },
        ...overrides,
    };
    return result;
}

test('missing commands receive a private response', async (t) => {
    const f = await fixture(t);
    const i = interaction(f.client);
    await dispatchInteraction(i);
    assert.equal(i.replies[0].flags, MessageFlags.Ephemeral);
});

test('context menus use the same execution path as slash commands', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(
        f.write(
            'commands/a.js',
            "module.exports = { data: {name:'Inspect',type:2}, async execute(i) { await i.reply({content:'OK'}); } };",
        ),
    );
    const i = interaction(f.client, {
        commandName: 'Inspect',
        commandType: 2,
        isChatInputCommand: () => false,
        isContextMenuCommand: () => true,
    });
    await dispatchInteraction(i);
    assert.equal(i.replies[0].embeds[0].toJSON().description, 'OK');
    assert.equal(f.client.healthMonitor.count, 1);
});

test('cooldowns survive reloads and apply independently per guild/user', async (t) => {
    const f = await fixture(t);
    const file = f.write('commands/a.js', command('hello', 1, ', cooldown: 10'));
    await f.manager.loadFile(file);
    await dispatchInteraction(interaction(f.client));
    await f.manager.loadFile(file);
    const second = interaction(f.client);
    await dispatchInteraction(second);
    assert.match(second.replies[0].embeds[0].toJSON().description, /wait/);
    await dispatchInteraction(interaction(f.client, { guildId: '1217588804328620163' }));
    assert.equal(f.client.healthMonitor.count, 2);
});

test('configured owner restrictions prevent unauthorized execution', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(f.write('commands/a.js', command('hello', 1, ', ownerOnly: true')));
    const i = interaction(f.client);
    await dispatchInteraction(i);
    assert.match(i.replies[0].embeds[0].toJSON().description, /owner/);
    assert.equal(f.client.healthMonitor.count, 0);
});

test('autocomplete always acknowledges missing or failed handlers', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(
        f.write('commands/a.js', command('hello', 1, ", autocomplete() { throw new Error('expected'); }")),
    );
    const i = interaction(f.client, { isChatInputCommand: () => false, isAutocomplete: () => true });
    await dispatchInteraction(i);
    assert.equal(i.responded, true);
    assert.deepEqual(i.choices, []);
});

test('opt-in deferral edits the deferred error response and releases cooldown', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(
        f.write(
            'commands/a.js',
            "module.exports = { data:{name:'hello',description:'Test'}, cooldown:30, defer:'private', execute() { throw new Error('expected failure'); } };",
        ),
    );
    const i = interaction(f.client);
    await dispatchInteraction(i);
    assert.equal(i.deferred, true);
    assert.equal(i.deferPayload.flags, MessageFlags.Ephemeral);
    assert.equal(i.replies.length, 1);
    assert.equal(f.client.interactionRuntime.cooldowns.size, 0);
});

test('unowned component interactions remain available to existing collectors', async (t) => {
    const f = await fixture(t);
    const i = interaction(f.client, {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'existing_game_collector',
    });
    await dispatchInteraction(i);
    assert.equal(i.replied, false);
});

test('drop-in modal handlers route without editing the core event', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(
        f.write(
            'components/form.js',
            "module.exports = { type:'modal',customId:'example:form',async execute(i) { await i.reply({content:'Saved'}); } };",
        ),
    );
    const i = interaction(f.client, {
        isChatInputCommand: () => false,
        isModalSubmit: () => true,
        customId: 'example:form',
    });
    await dispatchInteraction(i);
    assert.equal(i.replies[0].embeds[0].toJSON().description, 'Saved');
});

module.exports = { interaction };
