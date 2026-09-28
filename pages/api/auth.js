import { loadData, saveData } from '../../lib/storage';
import crypto from 'crypto';

// Criação de token simples com base na senha
export function generateAuthToken(password) {
  return crypto.createHash('sha256').update(`${password}_monitor_fluig_secret_key`).digest('hex');
}

export function verifyAuth(req) {
  const data = loadData();
  const currentPassword = data.config?.adminPassword || process.env.ADMIN_PASSWORD || 'admin123';
  const expectedToken = generateAuthToken(currentPassword);

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.cookies?.auth_token || req.headers['x-admin-token']);

  return token === expectedToken;
}

export default function handler(req, res) {
  const data = loadData();
  const currentPassword = data.config?.adminPassword || process.env.ADMIN_PASSWORD || 'admin123';
  const expectedToken = generateAuthToken(currentPassword);

  if (req.method === 'POST') {
    const { action, password, currentPass, newPass } = req.body || {};

    // Ação: Login
    if (action === 'login' || (!action && password !== undefined)) {
      if (password === currentPassword) {
        return res.status(200).json({
          success: true,
          token: expectedToken,
          message: 'Autenticado com sucesso!'
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Senha incorreta. Tente novamente.'
        });
      }
    }

    // Ação: Troca de Senha
    if (action === 'change-password') {
      const isAuth = verifyAuth(req);
      if (!isAuth && currentPass !== currentPassword) {
        return res.status(401).json({
          success: false,
          error: 'Senha atual incorreta ou não autorizado.'
        });
      }

      if (!newPass || newPass.trim().length < 4) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha deve ter pelo menos 4 caracteres.'
        });
      }

      data.config.adminPassword = newPass.trim();
      saveData(data);

      const newToken = generateAuthToken(data.config.adminPassword);

      return res.status(200).json({
        success: true,
        token: newToken,
        message: 'Senha alterada com sucesso!'
      });
    }
  }

  // Ação: Verificar Status
  if (req.method === 'GET') {
    const isAuth = verifyAuth(req);
    return res.status(200).json({
      authenticated: isAuth
    });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ error: `Método ${req.method} não permitido` });
}
