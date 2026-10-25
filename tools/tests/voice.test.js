process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, PermissionsBitField, PermissionFlagsBits, ChannelType } = require('discord.js');
const { VoiceRegistry, STATE_KEY } = require('../../src/features/voice/registry');
const { reconcile, createTemporary } = require('../../src/features/voice/channels');
const { restoreTemporaryChannels, handleVoiceUpdate } = require('../../src/features/voice/temporary');
const { fixture, GUILD_ID } = require('./helpers');

const BOT_ID = '486412940199591967';
const OWNER_ID = '486412940199591968';
const OTHER_ID = '486412940199591969';
const CHANNEL_ID = '1385321890675032175';
const LOBBY_ID = '1385321890675032174';

async function voiceFixture(t, initial = {}) {
    const f = await fixture(t);
    f.client.user = { id: BOT_ID };
    const config = (f.client.config.events.voiceConnect = {
        lobby_channel_id: LOBBY_ID,
        cooldown_seconds: 15,
        user_limit: 5,
        bitrate: 64000,
    });
    let data = structuredClone(initial);
    const store = async (mutate) => {
        const next = structuredClone(data);
        const result = await mutate(next);
        data = next;
        return result;
    };
    const registry = new VoiceRegistry(f.client, { store });
    f.client[Symbol.for('puro.temporaryVoice.controller')] = registry;
    const guild = {
        id: GUILD_ID,
        client: f.client,
        maximumBitrate: 96000,
        roles: { everyone: { id: GUILD_ID } },
        members: { me: { id: BOT_ID } },
        voiceStates: { cache: new Collection() },
        channels: {
            cache: new Collection(),
            async fetch(id) {
                return this.cache.get(id);
            },
        },
    };
    const actions = [];
    const channel = {
        id: CHANNEL_ID,
        type: ChannelType.GuildVoice,
        permissionOverwrites: {
            cache: new Collection([[OWNER_ID, {}]]),
            async edit(id) {
                actions.push(['edit', id]);
            },
            async delete(id) {
                actions.push(['remove', id]);
            },
        },
        async delete() {
            actions.push(['delete', this.id]);
            guild.channels.cache.delete(this.id);
        },
        async setName(name) {
            actions.push(['name', name]);
        },
    };
    guild.channels.cache.set(CHANNEL_ID, channel);
    const owner = {
        id: OWNER_ID,
        displayName: 'Owner',
        user: { bot: false, username: 'Owner' },
        voice: {
            async setChannel(target) {
                actions.push(['move', target.id || target]);
            },
        },
    };
    const state = await registry.state(guild);
    const record = { ownerId: OWNER_ID, botId: BOT_ID, lobbyId: LOBBY_ID, createdAt: Date.now(), lastRenameAt: 0 };
    return { ...f, guild, registry, state, config, actions, channel, owner, record, data: () => data };
}

test('temporary voice never deletes an untracked channel or the configured lobby', async (t) => {
    const f = await voiceFixture(t);
    await reconcile(f.guild, CHANNEL_ID, f.state, f.registry, f.config);
    assert.deepEqual(f.actions, []);
    f.state.channels.set(LOBBY_ID, f.record);
    await reconcile(f.guild, LOBBY_ID, f.state, f.registry, f.config);
    assert.deepEqual(f.actions, []);
    assert.equal(f.state.channels.has(LOBBY_ID), false);
});

test('temporary voice cleans tracked bot-only channels instead of assigning bot ownership', async (t) => {
    const f = await voiceFixture(t);
    f.state.channels.set(CHANNEL_ID, f.record);
    f.guild.voiceStates.cache.set(BOT_ID, { channelId: CHANNEL_ID, member: { id: BOT_ID, user: { bot: true } } });
    await reconcile(f.guild, CHANNEL_ID, f.state, f.registry, f.config);
    assert.deepEqual(f.actions, [['delete', CHANNEL_ID]]);
    assert.equal(f.state.channels.size, 0);
    assert.deepEqual(f.data()[STATE_KEY][GUILD_ID], {});
});

test('temporary voice transfers ownership to a human and removes the previous owner grant', async (t) => {
    const f = await voiceFixture(t);
    f.state.channels.set(CHANNEL_ID, f.record);
    f.guild.voiceStates.cache.set(BOT_ID, { channelId: CHANNEL_ID, member: { id: BOT_ID, user: { bot: true } } });
    f.guild.voiceStates.cache.set(OTHER_ID, {
        channelId: CHANNEL_ID,
        member: { id: OTHER_ID, displayName: 'Next owner', user: { bot: false } },
    });
    await reconcile(f.guild, CHANNEL_ID, f.state, f.registry, f.config);
    assert.equal(f.state.channels.get(CHANNEL_ID).ownerId, OTHER_ID);
    assert.ok(f.actions.some(([action, id]) => action === 'edit' && id === OTHER_ID));
    assert.ok(f.actions.some(([action, id]) => action === 'remove' && id === OWNER_ID));
    assert.ok(!f.actions.some(([action, id]) => action === 'edit' && id === BOT_ID));
});

test('partial voice caches never cause occupied tracked channels to be deleted', async (t) => {
    const f = await voiceFixture(t);
    f.state.channels.set(CHANNEL_ID, f.record);
    f.guild.voiceStates.cache.set(OTHER_ID, { channelId: CHANNEL_ID, member: null });
    await reconcile(f.guild, CHANNEL_ID, f.state, f.registry, f.config);
    assert.deepEqual(f.actions, []);
    assert.equal(f.state.channels.has(CHANNEL_ID), true);
});

test('ready restoration loads owned tracking and leaves another bot tracking intact', async (t) => {
    const record = { ownerId: OWNER_ID, botId: BOT_ID, lobbyId: LOBBY_ID };
    const otherBot = { ownerId: OWNER_ID, botId: OTHER_ID, lobbyId: LOBBY_ID };
    const f = await voiceFixture(t, {
        [STATE_KEY]: { [GUILD_ID]: { [CHANNEL_ID]: record, '1385321890675032176': otherBot } },
    });
    await restoreTemporaryChannels(f.guild, f.client);
    assert.ok(f.actions.some(([action]) => action === 'delete'));
    assert.deepEqual(f.data()[STATE_KEY][GUILD_ID]['1385321890675032176'], otherBot);
});

test('failed voice movement rolls back the created channel and stored tracking', async (t) => {
    const f = await voiceFixture(t);
    f.guild.channels.create = async () => f.channel;
    f.owner.voice.setChannel = async () => {
        throw new Error('Cannot move member');
    };
    const lobby = { id: LOBBY_ID, permissionsFor: () => new PermissionsBitField(PermissionFlagsBits.Administrator) };
    await assert.rejects(createTemporary(f.guild, f.owner, lobby, f.state, f.registry, f.config), /Cannot move/);
    assert.equal(f.state.channels.size, 0);
    assert.ok(f.actions.some(([action]) => action === 'delete'));
    assert.deepEqual(f.data()[STATE_KEY][GUILD_ID], {});
});

test('concurrent guild voice jobs run in order even after a rejected job', async (t) => {
    const f = await voiceFixture(t);
    const order = [];
    const first = f.registry.run(f.guild, async () => {
        order.push(1);
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push(2);
        throw new Error('Expected');
    });
    const second = f.registry.run(f.guild, () => {
        order.push(3);
    });
    await assert.rejects(first);
    await second;
    assert.deepEqual(order, [1, 2, 3]);
    assert.equal(f.registry.queues.size, 0);
});

test('bot departure events still clean up tracked temporary channels', async (t) => {
    const f = await voiceFixture(t);
    f.state.channels.set(CHANNEL_ID, f.record);
    await handleVoiceUpdate(
        { guild: f.guild, channelId: CHANNEL_ID },
        { guild: f.guild, channelId: null, member: { user: { bot: true } } },
    );
    assert.ok(f.actions.some(([action]) => action === 'delete'));
});
