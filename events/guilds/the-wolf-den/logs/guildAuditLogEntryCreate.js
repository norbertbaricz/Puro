const { Events, AuditLogEvent } = require('discord.js');
const { sendLog, formatUser, formatChannel, formatRole, truncate, timeTag } = require('../../../../lib/wolfDenLogger');

const actionNames = {
  [AuditLogEvent.ChannelCreate]: 'Channel Created',
  [AuditLogEvent.ChannelDelete]: 'Channel Deleted',
  [AuditLogEvent.ChannelUpdate]: 'Channel Updated',
  [AuditLogEvent.ChannelOverwriteCreate]: 'Permissions Added',
  [AuditLogEvent.ChannelOverwriteDelete]: 'Permissions Deleted',
  [AuditLogEvent.ChannelOverwriteUpdate]: 'Permissions Updated',
  [AuditLogEvent.MemberKick]: 'Member Kicked',
  [AuditLogEvent.MemberPrune]: 'Members Pruned',
  [AuditLogEvent.MemberBanAdd]: 'Member Banned',
  [AuditLogEvent.MemberBanRemove]: 'Member Unbanned',
  [AuditLogEvent.MemberUpdate]: 'Member Updated',
  [AuditLogEvent.MemberRoleUpdate]: 'Member Roles Updated',
  [AuditLogEvent.BotAdd]: 'Bot Added',
  [AuditLogEvent.RoleCreate]: 'Role Created',
  [AuditLogEvent.RoleDelete]: 'Role Deleted',
  [AuditLogEvent.RoleUpdate]: 'Role Updated',
  [AuditLogEvent.InviteCreate]: 'Invite Created',
  [AuditLogEvent.InviteDelete]: 'Invite Deleted',
  [AuditLogEvent.InviteUpdate]: 'Invite Updated',
  [AuditLogEvent.WebhookCreate]: 'Webhook Created',
  [AuditLogEvent.WebhookDelete]: 'Webhook Deleted',
  [AuditLogEvent.WebhookUpdate]: 'Webhook Updated',
  [AuditLogEvent.EmojiCreate]: 'Emoji Created',
  [AuditLogEvent.EmojiDelete]: 'Emoji Deleted',
  [AuditLogEvent.EmojiUpdate]: 'Emoji Updated',
  [AuditLogEvent.StickerCreate]: 'Sticker Created',
  [AuditLogEvent.StickerDelete]: 'Sticker Deleted',
  [AuditLogEvent.StickerUpdate]: 'Sticker Updated',
  [AuditLogEvent.GuildScheduledEventCreate]: 'Event Created',
  [AuditLogEvent.GuildScheduledEventDelete]: 'Event Deleted',
  [AuditLogEvent.GuildScheduledEventUpdate]: 'Event Updated',
  [AuditLogEvent.ThreadCreate]: 'Thread Created',
  [AuditLogEvent.ThreadDelete]: 'Thread Deleted',
  [AuditLogEvent.ThreadUpdate]: 'Thread Updated',
  [AuditLogEvent.MessagePin]: 'Message Pinned',
  [AuditLogEvent.MessageUnpin]: 'Message Unpinned',
};

module.exports = {
  name: Events.GuildAuditLogEntryCreate,
  async execute(auditLogEntry, guild) {
    if (!guild) return;
    const action = actionNames[auditLogEntry.action] || 'Unknown Action';
    const executor = auditLogEntry.executor ? formatUser(auditLogEntry.executor) : 'Unknown';

    const target = (() => {
      const t = auditLogEntry.target;
      if (!t) return 'None';
      if (t.username) return formatUser(t);
      if (t.name && t.id) return `${t.name} (${t.id})`;
      if (t.id && t.type && 'position' in t) return formatRole(t);
      if (t.id && 'type' in t) return `${t.id}`;
      return String(t);
    })();

    const changes = (auditLogEntry.changes || []).slice(0, 5).map((c) => {
      const key = c.key || 'prop';
      const oldValue = truncate(String(c.old ?? 'none'), 200);
      const newValue = truncate(String(c.new ?? 'none'), 200);
      return `• ${key}: ${oldValue} → ${newValue}`;
    }).join('\n') || 'None';

    const extra = auditLogEntry.extra;
    let channelField = null;
    if (extra?.channel) channelField = formatChannel(extra.channel);
    else if (extra?.channelId) channelField = `<#${extra.channelId}> (${extra.channelId})`;

    await sendLog(guild.client, {
      guildId: guild.id,
      title: `Audit: ${action}`,
      description: `Executor: ${executor}`,
      fields: [
        { name: 'Target', value: truncate(target, 256) },
        { name: 'Changes', value: changes },
        ...(channelField ? [{ name: 'Channel', value: channelField, inline: true }] : []),
        ...(extra?.count ? [{ name: 'Count', value: String(extra.count), inline: true }] : []),
        ...(extra?.deleteMemberDays ? [{ name: 'Prune Days', value: String(extra.deleteMemberDays), inline: true }] : []),
        ...(auditLogEntry.reason ? [{ name: 'Reason', value: truncate(auditLogEntry.reason, 256) }] : []),
        { name: 'Created', value: timeTag(auditLogEntry.createdAt), inline: true },
      ],
      color: 0x6a5acd,
    });
  },
};
