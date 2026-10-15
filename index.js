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
console.error('❌ ไม่พบ DISCORD_TOKEN ในไฟล์ .env');
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

const guildStates = new Map();

function getState(guildId) {
if (guildStates.has(guildId)) {
return guildStates.get(guildId);
}

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
    '⚠️ เล่นเพลงไม่สำเร็จ กำลังข้ามไปเพลงถัดไป'
  ).catch(() => {});
}

void playNext(guildId);

});

guildStates.set(guildId, state);
return state;
}

function makeButtons() {
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

async function searchTrack(query, requesterId) {
const results = await play.search(query, {
limit: 1,
source: {
youtube: 'video'
}
});

if (!results || results.length === 0) {
return null;
}

const result = results[0];

return {
title: result.title || 'ไม่ทราบชื่อเพลง',
url: result.url,
thumbnail: result.thumbnails?.[0]?.url || null,
requesterId
};
}

async function playNext(guildId) {
const state = guildStates.get(guildId);

if (
!state ||
state.playing ||
state.queue.length === 0 ||
!state.connection
) {
return;
}

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
    components: [makeButtons()]
  }).catch(() => {});
}

} catch (error) {
console.error('Playback error:', error.message);

state.playing = false;
state.current = null;

if (state.textChannel) {
  await state.textChannel.send(
    '❌ เปิดเพลงไม่ได้ ลองค้นหาเพลงอื่น'
  ).catch(() => {});
}

void playNext(guildId);

}
}

client.once('ready', () => {
console.log("✅ Bot online: ${client.user.tag}");
console.log("Prefix: ${PREFIX}");
});

client.on('messageCreate', async message => {
if (
message.author.bot ||
!message.guild ||
!message.content.startsWith(PREFIX)
) {
return;
}

const input = message.content.slice(PREFIX.length).trim();

if (!input) return;

const spaceIndex = input.indexOf(' ');

const command = (
spaceIndex === -1
? input
: input.slice(0, spaceIndex)
).toLowerCase();

const args = spaceIndex === -1
? ''
: input.slice(spaceIndex + 1).trim();

const state = getState(message.guild.id);

// HELP
if (command === 'help') {
return message.reply([
'🎵 Discord Music Bot',
'',
'";play ชื่อเพลง" — ค้นหาเพลงและเพิ่มเข้าคิว',
'";queue" — ดูคิวเพลง',
'";skip" — ข้ามเพลง',
'";pause" — พักเพลง',
'";resume" — เล่นเพลงต่อ',
'";stop" — หยุดเพลงและล้างคิว',
'";ping" — ทดสอบบอท',
'";help" — แสดงคำสั่งทั้งหมด',
'',
'ตัวอย่าง: ";play Numb Linkin Park"'
].join('\n'));
}

// PING
if (command === 'ping') {
return message.reply('🏓 Pong! บอทออนไลน์และตอบสนองแล้ว');
}

// PLAY / SEARCH
if (command === 'play') {
if (!args) {
return message.reply(
'❗ ใส่ชื่อเพลงด้วย เช่น ";play Numb Linkin Park"'
);
}

const voiceChannel = message.member?.voice?.channel;

if (!voiceChannel) {
  return message.reply(
    '🔊 เข้าห้องเสียง Discord ก่อนใช้คำสั่งเล่นเพลง'
  );
}

if (
  state.connection &&
  state.connection.joinConfig.channelId !== voiceChannel.id
) {
  return message.reply(
    'บอทอยู่ในห้องเสียงอื่น ให้ใช้ `;stop` ก่อน'
  );
}

await message.channel.sendTyping().catch(() => {});

try {
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

  await message.reply(`🔎 กำลังค้นหาเพลง: **${args}**`);

  const track = await searchTrack(
    args,
    message.author.id
  );

  if (!track) {
    return message.channel.send('ไม่พบเพลง ลองชื่อเพลงอื่น');
  }

  state.queue.push(track);

  await message.channel.send(
    `✅ เพิ่มเข้าคิวแล้ว: **${track.title}**`
  );

  void playNext(message.guild.id);
} catch (error) {
  console.error('Play command error:', error);

  return message.reply(
    '❌ ค้นหาหรือเชื่อมต่อห้องเสียงไม่สำเร็จ ตรวจสิทธิ์บอทแล้วลองใหม่'
  );
}

return;

}

// QUEUE
if (command === 'queue') {
const lines = [];

if (state.current) {
  lines.push(`▶️ กำลังเล่น: **${state.current.title}**`);
}

state.queue.slice(0, 15).forEach((track, index) => {
  lines.push(`${index + 1}. ${track.title}`);
});

return message.reply(
  lines.length
    ? lines.join('\n').slice(0, 1900)
    : '📭 ตอนนี้คิวเพลงว่าง'
);

}

// SKIP
if (command === 'skip') {
if (!state.current) {
return message.reply('ไม่มีเพลงที่กำลังเล่น');
}

state.player.stop(true);
return message.reply('⏭️ ข้ามเพลงแล้ว');

}

// PAUSE
if (command === 'pause') {
const success = state.player.pause();

return message.reply(
  success ? '⏸️ พักเพลงแล้ว' : 'ไม่มีเพลงที่พักได้'
);

}

// RESUME
if (command === 'resume') {
const success = state.player.unpause();

return message.reply(
  success ? '▶️ เล่นเพลงต่อแล้ว' : 'ไม่มีเพลงที่เล่นต่อได้'
);

}

// STOP
if (command === 'stop') {
state.queue = [];
state.generation++;

state.player.stop(true);
state.playing = false;
state.current = null;

if (state.connection) {
  state.connection.destroy();
  state.connection = null;
}

return message.reply('⏹️ หยุดเพลง ล้างคิว และออกจากห้องเสียงแล้ว');

}
});

// BUTTON CONTROLS
client.on('interactionCreate', async interaction => {
if (
!interaction.isButton() ||
!interaction.customId.startsWith('music:')
) {
return;
}

const state = interaction.guildId
? guildStates.get(interaction.guildId)
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
? '▶️ เล่นเพลงต่อแล้ว'
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
  state.connection = null;
}

return interaction.reply({
  content: '⏹️ หยุดเพลงและล้างคิวแล้ว',
  ephemeral: true
});

}
});

client.on('error', error => {
console.error('Discord client error:', error);
});

client.login(TOKEN);
