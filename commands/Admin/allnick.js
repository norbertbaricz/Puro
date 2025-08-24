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

        // Verificare suplimentară a permisiunilor (bună practică)
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.color || '#ff0000')
                        .setTitle('⛔ No Permission')
                        .setDescription(config.messages?.no_permission || 'You need "Manage Nicknames" permission to use this command.')
                ],
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        const members = await guild.members.fetch();
        let changed = 0, failed = 0, skipped = 0;

        for (const member of members.values()) {
            // MODIFICARE AICI:
            // Botul nu poate schimba NICIODATĂ porecla deținătorului serverului. Acesta este singurul caz pe care îl sărim.
            if (member.id === guild.ownerId) {
                skipped++;
                continue;
            }

            // Pentru toți ceilalți membri (inclusiv admini și boți), vom ÎNCERCA să schimbăm porecla.
            // Dacă botul nu are permisiunea (ex: rolul unui admin e mai mare), operațiunea va eșua și va fi prinsă în `catch`.
            try {
                await member.setNickname(newNick || null, `Action by /allnick used by ${interaction.user.tag}`);
                changed++;
            } catch (err) {
                // Eșecul este înregistrat fără a opri comanda.
                failed++;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(config.color || '#00ff00')
            .setTitle(newNick ? (config.messages?.title_changed || '✅ Nicknames Changed') : (config.messages?.title_reset || '✅ Nicknames Reset'))
            .setDescription(
                (newNick ?
                    (config.messages?.success || 'Changed nickname for **{changed}** members to: `{newNick}`.').replace('{changed}', changed).replace('{newNick}', newNick) :
                    (config.messages?.reset_success || 'Reset nickname for **{changed}** members.').replace('{changed}', changed)
                )
            )
            .addFields(
                { name: 'Succeeded', value: `**${changed}**`, inline: true },
                { name: 'Failed', value: `**${failed}**`, inline: true },
                { name: 'Skipped (Owner)', value: `**${skipped}**`, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`})
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
