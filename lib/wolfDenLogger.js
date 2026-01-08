const { EmbedBuilder, ChannelType } = require('discord.js');

const DEFAULT_COLOR = 0x0099ff;

function getLoggingConfig(client, guildSlug) {
  const config = client?.config?.premium_logging?.[guildSlug];
  if (!config?.enabled) return null;
  return {
    guildId: config.guild_id,
    channelId: config.log_channel_id,
    events: config.events || {},
  };
}

function timeTag(date, style = 'R') {
  if (!date) return 'none';
  const ts = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${ts}:${style}>`;
}

function formatUser(user) {
  if (!user) return 'Unknown user';
  const tag = user.tag || `${user.username || 'user'}#0000`;
  return `${tag} (${user.id})`;
}

function formatChannel(channel) {
  if (!channel) return 'Unknown channel';
  return `${channel.toString()} (${channel.id})`;
}

function formatRole(role) {
  if (!role) return 'Unknown role';
  return `${role.toString()} (${role.id})`;
}

function truncate(value, max = 1024) {
  if (!value) return 'Empty';
  const str = String(value);
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

async function resolveLogChannel(client, guildId, channelId) {
  try {
    // Try to get guild from cache first
    let guild = client.guilds.cache.get(guildId);
    
    // If not in cache, try to fetch it
    if (!guild) {
      try {
        guild = await client.guilds.fetch(guildId);
      } catch (error) {
        console.error(`[wolfDenLogger] Failed to fetch guild ${guildId}:`, error.message);
        return null;
      }
    }
    
    if (!guild) {
      console.error(`[wolfDenLogger] Guild ${guildId} not found`);
      return null;
    }
    
    // Try to get channel from cache first
    let channel = guild.channels.cache.get(channelId);
    
    // If not in cache, try to fetch it
    if (!channel) {
      try {
        channel = await guild.channels.fetch(channelId);
      } catch (error) {
        console.error(`[wolfDenLogger] Failed to fetch channel ${channelId}:`, error.message);
        return null;
      }
    }
    
    if (!channel) {
      console.error(`[wolfDenLogger] Channel ${channelId} not found in guild ${guildId}`);
      return null;
    }
    
    if (channel.type !== ChannelType.GuildText) {
      console.error(`[wolfDenLogger] Channel ${channelId} is not a text channel`);
      return null;
    }
    
    return channel;
  } catch (error) {
    console.error(`[wolfDenLogger] Error resolving log channel:`, error);
    return null;
  }
}

async function sendLog(client, payload) {
  const { guildId, title, description, color, fields = [], footer, thumbnail, author } = payload || {};
  if (!guildId) {
    console.error('[wolfDenLogger] No guildId provided to sendLog');
    return;
  }

  const guildMeta = Array.isArray(client?.config?.guilds)
    ? client.config.guilds.find((g) => g.id === guildId)
    : null;

  if (!guildMeta) {
    console.error(`[wolfDenLogger] Guild ${guildId} missing from config.guilds`);
    return;
  }

  if (guildMeta.tier !== 'premium') {
    console.error(`[wolfDenLogger] Guild ${guildId} is not premium; skipping logging`);
    return;
  }

  if (guildMeta.slug !== 'the-wolf-den') {
    console.error(`[wolfDenLogger] Logging restricted to the-wolf-den; got slug ${guildMeta.slug}`);
    return;
  }

  const config = getLoggingConfig(client, guildMeta.slug);
  if (!config) {
    console.error(`[wolfDenLogger] No logging config found for ${guildMeta.slug}`);
    return;
  }
  
  if (config.guildId !== guildId) {
    console.error(`[wolfDenLogger] Guild mismatch: expected ${config.guildId}, got ${guildId}`);
    return;
  }

  const channel = await resolveLogChannel(client, config.guildId, config.channelId);
  if (!channel) {
    console.error('[wolfDenLogger] Failed to resolve log channel');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(color || DEFAULT_COLOR)
    .setTimestamp(new Date());

  if (title) embed.setTitle(truncate(title, 256));
  if (description) embed.setDescription(truncate(description, 4000));
  if (fields.length) embed.addFields(fields.slice(0, 25).map((f) => ({
    name: truncate(f.name || 'Info', 256),
    value: truncate(f.value || 'none', 1024),
    inline: Boolean(f.inline),
  })));
  if (footer) embed.setFooter(footer);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (author) embed.setAuthor(author);

  try {
    await channel.send({ embeds: [embed] });
    if (process.env.WOLF_LOGGER_VERBOSE === 'true') {
      console.log(`[wolfDenLogger] Successfully sent log to channel ${channel.id}`);
    }
  } catch (error) {
    console.error(`[wolfDenLogger] Failed to send log message:`, error.message);
  }
}

module.exports = {
  sendLog,
  timeTag,
  formatUser,
  formatChannel,
  formatRole,
  truncate,
  getLoggingConfig,
};
