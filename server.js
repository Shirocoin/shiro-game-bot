const TelegramBot = require('node-telegram-bot-api');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

const apiUrl = 'https://649437dd0da866a953677f42.mockapi.io/scores';
const GAME_URL = 'https://shirocoin-game.netlify.app';

bot.onText(/\/jugar/, (msg) => {
  bot.sendMessage(msg.chat.id, `🎮 Juega ahora: ${GAME_URL}`);
});

bot.onText(/\/score (\d+)/, async (msg, match) => {
  const username = msg.from.username || msg.from.first_name;
  const score = parseInt(match[1]);
  const res = await fetch(apiUrl);
  const data = await res.json();
  const user = data.find(u => u.username === username);

  if (!user) {
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score })
    });
    bot.sendMessage(msg.chat.id, `✅ Puntuación guardada: ${score}`);
  } else if (score > user.score) {
    await fetch(`${apiUrl}/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score })
    });
    bot.sendMessage(msg.chat.id, `🔁 Puntuación actualizada a ${score}`);
  } else {
    bot.sendMessage(msg.chat.id, `📊 Tu récord es mayor o igual. No se actualiza.`);
  }
});

bot.onText(/\/ranking/, async (msg) => {
  const res = await fetch(apiUrl);
  const data = await res.json();
  const top = data.sort((a,b) => b.score - a.score).slice(0,10);
  let text = '🏆 TOP 10 SHIRO COIN 🏆\n\n';
  top.forEach((u, i) => {
    text += `${i+1}. ${u.username} — ${u.score}\n`;
  });
  bot.sendMessage(msg.chat.id, text);
});
