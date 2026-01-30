const { Events } = require('discord.js');
const { sendLog, formatUser, formatChannel, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.AutoModerationActionExecution,
  async execute(data) {
    await sendLog(data.client, {
      guildId: data.guildId,
      title: 'AutoMod Action',
      description: `Rule ${data.ruleId} triggered an action.`,
      fields: [
        { name: 'User', value: formatUser(data.user) },
        { name: 'Channel', value: data.channelId ? formatChannel({ id: data.channelId, toString: () => `<#${data.channelId}>` }) : 'None' },
        { name: 'Action', value: truncate(JSON.stringify(data.action || {}), 900) },
        { name: 'Matched Content', value: truncate(data.matchedContent || 'None', 900) },
      ],
      color: 0xcd5c5c,
    });
  },
};
