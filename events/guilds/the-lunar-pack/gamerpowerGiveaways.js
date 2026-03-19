const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const { withGuildEventState } = require('../../../lib/guildEventState');

const TARGET_GUILD_ID = '1217588804328620163';
const DEFAULT_CHANNEL_ID = '1484286265175048273';
const DEFAULT_ROLE_ID = '1484283917149274272';
const DEFAULT_ROLE_NAME = 'Ping';
const DEFAULT_INTERVAL_MINUTES = 60;
const MIN_INTERVAL_MS = 15 * 60 * 1000;
const API_URL = 'https://www.gamerpower.com/api/filter';
const STATE_KEY = 'the-lunar-pack.gamerpower-giveaways';

function getEventConfig(client) {
  return client?.config?.events?.guilds?.['the-lunar-pack']?.gamerpower_giveaways || {};
}

function normalizePlatformToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function normalizePlatformList(platforms) {
  if (Array.isArray(platforms)) {
    return platforms.map(normalizePlatformToken).filter(Boolean);
  }

  return String(platforms || '')
    .split(',')
    .map(normalizePlatformToken)
    .filter(Boolean);
}

function getAllowedPlatforms(config) {
  const rawPlatforms = Array.isArray(config.platforms) && config.platforms.length
    ? config.platforms
    : ['steam', 'ps4', 'ps5'];

  return new Set(rawPlatforms.map(normalizePlatformToken).filter(Boolean));
}

function getPlatformLabels(giveaway) {
  const tokens = new Set(normalizePlatformList(giveaway.platforms));
  const labels = [];

  if (tokens.has('steam')) {
    labels.push('Steam');
  }

  if (tokens.has('ps4') || tokens.has('ps5') || tokens.has('playstation')) {
    labels.push('PlayStation Store');
  }

  return labels.length ? labels : ['Unknown'];
}

function getPlatformAccent(giveaway) {
  const tokens = new Set(normalizePlatformList(giveaway.platforms));

  if (tokens.has('steam') && (tokens.has('ps4') || tokens.has('ps5') || tokens.has('playstation'))) {
    return { color: 0x20bf6b, label: 'Steam + PlayStation' };
  }

  if (tokens.has('steam')) {
    return { color: 0x1b2838, label: 'Steam Giveaway' };
  }

  if (tokens.has('ps4') || tokens.has('ps5') || tokens.has('playstation')) {
    return { color: 0x003087, label: 'PlayStation Store Giveaway' };
  }

  return { color: 0x00b894, label: 'Game Giveaway' };
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  if (!text) return 'No description provided.';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function toDiscordTimestamp(value, style = 'R') {
  if (!value || String(value).toLowerCase() === 'n/a') {
    return 'No end date listed';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return String(value);
  }

  return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function normalizeUrl(value) {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

function buildEmbed(giveaway) {
  const platforms = getPlatformLabels(giveaway).join(', ');
  const accent = getPlatformAccent(giveaway);
  const worth = giveaway.worth && giveaway.worth !== 'N/A' ? giveaway.worth : 'Unknown value';
  const description = truncate(giveaway.description, 900);
  const instructions = truncate(giveaway.instructions, 450);
  const endAbsolute = toDiscordTimestamp(giveaway.end_date, 'f');
  const endRelative = toDiscordTimestamp(giveaway.end_date, 'R');
  const publishedAt = toDiscordTimestamp(giveaway.published_date, 'f');
  const imageUrl = normalizeUrl(giveaway.image) || normalizeUrl(giveaway.thumbnail);

  return new EmbedBuilder()
    .setColor(accent.color)
    .setAuthor({ name: accent.label })
    .setTitle(truncate(giveaway.title, 240))
    .setDescription(description)
    .addFields(
      { name: 'Platform', value: platforms, inline: true },
      { name: 'Original Value', value: worth, inline: true },
      { name: 'Status', value: '100% free for a limited time', inline: true },
      { name: 'Published', value: publishedAt, inline: true },
      { name: 'Ends', value: `${endAbsolute}\n${endRelative}`, inline: true },
      { name: 'How to Claim', value: instructions, inline: false }
    )
    .setImage(imageUrl)
    .setThumbnail(normalizeUrl(giveaway.thumbnail))
    .setTimestamp(new Date(giveaway.published_date || Date.now()))
    .setFooter({ text: 'Powered by GamerPower' });
}

function buildComponents(giveaway) {
  const claimUrl = normalizeUrl(giveaway.open_giveaway_url) || normalizeUrl(giveaway.gamerpower_url);
  const sourceUrl = normalizeUrl(giveaway.gamerpower_url) || normalizeUrl(giveaway.open_giveaway_url);
  const row = new ActionRowBuilder();

  if (claimUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Claim Now')
        .setStyle(ButtonStyle.Link)
        .setURL(claimUrl)
    );
  }

  if (sourceUrl && sourceUrl !== claimUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('View on GamerPower')
        .setStyle(ButtonStyle.Link)
        .setURL(sourceUrl)
    );
  }

  return row.components.length ? [row] : [];
}

function extractRoleId(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const mentionMatch = input.match(/^<@&(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  return /^\d{16,22}$/.test(input) ? input : null;
}

async function resolveMentionRole(guild, config) {
  const configuredRoleId = extractRoleId(config.role_id) || extractRoleId(DEFAULT_ROLE_ID);
  const configuredRoleName = String(config.role_name || DEFAULT_ROLE_NAME).trim().toLowerCase();

  if (configuredRoleId) {
    const cachedRole = guild.roles.cache.get(configuredRoleId);
    if (cachedRole) {
      return cachedRole;
    }

    try {
      const fetchedRole = await guild.roles.fetch(configuredRoleId);
      if (fetchedRole) {
        return fetchedRole;
      }
    } catch {
      console.warn(`[GamerPowerGiveaways] Role ${configuredRoleId} could not be resolved, trying by name instead.`);
    }
  }

  if (!configuredRoleName) {
    return null;
  }

  try {
    await guild.roles.fetch();
  } catch (error) {
    console.warn('[GamerPowerGiveaways] Failed to refresh guild roles before name lookup:', error.message);
  }

  return guild.roles.cache.find((role) => role.name.trim().toLowerCase() === configuredRoleName) || null;
}

function buildAnnouncementPayload(giveaway, role) {
  const roleId = role?.id || null;

  return {
    content: roleId ? `<@&${roleId}>` : undefined,
    embeds: [buildEmbed(giveaway)],
    components: buildComponents(giveaway),
    allowedMentions: roleId ? { roles: [roleId] } : undefined,
  };
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
  return withGuildEventState((state) => {
    const root = state[STATE_KEY] || (state[STATE_KEY] = {});
    const guildState = root[guildId] || (root[guildId] = { announcedIds: {} });
    return { ...(guildState.announcedIds || {}) };
  }, { persist: false });
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
  const role = await resolveMentionRole(guild, config);

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
      await channel.send(buildAnnouncementPayload(giveaway, role));
      newlyAnnouncedIds.add(String(giveaway.id));
    } catch (error) {
      console.error(`[GamerPowerGiveaways] Failed to announce giveaway ${giveaway.id}:`, error.message);
    }
  }

  await updateAnnouncedIds(guild.id, activeIds, previouslyAnnouncedIds, newlyAnnouncedIds);
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(guild, client) {
    if (!guild || guild.id !== TARGET_GUILD_ID) {
      return;
    }

    const config = getEventConfig(client);
    if (config.enabled === false) {
      return;
    }

    if (client.lunarPackGamerPowerGiveawaysInterval) {
      return;
    }

    const intervalMinutes = Number(config.interval_minutes) || DEFAULT_INTERVAL_MINUTES;
    const intervalMs = Math.max(MIN_INTERVAL_MS, intervalMinutes * 60 * 1000);

    const runPoll = async () => {
      if (client.lunarPackGamerPowerGiveawaysRunning) {
        return;
      }

      client.lunarPackGamerPowerGiveawaysRunning = true;
      try {
        await pollGiveaways(guild, client);
      } catch (error) {
        console.error('[GamerPowerGiveaways] Poll failed:', error.message);
      } finally {
        client.lunarPackGamerPowerGiveawaysRunning = false;
      }
    };

    await runPoll();
    client.lunarPackGamerPowerGiveawaysInterval = setInterval(runPoll, intervalMs);
  },
};