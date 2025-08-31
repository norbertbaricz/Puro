const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Shows detailed information about this server.')
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately (only you can see)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const config = interaction.client.config;
        const serverinfoConfig = config.commands.serverinfo;

        if (!interaction.guild) {
            return interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
        }

        const { guild } = interaction;
        const isPrivate = interaction.options.getBoolean('private') || false;

        await interaction.deferReply({ ephemeral: isPrivate });
        const owner = await guild.fetchOwner();
        const channels = guild.channels.cache;
        const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
        const announcementChannels = channels.filter(c => c.type === ChannelType.GuildAnnouncement).size;
        const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
        const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum).size;
        const boostLevel = ['None', 'Tier 1', 'Tier 2', 'Tier 3'][guild.premiumTier] || 'None';

        const iconUrl = guild.iconURL({ dynamic: true, size: 1024 });
        const bannerUrl = guild.bannerURL({ size: 1024 });

        // Count open invites
        let inviteCount = 'NaN';
        try {
            const invites = await guild.invites.fetch();
            inviteCount = invites.size.toString();
        } catch (e) {
            inviteCount = 'NaN';
        }

        // Member stats
        const members = await guild.members.fetch();
        const total = members.size;
        const bots = members.filter(m => m.user.bot).size;
        const humans = total - bots;
        const online = members.filter(m => m.presence?.status === 'online').size;
        const idle = members.filter(m => m.presence?.status === 'idle').size;
        const dnd = members.filter(m => m.presence?.status === 'dnd').size;

        // Misc stats
        const emojisCount = guild.emojis?.cache?.size ?? 0;
        const stickersCount = guild.stickers?.cache?.size ?? 0;
        const verification = guild.verificationLevel || 'Unknown';
        const features = (guild.features || []).length ? guild.features.join(', ') : 'None';
        const afkChannel = guild.afkChannel ? `${guild.afkChannel} (${guild.afkTimeout / 60}m)` : 'None';

        // Boost progress bar (max Tier 3 at 14 boosts)
        const boosts = guild.premiumSubscriptionCount || 0;
        const bar = (value, max) => {
            const blocks = 14;
            const filled = Math.min(blocks, Math.round((value / max) * blocks));
            return '▰'.repeat(filled) + '▱'.repeat(blocks - filled);
        };

        const embed = new EmbedBuilder()
            .setColor(serverinfoConfig.color)
            .setTitle(serverinfoConfig.messages.title.replace('{servername}', guild.name))
            .setThumbnail(iconUrl)
            .setImage(bannerUrl || iconUrl)
            .setDescription(serverinfoConfig.messages.description)
            .addFields(
                { name: serverinfoConfig.messages.fields.server_id, value: guild.id, inline: true },
                { name: serverinfoConfig.messages.fields.owner, value: `${owner.user.tag}`, inline: true },
                { name: serverinfoConfig.messages.fields.created, value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: serverinfoConfig.messages.fields.members, value: `${total} (👤 ${humans} | 🤖 ${bots})`, inline: true },
                { name: serverinfoConfig.messages.fields.text_channels, value: `${textChannels}`, inline: true },
                { name: serverinfoConfig.messages.fields.voice_channels, value: `${voiceChannels}`, inline: true },
                { name: 'Announcements', value: `${announcementChannels}`, inline: true },
                { name: 'Categories', value: `${categories}`, inline: true },
                { name: 'Forums', value: `${forumChannels}`, inline: true },
                { name: serverinfoConfig.messages.fields.roles, value: `${guild.roles.cache.size}`, inline: true },
                { name: 'Verification', value: `${verification}`, inline: true },
                { name: 'AFK', value: `${afkChannel}`, inline: true },
                { name: 'Emojis', value: `${emojisCount}`, inline: true },
                { name: 'Stickers', value: `${stickersCount}`, inline: true },
                { name: serverinfoConfig.messages.fields.boost_level, value: `${boostLevel}`, inline: true },
                { name: serverinfoConfig.messages.fields.boosts, value: `${boosts}\n${bar(boosts, 14)}`, inline: true },
                { name: (serverinfoConfig.messages.fields.invites || 'Open Invites'), value: inviteCount, inline: true },
                { name: 'Presence', value: `🟢 ${online} • 🌙 ${idle} • ⛔ ${dnd}`, inline: true }
            )
            .setFooter({ text: serverinfoConfig.messages.footer.replace('{user}', interaction.user.tag), iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        const rolesButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('srv_roles').setLabel('Show roles').setStyle(ButtonStyle.Secondary).setEmoji('📜')
        );

        await interaction.editReply({ embeds: [embed], components: [rolesButton] });

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the command invoker can use this button.', ephemeral: true });
                return;
            }
            if (i.customId === 'srv_roles') {
                const roles = guild.roles.cache
                    .filter(r => r.name !== '@everyone')
                    .sort((a, b) => b.position - a.position)
                    .first(25)
                    .map(r => `${r} (${r.members.size})`)
                    .join('\n') || 'No roles';
                await i.reply({ content: roles, ephemeral: true });
            }
        });

        collector.on('end', async () => {
            const disabled = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(rolesButton.components[0]).setDisabled(true)
            );
            await interaction.editReply({ components: [disabled] }).catch(() => {});
        });
    }
};
