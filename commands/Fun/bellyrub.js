const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { pickRandom, formatTemplate } = require('../../lib/utils');

const MAX_GIF_BYTES = 8 * 1024 * 1024;

function isImageBuffer(buffer) {
    if (!buffer || buffer.length < 12) return false;
    const header = buffer.subarray(0, 12).toString('hex');
    // GIF87a/GIF89a
    if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a') return true;
    if (buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return true;
    // PNG
    if (header.startsWith('89504e470d0a1a0a')) return true;
    // WEBP (RIFF....WEBP)
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return true;
    // JPEG
    if (buffer.subarray(0, 2).toString('hex') === 'ffd8') return true;
    return false;
}

async function fetchGifAttachment(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8000,
            maxContentLength: MAX_GIF_BYTES,
            maxBodyLength: MAX_GIF_BYTES,
            validateStatus: status => status >= 200 && status < 300,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        const buffer = Buffer.from(response.data);
        if (!buffer.length || buffer.length > MAX_GIF_BYTES) return null;
        if (!isImageBuffer(buffer)) return null;

        return new AttachmentBuilder(buffer, { name: 'bellyrub.gif' });
    } catch {
        return null;
    }
}

async function buildEmbedWithGif({
    title,
    description,
    color,
    gifUrl,
    thumbnailUrl,
    footerText,
    footerIcon,
    note,
    noteLabel
}) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: footerText, iconURL: footerIcon })
        .setTimestamp();

    if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
    }

    if (note) {
        embed.addFields({ name: noteLabel || 'Note', value: `> ${note}` });
    }

    let files = [];
    if (gifUrl) {
        const attachment = await fetchGifAttachment(gifUrl);
        if (attachment) {
            embed.setImage('attachment://bellyrub.gif');
            files = [attachment];
        } else {
            embed.setImage(gifUrl);
        }
    }

    return { embed, files };
}

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('bellyrub')
        .setDescription('Offer a cozy belly rub to another member.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to belly rub')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Add a small note (optional)')
                .setMaxLength(200)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Only you will see the response')
                .setRequired(false)
        ),

    async execute(interaction) {
        const sender = interaction.user;
        const target = interaction.options.getUser('member');
        const note = (interaction.options.getString('note') || '').trim();
        const isPrivate = interaction.options.getBoolean('private') || false;

        const cfg = interaction.client.config || {};
        const colors = cfg.colors || {};
        const bellyCfg = (cfg.commands && cfg.commands.bellyrub) || {};
        const messages = bellyCfg.messages || {};

        const gifPool = Array.isArray(bellyCfg.gifs) && bellyCfg.gifs.length ? bellyCfg.gifs : [
            'https://media1.tenor.com/m/pb7eyPp7eb0AAAAC/mofumofu-nyaro-kemono.gif',
            'https://media1.tenor.com/m/4BItFn9rfZoAAAAC/belly-rub-sergal.gif',
            'https://media1.tenor.com/m/fdD8vLpUaYYAAAAC/furry-meme.gif',
            'https://media1.tenor.com/m/n0EA_aBbOOIAAAAC/hyaku-cute.gif',
            'https://media1.tenor.com/m/0I_X54t4myEAAAAC/belly-rub.gif',
            'https://media1.tenor.com/m/3-jhhOv5P8EAAAAd/arcanine-pokemon.gif'
        ];

        const color = bellyCfg.color || colors.default || '#ff9ff3';
        const selfMessage = messages.self_bellyrub || "You can't belly rub yourself! 🐾";
        const botMessage = messages.bot_bellyrub || "Bots aren't squishy enough for belly rubs. 🤖";

        if (sender.id === target.id) {
            return interaction.reply({ content: selfMessage, flags: MessageFlags.Ephemeral });
        }
        if (target.bot) {
            return interaction.reply({ content: botMessage, flags: MessageFlags.Ephemeral });
        }

        try {
            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });
        } catch (err) {
            if ((err?.code ?? err?.rawError?.code) === 10062) return;
            throw err;
        }

        const selectedGif = pickRandom(gifPool) || null;
        const descriptionTemplate = messages.success_desc || '{sender} gives {receiver} a gentle belly rub!';
        const description = formatTemplate(descriptionTemplate, {
            sender: `**${sender.username}**`,
            receiver: `**${target.username}**`
        });

        const { embed, files } = await buildEmbedWithGif({
            title: messages.success_title || '🫶 Belly Rub!',
            description,
            color,
            gifUrl: selectedGif,
            thumbnailUrl: target.displayAvatarURL({ dynamic: true }),
            footerText: `Requested by ${sender.tag}`,
            footerIcon: sender.displayAvatarURL({ dynamic: true }),
            note,
            noteLabel: messages.note_label || 'Note'
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bellyrub_return').setLabel(messages.return_button || 'Belly rub back').setStyle(ButtonStyle.Secondary).setEmoji('🫶'),
            new ButtonBuilder().setCustomId('bellyrub_close').setLabel(messages.close_button || 'Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.editReply({ embeds: [embed], files, components: [row] });

        let dmNoticeSent = false;
        const notifyDmFailure = async () => {
            if (dmNoticeSent) {
                return;
            }
            dmNoticeSent = true;
            const dmFailedMessage = messages.dm_failed || 'I could not send them a DM. They might have DMs disabled.';
            await interaction.followUp({ content: dmFailedMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
        };

        if (!target.bot) {
            const guildName = interaction.guild?.name || 'Direct Message';
            const channel = interaction.channel;
            const channelLabel = interaction.guild && channel && typeof channel.name === 'string'
                ? `#${channel.name}`
                : interaction.guild
                    ? 'this channel'
                    : 'this conversation';
            const channelMention = interaction.guild ? `<#${interaction.channelId}>` : channelLabel;

            const dmTemplate = messages.dm || '{sender} gave you a belly rub from {guild} in {channelMention}!';
            const dmContent = formatTemplate(dmTemplate, {
                sender: sender.tag,
                receiver: target.tag,
                guild: guildName,
                channel: channelLabel,
                channelMention
            });

            const contextFooter = [sender.tag];
            if (interaction.guild) {
                contextFooter.push(guildName, channelLabel);
            } else {
                contextFooter.push('Direct Message');
            }

            const { embed: dmEmbed, files: dmFiles } = await buildEmbedWithGif({
                title: messages.success_title || '🫶 Belly Rub!',
                description,
                color,
                gifUrl: selectedGif,
                thumbnailUrl: target.displayAvatarURL({ dynamic: true }),
                footerText: contextFooter.join(' • '),
                footerIcon: sender.displayAvatarURL({ dynamic: true }),
                note,
                noteLabel: messages.note_label || 'Note'
            });

            try {
                await target.send({ content: dmContent, embeds: [dmEmbed], files: dmFiles });
            } catch (error) {
                if (!bellyCfg.silent_dm_failures) {
                    const logger = interaction.client.logger?.warn ? interaction.client.logger : console;
                    (logger.warn || console.warn).call(logger, 'Unable to DM bellyrub target:', error?.message || error);
                }
                await notifyDmFailure();
            }
        }

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            try {
                if (i.customId === 'bellyrub_close') {
                    if (i.user.id !== sender.id && i.user.id !== target.id) {
                        await i.reply({ content: messages.close_denied || 'Only the sender or receiver can close this.', flags: MessageFlags.Ephemeral });
                        return;
                    }
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }

                if (i.customId === 'bellyrub_return') {
                    if (i.user.id !== target.id) {
                        await i.reply({ content: messages.return_denied || 'Only the mentioned member can return the belly rub.', flags: MessageFlags.Ephemeral });
                        return;
                    }
                    collector.stop('returned');
                    const newGif = pickRandom(gifPool) || selectedGif;
                    const returnTemplate = messages.return_desc || '**{receiver}** returns a cozy belly rub to **{sender}**!';
                    const returnDescription = formatTemplate(returnTemplate, {
                        sender: `**${sender.username}**`,
                        receiver: `**${target.username}**`
                    });

                    const { embed: returnedEmbed, files: returnedFiles } = await buildEmbedWithGif({
                        title: messages.return_title || '🫶 Belly Rub Returned!',
                        description: returnDescription,
                        color,
                        gifUrl: newGif,
                        footerText: `Started by ${sender.tag}`,
                        footerIcon: sender.displayAvatarURL({ dynamic: true })
                    });

                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ embeds: [returnedEmbed], files: returnedFiles, components: [disabled] });
                }
            } catch (error) {
                if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
                    console.warn('Skipped error reply for expired interaction (bellyrub).');
                } else {
                    console.error('Interaction handler error:', error);
                }
            }
        });

        collector.on('end', async (_c, reason) => {
            if (reason === 'time') {
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await interaction.editReply({ components: [disabled] }).catch(() => {});
            }
        });
    }
};
