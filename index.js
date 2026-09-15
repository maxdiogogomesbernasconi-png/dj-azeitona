const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');
const axios = require('axios'); // Para buscar memes na internet

// --- SERVER CENTRAL PARA MANTER ALIVE (RENDER) ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🎧 DJ Azeitona Multi-Redes está estourando os alto-falantes!'));
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

// --- BANCO DE DADOS DE COMBOS LOCAL ---
const DB_FILE = './combos_db.json';
let combosDatabase = {};
if (fs.existsSync(DB_FILE)) {
    combosDatabase = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

let criacaoEtapa = {};

// Configuração definitiva para o Puppeteer encontrar o Chrome baixado no Render
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./.wwebjs_auth"
    }),
    puppeteer: { 
        executablePath: '/opt/render/.cache/puppeteer/chrome/linux-130.0.6723.116/chrome-linux/chrome',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ] 
    }
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';

client.on('qr', qr => {
    // Desenha o código nos logs do painel do Render
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('🎧 DJ AZEITONA CONECTADO NA NUVEM!'));

client.on('message', async msg => {
    const chatID = msg.from;
    const texto = msg.body.trim();
    const textoMinusculo = texto.toLowerCase();

    // --- MODO DE CRIAÇÃO ---
    if (textoMinusculo.startsWith('!criarcombo ')) {
        const nomeCombo = texto.replace(/!criarcombo /i, '').trim().toLowerCase();
        criacaoEtapa[chatID] = { nome: nomeCombo, passo: 'aguardando_sticker', stickerMedia: null, audioMedia: null };
        await msg.reply(`🎧 *[DJ Azeitona]*\n\nCriando o combo *@${nomeCombo}*.\n👉 Encaminhe a *FIGURINHA* para mim.`);
        return;
    }

    if (criacaoEtapa[chatID]) {
        const etapa = criacaoEtapa[chatID];
        if (etapa.passo === 'aguardando_sticker' && msg.hasMedia && msg.type === 'sticker') {
            etapa.stickerMedia = await msg.downloadMedia();
            etapa.passo = 'aguardando_audio';
            await msg.reply('🟢 Figurinha salva! 👉 Agora encaminhe o *ÁUDIO*.');
            return;
        }
        if (etapa.passo === 'aguardando_audio' && msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
            etapa.audioMedia = await msg.downloadMedia();
            combosDatabase[etapa.nome] = {
                sticker: { data: etapa.stickerMedia.data, mimetype: etapa.stickerMedia.mimetype },
                audio: { data: etapa.audioMedia.data, mimetype: etapa.audioMedia.mimetype }
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(combosDatabase, null, 2));
            await msg.reply(`🎉 Combo *@${etapa.nome}* gravado com sucesso no CD do DJ Azeitona!`);
            delete criacaoEtapa[chatID];
            return;
        }
    }

    // --- MODO DE USO NO GRUPO (Disparado por @) ---
    if (texto.startsWith('@')) {
        const nomeAlvo = texto.replace('@', '').trim().toLowerCase();

        // 1. Verifica se o combo existe no seu banco de dados privado
        if (combosDatabase[nomeAlvo]) {
            const combo = combosDatabase[nomeAlvo];
            await client.sendMessage(chatID, new MessageMedia(combo.sticker.mimetype, combo.sticker.data), { sendMediaAsSticker: true });
            await client.sendMessage(chatID, new MessageMedia(combo.audio.mimetype, combo.audio.data), { sendAudioAsVoice: true });
            return;
        }

        // 2. Se NÃO existir, busca um GIF de meme/anime na internet automaticamente
        try {
            const urlBusca = `https://giphy.com{encodeURIComponent(nomeAlvo)}&limit=1&rating=g`;
            const resposta = await axios.get(urlBusca);
            
            if (resposta.data && resposta.data.data.length > 0) {
                const gifUrl = resposta.data.data.images.fixed_height.url;
                const midiaGif = await MessageMedia.fromUrl(gifUrl, { unsafeMime: true });
                await client.sendMessage(chatID, midiaGif, { sendMediaAsSticker: true });
            }
        } catch (err) {
            console.log("Erro ao buscar na internet:", err.message);
        }
    }
});

client.initialize();
