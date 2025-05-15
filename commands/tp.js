const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ratelimit = require('../ratelimit');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tp')
        .setDescription('Teleport to a member!')
        .addUserOption(option => 
            option.setName('member').setDescription('The member').setRequired(true)),

    async execute(interaction) {
        const config = interaction.client.config.commands.tp;
        try {
            const remaining = ratelimit(interaction.user.id, 30000);
            if (remaining) {
                return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
            }

            const memberToTeleport = interaction.options.getMember('member');

            if (!memberToTeleport) {
                return interaction.reply({ content: config.messages.not_found, ephemeral: true });
            }

            if (memberToTeleport.id === interaction.user.id) {
                return interaction.reply({ content: config.messages.self_tp, ephemeral: true });
            }

            if (memberToTeleport.user.bot) {
                return interaction.reply({ content: config.messages.bot_tp, ephemeral: true });
            }

            const teleportMessage = config.messages.teleport[Math.floor(Math.random() * config.messages.teleport.length)];

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('🌟 Teleportation Sequence')
                .setDescription(teleportMessage)
                .addFields(
                    { name: '🏃 Traveler', value: `${interaction.user}`, inline: true },
                    { name: '🎯 Destination', value: `${memberToTeleport}`, inline: true }
                )
                .setFooter({ text: 'Thank your teleporter operator!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            try {
                await memberToTeleport.send({
                    content: `🌟 ${interaction.user.tag} teleported to you from ${interaction.guild.name}!`
                });
            } catch (error) {
                console.log(`Could not DM ${memberToTeleport.user.tag}`);
            }
        } catch (error) {
            console.error('TP error:', error);
            await interaction.reply({ content: config.messages.error, ephemeral: true });
        }
    },
};