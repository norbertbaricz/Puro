const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ms = require('ms'); // Make sure to install 'ms' package for period parsing

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
        const member = interaction.options.getMember('member');
        const period = interaction.options.getString('period');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!member || !member.bannable) {
            return interaction.reply({ content: 'I cannot ban this member.', ephemeral: true });
        }

        let deleteDays = 0;
        let unbanTimeout = null;
        let periodText = period;

        if (period.toLowerCase() !== 'permanent') {
            const msPeriod = ms(period);
            if (!msPeriod || msPeriod < 1000) {
                return interaction.reply({ content: 'Invalid period format. Use formats like 1d, 7d, 1h, or "permanent".', ephemeral: true });
            }
            periodText = ms(msPeriod, { long: true });

            // Schedule unban
            unbanTimeout = setTimeout(async () => {
                try {
                    await interaction.guild.members.unban(member.id, 'Temporary ban expired');
                } catch (e) {
                    // Ignore if already unbanned or error
                }
            }, msPeriod);
        }

        await member.ban({ reason, deleteMessageDays: deleteDays });

        const embed = new EmbedBuilder()
            .setTitle('Member Banned')
            .setColor(0x8b0000)
            .addFields(
                { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: 'Banned by', value: `${interaction.user.tag}`, inline: true },
                { name: 'Duration', value: periodText, inline: true },
                { name: 'Reason', value: reason, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};