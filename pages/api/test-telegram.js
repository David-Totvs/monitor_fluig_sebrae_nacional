const { sendTelegramAlert } = require('../../lib/monitor');
const { loadData } = require('../../lib/storage');
const { verifyAuth } = require('./auth');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar autenticação
  if (!verifyAuth(req)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso negado: Você precisa estar autenticado como administrador para realizar testes.'
    });
  }

  const { telegramBotToken, telegramChatId } = req.body || {};
  const data = loadData();

  const token = (telegramBotToken && !telegramBotToken.includes('••••')) ? telegramBotToken : data.config.telegramBotToken;
  const chatId = (telegramChatId && !telegramChatId.includes('••••')) ? telegramChatId : data.config.telegramChatId;

  if (!token || !chatId) {
    return res.status(400).json({
      success: false,
      error: 'Informe o Token do Bot e o Chat ID para testar o envio.'
    });
  }

  const horaFormatada = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const mensagem = `
✅ <b>TESTE DE INTEGRAÇÃO - MONITOR FLUIG</b> ✅

🤖 As notificações do Telegram estão configuradas corretamente no <b>Monitor Dinâmico do Fluig</b>!
📱 Quando o servidor entrar em indisponibilidade, você receberá os alertas neste chat a cada 1 hora.
⏰ <b>Horário do teste:</b> ${horaFormatada}
  `.trim();

  const result = await sendTelegramAlert(token, chatId, mensagem);

  if (result.success) {
    return res.status(200).json({
      success: true,
      message: 'Mensagem de teste enviada com sucesso para o seu Telegram!'
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error || result.reason || 'Falha ao enviar mensagem pelo Telegram'
    });
  }
}
