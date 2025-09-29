const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Info',
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Shows detailed information about a user.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to get information about')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately (only you can see)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const config = interaction.client.config;
        const userinfoConfig = config.commands.userinfo;

        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        }

        // Always resolve the target user first
        const targetUser = interaction.options.getUser('member', true);
        const isPrivate = interaction.options.getBoolean('private') || false;

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        // Try to get a full GuildMember; fall back to fetching if uncached
        let member = interaction.options.getMember('member');
        if (!member) {
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (e) {
                member = null;
            }
        }

        // Safely compute roles (only if we have a GuildMember)
        const roles = member && member.roles && member.roles.cache
            ? member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .map(role => role.toString())
                .join(', ') || userinfoConfig.messages.none
            : userinfoConfig.messages.none;

        const avatarUrl = (member ? member.user : targetUser).displayAvatarURL({ dynamic: true, size: 4096 });
        // Try to fetch banner
        let bannerUrl = null;
        try {
            const fetched = await interaction.client.users.fetch(targetUser.id, { force: true });
            bannerUrl = fetched.bannerURL({ size: 1024 });
        } catch {}

        // Calculate account age in milliseconds
        const accountCreatedTimestamp = (member ? member.user : targetUser).createdTimestamp;
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000); // 12 months in milliseconds

        let securityStatus;
        if (accountCreatedTimestamp < oneYearAgo) {
            securityStatus = '✅ Account older than 12 months';
        } else {
            securityStatus = '⚠️ Account younger than 12 months';
        }

        // Try to find who invited the user
        let inviterTag = 'NaN';
        try {
            // Fetch all invites for the guild
            const invites = await interaction.guild.invites.fetch();
            // Try to find an invite used by this member (not always possible)
            const usedInvite = invites.find(inv => inv.uses > 0 && inv.inviter && member && inv.inviter.id !== member.id && inv.inviter.id !== interaction.guild.ownerId);
            if (usedInvite && usedInvite.inviter) {
                inviterTag = usedInvite.inviter.tag;
            }
        } catch (e) {
            inviterTag = 'NaN';
        }

        // Presence and timeout info
        const presence = member?.presence?.status ? member.presence.status : userinfoConfig.messages.none;
        const timeoutUntil = member?.communicationDisabledUntilTimestamp
            ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`
            : userinfoConfig.messages.none;
        const highestRole = member?.roles?.highest ? `${member.roles.highest} (${member.roles.highest.id})` : userinfoConfig.messages.none;
        const permissions = member?.permissions?.toArray?.() || [];
        const badges = (await interaction.client.users.fetch(targetUser.id, { force: true }).catch(() => null))?.flags?.toArray?.() || [];

        const embed = new EmbedBuilder()
            .setColor(userinfoConfig.color)
            .setTitle(userinfoConfig.messages.title.replace('{tag}', (member ? member.user : targetUser).tag))
            .setDescription(userinfoConfig.messages.description)
            .setThumbnail(avatarUrl)
            .setImage(bannerUrl || avatarUrl)
            .addFields(
                { name: userinfoConfig.messages.fields.user_id, value: (member ? member.id : targetUser.id), inline: true },
                { name: userinfoConfig.messages.fields.bot, value: ((member ? member.user : targetUser).bot ? userinfoConfig.messages.yes : userinfoConfig.messages.no), inline: true },
                { name: userinfoConfig.messages.fields.nickname, value: (member && member.nickname) ? member.nickname : userinfoConfig.messages.none, inline: true },
                { name: userinfoConfig.messages.fields.account_created, value: `<t:${Math.floor(((member ? member.user : targetUser).createdTimestamp) / 1000)}:F>`, inline: false },
                { name: userinfoConfig.messages.fields.joined_server, value: member && member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : userinfoConfig.messages.none, inline: false },
                { name: userinfoConfig.messages.fields.roles, value: roles, inline: false },
                { name: `🔒 ${userinfoConfig.messages.fields.security || 'Security'}`, value: securityStatus, inline: true },
                { name: 'Invited by', value: inviterTag, inline: true },
                { name: 'Presence', value: presence, inline: true },
                { name: 'Highest Role', value: highestRole, inline: true },
                { name: 'Timeout until', value: timeoutUntil, inline: true },
                { name: 'Badges', value: badges.length ? badges.join(', ') : userinfoConfig.messages.none, inline: false }
            )
            .setFooter({ text: userinfoConfig.messages.footer.replace('{user}', interaction.user.tag), iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ui_roles').setLabel('Show roles').setStyle(ButtonStyle.Secondary).setEmoji('📜'),
            new ButtonBuilder().setCustomId('ui_perms').setLabel('Show permissions').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('ui_avatar').setLabel('Avatar').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
            new ButtonBuilder().setCustomId('ui_banner').setLabel('Banner').setStyle(ButtonStyle.Secondary).setEmoji('🖼️').setDisabled(!bannerUrl)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'ui_roles') {
                const roleList = member?.roles?.cache
                    ?.filter(r => r.id !== interaction.guild.id)
                    ?.sort((a,b) => b.position - a.position)
                    ?.map(r => `${r}`)
                    ?.join('\n') || userinfoConfig.messages.none;
                await i.reply({ content: roleList.slice(0, 1900), flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'ui_perms') {
                const permList = permissions.length ? permissions.join(', ') : userinfoConfig.messages.none;
                await i.reply({ content: permList.slice(0, 1900), flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'ui_avatar') {
                await i.reply({ content: avatarUrl, flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'ui_banner') {
                if (bannerUrl) await i.reply({ content: bannerUrl, flags: MessageFlags.Ephemeral });
                else await i.reply({ content: 'No banner set.', flags: MessageFlags.Ephemeral });
                return;
            }
        });

        collector.on('end', async () => {
            const disabled = new ActionRowBuilder().addComponents(
                row.components.map(c => ButtonBuilder.from(c).setDisabled(true))
            );
            await interaction.editReply({ components: [disabled] }).catch(() => {});
        });
    }
};
