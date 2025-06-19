const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member for a specified duration.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to timeout')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration (e.g., 10m, 1h, 1d)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const remaining = ratelimit(interaction.user.id, 5000);
        if (remaining) {
            return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
        }

        // Obține configurația din client. Se presupune că a fost încărcată la pornire.
        const config = interaction.client.config;
        const timeoutConfig = config.commands.timeout;

        // Verificare dacă secțiunea de config există
        if (!timeoutConfig) {
            console.error("Eroare: Configurația pentru comanda 'timeout' nu a fost găsită.");
            return interaction.reply({ content: '❌ A configuration error occurred. Please contact the bot administrator.', ephemeral: true });
        }

        const member = interaction.options.getMember('member');
        const durationStr = interaction.options.getString('duration');

        // Parsează durata (ex: 10m, 1h, 1d)
        const durationRegex = /^(\d+)([smhd])$/i;
        const match = durationStr.match(durationRegex);

        if (!match) {
            return interaction.reply({ content: timeoutConfig.messages.invalid_format, ephemeral: true });
        }

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        let durationMs = 0;

        switch (unit) {
            case 's': durationMs = value * 1000; break;
            case 'm': durationMs = value * 60 * 1000; break;
            case 'h': durationMs = value * 60 * 60 * 1000; break;
            case 'd': durationMs = value * 24 * 60 * 60 * 1000; break;
        }
        
        // Limita de 28 de zile impusă de Discord API
        const maxDurationMs = 28 * 24 * 60 * 60 * 1000;
        if (durationMs > maxDurationMs) {
            return interaction.reply({ content: timeoutConfig.messages.max_duration_exceeded, ephemeral: true });
        }

        if (member.id === interaction.user.id) {
             return interaction.reply({ content: "❌ You cannot time out yourself.", ephemeral: true });
        }

        if (member.id === interaction.client.user.id) {
            return interaction.reply({ content: "❌ I cannot time myself out.", ephemeral: true });
        }
        
        // Verifică dacă membrul poate fi moderat (permisiuni și ierarhia rolurilor)
        if (!member.moderatable) {
            return interaction.reply({ content: timeoutConfig.messages.not_moderatable, ephemeral: true });
        }

        try {
            await member.timeout(durationMs, `Timed out by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setTitle(timeoutConfig.messages.success_title)
                .setDescription(timeoutConfig.messages.success_desc
                    .replace('{user}', member.user.tag)
                    .replace('{duration}', durationStr))
                .setColor(timeoutConfig.color || '#ffcc00')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            // === MODIFICAREA ESTE AICI ===
            // Răspunsul va fi acum vizibil doar pentru utilizatorul care a rulat comanda.
            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Failed to timeout member:', error);
            await interaction.reply({ content: timeoutConfig.messages.error, ephemeral: true });
        }
    },
};