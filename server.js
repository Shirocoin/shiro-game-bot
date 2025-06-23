const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// 🔧 CONFIGURACIÓN DEL NUEVO BOT
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // 🔴 USAR TOKEN DEL NUEVO BOT
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app";
const GAME_SHORT_NAME = "shirogame"; // ✅ Short name confirmado

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

app.use(express.json());
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 🎮 SISTEMA DE TELEGRAM GAMES OFICIAL
let activePlayers = {}; // Para tracking de jugadores activos

// ✅ CORS para el juego
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 🏠 ENDPOINT RAÍZ
app.get("/", (req, res) => {
    res.redirect(GAME_URL);
});

// 🏥 ENDPOINT DE SALUD
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Servidor Telegram Games funcionando',
        gameShortName: GAME_SHORT_NAME,
        activePlayersCount: Object.keys(activePlayers).length
    });
});

// 📊 ENDPOINT PARA VER RANKING DESDE WEB
app.get('/api/ranking', async (req, res) => {
    try {
        console.log('📊 Obteniendo ranking de Telegram Games...');
        
        const rankings = [];
        
        for (const [userId, playerData] of Object.entries(activePlayers)) {
            try {
                const telegramScores = await bot.getGameHighScores(userId, {
                    chat_id: playerData.chatId,
                    message_id: playerData.messageId
                });
                
                if (telegramScores && telegramScores.length > 0) {
                    rankings.push({
                        userId: userId,
                        username: playerData.username,
                        score: telegramScores[0].score,
                        position: telegramScores[0].position,
                        lastUpdate: playerData.lastSeen
                    });
                }
            } catch (error) {
                console.log(`No score para usuario ${userId}:`, error.message);
            }
        }
        
        // Ordenar por score descendente
        rankings.sort((a, b) => b.score - a.score);
        
        console.log(`📊 Ranking obtenido: ${rankings.length} jugadores`);
        
        res.json({
            success: true,
            total: rankings.length,
            ranking: rankings,
            timestamp: new Date().toISOString(),
            source: 'telegram_games_official',
            gameShortName: GAME_SHORT_NAME
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo ranking:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            ranking: []
        });
    }
});

// 🎯 ENDPOINT PARA RECIBIR SCORES DEL JUEGO
app.post('/api/score', async (req, res) => {
    try {
        console.log('📡 Score recibido del juego:', req.body);
        
        const { score, gameData } = req.body;
        
        if (!score && score !== 0) {
            console.log('❌ Score no proporcionado');
            return res.status(400).json({ error: 'Score requerido' });
        }
        
        if (!gameData || !gameData.userId || !gameData.chatId || !gameData.messageId) {
            console.log('❌ Datos del juego incompletos:', gameData);
            return res.status(400).json({ 
                error: 'Datos del juego requeridos (userId, chatId, messageId)' 
            });
        }
        
        const finalScore = parseInt(score);
        console.log(`🎮 Enviando score ${finalScore} a Telegram Games para usuario ${gameData.userId}`);
        
        try {
            // 🚀 ENVIAR SCORE OFICIAL A TELEGRAM GAMES
            const result = await bot.setGameScore(gameData.userId, finalScore, {
                chat_id: gameData.chatId,
                message_id: gameData.messageId,
                edit_message: true
            });
            
            console.log(`✅ Score enviado a Telegram Games exitosamente`);
            
            // Actualizar datos del jugador
            if (activePlayers[gameData.userId]) {
                activePlayers[gameData.userId].lastSeen = new Date().toISOString();
            }
            
            res.json({ 
                success: true, 
                score: finalScore,
                message: 'Score enviado a Telegram Games oficialmente',
                updated: true
            });
            
        } catch (telegramError) {
            console.error('❌ Error enviando score a Telegram:', telegramError.message);
            
            // Intentar sin edit_message
            try {
                const fallbackResult = await bot.setGameScore(gameData.userId, finalScore, {
                    chat_id: gameData.chatId,
                    message_id: gameData.messageId,
                    force: true
                });
                
                console.log(`✅ Score enviado (modo fallback)`);
                
                res.json({ 
                    success: true, 
                    score: finalScore,
                    message: 'Score enviado (modo fallback)',
                    updated: true
                });
                
            } catch (fallbackError) {
                console.error('❌ Error en fallback:', fallbackError.message);
                res.status(500).json({ 
                    error: `Error enviando a Telegram: ${fallbackError.message}` 
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error procesando score:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================
// COMANDOS DEL BOT DE TELEGRAM
// ============================

// ✅ COMANDO /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Usuario';
    
    console.log(`🚀 Comando /start - Chat: ${chatId}, Usuario: ${userId} (${username})`);

    const welcomeMessage = `🐱 ¡Hola ${username}! Bienvenido a **Shiro Coin Game** oficial! 🪙

🎮 **¡Presiona el botón "🎯 Jugar" para empezar!**

🏆 **Características del juego oficial:**
✅ Ranking automático de Telegram  
✅ Puntuaciones oficiales y seguras
✅ Competición en tiempo real
✅ Sin comandos manuales

ℹ️ **Comandos disponibles:**
/game - Enviar juego
/ranking - Ver ranking oficial  
/help - Ayuda

🎯 **¡Tu puntuación se guardará automáticamente!**`;

    try {
        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        
        // 🎮 ENVIAR EL JUEGO OFICIAL
        console.log(`🎮 Enviando juego "${GAME_SHORT_NAME}" a ${username}`);
        const gameMessage = await bot.sendGame(chatId, GAME_SHORT_NAME);
        
        console.log(`✅ Juego enviado. Message ID: ${gameMessage.message_id}`);
        
        // Guardar datos del jugador
        activePlayers[userId] = {
            username: username,
            chatId: chatId,
            messageId: gameMessage.message_id,
            lastSeen: new Date().toISOString()
        };
        
        console.log(`👤 Jugador registrado: ${username} (${userId})`);
        
    } catch (error) {
        console.error("❌ Error enviando juego:", error.message);
        await bot.sendMessage(chatId, `❌ Error enviando el juego: ${error.message}`);
    }
});

// ✅ COMANDO /game
bot.onText(/\/game/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Usuario';
    
    try {
        console.log(`🎮 Enviando juego a ${username} (${userId})`);
        
        const gameMessage = await bot.sendGame(chatId, GAME_SHORT_NAME);
        console.log(`✅ Juego enviado. Message ID: ${gameMessage.message_id}`);
        
        // Actualizar datos del jugador
        activePlayers[userId] = {
            username: username,
            chatId: chatId,
            messageId: gameMessage.message_id,
            lastSeen: new Date().toISOString()
        };
        
    } catch (error) {
        console.error("❌ Error enviando juego:", error.message);
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// ✅ COMANDO /ranking
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`📊 Ranking solicitado por usuario: ${userId}`);
    
    if (Object.keys(activePlayers).length === 0) {
        await bot.sendMessage(chatId, `📊 No hay jugadores aún. ¡Usa /game para ser el primero!`);
        return;
    }
    
    try {
        const rankings = [];
        
        // Obtener scores oficiales de Telegram
        for (const [playerId, playerData] of Object.entries(activePlayers)) {
            try {
                const scores = await bot.getGameHighScores(playerId, {
                    chat_id: playerData.chatId,
                    message_id: playerData.messageId
                });
                
                if (scores && scores.length > 0) {
                    rankings.push({
                        userId: playerId,
                        username: playerData.username,
                        score: scores[0].score
                    });
                }
            } catch (error) {
                console.log(`Sin score para ${playerData.username}`);
            }
        }
        
        if (rankings.length === 0) {
            await bot.sendMessage(chatId, '📊 No hay puntuaciones aún. ¡Juega para aparecer en el ranking!');
            return;
        }
        
        // Ordenar por score descendente
        rankings.sort((a, b) => b.score - a.score);
        
        let rankingText = '🏆 **RANKING OFICIAL SHIRO COIN** 🏆\n\n';
        
        rankings.forEach((player, index) => {
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
            rankingText += `${medal} ${position}. ${player.username} - ${player.score} puntos\n`;
        });
        
        // Posición del usuario actual
        const userRanking = rankings.find(p => p.userId == userId);
        if (userRanking) {
            const userPosition = rankings.indexOf(userRanking) + 1;
            rankingText += `\n👤 Tu posición: #${userPosition} con ${userRanking.score} puntos`;
        } else {
            rankingText += `\n👤 Aún no tienes puntuación. ¡Juega para aparecer!`;
        }
        
        rankingText += `\n\n📊 Total jugadores: ${rankings.length}`;
        rankingText += `\n🎮 Usa /game para jugar de nuevo`;
        
        await bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error("❌ Error obteniendo ranking:", error);
        await bot.sendMessage(chatId, '❌ Error obteniendo el ranking. Inténtalo de nuevo.');
    }
});

// ✅ MANEJO DE CALLBACK QUERIES (cuando se presiona "🎯 Jugar")
bot.on('callback_query', async (callbackQuery) => {
    const userId = callbackQuery.from.id;
    const username = callbackQuery.from.username || callbackQuery.from.first_name || 'Usuario';
    const gameShortName = callbackQuery.game_short_name;
    
    console.log(`🎮 Callback query - Usuario: ${userId}, Juego: ${gameShortName}`);
    
    if (gameShortName === GAME_SHORT_NAME) {
        // URL del juego con parámetros de Telegram Games
        const gameUrl = `${GAME_URL}?tgGameUserId=${userId}&tgGameChatId=${callbackQuery.message.chat.id}&tgGameMessageId=${callbackQuery.message.message_id}&tgGameUsername=${encodeURIComponent(username)}`;
        
        console.log(`🎯 Enviando URL del juego a ${username}`);
        
        try {
            await bot.answerCallbackQuery(callbackQuery.id, {
                url: gameUrl
            });
            
            // Actualizar datos del jugador
            activePlayers[userId] = {
                username: username,
                chatId: callbackQuery.message.chat.id,
                messageId: callbackQuery.message.message_id,
                lastSeen: new Date().toISOString()
            };
            
            console.log(`✅ Callback query respondido exitosamente para ${username}`);
            
        } catch (error) {
            console.error('❌ Error respondiendo callback query:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: `Error: ${error.message}`,
                show_alert: true
            });
        }
    }
});

// ✅ COMANDO /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
🎮 **SHIRO COIN GAME - OFICIAL**

🎯 **Para jugar:**
/game - Enviar el juego

🏆 **Comandos:**
/ranking - Ver ranking oficial de Telegram
/game - Jugar de nuevo
/help - Esta ayuda

💡 **Cómo funciona:**
1. Usa /game para que aparezca el juego
2. Presiona el botón "🎯 Jugar"  
3. ¡El score se envía automáticamente a Telegram!
4. Usa /ranking para ver tu posición

✅ **Ventajas del sistema oficial:**
• Ranking integrado de Telegram
• Scores automáticos y seguros  
• Sin comandos manuales (/testscore)
• Competición en tiempo real

🚀 **¡Completamente automático!**
    `;
    
    await bot.sendMessage(chatId, helpText);
});

// 🚫 IGNORAR OTROS MENSAJES
bot.on('message', async (msg) => {
    // Solo procesar comandos específicos
});

bot.on('polling_error', (error) => {
    console.error(`❌ Error de polling: ${error.message}`);
});

bot.on('error', (error) => {
    console.error(`❌ Error del bot:`, error);
});

// ============================
// INICIO DEL SERVIDOR
// ============================

app.listen(PORT, () => {
    console.log(`✅ Servidor Telegram Games corriendo en puerto ${PORT}`);
    console.log(`🎮 URL del juego: ${GAME_URL}`);
    console.log(`🎯 Game short name: ${GAME_SHORT_NAME}`);
    console.log(`🤖 Bot: ShiroCoin_GameBot`);
    console.log("🏆 SISTEMA: TELEGRAM GAMES OFICIAL");
    console.log("🚀 RANKING: 100% AUTOMÁTICO");
    console.log("📊 Endpoints activos:");
    console.log("   GET  /health - Estado del servidor");
    console.log("   GET  /api/ranking - Ver ranking oficial");
    console.log("   POST /api/score - Recibir scores del juego");
    console.log("⏳ ¡Listo para recibir jugadores!");
});

console.log("🤖 Bot Telegram Games iniciado correctamente");
console.log(`🎮 Game: ${GAME_SHORT_NAME}`);
console.log("🏆 RANKING: TELEGRAM GAMES OFICIAL");
console.log("🚀 AUTOMÁTICO: SÍ");
console.log("⏳ Esperando comandos...");
