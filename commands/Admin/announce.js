const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Announce a message to a specific channel!')
        .addChannelOption(option =>
            option.setName('channel').setDescription('The channel to send to').setRequired(true))
        .addStringOption(option =>
            option.setName('message').setDescription('The message to send').setRequired(true))
        // opțiunea opțională trebuie să fie ultima!
        .addBooleanOption(option =>
            option.setName('publish').setDescription('Publish in announcement channel').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const config = interaction.client.config.commands.announce;
        try {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                const embed = new EmbedBuilder()
                    .setTitle('No Permission')
                    .setDescription(config.messages.no_permission)
                    .setColor(0xff0000);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const publish = interaction.options.getBoolean('publish') ?? false;

            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
                const embed = new EmbedBuilder()
                    .setTitle('Invalid Channel')
                    .setDescription(config.messages.invalid_channel)
                    .setColor(0xffa500);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            const botMember = interaction.guild.members.me;
            if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
                const embed = new EmbedBuilder()
                    .setTitle('Missing Permission')
                    .setDescription(config.messages.no_bot_permission.replace('{channel}', channel))
                    .setColor(0xff0000);
            }

            if (message.length > interaction.client.config.limits.message) {
                const embed = new EmbedBuilder()
                    .setTitle('Message Too Long')
                    .setDescription(config.messages.too_long.replace('{maxLength}', interaction.client.config.limits.message))
                    .setColor(0xffa500);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });

            await channel.send({
                content: message,
                allowedMentions: { parse: ['users', 'roles'] },
                flags: publish && channel.type === ChannelType.GuildAnnouncement ? MessageFlags.CrossPost : null
            });

            const embed = new EmbedBuilder()
                .setTitle('Announcement Sent')
                .setDescription(config.messages.success.replace('{channel}', channel))
                .setColor(0x00b300);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Announce error:', error);
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription(config.messages.error)
                .setColor(0xff0000);
            const replyMethod = interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply;
            await replyMethod.call(interaction, { embeds: [embed] });
        }
    },
};