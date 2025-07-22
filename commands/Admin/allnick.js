const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('allnick')
        .setDescription('Change or reset the nickname of all server members (including bots and admins, if possible)')
        .addStringOption(option =>
            option.setName('nickname') // Am corectat 'nicknamne' in 'nickname'
                .setDescription('The nickname to set for all members (leave empty to reset)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        const config = interaction.client.config.commands.allnick || {};
        const newNick = interaction.options.getString('nickname');
        const guild = interaction.guild;

        // Verifică permisiuni
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors?.error || '#ff0000')
                        .setTitle('⛔ No Permission')
                        .setDescription(config.messages?.no_permission || 'You need the "Manage Nicknames" permission to use this command.')
                ],
                ephemeral: true // Am schimbat `flags: 64` in `ephemeral: true` pentru claritate
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const members = await guild.members.fetch();
        let changed = 0, failed = 0, skipped = 0;

        for (const member of members.values()) {
            // Nu poți schimba nickname-ul ownerului serverului
            if (member.id === guild.ownerId) {
                skipped++;
                continue;
            }
            // Nu poți schimba nickname-ul membrilor cu rol mai mare sau egal cu botul
            if (guild.members.me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
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

        const successMessage = newNick
            ? (config.messages?.success || 'Changed nickname for **{changed}** members to: `{newNick}`.').replace('{changed}', changed).replace('{newNick}', newNick)
            : (config.messages?.reset_success || 'Reset nickname for **{changed}** members.').replace('{changed}', changed);

        const embed = new EmbedBuilder()
            .setColor(config.color || '#00ff00')
            .setTitle(newNick ? (config.messages?.title_changed || 'Nicknames Changed') : (config.messages?.title_reset || 'Nicknames Reset'))
            .setDescription(
                `${successMessage}\n`
                + (failed > 0 ? `❌ ${(config.messages?.failed || 'Failed for {failed} members.').replace('{failed}', failed)}\n` : '')
                + (skipped > 0 ? `⚠️ ${(config.messages?.skipped || 'Skipped {skipped} members (owner or higher/equal role).').replace('{skipped}', skipped)}` : '')
            );

        await interaction.editReply({ embeds: [embed] });
    },
};