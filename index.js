require('dotenv').config();

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
} = require('discord.js');

const {
joinVoiceChannel,
createAudioPlayer,
createAudioResource,
AudioPlayerStatus,
VoiceConnectionStatus,
entersState,
NoSubscriberBehavior
} = require('@discordjs/voice');

const play = require('play-dl');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = ';';

if (!TOKEN) {
console.error('ไม่พบ DISCORD_TOKEN ในไฟล์ .env');
process.exit(1);
}

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildVoiceStates
]
});

const states = new Map();

function getState(guildId) {
if (states.has(guildId)) return states.get(guildId);

const player = createAudioPlayer({
behaviors: {
noSubscriber: NoSubscriberBehavior.Pause
}
});

const state = {
player,
connection: null,
queue: [],
current: null,
playing: false,
textChannel: null,
generation: 0
};

player.on(AudioPlayerStatus.Idle, () => {
state.playing = false;
state.current = null;
void playNext(guildId);
});

player.on('error', error => {
console.error('Audio error:', error.message);
state.playing = false;
state.current = null;

if (state.textChannel) {
  state.textChannel.send(
    '⚠️ เล่นเพลงนี้ไม่สำเร็จ กำลังข้ามเพลง'
  ).catch(() => {});
}

void playNext(guildId);

});

states.set(guildId, state);
return state;
}

function controlButtons() {
return new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('music:pause')
.setLabel('พัก')
.setEmoji('⏸️')
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
  .setCustomId('music:resume')
  .setLabel('เล่นต่อ')
  .setEmoji('▶️')
  .setStyle(ButtonStyle.Success),

new ButtonBuilder()
  .setCustomId('music:skip')
  .setLabel('ข้าม')
  .setEmoji('⏭️')
  .setStyle(ButtonStyle.Primary),

new ButtonBuilder()
  .setCustomId('music:stop')
  .setLabel('หยุด')
  .setEmoji('⏹️')
  .setStyle(ButtonStyle.Danger)

);
}

async function playNext(guildId) {
const state = states.get(guildId);

if (
!state ||
state.playing ||
!state.queue.length ||
!state.connection
) return;

const track = state.queue.shift();
state.current = track;
state.playing = true;

const generation = ++state.generation;

try {
const stream = await play.stream(track.url);

if (generation !== state.generation) {
  stream.stream.destroy();
  return;
}

const resource = createAudioResource(stream.stream, {
  inputType: stream.type,
  metadata: track
});

state.player.play(resource);

const embed = new EmbedBuilder()
  .setColor(0x5865F2)
  .setTitle('🎵 กำลังเล่นเพลง')
  .setDescription(`[${track.title}](${track.url})`)
  .addFields(
    {
      name: 'เพิ่มโดย',
      value: `<@${track.requesterId}>`,
      inline: true
    },
    {
      name: 'เพลงในคิว',
      value: String(state.queue.length),
      inline: true
    }
  );

if (track.thumbnail) {
  embed.setThumbnail(track.thumbnail);
}

if (state.textChannel) {
  await state.textChannel.send({
    embeds: [embed],
    components: [controlButtons()]
  }).catch(() => {});
}

} catch (error) {
console.error('Playback failed:', error.message);
state.playing = false;
state.current = null;

if (state.textChannel) {
  await state.textChannel.send(
    '❌ เปิดเพลงไม่สำเร็จ ลองค้นหาเพลงอื่น'
  ).catch(() => {});
}

void playNext(guildId);

}
}

async function searchTrack(query, requesterId) {
const results = await play.search(query, {
limit: 1,
source: { youtube: 'video' }
});

if (!results || !results.length) return null;

const result = results[0];

return {
title: result.title || 'ไม่ทราบชื่อเพลง',
url: result.url,
thumbnail: result.thumbnails?.[0]?.url || null,
requesterId
};
}

client.once('ready', () => {
console.log("บอทออนไลน์: ${client.user.tag}");
console.log("Prefix: ${PREFIX}");
});

client.on('messageCreate', async message => {
if (
!message.guild ||
message.author.bot ||
!message.content.startsWith(PREFIX)
) return;

const raw = message.content.slice(PREFIX.length).trim();
const separator = raw.indexOf(' ');

const command = (
separator === -1 ? raw : raw.slice(0, separator)
).toLowerCase();

const argument = separator === -1
? ''
: raw.slice(separator + 1).trim();

const state = getState(message.guild.id);

if (command === 'ping') {
return message.reply('🏓 Pong! บอททำงานอยู่');
}

if (command === 'help') {
return message.reply([
'🎵 คำสั่ง Music Bot',
'";play ชื่อเพลง" — ค้นหาเพลง',
'";queue" — ดูคิว',
'";skip" — ข้ามเพลง',
'";pause" — พักเพลง',
'";resume" — เล่นต่อ',
'";stop" — หยุดและล้างคิว',
'";ping" — ทดสอบบอท',
'";help" — ดูคำสั่ง'
].join('\n'));
}

if (command === 'play') {
if (!argument) {
return message.reply(
'ตัวอย่าง: ";play Numb Linkin Park"'
);
}

const voiceChannel = message.member?.voice?.channel;

if (!voiceChannel) {
  return message.reply('เข้าห้องเสียงก่อนนะ');
}

await message.channel.sendTyping().catch(() => {});

try {
  if (
    state.connection &&
    state.connection.joinConfig.channelId !== voiceChannel.id
  ) {
    return message.reply(
      'บอทอยู่ในห้องเสียงอื่น ใช้ `;stop` ก่อน'
    );
  }

  if (!state.connection) {
    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    state.connection.subscribe(state.player);

    await entersState(
      state.connection,
      VoiceConnectionStatus.Ready,
      20000
    );
  }

  state.textChannel = message.channel;

  await message.reply(`🔎 กำลังค้นหา: **${argument}**`);

  const track = await searchTrack(
    argument,
    message.author.id
  );

  if (!track) {
    return message.channel.send('ไม่พบเพลง ลองค้นหาใหม่');
  }

  state.queue.push(track);

  await message.channel.send(
    `✅ เพิ่มเข้าคิว: **${track.title}**`
  );

  void playNext(message.guild.id);
} catch (error) {
  console.error(error);

  return message.reply(
    '❌ เกิดข้อผิดพลาด ตรวจสิทธิ์บอทแล้วลองใหม่'
  );
}

}

if (command === 'queue') {
const lines = [];

if (state.current) {
  lines.push(`▶️ กำลังเล่น: **${state.current.title}**`);
}

state.queue.slice(0, 15).forEach((track, index) => {
  lines.push(`${index + 1}. ${track.title}`);
});

return message.reply(
  lines.length ? lines.join('\n').slice(0, 1900) : 'คิวว่างอยู่'
);

}

if (command === 'skip') {
if (!state.current) {
return message.reply('ไม่มีเพลงที่กำลังเล่น');
}

state.player.stop(true);
return message.reply('⏭️ ข้ามเพลงแล้ว');

}

if (command === 'pause') {
return message.reply(
state.player.pause() ? '⏸️ พักเพลงแล้ว' : 'ไม่มีเพลงให้พัก'
);
}

if (command === 'resume') {
return message.reply(
state.player.unpause() ? '▶️ เล่นต่อแล้ว' : 'ไม่มีเพลงให้เล่นต่อ'
);
}

if (command === 'stop') {
state.queue = [];
state.generation++;
state.player.stop(true);
state.playing = false;
state.current = null;

if (state.connection) {
  state.connection.destroy();
}

state.connection = null;

return message.reply('⏹️ หยุดเพลงและล้างคิวแล้ว');

}
});

client.on('interactionCreate', async interaction => {
if (
!interaction.isButton() ||
!interaction.customId.startsWith('music:')
) return;

const state = interaction.guildId
? states.get(interaction.guildId)
: null;

if (!state) {
return interaction.reply({
content: 'ยังไม่มีเพลงที่ควบคุมได้',
ephemeral: true
});
}

const action = interaction.customId.slice('music:'.length);

if (action === 'pause') {
return interaction.reply({
content: state.player.pause()
? '⏸️ พักเพลงแล้ว'
: 'ไม่มีเพลงให้พัก',
ephemeral: true
});
}

if (action === 'resume') {
return interaction.reply({
content: state.player.unpause()
? '▶️ เล่นต่อแล้ว'
: 'ไม่มีเพลงให้เล่นต่อ',
ephemeral: true
});
}

if (action === 'skip') {
if (!state.current) {
return interaction.reply({
content: 'ไม่มีเพลงให้ข้าม',
ephemeral: true
});
}

state.player.stop(true);

return interaction.reply({
  content: '⏭️ ข้ามเพลงแล้ว',
  ephemeral: true
});

}

if (action === 'stop') {
state.queue = [];
state.generation++;
state.player.stop(true);
state.playing = false;
state.current = null;

if (state.connection) {
  state.connection.destroy();
}

state.connection = null;

return interaction.reply({
  content: '⏹️ หยุดเพลงและล้างคิวแล้ว',
  ephemeral: true
});

}
});

client.on('error', error => {
console.error('Discord error:', error);
});

client.login(TOKEN);
