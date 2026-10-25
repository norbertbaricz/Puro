process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    Client,
    GatewayIntentBits,
    Collection,
    StringSelectMenuInteraction,
    ComponentType,
    MessageFlags,
} = require('discord.js');
const { validatePayload, validateComponents } = require('../../src/core/ui/validate');
const { guardInteraction } = require('../../src/core/ui/guard');
const { createSession } = require('../../src/features/help/sessions');
const { render } = require('../../src/features/help/view');
const { dispatchInteraction } = require('../../src/core/interactions/router');
const help = require('../../commands/info/help-menu');
const { fixture, GUILD_ID } = require('./helpers');

function interaction(client) {
    return { client, guildId: GUILD_ID, user: { id: '486412940199591967' } };
}

test('regression: even disabled navigation controls must have different custom IDs', () => {
    const controls = [
        { type: 2, style: 2, label: 'Previous', custom_id: 'help:commands:0', disabled: true },
        { type: 2, style: 2, label: 'Next', custom_id: 'help:commands:0', disabled: true },
    ];
    assert.throws(() => validatePayload({ components: [{ type: 1, components: controls }] }), /duplicate custom_id/);
});

test('help payloads have unique IDs for empty, single-page, and boundary-page categories', async (t) => {
    const f = await fixture(t);
    const i = interaction(f.client);
    for (const size of [0, 1, 7, 8, 9, 16, 17, 80, 100]) {
        f.client.commands.clear();
        for (let index = 0; index < size; index++)
            f.client.commands.set(`c${index}`, {
                category: 'Test',
                data: { name: `c${index}`, description: 'A command.' },
            });
        const session = createSession(i);
        session.category = 'Test';
        for (const page of [0, 1, 2, 9, 999, -1]) {
            const payload = render(i, session, 'commands', page);
            assert.doesNotThrow(() => validatePayload(payload), `size=${size}, page=${page}`);
            const ids = [...validateComponents(payload.components).customIds];
            assert.equal(ids.length, new Set(ids).size);
        }
    }
});

test('help category navigation remains valid at every 25-category boundary', async (t) => {
    const f = await fixture(t);
    const i = interaction(f.client);
    for (const size of [1, 25, 26, 50, 51, 100]) {
        f.client.commands.clear();
        for (let index = 0; index < size; index++)
            f.client.commands.set(`c${index}`, {
                category: `Category ${index}`,
                data: { name: `c${index}`, description: 'A command.' },
            });
        const session = createSession(i);
        for (const page of [0, 1, 2, 3])
            assert.doesNotThrow(() => validatePayload(render(i, session, 'categories', page)));
    }
});

test('interaction guards reject invalid outgoing payloads before calling the SDK', () => {
    let calls = 0;
    const i = {
        client: { config: {} },
        reply() {
            calls++;
        },
    };
    guardInteraction(i);
    guardInteraction(i);
    assert.throws(() => i.reply({ content: 'x'.repeat(6001) }), /exceeds/);
    assert.equal(calls, 0);
    i.reply({ content: 'Valid' });
    assert.equal(calls, 1);
});

test('UI validation rejects mixed Components V2 and legacy message bodies', () => {
    assert.throws(
        () => validatePayload({ flags: MessageFlags.IsComponentsV2, content: 'Not a Text Display' }),
        /cannot be mixed/,
    );
    assert.throws(
        () =>
            validatePayload({
                components: [
                    {
                        type: 1,
                        components: [
                            { type: 2, custom_id: 'a' },
                            { type: 3, custom_id: 'b' },
                        ],
                    },
                ],
            }),
        /own action row/,
    );
});

test('regression: actual Discord SDK select update serializes a valid one-page help response', async (t) => {
    const f = await fixture(t);
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    t.after(() => client.destroy());
    client.config = f.client.config;
    client.commands = new Collection([['hello', { category: 'Fun', data: { name: 'hello', description: 'Hello.' } }]]);
    client.guildCommands = new Map();
    client.healthMonitor = f.client.healthMonitor;
    client.plugins = {
        findComponent: () => ({ type: 'selectMenu', customId: 'puro:help:', execute: help.handleComponent }),
    };
    const user = { id: '486412940199591967', username: 'Max', discriminator: '0', avatar: null };
    const session = createSession({ client, guildId: GUILD_ID, user });
    let request;
    client.rest.post = async (_route, options) => {
        validatePayload(options.body.data);
        request = options.body;
        return {};
    };
    const raw = {
        id: '1563829077343735830',
        application_id: GUILD_ID,
        type: 3,
        token: 'offline-test-token',
        version: 1,
        guild_id: GUILD_ID,
        channel_id: '1229630651536375899',
        entitlements: [],
        authorizing_integration_owners: {},
        app_permissions: '8',
        locale: 'en-US',
        member: { user, permissions: '8', roles: [], joined_at: '2026-01-01T00:00:00Z' },
        data: {
            component_type: ComponentType.StringSelect,
            custom_id: `puro:help:${session.id}:select:commands:0`,
            values: ['0'],
        },
        message: {
            id: '1563829000000000000',
            channel_id: '1229630651536375899',
            author: { ...user, id: GUILD_ID, bot: true },
            content: '',
            timestamp: '2026-10-25T08:00:00Z',
            edited_timestamp: null,
            type: 0,
            flags: MessageFlags.IsComponentsV2,
            attachments: [],
            embeds: [],
            components: [],
        },
    };
    const select = new StringSelectMenuInteraction(client, raw);
    await dispatchInteraction(select);
    assert.equal(request?.type, 7);
    const row = request.data.components[0].components.find((component) => component.type === ComponentType.ActionRow);
    assert.equal(row.components.length, 3);
    assert.equal(new Set(row.components.map((button) => button.custom_id)).size, 3);
    assert.equal(select.replied, true);
});
