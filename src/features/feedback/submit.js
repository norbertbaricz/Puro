const { accentColor } = require('../../core/ui/theme');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const VALID_KINDS = new Set(['bug', 'idea', 'other']);

async function submitFeedback(interaction) {
    const config = interaction.client.config.features.feedback;
    if (!config.enabled || !config.channel_id)
        return interaction.editReply({
            content: 'Feedback is not configured. The owner must set features.feedback.channel_id.',
        });
    const subject = interaction.fields.getTextInputValue('subject').trim();
    const message = interaction.fields.getTextInputValue('message').trim();
    const kind = interaction.fields.getRadioGroup('kind', true);
    const contact = interaction.fields.getCheckbox('contact');
    if (!subject || !message || !VALID_KINDS.has(kind))
        return interaction.editReply({ content: 'Please provide a subject, details, and a valid feedback type.' });
    const uploads = [...(interaction.fields.getUploadedFiles('attachment')?.values() || [])];
    const maxBytes = config.max_file_bytes || DEFAULT_MAX_FILE_BYTES;
    if (uploads.some((file) => file.size > maxBytes))
        return interaction.editReply({
            content: `The attachment must be smaller than ${Math.floor(maxBytes / 1024 / 1024)} MiB.`,
        });
    const channel = await interaction.client.channels.fetch(config.channel_id);
    const permissions = channel?.permissionsFor?.(interaction.client.user);
    const required = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
    ];
    if (uploads.length) required.push(PermissionFlagsBits.AttachFiles);
    if (!channel?.isSendable?.() || !permissions?.has(required))
        return interaction.editReply({
            content: 'I cannot send feedback to the configured channel. Ask the owner to check my permissions.',
        });
    const embed = new EmbedBuilder()
        .setColor(accentColor(interaction.client))
        .setTitle(subject.slice(0, 100))
        .setDescription(message.slice(0, 1000))
        .addFields(
            { name: 'Type', value: kind, inline: true },
            { name: 'Contact allowed', value: contact ? 'Yes' : 'No', inline: true },
            { name: 'Submitted by', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: 'Server', value: interaction.guild?.name || interaction.guildId || 'Direct message' },
        )
        .setTimestamp();
    const sent = await channel.send(
        interaction.client.ui.message({
            embeds: [embed],
            files: uploads.map((file) => ({ attachment: file.url, name: file.name })),
            allowedMentions: { parse: [] },
        }),
    );
    await interaction.editReply({ content: `Feedback delivered. Reference: ${sent.id}.` });
}

module.exports = { submitFeedback };
