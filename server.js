
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app";

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

app.use(express.json());
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 🏆 SISTEMA DE RANKINGS INTERNO (ÚNICO)
let rankings = {};

// ✅ FUNCIÓN PARA ACTUALIZAR RANKING
function updateRanking(userId, username, score) {
    if (!rankings[userId] || rankings[userId].score < score) {
        rankings[userId] = {
            username: username || 'Usuario',
            score: score,
            lastUpdate: new Date().toISOString()
        };
        console.log(`🏆 Ranking actualizado: ${username} - ${score} puntos`);
        return true;
    }
    console.log(`📊 Score ${score} no supera récord actual: ${rankings[userId]?.score || 0}`);
    return false;
}

// ✅ FUNCIÓN PARA OBTENER TOP RANKINGS
function getTopRankings(limit = 10) {
    return Object.entries(rankings)
        .map(([userId, data]) => ({
            userId,
            username: data.username,
            score: data.score,
            lastUpdate: data.lastUpdate
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

app.get("/", (req, res) => {
  console.log("Redirigiendo al juego...");
  res.redirect(GAME_URL);
});


app.post("/setscore", async (req, res) => {
  const { userId, score, inline_message_id } = req.body;

  if (!userId || !score || !BOT_TOKEN) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const telegramURL = `https://api.telegram.org/bot${BOT_TOKEN}/setGameScore`;
    const result = await fetch(telegramURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        score: parseInt(score),
        inline_message_id,
        force: true
      })
    });

    const data = await result.json();
    res.json(data);
  } catch (error) {
    console.error("Error al enviar score:", error);
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
  console.log(`🌐 URL: ${GAME_URL}`);
  console.log("🏆 SOLO RANKING INTERNO - NO MÁS TELEGRAM GAMES");
});

// ✅ COMANDO /start - SIN GAMES, SOLO MENSAJE SIMPLE
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || 'Jugador';

  console.log(`🟢 /start - Enviando juego a ${username} (${userId})`);

  try {
    await bot.sendGame(chatId, 'shirogame');
  } catch (error) {
    console.error("❌ Error enviando juego:", error.message);
    await bot.sendMessage(chatId, ⚠️ No se pudo cargar el juego. Intenta con este enlace:\nhttps://t.me/ShiroCoin_GameBot?game=shirogame');
  }
});

// ✅ COMANDO /ranking - SOLO RANKING INTERNO
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    console.log(`Comando /ranking solicitado por chat: ${chatId}, usuario: ${userId}`);
    
    const topRankings = getTopRankings(10);
    
    if (topRankings.length === 0) {
        await bot.sendMessage(chatId, '📊 El ranking está vacío. ¡Sé el primero en jugar!\n\nUsa /testscore [número] para empezar.');
        return;
    }
    
    let rankingText = '🏆 **RANKING SHIRO COIN** 🏆\n\n';
    
    topRankings.forEach((player, index) => {
        const position = index + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
        rankingText += `${medal} ${position}. ${player.username} - ${player.score} puntos\n`;
    });
    
    if (rankings[userId]) {
        const userRank = topRankings.findIndex(p => p.userId == userId) + 1;
        if (userRank > 0) {
            rankingText += `\n👤 Tu posición: #${userRank}`;
        }
    }
    
    await bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
    console.log("✅ Ranking interno enviado (ÚNICO)");
});

// ✅ COMANDO /testscore
bot.onText(/\/testscore (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.username || msg.from.first_name || 'Usuario';
    const score = parseInt(match[1]);
    
    console.log(`Comando /testscore: ${userName} quiere registrar ${score} puntos`);
    
    const updated = updateRanking(userId, userName, score);
    
    if (updated) {
        await bot.sendMessage(chatId, `✅ Score de ${score} registrado para ${userName}!\n\nUsa /ranking para ver tu posición.`);
    } else {
        const currentScore = rankings[userId]?.score || 0;
        await bot.sendMessage(chatId, `📊 Tu puntuación actual (${currentScore}) es mayor o igual.\nNecesitas más de ${currentScore} puntos para actualizar.`);
    }
});

// ✅ ENDPOINT PARA RECIBIR SCORES DEL JUEGO
app.post('/api/score', async (req, res) => {
    try {
        console.log('📡 Score recibido del juego:', req.body);
        
        const { userId, username, score, chatId } = req.body;
        
        if (!score) {
            return res.status(400).json({ error: 'Score requerido' });
        }
        
        const finalUserId = userId || Date.now().toString();
        const finalUsername = username || 'Jugador_' + Math.floor(Math.random() * 1000);
        const finalScore = parseInt(score);
        
        const updated = updateRanking(finalUserId, finalUsername, finalScore);
        
        console.log(`🎯 Score procesado: ${finalUsername} = ${finalScore}, actualizado: ${updated}`);
        
        res.json({ 
            success: true, 
            updated: updated,
            score: finalScore,
            message: updated ? 'Nuevo récord!' : 'No supera récord actual'
        });
        
    } catch (error) {
        console.error('❌ Error procesando score:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ COMANDO /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
🎮 **SHIRO COIN GAME**

**🎯 Para jugar:**
${GAME_URL}

**📋 Comandos:**
/ranking - Ver ranking actual
/testscore [número] - Registrar score
/help - Esta ayuda

**🎮 Cómo funciona:**
1. Juega en el enlace de arriba
2. Al terminar, usa /testscore [tu_puntuación]
3. Usa /ranking para ver tu posición

**Ejemplo:**
/testscore 150
/ranking

**💡 Sistema:**
✅ Solo ranking interno
✅ Se actualiza solo si superas tu récord
✅ Un solo ranking para todos
    `;
    
    await bot.sendMessage(chatId, helpText);
});

// ✅ NO PROCESAR NADA DE TELEGRAM GAMES
bot.on('message', async (msg) => {
    console.log('📨 MENSAJE RECIBIDO TIPO:', msg.content_type || 'unknown');
    
    // ❌ IGNORAR completamente web_app_data y game_score
    if (msg.web_app_data || msg.game_score !== undefined) {
        console.log('🚫 Ignorando datos de Telegram Games - Solo ranking interno');
        return;
    }
});

bot.on('polling_error', (error) => {
  console.error(`❌ Error de polling: ${error.code} - ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`❌ Error del bot:`, error);
});

console.log("🤖 Bot iniciado");
console.log(`🌐 URL del juego: ${GAME_URL}`);
console.log("🏆 SISTEMA: SOLO RANKING INTERNO");
console.log("🚫 NO TELEGRAM GAMES - NO MÁS DOBLE RANKING");
console.log("⏳ Esperando comandos...");
