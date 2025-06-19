const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allnick')
        .setDescription('Change or reset the nickname of all server members (including bots and admins, if possible)')
        .addStringOption(option =>
            option.setName('nicknamne')
                .setDescription('The nickname to set for all members (leave empty to reset)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        const config = interaction.client.config.commands.allnick || {};
        const newNick = interaction.options.getString('nicknamne');
        const guild = interaction.guild;

        // Verifică permisiuni
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.color || '#ff0000')
                        .setTitle('⛔ No Permission')
                        .setDescription('You need the "Manage Nicknames" permission to use this command.')
                ],
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

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

        const embed = new EmbedBuilder()
            .setColor(config.color || '#00ff00')
            .setTitle(newNick ? 'Nicknames Changed' : 'Nicknames Reset')
            .setDescription(
                `${newNick ? `Changed nickname for **${changed}** members to: \`${newNick}\`.` : `Reset nickname for **${changed}** members.`}\n`
                + (failed ? `❌ Failed for ${failed} members.\n` : '')
                + (skipped ? `⚠️ Skipped ${skipped} members (owner or higher/equal role than bot).` : '')
            );

        await interaction.editReply({ embeds: [embed] });
    },
};