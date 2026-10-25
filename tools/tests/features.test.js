process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    Client,
    GatewayIntentBits,
    MessagePayload,
    MessageFlags,
    ComponentType,
    PermissionsBitField,
    PermissionFlagsBits,
} = require('discord.js');
const { fixture, GUILD_ID } = require('./helpers');
const help = require('../../commands/info/help-menu');

// Serialize through the installed Discord SDK to validate modern request payloads.
async function payloadClient(t) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    t.after(() => client.destroy());
    return client;
}

test('Components V2 ping serializes with the correct flag and no legacy embeds', async (t) => {
    const f = await fixture(t);
    f.client.ws = { ping: 42 };
    let sent;
    await require('../../commands/info/ping').execute({
        client: f.client,
        createdTimestamp: Date.now(),
        options: { getBoolean: () => true },
        async reply(payload) {
            sent = payload;
        },
    });
    const client = await payloadClient(t);
    const body = MessagePayload.create({ client }, sent).resolveBody().body;
    assert.equal(body.flags, MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
    assert.equal(body.components[0].type, ComponentType.Container);
    assert.equal(body.embeds, undefined);
    assert.match(body.components[0].components[0].content, /42 ms/);
});

test('native poll choices serialize as Discord poll media and multiple selection', async (t) => {
    let sent;
    const options = {
        getString: (name) => (name === 'answers' ? 'Tea | Coffee' : 'Your favorite drink?'),
        getInteger: () => 2,
        getBoolean: () => true,
    };
    await require('../../commands/management/create-poll').execute({
        options,
        async reply(payload) {
            sent = payload;
        },
    });
    const client = await payloadClient(t);
    const body = MessagePayload.create({ client }, sent).resolveBody().body;
    assert.equal(body.poll.answers[0].poll_media.text, 'Tea');
    assert.equal(body.poll.allow_multiselect, true);
    assert.equal(body.poll.duration, 2);
});

test('poll rejects duplicate choices before sending a native poll', async () => {
    let sent;
    await require('../../commands/management/create-poll').execute({
        options: { getString: () => 'Yes | yes' },
        async reply(payload) {
            sent = payload;
        },
    });
    assert.equal(sent.flags, MessageFlags.Ephemeral);
    assert.equal(sent.poll, undefined);
});

test('modern modal template serializes labeled text inputs', async () => {
    let modal;
    await require('../templates/modal-command').execute({
        async showModal(value) {
            modal = value.toJSON();
        },
    });
    assert.equal(modal.custom_id, 'example:feedback');
    assert.equal(modal.components[0].type, ComponentType.Label);
    assert.equal(modal.components[0].component.type, ComponentType.TextInput);
});

test('help paginates large categories and restricts menu actions to their owner', async (t) => {
    const f = await fixture(t);
    f.client.config.ui.help_page_size = 10;
    for (let index = 0; index < 35; index++)
        f.client.commands.set(`command-${index}`, {
            category: 'Big',
            data: { name: `command-${index}`, description: 'x'.repeat(100) },
        });
    let sent;
    const i = {
        client: f.client,
        user: { id: GUILD_ID },
        guildId: GUILD_ID,
        options: { getString: (name) => (name === 'category' ? 'Big' : null), getBoolean: () => true },
        async reply(payload) {
            sent = payload;
        },
    };
    await help.execute(i);
    assert.match(
        sent.components[0].toJSON().components.find((component) => component.content?.startsWith('-#')).content,
        /Page 1\/4/,
    );
    assert.ok(sent.components[0].toJSON().components[0].content.length < 4000);
    const next = sent.components[0].toJSON().components.at(-1).components.at(-1).custom_id;
    let changed;
    await help.handleComponent({
        ...i,
        customId: next,
        async update(payload) {
            changed = payload;
        },
    });
    assert.match(
        changed.components[0].toJSON().components.find((component) => component.content?.startsWith('-#')).content,
        /Page 2\/4/,
    );
    await help.handleComponent({ ...i, user: { id: '999999999999999999' }, customId: next });
    assert.match(sent.content, /your own menu/);
});

test('help supports more than 25 categories and an empty command collection', async (t) => {
    const f = await fixture(t);
    let sent;
    const i = {
        client: f.client,
        user: { id: GUILD_ID },
        options: { getString: () => null, getBoolean: () => false },
        async reply(payload) {
            sent = payload;
        },
    };
    await help.execute(i);
    assert.match(sent.components[0].toJSON().components[0].content, /No commands/);
    for (let index = 0; index < 30; index++)
        f.client.commands.set(`c${index}`, {
            category: `Category ${index}`,
            data: { name: `c${index}`, description: 'Test' },
        });
    await help.execute(i);
    assert.equal(
        sent.components[0].toJSON().components.find((component) => component.type === ComponentType.ActionRow)
            .components[0].options.length,
        25,
    );
    assert.match(
        sent.components[0].toJSON().components.find((component) => component.content?.startsWith('-#')).content,
        /Page 1\/2/,
    );
});

test('permission checks block missing permissions before running a command', async (t) => {
    const f = await fixture(t);
    const { runHandler } = require('../../src/core/interactions/router');
    let executed = false;
    let content;
    const i = {
        client: f.client,
        user: { id: GUILD_ID },
        guildId: GUILD_ID,
        memberPermissions: new PermissionsBitField(),
        async reply(payload) {
            content = payload.embeds[0].toJSON().description;
        },
    };
    await runHandler(
        i,
        {
            userPermissions: [PermissionFlagsBits.ManageMessages],
            execute() {
                executed = true;
            },
        },
        'test',
    );
    assert.equal(executed, false);
    assert.match(content, /permissions/);
});

test('unmatched messages do not consume a greeting cooldown', async (t) => {
    const f = await fixture(t);
    const event = require('../../src/features/greetings/createGreetingEvent')();
    f.client.config.events.messageCreate = {
        greetings: { patterns: ['^hello$'], responses: ['Hello!'], cooldown_seconds: 10 },
    };
    let replies = 0;
    const message = {
        client: f.client,
        guild: { id: GUILD_ID },
        channel: { id: GUILD_ID },
        author: { id: GUILD_ID, bot: false },
        content: 'something else',
        async reply() {
            replies++;
            return {};
        },
    };
    await event.execute(message);
    message.content = 'hello';
    await event.execute(message);
    await event.execute(message);
    assert.equal(replies, 1);
});
