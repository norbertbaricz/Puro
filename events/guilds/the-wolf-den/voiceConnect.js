const { Events, ChannelType, PermissionsBitField } = require('discord.js');

// Default fallback; prefer config.events.voiceConnect.lobby_channel_id if present
const DEFAULT_LOBBY_CHANNEL_ID = '1385321890675032174';

// We use a Map to keep track of the created channels and their creators.
// This method is much safer than checking the channel name.
// The key will be the channel ID, and the value will be the creator's ID.
const temporaryChannels = new Map();
// Per-user cooldown map: Map<userId, lastTs>
const lastCreate = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const guild = newState.guild;
    const member = newState.member;
    const cfg = (guild.client.config?.events?.voiceConnect) || {};
    const lobbyId = cfg.lobby_channel_id || DEFAULT_LOBBY_CHANNEL_ID;
    const bitrate = Number(cfg.bitrate) || 64000;
    const userLimit = Number(cfg.user_limit) || 5;
    const rtcRegion = cfg.rtc_region || 'rotterdam';
    const nameTemplate = cfg.name_template || "{user}'s Channel";
    const cooldownMs = Math.max(0, Number(cfg.cooldown_seconds) || 15) * 1000;

    // --- Channel CREATION logic ---
    // Check if the user joined the "Lobby" channel.
    if (newState.channelId === lobbyId && oldState.channelId !== lobbyId) {
      // Cooldown to prevent abuse
      const now = Date.now();
      const last = lastCreate.get(member.id) || 0;
      if (now - last < cooldownMs) {
        // Try to move them back out of lobby if spam; ignore failures
        if (oldState.channelId) {
          member.voice.setChannel(oldState.channelId).catch(() => {});
        }
        return;
      }
      lastCreate.set(member.id, now);
      // Get the category (parent) of the Lobby channel to create the new channel in the same place.
      const parentCategory = newState.channel.parent;

      try {
        // Create the voice channel with strict permissions.
        const channel = await guild.channels.create({
          name: nameTemplate.replace('{user}', member.displayName || member.user.username).slice(0, 90),
          type: ChannelType.GuildVoice,
          parent: parentCategory,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: member.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.MoveMembers,
                PermissionsBitField.Flags.MuteMembers,
                PermissionsBitField.Flags.DeafenMembers,
                PermissionsBitField.Flags.ManageChannels,
              ],
            },
          ],
          bitrate,
          userLimit,
          rtcRegion,
        });

        // Move the member to the newly created channel.
        await member.voice.setChannel(channel);

        // Save the channel ID in our Map to know it's a temporary channel.
        temporaryChannels.set(channel.id, member.id);
        
      } catch (error) {
        console.error('Could not create the temporary channel:', error);
      }
    }

    // --- Channel DELETION logic ---
    // This part handles deleting the channel when it becomes empty.
    // We check the ID from the old state, as the channel object itself might be gone.
    if (oldState.channelId && temporaryChannels.has(oldState.channelId)) {
        // We need to fetch the channel object from the guild to ensure it still exists.
        const channel = guild.channels.cache.get(oldState.channelId);

        // If the channel still exists in the cache and is now empty, delete it.
        if (channel && channel.members.size === 0) {
            try {
                await channel.delete('Temporary channel is empty.');
                temporaryChannels.delete(channel.id);
            } catch (error) {
                console.error(`Failed to delete temporary channel ${channel.id}:`, error);
                // If the error is 'Unknown Channel', it was likely deleted by another process (race condition).
                // We can safely remove it from our tracking map.
                if (error.code === 10003) { // Discord API Error Code for 'Unknown Channel'
                    temporaryChannels.delete(channel.id);
                }
            }
        } else if (channel) {
            // If the owner left but others remain, transfer ownership to first remaining member
            const currentOwnerId = temporaryChannels.get(channel.id);
            const stillHasOwner = channel.members.has(currentOwnerId);
            if (!stillHasOwner && channel.members.size > 0) {
                const newOwner = channel.members.first();
                if (newOwner) {
                    try {
                        await channel.permissionOverwrites.edit(newOwner.id, {
                            ViewChannel: true,
                            Connect: true,
                            MoveMembers: true,
                            MuteMembers: true,
                            DeafenMembers: true,
                            ManageChannels: true,
                        });
                        // Optionally reduce old owner's perms
                        await channel.permissionOverwrites.edit(currentOwnerId, { ManageChannels: false }).catch(() => {});
                        temporaryChannels.set(channel.id, newOwner.id);
                        // Also rename channel to reflect new owner
                        const newName = nameTemplate.replace('{user}', newOwner.displayName || newOwner.user.username).slice(0, 90);
                        await channel.setName(newName).catch(() => {});
                    } catch (e) {
                        console.error('Failed to transfer temporary channel ownership:', e);
                    }
                }
            }
        }
    }
  },
};
