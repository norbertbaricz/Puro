const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Tells a random joke!')
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Pick a category')
                .addChoices(
                    { name: 'Any', value: 'Any' },
                    { name: 'Programming', value: 'Programming' },
                    { name: 'Misc', value: 'Misc' },
                    { name: 'Pun', value: 'Pun' },
                    { name: 'Dark', value: 'Dark' },
                    { name: 'Spooky', value: 'Spooky' },
                    { name: 'Christmas', value: 'Christmas' }
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Joke type')
                .addChoices(
                    { name: 'Any', value: 'any' },
                    { name: 'One-liner', value: 'single' },
                    { name: 'Two-part', value: 'twopart' }
                )
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName('private')
                .setDescription('Only you see the joke')
                .setRequired(false)
        ),

    async execute(interaction) {
        const config = interaction.client.config;
        const jokeConfig = config.commands.joke;

        const category = interaction.options.getString('category') || 'Any';
        const type = interaction.options.getString('type') || 'any';
        const isPrivate = interaction.options.getBoolean('private') || false;

        const endpoint = `https://v2.jokeapi.dev/joke/${encodeURIComponent(category)}`;

        const fetchJoke = async () => {
            const params = {
                blacklistFlags: 'nsfw,religious,political,racist,sexist,explicit',
            };
            if (type !== 'any') params.type = type;
            const res = await axios.get(endpoint, { params });
            return res.data;
        };

        const buildSingle = (data, rerolls) => new EmbedBuilder()
            .setColor(jokeConfig.color)
            .setTitle(jokeConfig.messages.title)
            .setDescription(data.joke)
            .setTimestamp()
            .setFooter({ text: `${interaction.user.tag}${rerolls ? ` • Rerolls: ${rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL() });

        const buildSetup = (data, rerolls) => new EmbedBuilder()
            .setColor(jokeConfig.color)
            .setTitle(jokeConfig.messages.title)
            .setDescription(`Setup: ${data.setup}`)
            .setTimestamp()
            .setFooter({ text: `${interaction.user.tag}${rerolls ? ` • Rerolls: ${rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL() });

        const buildReveal = (data, rerolls) => new EmbedBuilder()
            .setColor(jokeConfig.color)
            .setTitle(jokeConfig.messages.title)
            .setDescription(`Setup: ${data.setup}\n\nPunchline: **${data.delivery}**`)
            .setTimestamp()
            .setFooter({ text: `${interaction.user.tag}${rerolls ? ` • Rerolls: ${rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL() });

        try {
            await interaction.deferReply({ ephemeral: isPrivate });

            const loading = new EmbedBuilder()
                .setColor(jokeConfig.color)
                .setTitle(jokeConfig.messages.title)
                .setDescription('Fetching a fresh joke...')
                .setTimestamp();
            await interaction.editReply({ embeds: [loading], components: [] });

            const render = async (rerolls = 0) => {
                const data = await fetchJoke();

                if (data.error) {
                    console.error(`Error from joke API: ${data.message}`);
                    await interaction.editReply({ content: jokeConfig.messages.api_error, embeds: [], components: [] });
                    return;
                }

                let embed;
                let row;
                if (data.type === 'single') {
                    embed = buildSingle(data, rerolls);
                    row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('joke_again').setLabel('Another').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(rerolls >= 3),
                        new ButtonBuilder().setCustomId('joke_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                    );
                } else if (data.type === 'twopart') {
                    embed = buildSetup(data, rerolls);
                    row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('joke_reveal').setLabel('Reveal').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
                        new ButtonBuilder().setCustomId('joke_again').setLabel('Another').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(rerolls >= 3),
                        new ButtonBuilder().setCustomId('joke_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                    );
                } else {
                    await interaction.editReply({ content: jokeConfig.messages.decode_error, embeds: [], components: [] });
                    return;
                }

                await interaction.editReply({ embeds: [embed], components: [row] });

                const msg = await interaction.fetchReply();
                const collector = msg.createMessageComponentCollector({ time: 30000 });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        await i.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
                        return;
                    }

                    if (i.customId === 'joke_close') {
                        collector.stop('closed');
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await i.update({ components: [disabled] });
                        return;
                    }

                    if (i.customId === 'joke_reveal' && data.type === 'twopart') {
                        const revealed = buildReveal(data, rerolls);
                        const updatedRow = new ActionRowBuilder().addComponents(
                            row.components.map(c => {
                                const btn = ButtonBuilder.from(c);
                                if (btn.data.custom_id === 'joke_reveal') btn.setDisabled(true);
                                return btn;
                            })
                        );
                        await i.update({ embeds: [revealed], components: [updatedRow] });
                        return;
                    }

                    if (i.customId === 'joke_again') {
                        collector.stop('reroll');
                        await i.deferUpdate();
                        const waiting = new EmbedBuilder()
                            .setColor(jokeConfig.color)
                            .setTitle(jokeConfig.messages.title)
                            .setDescription('Finding another one...')
                            .setTimestamp();
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await interaction.editReply({ embeds: [waiting], components: [disabled] });
                        setTimeout(() => render(rerolls + 1), 600);
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

        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                console.error(`Axios API request error: ${error.response.status} ${error.response.statusText}`, error.response.data);
                const alreadyReplied = interaction.replied || interaction.deferred;
                const payload = { content: jokeConfig.messages.fetch_error, ephemeral: true };
                alreadyReplied ? await interaction.editReply(payload) : await interaction.reply(payload);
            } else {
                console.error('An unexpected error occurred while executing the /joke command:', error);
                const alreadyReplied = interaction.replied || interaction.deferred;
                const payload = { content: jokeConfig.messages.unexpected_error, ephemeral: true };
                alreadyReplied ? await interaction.editReply(payload) : await interaction.reply(payload);
            }
        }
    },
};

