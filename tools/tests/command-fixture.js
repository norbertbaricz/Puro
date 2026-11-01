const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Client, GatewayIntentBits, PermissionsBitField, Collection, MessagePayload } = require('discord.js');
const { fixture, GUILD_ID } = require('./helpers');
const { loadConfig } = require('../../src/core/config');
const { guardInteraction } = require('../../src/core/ui/guard');
const { validatePayload } = require('../../src/core/ui/validate');
const { ROOT } = require('../../src/paths');

// Run real command implementations and SDK payload serialization with offline state.
async function commandFixture(t, options = {}) {
    const f = await fixture(t);
    f.client.config = loadConfig(path.join(ROOT, 'config.yml'));
    const sdk = new Client({ intents: [GatewayIntentBits.Guilds] });
    t.after(() => sdk.destroy());
    const user = (id) => ({
        id,
        username: id === GUILD_ID ? 'Max' : 'Friend',
        tag: 'Max',
        bot: false,
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
        toString: () => `<@${id}>`,
    });
    const actor = user(GUILD_ID);
    const friend = user('486412940199591967');
    f.client.user = user('1563829000000000000');
    const replies = [];
    const collectors = [];
    let editFailure;
    let edits = 0;
    const serialize = (payload) => {
        validatePayload(payload);
        return MessagePayload.create({ client: sdk }, payload).resolveBody().body;
    };
    function collector() {
        const c = new EventEmitter();
        c.client = f.client;
        c.stop = (reason) => {
            if (c.ended) return;
            c.ended = true;
            c.endReason = reason;
            c.emit('end', new Collection(), reason);
        };
        collectors.push(c);
        return c;
    }
    const message = {
        id: '1563829000000000000',
        flags: { has: () => false },
        createMessageComponentCollector: collector,
        async edit(payload) {
            replies.push({ method: 'message.edit', body: serialize(payload) });
        },
        async delete() {},
    };
    const channel = {
        id: GUILD_ID,
        type: 0,
        isTextBased: () => true,
        isSendable: () => true,
        createMessageCollector: collector,
        permissionsFor: () => new PermissionsBitField(options.botPermissions ?? 8n),
        async send(payload) {
            replies.push({ method: 'send', body: serialize(payload) });
            return message;
        },
    };
    const guild = {
        id: GUILD_ID,
        name: 'Test server',
        channels: { cache: new Collection([[GUILD_ID, channel]]) },
        members: { me: { id: f.client.user.id } },
    };
    function interaction(customId) {
        const i = {
            client: f.client,
            user: actor,
            guildId: GUILD_ID,
            guild,
            channel,
            channelId: GUILD_ID,
            member: { displayName: 'Max', toString: actor.toString },
            memberPermissions: new PermissionsBitField(8n),
            appPermissions: new PermissionsBitField(8n),
            commandName: customId ? undefined : options.commandName,
            customId,
            message: customId ? message : undefined,
            ephemeral: null,
            deferred: false,
            replied: false,
            isRepliable: () => true,
            inGuild: () => true,
            options: {
                getString: (name) => options.strings?.[name] ?? null,
                getInteger: (name) => options.integers?.[name] ?? null,
                getBoolean: (name) => options.booleans?.[name] ?? false,
                getUser: (name) => options.users?.[name] ?? null,
                getMember: () => null,
                getRole: () => null,
                getChannel: () => null,
            },
            async deferReply(payload = {}) {
                assert.equal(this.deferred || this.replied, false);
                this.deferred = true;
                this.ephemeral = Boolean(payload.flags & 64);
            },
            async deferUpdate() {
                assert.equal(this.deferred || this.replied, false);
                this.deferred = true;
            },
            async reply(payload) {
                assert.equal(this.deferred || this.replied, false);
                this.replied = true;
                replies.push({ method: 'reply', body: serialize(payload) });
                return message;
            },
            async update(payload) {
                assert.equal(this.deferred || this.replied, false);
                this.replied = true;
                replies.push({ method: 'update', body: serialize(payload) });
                return message;
            },
            async editReply(payload) {
                assert.equal(this.deferred || this.replied, true);
                if (++edits === editFailure) throw new Error('Expected render failure');
                this.replied = true;
                replies.push({ method: 'editReply', body: serialize(payload) });
                return message;
            },
            async followUp(payload) {
                assert.equal(this.deferred || this.replied, true);
                replies.push({ method: 'followUp', body: serialize(payload) });
                return message;
            },
            async fetchReply() {
                return message;
            },
            async deleteReply() {},
        };
        guardInteraction(i);
        return i;
    }
    const i = interaction();
    const run = (relative) => {
        const file = path.join(ROOT, relative);
        delete require.cache[require.resolve(file)];
        return require(file).execute(i, f.client);
    };
    return {
        ...f,
        i,
        actor,
        friend,
        collectors,
        replies,
        run,
        component: interaction,
        failEdit: (number) => {
            editFailure = number;
        },
    };
}

module.exports = { commandFixture };
