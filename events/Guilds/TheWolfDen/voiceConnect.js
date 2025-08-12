const { Events, ChannelType, PermissionsBitField } = require('discord.js');

// The ID of the "Lobby" channel where users join to create a private channel.
const LOBBY_CHANNEL_ID = '1385321890675032174';

// We use a Map to keep track of the created channels and their creators.
// This method is much safer than checking the channel name.
// The key will be the channel ID, and the value will be the creator's ID.
const temporaryChannels = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const guild = newState.guild;
    const member = newState.member;

    // --- Channel CREATION logic ---
    // Check if the user joined the "Lobby" channel.
    if (newState.channelId === LOBBY_CHANNEL_ID && oldState.channelId !== LOBBY_CHANNEL_ID) {
      // Get the category (parent) of the Lobby channel to create the new channel in the same place.
      const parentCategory = newState.channel.parent;

      try {
        // Create the voice channel with strict permissions.
        const channel = await guild.channels.create({
          // Use the member's server nickname, or their global username as a fallback.
          name: `${member.nickname || member.user.username}'s Channel`,
          type: ChannelType.GuildVoice,
          parent: parentCategory, // Place it in the same category as the Lobby
          permissionOverwrites: [
            {
              // Deny the @everyone role from seeing the channel. This is the key!
              id: guild.roles.everyone,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              // Allow the creator to see, connect, and manage the members in the channel.
              id: member.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.MoveMembers,    // Can move other members into the channel.
                PermissionsBitField.Flags.MuteMembers,
                PermissionsBitField.Flags.DeafenMembers,
              ],
            },
          ],
          // The extra options you added
          bitrate: 64000,
          userLimit: 5,
          rtcRegion: 'rotterdam',
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
        }
    }
  },
};
