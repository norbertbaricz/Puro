const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

function calculateLoveScore(user1Id, user2Id) {
    const seed = parseInt(user1Id) + parseInt(user2Id);
    return Math.abs(seed % 101);
}

function getLoveMessage(percentage, messages) {
    if (percentage === 100) return messages[100];
    if (percentage >= 90) return messages[90];
    if (percentage >= 70) return messages[70];
    if (percentage >= 50) return messages[50];
    if (percentage >= 30) return messages[30];
    if (percentage >= 10) return messages[10];
    return messages[0];
}

function generateLoveBar(percentage) {
    const filled = Math.round(percentage / 10);
    return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);
}

function shipName(a, b) {
    const left = a.username || String(a);
    const right = b.username || String(b);
    const cutLeft = Math.max(2, Math.ceil(left.length / 2));
    const cutRight = Math.max(2, Math.floor(right.length / 2));
    return (left.slice(0, cutLeft) + right.slice(right.length - cutRight)).replace(/\s+/g, '');
}

function colorFromPercentage(pct) {
    // Map 0..100 to red->yellow->green using HSL
    const hue = Math.round((pct / 100) * 120); // 0=red,120=green
    return Number(`0x${hslToHex(hue, 70, 45)}`);
}

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
    return `${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('love')
        .setDescription('Calculate love compatibility')
        .addUserOption(option =>
            option.setName('user1').setDescription('First user').setRequired(true))
        .addUserOption(option =>
            option.setName('user2').setDescription('Second user (defaults to you)').setRequired(false))
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Score mode')
                .addChoices(
                    { name: 'Fixed (based on IDs)', value: 'fixed' },
                    { name: 'Random (just for fun)', value: 'random' }
                )
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Only you will see the result')
                .setRequired(false)
        ),

    async execute(interaction) {
        const config = interaction.client.config.commands.love;
        try {
            const user1 = interaction.options.getUser('user1');
            const user2 = interaction.options.getUser('user2') || interaction.user;
            const mode = interaction.options.getString('mode') || 'fixed';
            const isPrivate = interaction.options.getBoolean('private') || false;

            if (user1.id === user2.id) {
                return interaction.reply({ content: config.messages.self_love, flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

            const build = (u1, u2, pct, tip, rerolls) => {
                const loveMessage = getLoveMessage(pct, config.messages.results);
                const loveBar = generateLoveBar(pct);
                const pair = `${u1} 💕 ${u2}`;
                const ship = shipName(u1, u2);
                return new EmbedBuilder()
                    .setColor(mode === 'fixed' ? config.color : colorFromPercentage(pct))
                    .setTitle('💘 Love Calculator')
                    .addFields(
                        { name: '👥 Love Match', value: pair, inline: false },
                        { name: '🔤 Ship Name', value: `\`${ship}\``, inline: true },
                        { name: '💝 Compatibility', value: `${pct}%\n${loveBar}`, inline: false },
                        { name: '💌 Love Reading', value: loveMessage, inline: false },
                        { name: '💡 Love Tip', value: tip, inline: false }
                    )
                    .setThumbnail(u2.displayAvatarURL({ size: 256 }))
                    .setFooter({ text: `True love > numbers!${rerolls ? ` • Rerolls: ${rerolls}` : ''}` })
                    .setTimestamp();
            };

            const randomTip = () => config.messages.tips[Math.floor(Math.random() * config.messages.tips.length)];
            const compute = (u1, u2) => mode === 'random' ? Math.floor(Math.random() * 101) : calculateLoveScore(u1.id, u2.id);

            let current = { u1: user1, u2: user2, pct: compute(user1, user2), tip: randomTip(), rerolls: 0 };

            const row = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('love_swap').setLabel('Swap').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('love_tip').setLabel('New Tip').setStyle(ButtonStyle.Primary).setEmoji('💡'),
                new ButtonBuilder().setCustomId('love_reroll').setLabel('Recalculate').setStyle(ButtonStyle.Success).setEmoji('🎯').setDisabled(current.rerolls >= 3 || mode !== 'random'),
                new ButtonBuilder().setCustomId('love_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            await interaction.editReply({ embeds: [build(current.u1, current.u2, current.pct, current.tip, current.rerolls)], components: [row()] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'love_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(row().components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }
                if (i.customId === 'love_swap') {
                    const tmp = current.u1; current.u1 = current.u2; current.u2 = tmp;
                    current.tip = randomTip();
                    await i.update({ embeds: [build(current.u1, current.u2, current.pct, current.tip, current.rerolls)], components: [row()] });
                    return;
                }
                if (i.customId === 'love_tip') {
                    current.tip = randomTip();
                    await i.update({ embeds: [build(current.u1, current.u2, current.pct, current.tip, current.rerolls)], components: [row()] });
                    return;
                }
                if (i.customId === 'love_reroll') {
                    current.rerolls += 1;
                    current.pct = compute(current.u1, current.u2);
                    current.tip = randomTip();
                    await i.update({ embeds: [build(current.u1, current.u2, current.pct, current.tip, current.rerolls)], components: [row()] });
                    return;
                }
            });

            collector.on('end', async (_c, reason) => {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(row().components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ components: [disabled] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('Love error:', error);
            await interaction.reply({ content: config.messages.error, flags: MessageFlags.Ephemeral });
        }
    },
};
