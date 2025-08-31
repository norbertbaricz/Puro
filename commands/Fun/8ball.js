const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the Magic 8-Ball a question and receive a mysterious answer.')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The yes/no question you want to ask.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('If enabled, only you will see the answer.')
                .setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.eightball;

        try {
            const question = (interaction.options.getString('question') || '').trim();
            const isPrivate = interaction.options.getBoolean('private') || false;

            // Harta culorilor pe categorie folosind schema globală din config
            const palette = interaction.client.config.colors || {};
            const categoryColor = {
                affirmative: palette.success || '#00ff00',
                non_committal: palette.info || '#0099ff',
                negative: palette.error || '#ff0000'
            };

            // Pre-generate helperi pentru alegerea răspunsului cu categoria aferentă
            const categories = ['affirmative', 'non_committal', 'negative'];
            const pickAnswer = () => {
                const category = categories[Math.floor(Math.random() * categories.length)];
                const pool = config.answers[category] || [];
                const answer = pool[Math.floor(Math.random() * pool.length)] || '...';
                return { category, answer };
            };

            const categoryEmoji = {
                affirmative: '✅',
                non_committal: '🤔',
                negative: '❌'
            };

            // Suspans: arătăm „shake” înainte de rezultat
            await interaction.deferReply({ ephemeral: isPrivate });

            const loadingEmbed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(config.messages.title)
                .setDescription(`Shaking the 8-Ball... \n> ${question}`)
                .setImage(config.image_url)
                .setFooter({
                    text: `Asked by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [loadingEmbed], components: [] });

            // Afișăm răspunsul după o scurtă animație
            const reveal = async (rerollCount = 0) => {
                const { category, answer } = pickAnswer();
                const finalEmbed = new EmbedBuilder()
                    .setColor(categoryColor[category] || config.color)
                    .setTitle(config.messages.title)
                    .setThumbnail(config.image_url)
                    .setDescription(
                        `**❓ ${config.messages.question_field}:**\n> ${question}\n\n` +
                        `**🎱 ${config.messages.answer_field}:**\n${categoryEmoji[category]} ${answer}`
                    )
                    .setFooter({
                        text: `Asked by ${interaction.user.tag}${rerollCount ? ` • Rerolls: ${rerollCount}` : ''}`,
                        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                    })
                    .setTimestamp();

                // Butoane: Re-întreabă (max 3) și Închide (doar pentru autor)
                const canReroll = rerollCount < 3;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('8ball_again')
                        .setLabel('Ask again')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                        .setDisabled(!canReroll),
                    new ButtonBuilder()
                        .setCustomId('8ball_close')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️')
                );

                await interaction.editReply({ embeds: [finalEmbed], components: [row] });

                // Colector pentru butoane — doar autorul poate apăsa
                const replyMessage = await interaction.fetchReply();
                const collector = replyMessage.createMessageComponentCollector({ time: 30_000 });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        await i.reply({ content: 'Only the original asker can use these buttons.', ephemeral: true });
                        return;
                    }
                    if (i.customId === '8ball_close') {
                        collector.stop('closed');
                        const disabledRow = new ActionRowBuilder().addComponents(
                            row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                        );
                        await i.update({ components: [disabledRow] });
                        return;
                    }
                    if (i.customId === '8ball_again') {
                        collector.stop('reroll');
                        await i.deferUpdate();
                        // mic efect de „shake” la re-roll
                        const rolling = EmbedBuilder.from(finalEmbed)
                            .setColor(config.color)
                            .setDescription(`Shaking again... \n> ${question}`)
                            .setImage(config.image_url)
                            .setThumbnail(null);
                        const disabledRow = new ActionRowBuilder().addComponents(
                            row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                        );
                        await interaction.editReply({ embeds: [rolling], components: [disabledRow] });
                        setTimeout(() => reveal(rerollCount + 1), 1000);
                    }
                });

                collector.on('end', async (_collected, reason) => {
                    if (reason === 'time') {
                        const disabledRow = new ActionRowBuilder().addComponents(
                            row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                        );
                        await interaction.editReply({ components: [disabledRow] }).catch(() => {});
                    }
                });
            };

            setTimeout(() => reveal(0), 1000);

        } catch (error) {
            console.error('8ball command error:', error);
            await interaction.reply({ content: config.messages.error, ephemeral: true });
        }
    },
};
