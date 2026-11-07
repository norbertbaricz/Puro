process.env.LOG_LEVEL = 'FATAL';
process.env.PURO_LOG_FILE = 'false';

const assert = require('node:assert/strict');
const dns = require('node:dns');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const { setTimeout: wait } = require('node:timers/promises');
const test = require('node:test');
const { Events, GatewayOpcodes, Routes } = require('discord.js');
const { getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const { createClient } = require('../../src/core/runtime/client');
const { DEFAULTS } = require('../../src/core/config');
const voiceFollow = require('../../events/guilds/the-lunar-pack/voiceFollow');
const { eventually, GUILD_ID } = require('./helpers');

const requireDiscord = createRequire(require.resolve('discord.js'));
const { WebSocketServer } = createRequire(requireDiscord.resolve('@discordjs/ws'))('ws');
const OFFLINE_HOST = 'puro-gateway.invalid';
const MEMBER_ID = '486412940199591967';
const CHANNEL_A = '1385321890675032175';
const CHANNEL_B = '1385321890675032176';
const BOT_ID = '486412940199591968';

function gatewayDnsFailure(t) {
    const lookups = [];
    const lookup = dns.lookup;
    t.mock.method(dns, 'lookup', (host, options, callback) => {
        if (host !== OFFLINE_HOST) return lookup(host, options, callback);
        lookups.push(performance.now());
        const error = Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND', hostname: host });
        queueMicrotask(() => callback(error));
    });
    return lookups;
}

function gatewayClient(t, url) {
    const client = createClient(structuredClone(DEFAULTS));
    t.mock.method(client.rest, 'get', async (route) => {
        assert.equal(route, Routes.gatewayBot());
        return {
            url,
            shards: 1,
            session_start_limit: { total: 1000, remaining: 999, reset_after: 86_400_000, max_concurrency: 1 },
        };
    });
    return client;
}

test('a DNS failure on the resume host reconnects through the original Gateway URL', { timeout: 15_000 }, async (t) => {
    const lookups = gatewayDnsFailure(t);
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    let client;
    t.after(async () => {
        await client?.destroy();
        for (const socket of server.clients) socket.terminate();
        await new Promise((resolve) => server.close(resolve));
    });
    await once(server, 'listening');
    const { port } = server.address();
    client = gatewayClient(t, `ws://127.0.0.1:${port}`);
    const sockets = [];
    const sessionPackets = [];
    const shardErrors = [];
    client.on(Events.ShardError, (error) => shardErrors.push(error));
    server.on('connection', (socket) => {
        sockets.push(socket);
        socket.on('message', (message) => {
            const { op } = JSON.parse(message);
            if (op === GatewayOpcodes.Heartbeat) {
                socket.send(JSON.stringify({ op: GatewayOpcodes.HeartbeatAck, d: null }));
                return;
            }
            if (op !== GatewayOpcodes.Identify && op !== GatewayOpcodes.Resume) return;
            sessionPackets.push(op);
            if (op === GatewayOpcodes.Resume) {
                socket.send(JSON.stringify({ op: GatewayOpcodes.Dispatch, t: 'RESUMED', s: 2, d: {} }));
                return;
            }
            socket.send(
                JSON.stringify({
                    op: GatewayOpcodes.Dispatch,
                    t: 'READY',
                    s: 1,
                    d: {
                        v: 10,
                        user: { id: BOT_ID, username: 'Puro', discriminator: '0', bot: true, avatar: null },
                        application: { id: BOT_ID, flags: 0 },
                        guilds: [],
                        session_id: `fixture-${sockets.length}`,
                        resume_gateway_url: `ws://${sockets.length === 1 ? OFFLINE_HOST : '127.0.0.1'}:${port}`,
                    },
                }),
            );
        });
        socket.send(JSON.stringify({ op: GatewayOpcodes.Hello, d: { heartbeat_interval: 30_000 } }));
    });
    await client.login('local-gateway-fixture');
    const restored = once(client, Events.ShardReady, { signal: AbortSignal.timeout(9_000) });
    sockets[0].close(4000);
    await restored;

    assert.equal(lookups.length, 1);
    assert.deepEqual(sessionPackets, [GatewayOpcodes.Identify, GatewayOpcodes.Identify]);
    assert.equal(sockets.length, 2);
    assert.deepEqual(shardErrors, []);
    assert.equal(client.isReady(), true);

    const resumed = once(client, Events.ShardResume, { signal: AbortSignal.timeout(3_000) });
    sockets[1].close(4000);
    await resumed;
    assert.deepEqual(sessionPackets, [GatewayOpcodes.Identify, GatewayOpcodes.Identify, GatewayOpcodes.Resume]);
    assert.deepEqual(shardErrors, []);
});

test('Gateway DNS retries back off during an outage and stop at shutdown', { timeout: 15_000 }, async (t) => {
    const lookups = gatewayDnsFailure(t);
    const client = gatewayClient(t, `ws://${OFFLINE_HOST}`);
    t.after(() => client.destroy());
    const errors = [];
    void client.login('local-gateway-fixture').catch((error) => errors.push(error));
    await eventually(() => lookups.length >= 3, 12_000);
    assert.ok(lookups[1] - lookups[0] >= 2_000);
    assert.ok(lookups[2] - lookups[1] >= 4_000);
    await client.destroy();
    await wait(600);
    assert.equal(lookups.length, 3);
    assert.deepEqual(errors, []);
});

function voiceFixture(t) {
    const joins = [];
    const sounds = [];
    const errors = [];
    const client = {
        rest: {
            async post(route) {
                sounds.push(route);
            },
        },
        healthMonitor: { recordError: (error) => errors.push(error) },
    };
    const guild = {
        id: GUILD_ID,
        members: { me: { voice: { channelId: null } } },
        voiceAdapterCreator: () => ({
            sendPayload(packet) {
                joins.push(packet.d.channel_id);
                return true;
            },
            destroy() {},
        }),
    };
    const changeChannel = (oldChannelId, channelId) => {
        voiceFollow.execute(
            { guild, channelId: oldChannelId },
            { id: MEMBER_ID, guild, client, channelId, channel: channelId ? { id: channelId } : null },
        );
    };
    const connection = () => getVoiceConnection(GUILD_ID);
    const ready = (channelId) => {
        guild.members.me.voice.channelId = channelId;
        const current = connection();
        current.state = { ...current.state, status: VoiceConnectionStatus.Ready };
    };
    t.after(() => voiceFollow.cleanup());
    return { joins, sounds, errors, changeChannel, connection, ready };
}

test(
    'voice requests fresh connections after DNS and HTTP 521, then plays one sound when ready',
    { timeout: 12_000 },
    async (t) => {
        const f = voiceFixture(t);
        f.changeChannel(null, CHANNEL_A);
        const first = f.connection();
        first.emit(
            'error',
            Object.assign(new Error('getaddrinfo ENOTFOUND voice.discord.media'), { code: 'ENOTFOUND' }),
        );
        assert.equal(first.state.status, VoiceConnectionStatus.Destroyed);
        assert.deepEqual(f.sounds, []);

        await eventually(() => Boolean(f.connection()));
        const second = f.connection();
        assert.notEqual(second, first);
        second.emit('error', new Error('Unexpected server response: 521'));
        assert.equal(second.state.status, VoiceConnectionStatus.Destroyed);
        assert.deepEqual(f.sounds, []);

        await eventually(() => Boolean(f.connection()), 7_000);
        assert.notEqual(f.connection(), second);
        assert.deepEqual(f.joins, [CHANNEL_A, null, CHANNEL_A, null, CHANNEL_A]);
        f.ready(CHANNEL_A);
        f.ready(CHANNEL_A);
        assert.deepEqual(f.sounds, [Routes.sendSoundboardSound(CHANNEL_A)]);
        assert.deepEqual(f.errors, []);
    },
);

test('a member moving channels cancels the previous voice retry', { timeout: 6_000 }, async (t) => {
    const f = voiceFixture(t);
    f.changeChannel(null, CHANNEL_A);
    f.connection().emit('error', new Error('Unexpected server response: 521'));
    await Promise.resolve();
    f.changeChannel(CHANNEL_A, CHANNEL_B);
    f.ready(CHANNEL_B);
    await wait(2_200);

    assert.deepEqual(f.joins, [CHANNEL_A, null, CHANNEL_B]);
    assert.deepEqual(f.sounds, [Routes.sendSoundboardSound(CHANNEL_B)]);
    f.changeChannel(CHANNEL_B, null);
    assert.equal(f.connection(), undefined);
    assert.deepEqual(f.errors, []);
});
