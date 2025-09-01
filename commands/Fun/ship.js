const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Ship yourself with another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to ship with')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Score mode')
                .addChoices(
                    { name: 'Fixed (consistent)', value: 'fixed' },
                    { name: 'Random (for fun)', value: 'random' }
                )
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Only you will see the result')
                .setRequired(false)
        ),
    async execute(interaction) {
        const user1 = interaction.user;
        const user2 = interaction.options.getUser('member');
        const mode = interaction.options.getString('mode') || 'fixed';
        const isPrivate = interaction.options.getBoolean('private') || false;
        const config = interaction.client.config;
        const shipConfig = config.commands.ship;

        if (user1.id === user2.id) {
            return interaction.reply({ content: shipConfig.messages.self_ship, ephemeral: true });
        }

        const seeded = (a, b) => {
            const key = `${a.id}|${b.id}`;
            let h = 2166136261;
            for (let i = 0; i < key.length; i++) {
                h ^= key.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return Math.abs(h % 101);
        };

        const makeShipName = (a, b) => {
            const left = a.username;
            const right = b.username;
            const cutLeft = Math.max(2, Math.ceil(left.length / 2));
            const cutRight = Math.max(2, Math.floor(right.length / 2));
            return (left.slice(0, cutLeft) + right.slice(right.length - cutRight)).replace(/\s+/g, '');
        };

        const emojiFor = p => p > 80 ? '💖' : p > 60 ? '❤️' : p > 40 ? '💛' : p > 20 ? '💙' : '💔';
        const bar = p => {
            const filled = Math.round(p / 10);
            return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled) + ` ${p}%`;
        };
        const colorFromPct = p => {
            const hue = Math.round((p / 100) * 120);
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

        if (isPrivate) {
            await interaction.deferReply({ flags: 64 });
        } else {
            await interaction.deferReply();
        }

        let state = {
            a: user1,
            b: user2,
            pct: mode === 'random' ? Math.floor(Math.random() * 101) : seeded(user1, user2),
            rerolls: 0
        };

        const build = () => {
            const ship = makeShipName(state.a, state.b);
            const emoji = emojiFor(state.pct);
            const desc = shipConfig.messages.description
                .replace('{emoji}', emoji)
                .replace('{user1}', state.a.username)
                .replace('{user2}', state.b.username)
                .replace('{shipName}', ship)
                .replace('{percentage}', String(state.pct));
            return new EmbedBuilder()
                .setColor(shipConfig.color || colorFromPct(state.pct))
                .setTitle(shipConfig.messages.title)
                .setDescription(desc)
                .addFields({ name: 'Meter', value: bar(state.pct), inline: false })
                .setThumbnail(state.b.displayAvatarURL({ size: 256 }))
                .setFooter({ text: `${interaction.user.tag}${state.rerolls ? ` • Rerolls: ${state.rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
        };

        const row = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ship_swap').setLabel('Swap').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('ship_reroll').setLabel('Recalculate').setStyle(ButtonStyle.Success).setEmoji('🎯').setDisabled(mode !== 'random' || state.rerolls >= 3),
            new ButtonBuilder().setCustomId('ship_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.editReply({ embeds: [build()], components: [row()] });

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the command invoker can use these buttons.', flags: 64 });
                return;
            }
            if (i.customId === 'ship_close') {
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(row().components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }
            if (i.customId === 'ship_swap') {
                const tmp = state.a; state.a = state.b; state.b = tmp;
                await i.update({ embeds: [build()], components: [row()] });
                return;
            }
            if (i.customId === 'ship_reroll' && mode === 'random') {
                state.rerolls += 1;
                state.pct = Math.floor(Math.random() * 101);
                await i.update({ embeds: [build()], components: [row()] });
                return;
            }
        });

        collector.on('end', async (_c, reason) => {
            if (reason === 'time') {
                const disabled = new ActionRowBuilder().addComponents(row().components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await interaction.editReply({ components: [disabled] }).catch(() => {});
            }
        });
    }
};
