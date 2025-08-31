const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Rate anything out of 10!')
        .addStringOption(option =>
            option.setName('thing')
                .setDescription('What do you want me to rate?')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('Score mode')
                .addChoices(
                    { name: 'Fixed (consistent)', value: 'fixed' },
                    { name: 'Random (for fun)', value: 'random' }
                )
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName('private')
                .setDescription('Only you will see the result')
                .setRequired(false)
        ),
    async execute(interaction) {
        const config = interaction.client.config;
        const rateConfig = config.commands.rate;

        const thing = interaction.options.getString('thing').trim();
        const mode = interaction.options.getString('mode') || 'fixed';
        const isPrivate = interaction.options.getBoolean('private') || false;

        const seeded = (str) => {
            // Simple deterministic hash-based pseudo-random (0..1)
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            // map to 0..1
            return ((h >>> 0) % 1000) / 1000;
        };

        const compute = () => {
            if (mode === 'random') return +(Math.random() * 10).toFixed(1);
            const base = seeded(`${thing}|${interaction.user.id}`); // user-scoped consistency
            return +(base * 10).toFixed(1);
        };

        const colorFromScore = (score) => {
            const pct = Math.max(0, Math.min(100, Math.round(score * 10)));
            const hue = Math.round((pct / 100) * 120); // 0 red -> 120 green
            const hslToHex = (h, s, l) => {
                s /= 100; l /= 100;
                const k = n => (n + h / 30) % 12;
                const a = s * Math.min(l, 1 - l);
                const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
                const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
                return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
            };
            return hslToHex(hue, 70, 45);
        };

        const stars = (score) => {
            const full = Math.floor(score);
            const half = score - full >= 0.5 ? 1 : 0;
            const empty = 10 - full - half;
            return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(Math.max(0, empty - (half ? 1 : 0)));
        };

        await interaction.deferReply({ ephemeral: isPrivate });

        const render = async (rerolls = 0) => {
            const rating = compute();
            const embed = new EmbedBuilder()
                .setColor(rateConfig.color || colorFromScore(rating))
                .setTitle(rateConfig.messages.title)
                .setDescription(
                    rateConfig.messages.description
                        .replace('{thing}', thing)
                        .replace('{rating}', rating)
                )
                .addFields(
                    { name: 'Meter', value: stars(rating), inline: false },
                    { name: 'Mode', value: `\`${mode}\``, inline: true }
                )
                .setFooter({ text: `${interaction.user.tag}${rerolls ? ` • Rerolls: ${rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rate_reroll').setLabel('Rerate').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(mode !== 'random' || rerolls >= 3),
                new ButtonBuilder().setCustomId('rate_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
                    return;
                }
                if (i.customId === 'rate_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }
                if (i.customId === 'rate_reroll' && mode === 'random') {
                    collector.stop('reroll');
                    await i.deferUpdate();
                    const waiting = new EmbedBuilder()
                        .setColor(rateConfig.color || '#0099ff')
                        .setTitle(rateConfig.messages.title)
                        .setDescription('Rolling new rating...')
                        .setTimestamp();
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ embeds: [waiting], components: [disabled] });
                    setTimeout(() => render(rerolls + 1), 500);
                }
            });

            collector.on('end', async (_c, reason) => {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ components: [disabled] }).catch(() => {});
                }
            });
        };

        await render(0);
    }
};
