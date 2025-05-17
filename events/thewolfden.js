const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const targetChannelId = '1321584720068350033'; // ID-ul canalului vocal
        const audioFilePath = './audio/hello-trailer_01.mp3'; // Calea către fișierul audio

        // Verificăm dacă fișierul audio există
        if (!fs.existsSync(audioFilePath)) {
            console.error(`Fișierul audio "${audioFilePath}" nu a fost găsit.`);
            return;
        }

        // Când un membru intră pe canalul vocal specificat
        if (newState.channelId === targetChannelId && oldState.channelId !== targetChannelId) {
            const voiceChannel = newState.channel;

            try {
                // Conectăm botul la canalul vocal
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });

                // Creăm un player audio
                const player = createAudioPlayer();

                // Creăm un resource audio din fișierul local
                const resource = createAudioResource(audioFilePath);

                // Conectăm player-ul la conexiunea vocală
                connection.subscribe(player);

                // Începem redarea fișierului audio
                player.play(resource);
            } catch (error) {
                console.error('A apărut o eroare la conectarea botului sau redarea audio:', error);
            }
        }

        // Când canalul vocal devine gol
        if (oldState.channelId === targetChannelId && newState.channelId !== targetChannelId) {
            const voiceChannel = oldState.channel;

            if (voiceChannel.members.size === 0) {
                const connection = getVoiceConnection(voiceChannel.guild.id);
                if (connection) {
                    connection.destroy(); // Deconectăm botul de pe canal
                    console.log('Botul a ieșit de pe canal deoarece nu mai este nimeni.');
                }
            }
        }
    },
};