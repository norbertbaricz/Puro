const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Ban duration (e.g. 1d, 7d, permanent)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false)),
    async execute(interaction) {
        const config = interaction.client.config.commands.ban || {};
        const member = interaction.options.getMember('member');
        const period = interaction.options.getString('period');
        const reason = interaction.options.getString('reason') || (config.messages?.no_reason || 'No reason provided');

        if (!member || !member.bannable) {
            return interaction.reply({ content: config.messages?.cannot_ban || 'I cannot ban this member.', ephemeral: true });
        }

        let deleteDays = 0;
        let periodText = period;

        if (period.toLowerCase() !== 'permanent') {
            try {
                const msPeriod = ms(period);
                if (!msPeriod || msPeriod < 1000) {
                    return interaction.reply({ content: config.messages?.invalid_period || 'Invalid period format.', ephemeral: true });
                }
                periodText = ms(msPeriod, { long: true });

                // Schedule unban
                setTimeout(async () => {
                    try {
                        await interaction.guild.members.unban(member.id, 'Temporary ban expired');
                    } catch (e) {
                        // Ignore if already unbanned or error
                    }
                }, msPeriod);
            } catch (e) {
                return interaction.reply({ content: config.messages?.invalid_period || 'Invalid period format.', ephemeral: true });
            }
        } else {
            periodText = config.messages?.permanent || 'Permanent';
        }

        await member.ban({ reason, deleteMessageDays: deleteDays });

        const embed = new EmbedBuilder()
            .setTitle(config.messages?.success_title || 'Member Banned')
            .setColor(config.color || 0x8b0000)
            .addFields(
                { name: config.messages?.field_user || 'User', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: config.messages?.field_banned_by || 'Banned by', value: `${interaction.user.tag}`, inline: true },
                { name: config.messages?.field_duration || 'Duration', value: periodText, inline: true },
                { name: config.messages?.field_reason || 'Reason', value: reason, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};