const { Events } = require('discord.js');
const { sendLog, formatUser, formatRole } = require('../../../../lib/wolfDenLogger');

function diffRoles(before, after) {
  const beforeIds = new Set(before?.map((r) => r.id));
  const afterIds = new Set(after?.map((r) => r.id));
  const added = [...afterIds].filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));
  return { added, removed };
}

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    if (!newMember?.guild) return;
    if (oldMember.partial) { try { oldMember = await oldMember.fetch(); } catch (_) {} }

    const fields = [];
    if (oldMember.nickname !== newMember.nickname) {
      fields.push({ name: 'Nickname', value: `${oldMember.nickname || 'None'} → ${newMember.nickname || 'None'}` });
    }

    const { added, removed } = diffRoles(oldMember.roles.cache.map((r) => r), newMember.roles.cache.map((r) => r));
    if (added.length) fields.push({ name: 'Roles Added', value: added.map((id) => formatRole(newMember.guild.roles.cache.get(id))).join('\n') });
    if (removed.length) fields.push({ name: 'Roles Removed', value: removed.map((id) => formatRole(newMember.guild.roles.cache.get(id))).join('\n') });

    if (!fields.length) return;

    await sendLog(newMember.client, {
      guildId: newMember.guild.id,
      title: 'Member Updated',
      description: `${formatUser(newMember.user)} was modified.`,
      fields,
      color: 0x20b2aa,
    });
  },
};
