const { ChannelType } = require('discord.js');
const {
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} = require('@discordjs/voice');
const { opus } = require('prism-media');
const fs = require('fs');
const path = require('path');

const TARGET_USER_ID = '486412940199591967';
const TARGET_GUILD_ID = '1217588804328620163';
const MAX_RECORDING_MS = 60 * 60 * 1000; // 1 hour cap
// Save under project root /recordings/wolf-den
const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings', 'wolf-den');
const POLL_INTERVAL_MS = 20_000;

let session = null;
let pollTimer = null;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isVoiceChannel(channel) {
  return channel && (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice);
}

function buildSessionDir() {
  ensureDir(RECORDINGS_DIR);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(RECORDINGS_DIR, stamp);
  ensureDir(dir);
  return dir;
}

async function bootstrapRecorder(client) {
  const guild = client.guilds.cache.get(TARGET_GUILD_ID) || await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
  if (!guild) return;
  const member = await guild.members.fetch(TARGET_USER_ID).catch(() => null);
  if (member?.voice?.channel) {
    await startRecording(member.voice.channel, client, 'bootstrap');
  }
  startPoll(client);
}

function startPoll(client) {
  if (pollTimer) return;
  pollTimer = setInterval(() => ensureActive(client), POLL_INTERVAL_MS);
}

async function ensureActive(client) {
  try {
    const guild = client.guilds.cache.get(TARGET_GUILD_ID) || await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
    if (!guild) return;
    const member = await guild.members.fetch(TARGET_USER_ID).catch(() => null);
    const channel = member?.voice?.channel;

    if (isVoiceChannel(channel)) {
      const destroyed = !session || !session.connection || session.connection.state.status === VoiceConnectionStatus.Destroyed;
      const wrongChannel = session && session.channelId && session.channelId !== channel.id;
      if (!session || destroyed || wrongChannel) {
        await startRecording(channel, client, destroyed ? 'reconnect' : 'ensure-active');
      }
    } else {
      await stopRecording('not-in-voice', client);
    }
  } catch (_) {
    // Swallow poll errors
  }
}

async function handleVoiceStateUpdate(oldState, newState, client) {
  const affected = oldState.id === TARGET_USER_ID || newState.id === TARGET_USER_ID;
  if (!affected) return;
  const guild = newState.guild || oldState.guild;
  if (!guild || guild.id !== TARGET_GUILD_ID) return;

  const channel = newState.channel;
  if (isVoiceChannel(channel)) {
    await startRecording(channel, client, 'voice-state');
  } else {
    await stopRecording('left-channel', client);
  }
}

async function handleRecorderDm(message, client) {
  if (message.author?.id !== TARGET_USER_ID) return;
  if (!message.inGuild && typeof message.content === 'string' && message.content.trim().toLowerCase() === '/start') {
    const guild = client.guilds.cache.get(TARGET_GUILD_ID) || await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(TARGET_USER_ID).catch(() => null) : null;
    const channel = member?.voice?.channel;
    if (!isVoiceChannel(channel)) {
      await message.channel.send('Nu ești într-un voice/stage. Intră într-un canal și apoi trimite din nou /start.').catch(() => {});
      return;
    }
    await startRecording(channel, client, 'dm-start');
    await message.channel.send('Am intrat pe voice și am pornit înregistrarea.').catch(() => {});
  }
}

async function startRecording(channel, client, reason) {
  if (!isVoiceChannel(channel)) return;
  if (channel.guild.id !== TARGET_GUILD_ID) return;

  if (session && session.channelId === channel.id && session.connection && session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
    return;
  }

  await stopRecording('switch-channel', client);

  const dir = buildSessionDir();
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (err) {
    connection.destroy();
    return;
  }

  session = {
    connection,
    guildId: channel.guild.id,
    channelId: channel.id,
    dir,
    startedAt: Date.now(),
    timeout: setTimeout(() => stopRecording('max-duration', client), MAX_RECORDING_MS),
    subscriptions: new Set(),
    reason,
  };

  const receiver = connection.receiver;
  receiver.speaking.on('start', (userId) => beginUserStream(userId, receiver, dir));

  connection.on('stateChange', (_, newState) => {
    if (newState.status === VoiceConnectionStatus.Disconnected) {
      // Try a quick reconnection; if it fails, stop.
      Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]).catch(() => stopRecording('connection-lost', client));
    } else if (newState.status === VoiceConnectionStatus.Destroyed) {
      stopRecording('connection-lost', client);
    }
  });

  // Unsuppress in stage channels so we stay present and can receive audio
  if (channel.type === ChannelType.GuildStageVoice) {
    const me = channel.guild.members.me;
    if (me?.voice?.suppressed) {
      me.voice.setSuppressed(false).catch(() => {});
    }
  }
}

function beginUserStream(userId, receiver, dir) {
  if (!session) return;
  const opusStream = receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 1500 },
  });
  const oggStream = new opus.OggLogicalBitstream({
    opusHead: new opus.OpusHead({ channelCount: 2, sampleRate: 48000 }),
    pageSizeControl: { maxPackets: 10 },
  });
  const filePath = path.join(dir, `${userId}-${Date.now()}.ogg`);
  const fileStream = fs.createWriteStream(filePath);

  opusStream.pipe(oggStream).pipe(fileStream);

  const cleanup = () => {
    fileStream.end();
    session?.subscriptions.delete(opusStream);
  };

  opusStream.on('error', () => cleanup());
  oggStream.on('error', () => cleanup());
  oggStream.on('close', () => cleanup());

  session.subscriptions.add(opusStream);
}

async function stopRecording(reason = 'manual', client) {
  if (!session) return;
  const { connection, timeout, subscriptions } = session;

  if (timeout) clearTimeout(timeout);
  if (subscriptions) {
    for (const sub of subscriptions) {
      try { sub.destroy(); } catch (_) {}
    }
  }

  if (connection) connection.destroy();
  session = null;

  if (reason === 'max-duration' || reason === 'connection-lost') {
    const user = await client.users.fetch(TARGET_USER_ID).catch(() => null);
    if (user) {
      const msg = reason === 'max-duration'
        ? 'Înregistrarea s-a oprit după o oră. Dacă vrei să reiau, trimite /start în DM în timp ce ești pe voice.'
        : 'Înregistrarea s-a oprit deoarece conexiunea a fost întreruptă. Trimite /start în DM dacă ești pe voice și vrei să reiau.';
      await user.send(msg).catch(() => {});
    }
  }
}

module.exports = {
  TARGET_USER_ID,
  TARGET_GUILD_ID,
  MAX_RECORDING_MS,
  bootstrapRecorder,
  handleVoiceStateUpdate,
  handleRecorderDm,
};
