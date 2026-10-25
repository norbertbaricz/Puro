const axios = require('axios');
const { withGuildEventState } = require('../../services/guild-state');
const { getAllowedPlatforms, normalizePlatformList } = require('./platforms');
const { buildAnnouncementPayload } = require('./view');

const DEFAULT_CHANNEL_ID = '1484286265175048273';
const API_URL = 'https://www.gamerpower.com/api/filter';
const STATE_KEY = 'the-lunar-pack.gamerpower-giveaways';

function getEventConfig(client) {
    return client?.config?.events?.guilds?.['the-lunar-pack']?.gamerpower_giveaways || {};
}

async function resolveAnnouncementChannel(guild, channelId) {
    let channel = guild.channels.cache.get(channelId);

    if (!channel) {
        try {
            channel = await guild.channels.fetch(channelId);
        } catch (error) {
            console.error(`[GamerPowerGiveaways] Failed to fetch channel ${channelId}:`, error.message);
            return null;
        }
    }

    if (!channel?.isTextBased?.() || channel.isDMBased?.()) {
        console.error(`[GamerPowerGiveaways] Channel ${channelId} is not a guild text-based channel.`);
        return null;
    }

    return channel;
}

function isEligibleGiveaway(giveaway, allowedPlatforms) {
    if (!giveaway || typeof giveaway !== 'object') {
        return false;
    }

    if (String(giveaway.status || '').toLowerCase() !== 'active') {
        return false;
    }

    if (String(giveaway.type || '').toLowerCase() !== 'game') {
        return false;
    }

    const platformTokens = normalizePlatformList(giveaway.platforms);
    return platformTokens.some((token) => allowedPlatforms.has(token));
}

async function fetchGiveaways(config) {
    const allowedPlatforms = getAllowedPlatforms(config);
    const platformQuery = Array.from(allowedPlatforms).join('.');

    const response = await axios.get(API_URL, {
        params: {
            platform: platformQuery,
            type: 'game',
            'sort-by': 'date',
        },
        timeout: 15000,
    });

    const payload = Array.isArray(response.data) ? response.data : [];
    return payload
        .filter((giveaway) => isEligibleGiveaway(giveaway, allowedPlatforms))
        .sort((left, right) => {
            const leftTs = Date.parse(left.published_date || 0) || 0;
            const rightTs = Date.parse(right.published_date || 0) || 0;
            return leftTs - rightTs;
        });
}

async function getAnnouncedIds(guildId) {
    return withGuildEventState(
        (state) => {
            const root = state[STATE_KEY] || (state[STATE_KEY] = {});
            const guildState = root[guildId] || (root[guildId] = { announcedIds: {} });
            return { ...(guildState.announcedIds || {}) };
        },
        { persist: false },
    );
}

async function updateAnnouncedIds(guildId, activeIds, previouslyAnnouncedIds, newlyAnnouncedIds) {
    const now = new Date().toISOString();

    return withGuildEventState((state) => {
        const root = state[STATE_KEY] || (state[STATE_KEY] = {});
        const guildState = root[guildId] || (root[guildId] = { announcedIds: {} });
        const nextAnnouncedIds = {};

        for (const id of activeIds) {
            if (previouslyAnnouncedIds[id]) {
                nextAnnouncedIds[id] = previouslyAnnouncedIds[id];
                continue;
            }

            if (newlyAnnouncedIds.has(id)) {
                nextAnnouncedIds[id] = now;
            }
        }

        guildState.announcedIds = nextAnnouncedIds;
        guildState.lastSuccessfulPollAt = now;
        guildState.lastSeenCount = activeIds.size;
    });
}

async function pollGiveaways(guild, client) {
    const config = getEventConfig(client);
    const channelId = String(config.channel_id || DEFAULT_CHANNEL_ID);
    const channel = await resolveAnnouncementChannel(guild, channelId);

    if (!channel) {
        return;
    }

    const giveaways = await fetchGiveaways(config);
    const activeIds = new Set(giveaways.map((giveaway) => String(giveaway.id)));
    const previouslyAnnouncedIds = await getAnnouncedIds(guild.id);
    const pendingGiveaways = giveaways.filter((giveaway) => !previouslyAnnouncedIds[String(giveaway.id)]);
    const newlyAnnouncedIds = new Set();

    for (const giveaway of pendingGiveaways) {
        try {
            await channel.send(client.ui.message(buildAnnouncementPayload(giveaway)));
            newlyAnnouncedIds.add(String(giveaway.id));
        } catch (error) {
            console.error(`[GamerPowerGiveaways] Failed to announce giveaway ${giveaway.id}:`, error.message);
        }
    }

    await updateAnnouncedIds(guild.id, activeIds, previouslyAnnouncedIds, newlyAnnouncedIds);
}

module.exports = { getEventConfig, pollGiveaways };
