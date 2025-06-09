const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const gTTS = require('gtts');
const { translate } = require('@vitalets/google-translate-api');
const fs = require('fs');
const path = require('path');
const util = require('util');

const statAsync = util.promisify(fs.stat);
const unlinkAsync = util.promisify(fs.unlink);

// IMPORTANT: This 'config' variable needs to be loaded from your config.yml.
// How you access it depends on your bot's structure.
// If your main bot file passes config to commands, you might access it via interaction.client.config
// For demonstration, let's assume it's loaded like this:
// const config = require('../../config.js'); // Or however your config is loaded
// For this example, I'll access it via `interaction.client.config`
// Make sure your main bot file sets `client.config = config;` after loading config.yml

module.exports = {
    data: new SlashCommandBuilder()
        .setName('speak')
        .setDescription('Makes the bot speak text in your voice channel, translated to English.')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text you want the bot to say (will be translated to English).')
                .setRequired(true)),

    async execute(interaction) {
        const config = interaction.client.config; // Access config from the client object
        const messages = config.commands.speak.messages; // Shorthand for speak messages

        const originalText = interaction.options.getString('text');
        const member = interaction.member;

        if (!member || !member.voice) {
            return interaction.reply({ content: messages.not_in_server, flags: [MessageFlags.Ephemeral] });
        }

        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: messages.no_voice_channel, flags: [MessageFlags.Ephemeral] });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has("CONNECT")) {
            return interaction.reply({ content: messages.no_connect_permission, flags: [MessageFlags.Ephemeral] });
        }
        if (!permissions.has("SPEAK")) {
            return interaction.reply({ content: messages.no_speak_permission, flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        let translatedText;
        try {
            const res = await translate(originalText, { to: 'en', autoCorrect: true });
            translatedText = res.text;
            if (!translatedText || translatedText.trim() === "") {
                await interaction.editReply({ content: messages.empty_translation });
                return;
            }
        } catch (error) {
            let errorMessage = messages.translation_error;
            if (error.message && error.message.includes('TooManyRequests') || error.name === 'TooManyRequestsError') {
                errorMessage = messages.translation_too_many_requests;
            }
            return interaction.editReply({ content: errorMessage });
        }

        const audioDir = path.join(__dirname, 'temp_audio');
        if (!fs.existsSync(audioDir)) {
            try {
                fs.mkdirSync(audioDir);
            } catch (mkdirError) {
                await interaction.editReply({ content: messages.audio_storage_error });
                return; // Added return here to stop execution if mkdir fails
            }
        }
        const audioFileName = path.join(audioDir, `audio_${interaction.id}.mp3`);

        let connection;
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Stop,
            },
        });

        const cleanup = async () => {
            if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
            if (fs.existsSync(audioFileName)) {
                try {
                    await unlinkAsync(audioFileName);
                } catch (unlinkErr) {
                    // Ignore error on file deletion
                }
            }
        };

        try {
            const gttsInstance = new gTTS(translatedText, 'en');
            await new Promise((resolve, reject) => {
                gttsInstance.save(audioFileName, (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });

            try {
                const fileStats = await statAsync(audioFileName);
                if (fileStats.size === 0) throw new Error('Audio file is empty.');
            } catch (fileError) {
                await interaction.editReply({ content: messages.empty_audio_file });
                await cleanup();
                return;
            }

            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                         await cleanup();
                    }
                }
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                if (fs.existsSync(audioFileName)) {
                     unlinkAsync(audioFileName).catch(e => { /* Ignorăm eroarea de la unlink în consolă */ });
                }
            });

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            } catch (error) {
                await interaction.editReply({ content: messages.connection_timeout });
                await cleanup();
                return;
            }

            const resource = createAudioResource(audioFileName);
            player.play(resource);
            connection.subscribe(player);

            await interaction.editReply({ content: messages.speaking_now.replace('{translatedText}', translatedText) });

            player.on(AudioPlayerStatus.Playing, () => {});

            player.on(AudioPlayerStatus.Idle, async () => {
                await cleanup();
            });

            player.on('error', async (error) => {
                try {
                    await interaction.editReply({ content: messages.playback_error });
                } catch (editError) {
                    // Ignore error on editReply
                }
                await cleanup();
            });

        } catch (error) {
            try {
                await interaction.editReply({ content: messages.critical_error });
            } catch (editError) {
                // Ignore error on editReply
            }
            await cleanup();
        }
    },
};