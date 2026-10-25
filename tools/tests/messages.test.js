process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    Client,
    GatewayIntentBits,
    MessagePayload,
    MessageFlags,
    EmbedBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    ChatInputCommandInteraction,
} = require('discord.js');
const { createUi, formatMessage, plainMessage } = require('../../src/core/ui/messages');
const { guardInteraction } = require('../../src/core/ui/guard');
const { validatePayload } = require('../../src/core/ui/validate');
const { fixture, GUILD_ID } = require('./helpers');

function json(embed) {
    return embed.toJSON();
}

test('all ordinary interaction response methods produce branded embeds', async (t) => {
    const f = await fixture(t);
    for (const method of ['reply', 'editReply', 'followUp', 'update']) {
        let sent;
        const i = {
            client: f.client,
            async [method](payload) {
                sent = payload;
                return 'SDK result';
            },
        };
        guardInteraction(i);
        const input = { content: 'A clear response.', flags: MessageFlags.Ephemeral };
        assert.equal(await i[method](input), 'SDK result');
        assert.equal(sent.content, null);
        assert.equal(sent.flags, MessageFlags.Ephemeral);
        assert.equal(json(sent.embeds[0]).description, input.content);
        assert.equal(json(sent.embeds[0]).color, 0xff1493);
        assert.equal(json(sent.embeds[0]).footer.text, 'Puro • Skypixel');
        assert.deepEqual(input, { content: 'A clear response.', flags: MessageFlags.Ephemeral });
    }
});

test('style preserves existing embeds, media, custom footers, files, and controls', async (t) => {
    const f = await fixture(t);
    const embed = new EmbedBuilder()
        .setTitle('Existing')
        .setDescription('Keep this.')
        .setColor(0x123456)
        .setFooter({ text: 'Original attribution' })
        .setImage('attachment://image.png');
    const original = embed.toJSON();
    const files = [{ attachment: Buffer.from('bytes'), name: 'image.png' }];
    const components = [{ type: 1, components: [{ type: 2, style: 1, label: 'Go', custom_id: 'test:go' }] }];
    const sent = f.client.ui.message({ content: 'Extra context.', embeds: [embed], files, components });
    assert.equal(sent.embeds.length, 2);
    assert.deepEqual(sent.embeds[1].toJSON(), original);
    assert.deepEqual(embed.toJSON(), original);
    assert.equal(sent.files, files);
    assert.equal(sent.components, components);
    assert.doesNotThrow(() => validatePayload(sent));
});

test('live style configuration changes do not require recreating the UI service', async (t) => {
    const f = await fixture(t);
    f.client.config.ui.accent = '#112233';
    f.client.config.ui.footer = 'My community';
    f.client.config.ui.timestamps = true;
    const embed = json(f.client.ui.info('Updated.').embeds[0]);
    assert.equal(embed.color, 0x112233);
    assert.equal(embed.footer.text, 'My community');
    assert.ok(Number.isFinite(Date.parse(embed.timestamp)));
    assert.notEqual(json(f.client.ui.error('Failed.').embeds[0]).color, embed.color);
});

test('component-only edits and attachment-only posts remain partial payloads', async (t) => {
    const f = await fixture(t);
    for (const payload of [
        { components: [] },
        { embeds: [], content: null },
        { files: [{ attachment: Buffer.from('x'), name: 'data.txt' }] },
    ]) {
        assert.equal(formatMessage(f.client, payload), payload);
    }
});

test('explicit plain messages are opt-in while the normal default is rich', async (t) => {
    const f = await fixture(t);
    let sent;
    const i = {
        client: f.client,
        async reply(payload) {
            sent = payload;
        },
    };
    guardInteraction(i);
    await i.reply(f.client.ui.plain('@everyone intentional plain message'));
    assert.equal(sent.content, '@everyone intentional plain message');
    assert.equal(sent.embeds, undefined);
    f.client.config.ui.auto_embeds = false;
    await i.reply('Opted out in configuration.');
    assert.equal(sent.content, 'Opted out in configuration.');
});

test('formatting remains active when only payload validation is disabled', async (t) => {
    const f = await fixture(t);
    f.client.config.ui.validate_payloads = false;
    let sent;
    const i = {
        client: f.client,
        reply(payload) {
            sent = payload;
        },
    };
    guardInteraction(i);
    await i.reply('Styled.');
    assert.equal(json(sent.embeds[0]).description, 'Styled.');
});

test('V2 layouts, native polls, and modals retain their native SDK payload', async (t) => {
    const f = await fixture(t);
    const v2 = {
        flags: MessageFlags.IsComponentsV2,
        components: [
            new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('A native card.')),
        ],
    };
    const poll = { poll: { question: { text: 'Which?' }, answers: [{ text: 'A' }, { text: 'B' }] } };
    assert.equal(formatMessage(f.client, v2), v2);
    assert.equal(formatMessage(f.client, poll), poll);
    let shown;
    const i = {
        client: f.client,
        async showModal(payload) {
            shown = payload;
        },
    };
    guardInteraction(i);
    const modal = {
        custom_id: 'test:form',
        title: 'Form',
        components: [{ type: 18, label: 'Name', component: { type: 4, custom_id: 'name', style: 1 } }],
    };
    await i.showModal(modal);
    assert.equal(shown, modal);
});

test('notices editing a V2 message remain V2 and clear legacy fields', async (t) => {
    const f = await fixture(t);
    let sent;
    const i = {
        client: f.client,
        message: { flags: { has: () => true } },
        async update(payload) {
            sent = payload;
        },
    };
    guardInteraction(i);
    await i.update(f.client.ui.warning('This menu expired.'));
    assert.equal(sent.flags & MessageFlags.IsComponentsV2, MessageFlags.IsComponentsV2);
    assert.equal(sent.content, null);
    assert.deepEqual(sent.embeds, []);
    assert.match(sent.components[0].toJSON().components[0].content, /This menu expired/);
    assert.doesNotThrow(() => validatePayload(sent));
});

test('long text splits safely at embed boundaries and oversize payloads fail locally', async (t) => {
    const f = await fixture(t);
    const text = 'a'.repeat(4095) + '🐺' + 'b'.repeat(800);
    const sent = f.client.ui.message(text);
    assert.equal(sent.embeds.map((embed) => json(embed).description).join(''), text);
    assert.ok(sent.embeds.every((embed) => json(embed).description.length <= 4096));
    assert.throws(() => f.client.ui.message('x'.repeat(6001)), /6000/);
    assert.throws(() => f.client.ui.message(plainMessage('x'.repeat(2001))), /2000/);
    assert.throws(() => validatePayload({ embeds: [{ description: 'x'.repeat(4097) }] }), /4096/);
    assert.throws(() => validatePayload({ embeds: [{ fields: [{ name: 'A', value: 'x'.repeat(1025) }] }] }), /1024/);
});

test('channel and DM payloads serialize through the actual Discord SDK', async (t) => {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    t.after(() => client.destroy());
    client.config = { ui: { accent: '#ff1493' } };
    client.ui = createUi(client);
    const payload = MessagePayload.create(
        { client },
        client.ui.success('Message delivered.', {
            title: 'Delivery',
            files: [{ attachment: Buffer.from('x'), name: 'data.txt' }],
        }),
    ).resolveBody();
    await payload.resolveFiles();
    const body = payload.body;
    assert.equal(body.content, undefined);
    assert.equal(body.embeds[0].title, 'Delivery');
    assert.equal(body.embeds[0].description, 'Message delivered.');
    assert.equal(payload.files[0].name, 'data.txt');
    assert.equal(payload.files[0].data.toString(), 'x');
});

test('actual slash interaction sends a private rich response through REST', async (t) => {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    t.after(() => client.destroy());
    client.config = { ui: { accent: '#ff1493' } };
    let request;
    client.rest.post = async (_route, options) => {
        request = options.body;
        return {};
    };
    const interaction = new ChatInputCommandInteraction(client, {
        id: '1563829077343735830',
        application_id: GUILD_ID,
        type: 2,
        token: 'offline-test',
        version: 1,
        entitlements: [],
        authorizing_integration_owners: {},
        locale: 'en-US',
        app_permissions: '8',
        user: { id: '486412940199591967', username: 'Max', discriminator: '0', avatar: null },
        data: { id: GUILD_ID, name: 'hello', type: 1 },
    });
    guardInteraction(interaction);
    await interaction.reply({ content: 'Hello from a drop-in command.', flags: MessageFlags.Ephemeral });
    assert.equal(request.type, 4);
    assert.equal(request.data.flags, MessageFlags.Ephemeral);
    assert.equal(request.data.embeds[0].description, 'Hello from a drop-in command.');
    assert.ok(!request.data.content);
});
