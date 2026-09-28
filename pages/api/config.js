import { loadData, saveData } from '../../lib/storage';
import { verifyAuth } from './auth';

export default function handler(req, res) {
  const data = loadData();
  const isAuth = verifyAuth(req);

  if (req.method === 'GET') {
    // Se não estiver autenticado, omitir dados sensíveis
    const safeConfig = {
      fluigUrl: data.config.fluigUrl,
      timeoutSeconds: data.config.timeoutSeconds,
      serverName: data.config.serverName,
      alertIntervalMinutes: data.config.alertIntervalMinutes,
      isTelegramConfigured: Boolean(data.config.telegramBotToken && data.config.telegramChatId),
      // Se autenticado, envia os valores reais, senão mascara
      telegramBotToken: isAuth ? data.config.telegramBotToken : (data.config.telegramBotToken ? '••••••••••••••••' : ''),
      telegramChatId: isAuth ? data.config.telegramChatId : (data.config.telegramChatId ? '••••••••' : '')
    };

    return res.status(200).json({
      success: true,
      config: safeConfig,
      state: data.state,
      authenticated: isAuth
    });
  }

  if (req.method === 'POST') {
    // Exigir autenticação para salvar configurações
    if (!isAuth) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado: Você precisa estar autenticado como administrador para alterar configurações.'
      });
    }

    const {
      fluigUrl,
      timeoutSeconds,
      telegramBotToken,
      telegramChatId,
      alertIntervalMinutes,
      serverName
    } = req.body || {};

    if (fluigUrl) data.config.fluigUrl = fluigUrl.trim();
    if (timeoutSeconds) data.config.timeoutSeconds = Number(timeoutSeconds);
    if (telegramBotToken !== undefined) data.config.telegramBotToken = telegramBotToken.trim();
    if (telegramChatId !== undefined) data.config.telegramChatId = telegramChatId.trim();
    if (alertIntervalMinutes) data.config.alertIntervalMinutes = Number(alertIntervalMinutes);
    if (serverName) data.config.serverName = serverName.trim();

    saveData(data);

    return res.status(200).json({
      success: true,
      message: 'Configurações salvas com sucesso!',
      config: data.config
    });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ error: `Método ${req.method} não permitido` });
}
