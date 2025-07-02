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

        const member = interaction.options.getMember('member');
        if (!member) {
            return interaction.reply({ content: userinfoConfig.messages.not_found, ephemeral: true });
        }

        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .map(role => role.toString())
            .join(', ') || userinfoConfig.messages.none;

        const avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 4096 });

        // Calculate account age in milliseconds
        const accountCreatedTimestamp = member.user.createdTimestamp;
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000); // 12 months in milliseconds

        let securityStatus;
        if (accountCreatedTimestamp < oneYearAgo) {
            securityStatus = '✅ Account older than 12 months';
        } else {
            securityStatus = '⚠️ Account younger than 12 months';
        }

        const embed = new EmbedBuilder()
            .setColor(userinfoConfig.color)
            .setTitle(userinfoConfig.messages.title.replace('{tag}', member.user.tag))
            .setDescription(userinfoConfig.messages.description)
            .setThumbnail(avatarUrl)
            .setImage(avatarUrl)
            .addFields(
                { name: userinfoConfig.messages.fields.user_id, value: member.id, inline: true },
                { name: userinfoConfig.messages.fields.bot, value: member.user.bot ? userinfoConfig.messages.yes : userinfoConfig.messages.no, inline: true },
                { name: userinfoConfig.messages.fields.nickname, value: member.nickname || userinfoConfig.messages.none, inline: true },
                { name: userinfoConfig.messages.fields.account_created, value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: userinfoConfig.messages.fields.joined_server, value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: false },
                { name: userinfoConfig.messages.fields.roles, value: roles, inline: false },
                { name: `🔒 ${userinfoConfig.messages.fields.security || 'Security'}`, value: securityStatus, inline: true } // Added lock emoji here
            )
            .setFooter({ text: userinfoConfig.messages.footer.replace('{user}', interaction.user.tag), iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};