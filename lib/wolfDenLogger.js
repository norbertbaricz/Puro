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
  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return null;
  return channel;
}

async function sendLog(client, payload) {
  const { guildId, title, description, color, fields = [], footer, thumbnail, author } = payload || {};
  if (!guildId) return;

  const config = getLoggingConfig(client, 'the-wolf-den');
  if (!config || config.guildId !== guildId) return;

  const channel = await resolveLogChannel(client, config.guildId, config.channelId);
  if (!channel) return;

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

  await channel.send({ embeds: [embed] }).catch(() => {});
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
