const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app";
const GAME_SHORT_NAME = "shirogame"; // ⚠️ CONFIGURAR EN BOTFATHER

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

app.use(express.json());
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 🏆 SISTEMA DE RANKINGS (MANTENER COMO BACKUP)
let rankings = {};

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
    return false;
}

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

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
  console.log(`🌐 URL: ${GAME_URL}`);
  console.log("🎮 SISTEMA TELEGRAM GAMES OFICIAL + RANKING BACKUP");
});

// ✅ COMANDO /start - CON JUEGO OFICIAL
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || 'Usuario';
  
  console.log(`Comando /start del chat: ${chatId}, usuario: ${userId}`);

  const message = `🐱 ¡Hola ${username}! Bienvenido a Shiro Coin Game! 🪙

🎮 **Para jugar usa el botón de abajo o:**
🌐 **URL directa:** ${GAME_URL}

🏆 **Comandos disponibles:**
/game - Enviar juego oficial
/ranking - Ver ranking backup
/testscore [número] - Registrar puntuación manual

**Puntuaciones oficiales se muestran automáticamente en el juego.**`;

  try {
    await bot.sendMessage(chatId, message);
    
    // 🎮 ENVIAR JUEGO OFICIAL AUTOMÁTICAMENTE
    await bot.sendGame(chatId, GAME_SHORT_NAME);
    
    console.log(`✅ Mensaje y juego oficial enviados. Usuario: ${userId}`);
    
  } catch (error) {
    console.error("❌ Error enviando mensaje/juego:", error.message);
  }
});

// 🎮 COMANDO /game - ENVIAR JUEGO OFICIAL
bot.onText(/\/game/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    console.log(`Comando /game solicitado por: ${userId}`);
    
    try {
        await bot.sendGame(chatId, GAME_SHORT_NAME);
        console.log(`✅ Juego oficial enviado a chat: ${chatId}`);
    } catch (error) {
        console.error("❌ Error enviando juego:", error.message);
        await bot.sendMessage(chatId, "❌ Error: Asegúrate de que el juego esté configurado en @BotFather");
    }
});

// 🎮 MANEJAR CALLBACK DEL BOTÓN "PLAY"
bot.on('callback_query', async (callbackQuery) => {
    const { id, from, message, game_short_name } = callbackQuery;
    
    console.log(`🎮 Callback recibido: ${game_short_name}, user: ${from.id}`);
    
    if (game_short_name === GAME_SHORT_NAME) {
        try {
            // ✅ RESPONDER CON LA URL DEL JUEGO
            await bot.answerCallbackQuery(id, {
                url: GAME_URL
            });
            
            console.log(`✅ URL del juego enviada a usuario: ${from.id}`);
            
        } catch (error) {
            console.error("❌ Error respondiendo callback:", error.message);
        }
    }
});

// 🏆 MANEJAR SCORES OFICIALES DE TELEGRAM GAMES
bot.on('message', async (msg) => {
    if (msg.game_score !== undefined) {
        const { from, game_score, chat } = msg;
        
        console.log(`🏆 SCORE OFICIAL recibido: ${from.username || from.first_name} = ${game_score}`);
        
        try {
            // ✅ CONFIRMAR SCORE OFICIALMENTE
            const confirmed = await bot.setGameScore(from.id, game_score, {
                chat_id: chat.id,
                message_id: msg.message_id,
                force: false // No permitir scores menores
            });
            
            if (confirmed) {
                console.log(`✅ Score oficial confirmado: ${game_score}`);
                
                // 📊 TAMBIÉN GUARDAR EN RANKING BACKUP
                updateRanking(from.id, from.username || from.first_name, game_score);
                
                // 🎉 NOTIFICACIÓN EN EL CHAT (OPCIONAL)
                if (game_score > 100) { // Solo para scores altos
                    await bot.sendMessage(chat.id, 
                        `🎉 ¡${from.first_name} acaba de hacer ${game_score} puntos en Shiro Coin Game!`
                    );
                }
            }
            
        } catch (error) {
            console.error("❌ Error confirmando score oficial:", error.message);
        }
    }
});

// ✅ COMANDO /ranking - BACKUP (OPCIONAL)
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Comando /ranking backup solicitado`);
    
    try {
        // 🏆 OBTENER RANKING OFICIAL
        const gameHighScores = await bot.getGameHighScores(msg.from.id, {
            chat_id: chatId,
            // message_id requerido - obtener del último juego enviado
        });
        
        let rankingText = '🏆 **RANKING OFICIAL SHIRO COIN** 🏆\n\n';
        
        if (gameHighScores && gameHighScores.length > 0) {
            gameHighScores.forEach((score, index) => {
                const position = index + 1;
                const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
                rankingText += `${medal} ${position}. ${score.user.first_name} - ${score.score} puntos\n`;
            });
        } else {
            rankingText += '📊 El ranking oficial está vacío.\n\n';
            
            // MOSTRAR RANKING BACKUP
            const backupRanking = getTopRankings(5);
            if (backupRanking.length > 0) {
                rankingText += '**RANKING BACKUP:**\n';
                backupRanking.forEach((player, index) => {
                    rankingText += `${index + 1}. ${player.username} - ${player.score} pts\n`;
                });
            }
        }
        
        await bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error("❌ Error obteniendo ranking oficial:", error.message);
        
        // FALLBACK AL RANKING BACKUP
        const topRankings = getTopRankings(10);
        let rankingText = '🏆 **RANKING BACKUP** 🏆\n\n';
        
        if (topRankings.length === 0) {
            rankingText += '📊 El ranking está vacío. ¡Sé el primero en jugar!';
        } else {
            topRankings.forEach((player, index) => {
                const position = index + 1;
                const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
                rankingText += `${medal} ${position}. ${player.username} - ${player.score} puntos\n`;
            });
        }
        
        await bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
    }
});

// ✅ MANTENER /testscore COMO BACKUP
bot.onText(/\/testscore (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.username || msg.from.first_name || 'Usuario';
    const score = parseInt(match[1]);
    
    console.log(`Comando /testscore backup: ${userName} = ${score}`);
    
    const updated = updateRanking(userId, userName, score);
    
    if (updated) {
        await bot.sendMessage(chatId, `✅ Score backup de ${score} registrado para ${userName}!\n\n⚠️ Nota: Los scores oficiales se registran automáticamente al jugar.`);
    } else {
        const currentScore = rankings[userId]?.score || 0;
        await bot.sendMessage(chatId, `📊 Tu puntuación backup actual (${currentScore}) es mayor.\n\n🎮 Usa el juego oficial para actualizar tu score.`);
    }
});

// ✅ ENDPOINT BACKUP PARA SCORES
app.post('/api/score', async (req, res) => {
    try {
        console.log('📡 Score backup recibido:', req.body);
        
        const { userId, username, score } = req.body;
        const finalScore = parseInt(score);
        
        if (!finalScore) {
            return res.status(400).json({ error: 'Score requerido' });
        }
        
        const updated = updateRanking(userId || Date.now().toString(), username || 'Jugador', finalScore);
        
        res.json({ 
            success: true, 
            updated: updated,
            score: finalScore,
            message: 'Score backup guardado - Usa el juego oficial para score oficial'
        });
        
    } catch (error) {
        console.error('❌ Error procesando score backup:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ COMANDO /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
🎮 **SHIRO COIN GAME - SISTEMA OFICIAL**

**🎯 Para jugar:**
1. Usa /game para obtener el juego oficial
2. O visita: ${GAME_URL}

**📋 Comandos:**
/game - Enviar juego oficial de Telegram
/ranking - Ver ranking oficial + backup
/testscore [número] - Score backup manual
/help - Esta ayuda

**🏆 Sistema de Rankings:**
✅ **OFICIAL:** Se registra automáticamente al jugar
✅ **BACKUP:** Sistema interno como respaldo

**💡 Funcionamiento:**
- Los scores oficiales aparecen automáticamente en el mensaje del juego
- El ranking oficial se actualiza en tiempo real
- Sistema backup disponible como respaldo

**🎮 ¡El mejor score se mostrará a todos en el chat!**
    `;
    
    await bot.sendMessage(chatId, helpText);
});

bot.on('polling_error', (error) => {
  console.error(`❌ Error de polling: ${error.code} - ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`❌ Error del bot:`, error);
});

console.log("🤖 Bot iniciado con TELEGRAM GAMES OFICIAL");
console.log(`🌐 URL del juego: ${GAME_URL}`);
console.log(`🎮 Nombre del juego: ${GAME_SHORT_NAME}`);
console.log("🏆 RANKING OFICIAL + BACKUP");
console.log("⏳ Esperando comandos...");
