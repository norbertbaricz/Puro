const { SlashCommandBuilder } = require('discord.js');
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('speak')
        .setDescription('Makes the bot speak text in your voice channel, translated to English.')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text you want the bot to say (will be translated to English).')
                .setRequired(true)),

    async execute(interaction) {
        // const logPrefix = `[SpeakCmd][${interaction.id}]`; // logPrefix nu mai este necesar
        const originalText = interaction.options.getString('text');
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'You must be in a voice channel to use this command!', ephemeral: true });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has("CONNECT")) {
            return interaction.reply({ content: 'I do not have permission to connect to this voice channel!', ephemeral: true });
        }
        if (!permissions.has("SPEAK")) {
            return interaction.reply({ content: 'I do not have permission to speak in this voice channel!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        let translatedText;
        try {
            const res = await translate(originalText, { to: 'en', autoCorrect: true });
            translatedText = res.text;
            if (!translatedText || translatedText.trim() === "") {
                await interaction.editReply({ content: 'Translation resulted in empty text. Cannot speak nothing!' });
                return;
            }
        } catch (error) {
            let errorMessage = 'An error occurred during translation.';
            if (error.message && error.message.includes('TooManyRequests') || error.name === 'TooManyRequestsError') {
                errorMessage = 'Translation service is busy or limit reached. Please try again later.';
            }
            return interaction.editReply({ content: errorMessage });
        }

        const audioDir = path.join(__dirname, 'temp_audio');
        if (!fs.existsSync(audioDir)) {
            try {
                fs.mkdirSync(audioDir);
            } catch (mkdirError) {
                return interaction.editReply({ content: 'Error setting up audio storage. Cannot proceed.' });
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
            } else if (fs.existsSync(audioFileName)) {
                try {
                    await unlinkAsync(audioFileName);
                } catch (unlinkErr) {
                    // Eroare la ștergerea fișierului, dar nu facem logging în consolă
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
                await interaction.editReply({ content: 'Failed to create or access the audio file for speaking.' });
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
                await interaction.editReply({ content: 'Could not establish voice connection in time. Please try again.' });
                await cleanup();
                return;
            }

            const resource = createAudioResource(audioFileName);
            player.play(resource);
            connection.subscribe(player);

            await interaction.editReply({ content: `Now speaking: "${translatedText}"` });

            player.on(AudioPlayerStatus.Playing, () => {
                // Acțiune la începerea redării (dacă e necesar, dar fără logging)
            });

            player.on(AudioPlayerStatus.Idle, async () => {
                await cleanup();
            });

            player.on('error', async (error) => {
                try {
                    await interaction.editReply({ content: 'An error occurred during audio playback.' });
                } catch (editError) {
                    // Ignorăm eroarea de la editReply în consolă
                }
                await cleanup();
            });

        } catch (error) {
            try {
                await interaction.editReply({ content: 'A critical error occurred. Could not play audio.' });
            } catch (editError) {
                // Ignorăm eroarea de la editReply în consolă
            }
            await cleanup();
        }
    },
};