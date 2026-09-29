import fs from 'fs';
import path from 'path';

// Caminho para armazenamento local temporário/persistente
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'monitor_data.json');

// Variáveis de ambiente da Vercel / Upstash KV
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Configuração padrão com fallback para variáveis de ambiente
export const DEFAULT_DATA = {
  config: {
    fluigUrl: process.env.FLUIG_URL || 'https://processos.sebrae.com.br',
    timeoutSeconds: Number(process.env.TIMEOUT_SECONDS) || 15,
    expectedStatusCodes: [200, 301, 302],
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    alertIntervalMinutes: Number(process.env.ALERT_INTERVAL_MINUTES) || 60,
    checkIntervalMinutes: 5,
    serverName: process.env.SERVER_NAME || 'Fluig Produção',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123'
  },
  state: {
    status: 'UNKNOWN',
    lastCheck: null,
    lastResponseTimeMs: null,
    lastStatusCode: null,
    lastError: null,
    lastAlertSent: null,
    consecutiveFailures: 0,
    uptimePercentage: 100
  },
  history: []
};

// Cache em memória
let memoryStore = JSON.parse(JSON.stringify(DEFAULT_DATA));

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Ignora erro em ambientes serverless read-only
  }
}

/**
 * Carrega os dados de forma assíncrona com suporte a Vercel KV / Upstash Redis
 */
export async function loadData() {
  // 1. Tenta carregar do Upstash Redis / Vercel KV se configurado
  if (KV_URL && KV_TOKEN) {
    try {
      const res = await fetch(`${KV_URL}/get/fluig_monitor_data`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: 'no-store'
      });
      const json = await res.json();
      if (json && json.result) {
        const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
        memoryStore = {
          config: { ...DEFAULT_DATA.config, ...(parsed.config || {}) },
          state: { ...DEFAULT_DATA.state, ...(parsed.state || {}) },
          history: parsed.history || []
        };
        return memoryStore;
      }
    } catch (e) {
      console.warn('[Storage] Erro ao carregar do Vercel KV / Upstash:', e.message);
    }
  }

  // 2. Fallback para arquivo local (desenvolvimento)
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      memoryStore = {
        config: { ...DEFAULT_DATA.config, ...(parsed.config || {}) },
        state: { ...DEFAULT_DATA.state, ...(parsed.state || {}) },
        history: parsed.history || []
      };
    }
  } catch (err) {
    // Mantém memoryStore
  }

  return memoryStore;
}

/**
 * Salva os dados de forma assíncrona com suporte a Vercel KV / Upstash Redis
 */
export async function saveData(data) {
  memoryStore = data;

  // 1. Salva no Vercel KV / Upstash Redis se configurado
  if (KV_URL && KV_TOKEN) {
    try {
      await fetch(`${KV_URL}/set/fluig_monitor_data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return true;
    } catch (e) {
      console.warn('[Storage] Erro ao salvar no Vercel KV / Upstash:', e.message);
    }
  }

  // 2. Fallback para arquivo local (desenvolvimento)
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Ignora erro em Vercel Serverless
  }

  return true;
}
