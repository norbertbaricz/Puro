const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Per-user cooldown map
const tpCooldowns = new Map();

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('tp')
        .setDescription('Teleport to another member in the server!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to teleport to')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('If enabled, only you will see the teleport')
                .setRequired(false)
        ),

    async execute(interaction) {
        const commandConfig = interaction.client.config.commands.tp || {};
        const configMessages = commandConfig.messages || {};
        const configColor = commandConfig.color || '#9B59B6';
        const cooldownSeconds = Number(commandConfig.cooldown_seconds) || 10;

        const defaults = {
            cooldown: '⏳ Teleporter is recharging! Please wait {remaining} seconds.',
            not_found: '❌ The selected user could not be found as a member in this server.',
            self_tp: "❌ You cannot teleport to yourself! That's not how this works.",
            bot_tp: '❌ Apologies, teleporter systems are incompatible with bot entities. Cannot teleport to bots!',
            error: '❌ Teleportation sequence failed! An unexpected dimensional rift occurred.',
            teleport: [
                '🌟 WHOOSH! A shimmering portal slices through reality...',
                "⚡ ZAP! You're dematerialized and rematerialized in a flash of light!",
                '🌀 VWOORP! The very fabric of space-time bends around you...',
                "🌌 STRETCH! You're pulled through a cosmic string to your destination!",
                '✨ TWINKLE! With a sprinkle of quantum dust, you arrive!'
            ]
        };

        const getMessage = (key, replacements = {}) => {
            let message = configMessages[key] ?? defaults[key];
            if (typeof message === 'string') {
                for (const k of Object.keys(replacements)) {
                    message = message.replace(new RegExp(`{${k}}`, 'g'), String(replacements[k]));
                }
            }
            return message;
        };

        try {
            const isPrivate = interaction.options.getBoolean('private') || false;
            const targetUser = interaction.options.getUser('member');

            if (!targetUser) {
                return interaction.reply({ content: getMessage('error'), ephemeral: true });
            }
            if (targetUser.bot) {
                return interaction.reply({ content: getMessage('bot_tp'), ephemeral: true });
            }
            const memberToTeleport = interaction.options.getMember('member');
            if (!memberToTeleport) {
                return interaction.reply({ content: getMessage('not_found'), ephemeral: true });
            }
            if (memberToTeleport.id === interaction.user.id) {
                return interaction.reply({ content: getMessage('self_tp'), ephemeral: true });
            }

            // Cooldown check
            const now = Date.now();
            const last = tpCooldowns.get(interaction.user.id) || 0;
            const remainingMs = last + cooldownSeconds * 1000 - now;
            if (remainingMs > 0) {
                const remaining = Math.ceil(remainingMs / 1000);
                return interaction.reply({ content: getMessage('cooldown', { remaining }), ephemeral: true });
            }
            tpCooldowns.set(interaction.user.id, now);

            await interaction.deferReply({ ephemeral: isPrivate });

            const effects = Array.isArray(configMessages.teleport) && configMessages.teleport.length > 0
                ? configMessages.teleport
                : defaults.teleport;

            const charging = new EmbedBuilder()
                .setColor(configColor)
                .setTitle('🔌 Charging Teleporters...')
                .setDescription('Stabilizing wormholes and aligning quantum tunnels...')
                .setTimestamp();
            await interaction.editReply({ embeds: [charging], components: [] });

            const render = async (rerolls = 0) => {
                const msgText = effects[Math.floor(Math.random() * effects.length)];
                const embed = new EmbedBuilder()
                    .setColor(configColor)
                    .setTitle('🌟 Teleportation Sequence Initiated!')
                    .setDescription(msgText || 'Teleporting...')
                    .addFields(
                        { name: '🚀 Traveler', value: `${interaction.user}`, inline: true },
                        { name: '🏁 Destination', value: `${memberToTeleport}`, inline: true }
                    )
                    .setFooter({ text: `Always thank your friendly teleporter operator!${rerolls ? ` • Rerolls: ${rerolls}` : ''}` })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('tp_again').setLabel('Teleport again').setStyle(ButtonStyle.Secondary).setEmoji('🌀').setDisabled(rerolls >= 3),
                    new ButtonBuilder().setCustomId('tp_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.editReply({ embeds: [embed], components: [row] });

                const msg = await interaction.fetchReply();
                const collector = msg.createMessageComponentCollector({ time: 30000 });
                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        await i.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
                        return;
                    }
                    if (i.customId === 'tp_close') {
                        collector.stop('closed');
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await i.update({ components: [disabled] });
                        return;
                    }
                    if (i.customId === 'tp_again') {
                        collector.stop('again');
                        await i.deferUpdate();
                        const recal = EmbedBuilder.from(charging).setTitle('🔌 Recalibrating Coordinates...');
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await interaction.editReply({ embeds: [recal], components: [disabled] });
                        setTimeout(() => render(rerolls + 1), 700);
                    }
                });
                collector.on('end', async (_c, reason) => {
                    if (reason === 'time') {
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await interaction.editReply({ components: [disabled] }).catch(() => {});
                    }
                });
            };

            setTimeout(() => render(0), 800);

            // Best-effort DM to target
            memberToTeleport.send({
                content: `👋 Greetings! ${interaction.user.tag} just "teleported" to your location in the server: **${interaction.guild.name}**!`
            }).catch(dmError => {
                console.log(`TP Info: Could not send a DM to ${memberToTeleport.user.tag} (User ID: ${memberToTeleport.id}).`, dmError?.code || dmError?.message || dmError);
            });

        } catch (error) {
            console.error('TP Command General Error:', error);
            const payload = { content: getMessage('error'), ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload);
            } else {
                await interaction.reply(payload);
            }
        }
    },
};

