const { Client: ClientWA, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { Telegraf } = require('telegraf');
const { Client: ClientDC, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const express = require('express');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// --- SERVER CENTRAL PARA MANTER ALIVE (RENDER) ---
const app = express();
app.get('/', (req, res) => res.send('🎧 DJ Azeitona Multi-Redes está estourando os alto-falantes!'));
app.listen(process.env.PORT || 3000, () => console.log("Servidor Web Ativo"));

// --- BANCO DE DADOS DE COMBOS LOCAL ---
const DB_FILE = './combos_db.json';
let combosDatabase = {};
if (fs.existsSync(DB_FILE)) combosDatabase = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

// --- CONFIGURAÇÃO DOS TOKENS DAS REDES (VARIÁVEIS DE AMBIENTE) ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';

// --- INTERFACE 1: WHATSAPP ---
const whatsapp = new ClientWA({
    authStrategy: new RemoteAuth({ clientId: "dj-azeitona", dataPath: "./.wwebjs_auth", backupSyncIntervalMs: 60000 }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});
whatsapp.on('qr', qr => qrcode.generate(qr, { small: true }));
whatsapp.on('ready', () => console.log('🟢 DJ Azeitona conectado no WhatsApp!'));
whatsapp.on('message', async msg => {
    if (msg.body.startsWith('@')) {
        const comando = msg.body.replace('@', '').trim().toLowerCase();
        if (combosDatabase[comando]) {
            const c = combosDatabase[comando];
            await whatsapp.sendMessage(msg.from, new MessageMedia(c.sticker.mimetype, c.sticker.data), { sendMediaAsSticker: true });
            await whatsapp.sendMessage(msg.from, new MessageMedia(c.audio.mimetype, c.audio.data), { sendAudioAsVoice: true });
        }
    }
});
whatsapp.initialize();

// --- INTERFACE 2: TELEGRAM ---
if (TELEGRAM_TOKEN) {
    const botTelegram = new Telegraf(TELEGRAM_TOKEN);
    console.log('🔵 DJ Azeitona configurado para o Telegram!');
    
    botTelegram.on('text', async (ctx) => {
        const texto = ctx.message.text;
        if (texto.startsWith('@')) {
            const comando = texto.replace('@', '').trim().toLowerCase();
            if (combosDatabase[comando]) {
                const c = combosDatabase[comando];
                // Telegram aceita buffers diretamente para Stickers e Áudios (Voz)
                const stickerBuffer = Buffer.from(c.sticker.data, 'base64');
                const voiceBuffer = Buffer.from(c.audio.data, 'base64');
                await ctx.replyWithSticker({ source: stickerBuffer });
                await ctx.replyWithVoice({ source: voiceBuffer });
            }
        }
    });
    botTelegram.launch();
}

// --- INTERFACE 3: DISCORD (STIKERS + PLAY DE MÚSICA EM CALL) ---
if (DISCORD_TOKEN) {
    const discord = new ClientDC({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });
    
    discord.on('ready', () => console.log('🟣 DJ Azeitona logado no Discord!'));
    
    discord.on('messageCreate', async message => {
        if (message.author.bot) return;
        const texto = message.content;

        // Comandos de figurinha/áudio no chat do Discord
        if (texto.startsWith('@')) {
            const comando = texto.replace('@', '').trim().toLowerCase();
            if (combosDatabase[comando]) {
                const c = combosDatabase[comando];
                const voiceBuffer = Buffer.from(c.audio.data, 'base64');
                // Envia o áudio como arquivo no chat do Discord
                await message.reply({ content: `🎵 Tocando a vinheta de *@${comando}*!`, files: [{ attachment: voiceBuffer, name: 'audio.mp3' }] });
            }
        }

        // COMANDO DE MÚSICA DO YOUTUBE NA CALL DO DISCORD: !play <link ou nome>
        if (texto.startsWith('!play ')) {
            const busca = texto.replace('!play ', '').trim();
            const channel = message.member.voice.channel;
            
            if (!channel) return message.reply('❌ Entra num canal de voz primeiro, chefe!');
            
            try {
                const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
                message.reply(`🎧 Procurando e soltando o som de: *${busca}* na call!`);

                // Extrai ou busca o streaming de áudio do YouTube usando ytdl
                const stream = ytdl(busca, { filter: 'audioonly', highWaterMark: 1 << 25 });
                const resource = createAudioResource(stream);
                const player = createAudioPlayer();

                player.play(resource);
                connection.subscribe(player);

                player.on(AudioPlayerStatus.Idle, () => connection.destroy());
            } catch (error) {
                console.error(error);
                message.reply('⚠️ Ocorreu um erro ao sintonizar essa música.');
            }
        }
    });
    discord.login(DISCORD_TOKEN);
}
