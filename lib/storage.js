import fs from 'fs';
import path from 'path';

// Caminho para armazenamento local temporário/persistente
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'monitor_data.json');

// Configuração padrão
export const DEFAULT_DATA = {
  config: {
    fluigUrl: 'https://processos.sebrae.com.br',
    timeoutSeconds: 15,
    expectedStatusCodes: [200, 301, 302],
    telegramBotToken: '',
    telegramChatId: '',
    alertIntervalMinutes: 60, // Notificar a cada 1 hora se continuar indisponível
    checkIntervalMinutes: 5,
    serverName: 'Fluig Produção',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123'
  },
  state: {
    status: 'UNKNOWN', // 'ONLINE', 'OFFLINE', 'SLOW', 'UNKNOWN'
    lastCheck: null,
    lastResponseTimeMs: null,
    lastStatusCode: null,
    lastError: null,
    lastAlertSent: null,
    consecutiveFailures: 0,
    uptimePercentage: 100
  },
  history: [] // Últimas 100 checagens
};

// Cache em memória para ambientes serverless (Vercel)
let memoryStore = JSON.parse(JSON.stringify(DEFAULT_DATA));

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Em ambientes serverless read-only, usamos o memoryStore
  }
}

export function loadData() {
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
    console.warn('[Storage] Usando armazenamento em memória:', err.message);
  }
  return memoryStore;
}

export function saveData(data) {
  memoryStore = data;
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Ignora erro de escrita se estiver no ambiente Vercel Serverless
  }
}
