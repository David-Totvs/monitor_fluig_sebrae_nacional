import { loadData } from '../../lib/storage';
import { verifyAuth } from './auth';

export default async function handler(req, res) {
  const data = await loadData();
  const isAuth = await verifyAuth(req);

  const safeConfig = {
    fluigUrl: data.config.fluigUrl,
    timeoutSeconds: data.config.timeoutSeconds,
    serverName: data.config.serverName,
    alertIntervalMinutes: data.config.alertIntervalMinutes,
    isTelegramConfigured: Boolean(data.config.telegramBotToken && data.config.telegramChatId),
    telegramBotToken: isAuth ? data.config.telegramBotToken : (data.config.telegramBotToken ? '••••••••••••••••' : ''),
    telegramChatId: isAuth ? data.config.telegramChatId : (data.config.telegramChatId ? '••••••••' : '')
  };

  res.status(200).json({
    success: true,
    state: data.state,
    history: data.history || [],
    config: safeConfig,
    authenticated: isAuth
  });
}
