const { Client, GatewayIntentBits, Partials, Options } = require('discord.js');
const { createUi } = require('../ui/messages');

// Cache limits come from config.yml; sweeper timing is independent of bot traffic.
const MESSAGE_SWEEP_SECONDS = 300;
const MESSAGE_LIFETIME_SECONDS = 600;

function createClient(config) {
    const client = new Client({
        intents: config.runtime.intents.map((name) => GatewayIntentBits[name]),
        partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User, Partials.Reaction],
        allowedMentions: { parse: ['users'], repliedUser: false },
        makeCache: Options.cacheWithLimits({
            ...Options.DefaultMakeCacheSettings,
            MessageManager: config.runtime.message_cache_limit,
        }),
        sweepers: { messages: { interval: MESSAGE_SWEEP_SECONDS, lifetime: MESSAGE_LIFETIME_SECONDS } },
    });
    client.setMaxListeners(config.logging.listener_max);
    client.config = config;
    client.ui = createUi(client);
    client.bootStartedAt = process.hrtime.bigint();
    return client;
}

module.exports = { createClient };
