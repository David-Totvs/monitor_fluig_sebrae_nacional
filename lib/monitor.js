import https from 'https';
import http from 'http';
import { loadData, saveData } from './storage';

/**
 * Envia notificação via Telegram Bot para um ou múltiplos chats/usuários
 */
async function sendSingleTelegramMessage(botToken, singleChatId, message) {
  const cleanToken = botToken.trim();
  const cleanChatId = singleChatId.trim();
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  const payload = JSON.stringify({
    chat_id: cleanChatId,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });

  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 10000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.ok) {
              resolve({ success: true, chatId: cleanChatId });
            } else {
              resolve({ success: false, chatId: cleanChatId, error: parsed.description });
            }
          } catch (e) {
            resolve({ success: false, chatId: cleanChatId, error: body });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({ success: false, chatId: cleanChatId, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, chatId: cleanChatId, error: 'Timeout ao conectar com o Telegram' });
    });

    req.write(payload);
    req.end();
  });
}

export async function sendTelegramAlert(botToken, chatIds, message) {
  if (!botToken || !chatIds) {
    console.warn('[Telegram] Bot Token ou Chat ID não configurados.');
    return { success: false, reason: 'Credenciais do Telegram ausentes' };
  }

  // Divide por vírgula ou ponto e vírgula caso haja múltiplos destinatários
  const targetChats = String(chatIds)
    .split(/[,;]/)
    .map((id) => id.trim())
    .filter(Boolean);

  if (targetChats.length === 0) {
    return { success: false, reason: 'Nenhum Chat ID válido informado' };
  }

  // Dispara as mensagens para todos os chats/usuários
  const results = await Promise.all(
    targetChats.map((id) => sendSingleTelegramMessage(botToken, id, message))
  );

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    return {
      success: true,
      totalSent: successful.length,
      failed: failed.length,
      errors: failed.map((f) => `${f.chatId}: ${f.error}`).join(' | ')
    };
  } else {
    return {
      success: false,
      error: failed.map((f) => `${f.chatId}: ${f.error}`).join(' | ')
    };
  }
}

/**
 * Executa a checagem HTTP/HTTPS da URL do Fluig
 */
export async function checkUrl(targetUrl, timeoutSeconds = 15) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return resolve({
        isUp: false,
        statusCode: null,
        responseTimeMs: 0,
        error: `URL inválida: ${targetUrl}`
      });
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      parsedUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'FluigMonitor/1.0 (Availability Checker)',
          Accept: '*/*'
        },
        timeout: timeoutSeconds * 1000,
        // Em produção aceita certificados padrão
        rejectUnauthorized: false
      },
      (res) => {
        const responseTimeMs = Date.now() - startTime;
        // Consumir dados para liberar socket
        res.on('data', () => {});
        res.on('end', () => {
          const isUp = res.statusCode >= 200 && res.statusCode < 400;
          resolve({
            isUp,
            statusCode: res.statusCode,
            responseTimeMs,
            error: isUp ? null : `Status HTTP retornado: ${res.statusCode}`
          });
        });
      }
    );

    req.on('error', (err) => {
      const responseTimeMs = Date.now() - startTime;
      resolve({
        isUp: false,
        statusCode: null,
        responseTimeMs,
        error: err.message || 'Falha de conexão com o servidor'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTimeMs = Date.now() - startTime;
      resolve({
        isUp: false,
        statusCode: null,
        responseTimeMs,
        error: `Tempo limite esgotado (${timeoutSeconds}s)`
      });
    });

    req.end();
  });
}

/**
 * Executa o fluxo completo de monitoramento:
 * 1. Faz a checagem HTTP
 * 2. Atualiza estado e histórico
 * 3. Se estiver OFFLINE, dispara alerta Telegram de hora em hora
 * 4. Se estiver ONLINE, não notifica
 */
export async function runHealthCheck(forceCheck = false) {
  const data = loadData();
  const { config, state, history } = data;

  // Realiza a verificação
  const checkResult = await checkUrl(config.fluigUrl, config.timeoutSeconds);
  const now = new Date();
  const timestamp = now.toISOString();

  let newStatus = 'ONLINE';
  if (!checkResult.isUp) {
    newStatus = 'OFFLINE';
  } else if (checkResult.responseTimeMs > 5000) {
    newStatus = 'SLOW'; // Alerta de lentidão, mas ainda disponível
  }

  // Atualiza contadores
  const previousStatus = state.status;
  const consecutiveFailures = checkResult.isUp ? 0 : (state.consecutiveFailures || 0) + 1;

  // Registrar histórico (máximo 100 itens)
  const historyEntry = {
    id: Date.now().toString(),
    timestamp,
    status: newStatus,
    statusCode: checkResult.statusCode,
    responseTimeMs: checkResult.responseTimeMs,
    error: checkResult.error
  };

  const updatedHistory = [historyEntry, ...(history || [])].slice(0, 100);

  // Calcula % de Uptime com base no histórico
  const totalChecks = updatedHistory.length;
  const upChecks = updatedHistory.filter((h) => h.status !== 'OFFLINE').length;
  const uptimePercentage = totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(1) : 100;

  // Lógica de Notificação:
  // Dispara apenas quando OFFLINE, com intervalo mínimo de X minutos (padrão 60 min / 1 hora)
  let alertSent = false;
  let alertReason = null;

  if (newStatus === 'OFFLINE') {
    const lastAlertTime = state.lastAlertSent ? new Date(state.lastAlertSent).getTime() : 0;
    const nowTime = now.getTime();
    const alertIntervalMs = (config.alertIntervalMinutes || 60) * 60 * 1000;

    const timeSinceLastAlert = nowTime - lastAlertTime;
    const shouldSendAlert =
      !state.lastAlertSent || // Primeiro alerta
      previousStatus !== 'OFFLINE' || // Acabou de cair
      timeSinceLastAlert >= alertIntervalMs; // Já passou 1 hora desde o último alerta

    if (shouldSendAlert) {
      const horaFormatada = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const mensagem = `
🚨 <b>ALERTA DE INDISPONIBILIDADE - TOTVS FLUIG</b> 🚨

🏢 <b>Servidor:</b> ${config.serverName || 'Fluig Produção'}
🌐 <b>URL:</b> ${config.fluigUrl}
⚠️ <b>Status:</b> FORA DO AR (OFFLINE)
❌ <b>Motivo:</b> ${checkResult.error || 'Sem resposta HTTP'}
⏱️ <b>Latência/Tempo:</b> ${checkResult.responseTimeMs} ms
📅 <b>Horário:</b> ${horaFormatada}

🔔 <i>Você receberá um novo lembrete a cada ${config.alertIntervalMinutes || 60} minutos enquanto o servidor permanecer indisponível.</i>
      `.trim();

      const telegramResult = await sendTelegramAlert(
        config.telegramBotToken,
        config.telegramChatId,
        mensagem
      );

      if (telegramResult.success) {
        state.lastAlertSent = timestamp;
        alertSent = true;
        alertReason = 'Alerta de indisponibilidade enviado com sucesso';
      } else {
        alertReason = `Falha ao enviar Telegram: ${telegramResult.error || telegramResult.reason}`;
      }
    } else {
      const minutosRestantes = Math.ceil((alertIntervalMs - timeSinceLastAlert) / 60000);
      alertReason = `Silenciado (Próximo alerta em ${minutosRestantes} min se continuar offline)`;
    }
  }

  // Atualiza o estado
  state.status = newStatus;
  state.lastCheck = timestamp;
  state.lastResponseTimeMs = checkResult.responseTimeMs;
  state.lastStatusCode = checkResult.statusCode;
  state.lastError = checkResult.error;
  state.consecutiveFailures = consecutiveFailures;
  state.uptimePercentage = Number(uptimePercentage);

  data.history = updatedHistory;
  saveData(data);

  return {
    status: newStatus,
    statusCode: checkResult.statusCode,
    responseTimeMs: checkResult.responseTimeMs,
    error: checkResult.error,
    lastCheck: timestamp,
    uptimePercentage: Number(uptimePercentage),
    alertSent,
    alertReason
  };
}
