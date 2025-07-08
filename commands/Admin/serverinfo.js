const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Shows detailed information about this server.'),
    async execute(interaction) {
        const config = interaction.client.config;
        const serverinfoConfig = config.commands.serverinfo;

        if (!interaction.guild) {
            return interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
        }

        const { guild } = interaction;
        const owner = await guild.fetchOwner();
        const channels = guild.channels.cache;
        const textChannels = channels.filter(c => c.type === 0).size;
        const voiceChannels = channels.filter(c => c.type === 2).size;
        const boostLevel = ['None', 'Tier 1', 'Tier 2', 'Tier 3'][guild.premiumTier] || 'None';

        const iconUrl = guild.iconURL({ dynamic: true, size: 4096 });

        // Count open invites
        let inviteCount = 'NaN';
        try {
            const invites = await guild.invites.fetch();
            inviteCount = invites.size.toString();
        } catch (e) {
            inviteCount = 'NaN';
        }

        const embed = new EmbedBuilder()
            .setColor(serverinfoConfig.color)
            .setTitle(serverinfoConfig.messages.title.replace('{servername}', guild.name))
            .setThumbnail(iconUrl)
            .setImage(iconUrl)
            .setDescription(serverinfoConfig.messages.description)
            .addFields(
                { name: serverinfoConfig.messages.fields.server_id, value: guild.id, inline: true },
                { name: serverinfoConfig.messages.fields.owner, value: `${owner.user.tag}`, inline: true },
                { name: serverinfoConfig.messages.fields.created, value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: serverinfoConfig.messages.fields.members, value: `${guild.memberCount}`, inline: true },
                { name: serverinfoConfig.messages.fields.text_channels, value: `${textChannels}`, inline: true },
                { name: serverinfoConfig.messages.fields.voice_channels, value: `${voiceChannels}`, inline: true },
                { name: serverinfoConfig.messages.fields.roles, value: `${guild.roles.cache.size}`, inline: true },
                { name: serverinfoConfig.messages.fields.boost_level, value: `${boostLevel}`, inline: true },
                { name: serverinfoConfig.messages.fields.boosts, value: `${guild.premiumSubscriptionCount}`, inline: true },
                { name: 'Open Invites', value: inviteCount, inline: true } // Add open invites count
            )
            .setFooter({ text: serverinfoConfig.messages.footer.replace('{user}', interaction.user.tag), iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};