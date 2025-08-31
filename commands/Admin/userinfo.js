const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Shows detailed information about a user.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to get information about')
                .setRequired(true)),
    async execute(interaction) {
        const config = interaction.client.config;
        const userinfoConfig = config.commands.userinfo;

        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
        }

        // Always resolve the target user first
        const targetUser = interaction.options.getUser('member', true);

        // Try to get a full GuildMember; fall back to fetching if uncached
        let member = interaction.options.getMember('member');
        if (!member) {
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (e) {
                member = null;
            }
        }

        // Safely compute roles (only if we have a GuildMember)
        const roles = member && member.roles && member.roles.cache
            ? member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .map(role => role.toString())
                .join(', ') || userinfoConfig.messages.none
            : userinfoConfig.messages.none;

        const avatarUrl = (member ? member.user : targetUser).displayAvatarURL({ dynamic: true, size: 4096 });

        // Calculate account age in milliseconds
        const accountCreatedTimestamp = (member ? member.user : targetUser).createdTimestamp;
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000); // 12 months in milliseconds

        let securityStatus;
        if (accountCreatedTimestamp < oneYearAgo) {
            securityStatus = '✅ Account older than 12 months';
        } else {
            securityStatus = '⚠️ Account younger than 12 months';
        }

        // Try to find who invited the user
        let inviterTag = 'NaN';
        try {
            // Fetch all invites for the guild
            const invites = await interaction.guild.invites.fetch();
            // Try to find an invite used by this member (not always possible)
            const usedInvite = invites.find(inv => inv.uses > 0 && inv.inviter && member && inv.inviter.id !== member.id && inv.inviter.id !== interaction.guild.ownerId);
            if (usedInvite && usedInvite.inviter) {
                inviterTag = usedInvite.inviter.tag;
            }
        } catch (e) {
            inviterTag = 'NaN';
        }

        const embed = new EmbedBuilder()
            .setColor(userinfoConfig.color)
            .setTitle(userinfoConfig.messages.title.replace('{tag}', (member ? member.user : targetUser).tag))
            .setDescription(userinfoConfig.messages.description)
            .setThumbnail(avatarUrl)
            .setImage(avatarUrl)
            .addFields(
                { name: userinfoConfig.messages.fields.user_id, value: (member ? member.id : targetUser.id), inline: true },
                { name: userinfoConfig.messages.fields.bot, value: ((member ? member.user : targetUser).bot ? userinfoConfig.messages.yes : userinfoConfig.messages.no), inline: true },
                { name: userinfoConfig.messages.fields.nickname, value: (member && member.nickname) ? member.nickname : userinfoConfig.messages.none, inline: true },
                { name: userinfoConfig.messages.fields.account_created, value: `<t:${Math.floor(((member ? member.user : targetUser).createdTimestamp) / 1000)}:F>`, inline: false },
                { name: userinfoConfig.messages.fields.joined_server, value: member && member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : userinfoConfig.messages.none, inline: false },
                { name: userinfoConfig.messages.fields.roles, value: roles, inline: false },
                { name: `🔒 ${userinfoConfig.messages.fields.security || 'Security'}`, value: securityStatus, inline: true },
                { name: 'Invited by', value: inviterTag, inline: true } // Show who invited the user
            )
            .setFooter({ text: userinfoConfig.messages.footer.replace('{user}', interaction.user.tag), iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
