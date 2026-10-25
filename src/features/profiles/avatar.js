const { accentColor } = require('../../core/ui/theme');
const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    escapeMarkdown,
} = require('discord.js');

const AVATAR_SIZE = 1024;

async function showAvatar(interaction, user, privateResponse = true) {
    const url = user.displayAvatarURL({ size: AVATAR_SIZE });
    const panel = new ContainerBuilder()
        .setAccentColor(accentColor(interaction.client))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${escapeMarkdown(user.username)}\n[Open full avatar](${url})`),
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(url).setDescription(`${user.username}'s avatar`),
            ),
        );
    await interaction.reply({
        components: [panel],
        flags: MessageFlags.IsComponentsV2 | (privateResponse ? MessageFlags.Ephemeral : 0),
    });
}

module.exports = { showAvatar };
