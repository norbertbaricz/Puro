const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('allnick')
        .setDescription('Change or reset the nickname of all server members')
        .addStringOption(option =>
            option.setName('nickname')
                .setDescription('The nickname to set (leave empty to reset)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        const config = interaction.client.config.commands.allnick || {};
        const newNick = interaction.options.getString('nickname');
        const guild = interaction.guild;

        // MODIFICARE AICI: Am corectat verificarea permisiunilor
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.color || '#ff0000')
                        .setTitle('⛔ No Permission')
                        .setDescription(config.messages?.no_permission || 'You need "Manage Nicknames" permission.')
                ],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const members = await guild.members.fetch();
        let changed = 0, failed = 0, skipped = 0;

        for (const member of members.values()) {
            if (member.id === guild.ownerId || !member.manageable) {
                skipped++;
                continue;
            }
            try {
                await member.setNickname(newNick || null, `Changed by /allnick command`);
                changed++;
            } catch {
                failed++;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(config.color || '#00ff00')
            .setTitle(newNick ? (config.messages?.title_changed || 'Nicknames Changed') : (config.messages?.title_reset || 'Nicknames Reset'))
            .setDescription(
                (newNick ? (config.messages?.success || 'Changed nickname for **{changed}** members to: `{newNick}`.').replace('{changed}', changed).replace('{newNick}', newNick) 
                         : (config.messages?.reset_success || 'Reset nickname for **{changed}** members.').replace('{changed}', changed)) + '\n'
                + (failed > 0 ? `❌ ${(config.messages?.failed || 'Failed for {failed} members.').replace('{failed}', failed)}\n` : '')
                + (skipped > 0 ? `⚠️ ${(config.messages?.skipped || 'Skipped {skipped} members.').replace('{skipped}', skipped)}` : '')
            );

        await interaction.editReply({ embeds: [embed] });
    },
};