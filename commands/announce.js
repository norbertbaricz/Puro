const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const ratelimit = require('../ratelimit');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Announce a message to a specific channel!')
        .addChannelOption(option =>
            option.setName('channel').setDescription('The channel to send to').setRequired(true))
        .addStringOption(option =>
            option.setName('message').setDescription('The message to send').setRequired(true))
        .addBooleanOption(option =>
            option.setName('publish').setDescription('Publish in announcement channel').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const config = interaction.client.config.commands.announce;
        try {
            // Fixed line: Use interaction.memberPermissions
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: config.messages.no_permission, ephemeral: true });
            }

            const remaining = ratelimit(interaction.user.id, 10000);
            if (remaining) {
                return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
            }

            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const publish = interaction.options.getBoolean('publish') ?? false;

            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
                return interaction.reply({ content: config.messages.invalid_channel, ephemeral: true });
            }

            const botMember = interaction.guild.members.me;
            if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
                return interaction.reply({ content: config.messages.no_bot_permission.replace('{channel}', channel), ephemeral: true });
            }

            if (message.length > interaction.client.config.limits.message) {
                return interaction.reply({
                    content: config.messages.too_long.replace('{maxLength}', interaction.client.config.limits.message),
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            await channel.send({
                content: message,
                allowedMentions: { parse: ['users', 'roles'] },
                flags: publish && channel.type === ChannelType.GuildAnnouncement ? MessageFlags.CrossPost : null
            });

            await interaction.editReply({ content: config.messages.success.replace('{channel}', channel), ephemeral: true });
        } catch (error) {
            console.error('Announce error:', error);
            const replyMethod = interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply;
            await replyMethod.call(interaction, { content: config.messages.error, ephemeral: true });
        }
    },
};