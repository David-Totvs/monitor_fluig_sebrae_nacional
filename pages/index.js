import React, { useState, useEffect } from 'react';

export default function Dashboard() {
  const [data, setData] = useState({
    config: {
      fluigUrl: 'https://processos.sebrae.com.br',
      timeoutSeconds: 15,
      telegramBotToken: '',
      telegramChatId: '',
      alertIntervalMinutes: 60,
      serverName: 'Fluig Produção',
      isTelegramConfigured: false
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
  });

  // Autenticação
  const [authToken, setAuthToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Troca de Senha
  const [passData, setPassData] = useState({ currentPass: '', newPass: '', confirmPass: '' });
  const [changingPass, setChangingPass] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toast, setToast] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    fluigUrl: '',
    timeoutSeconds: 15,
    serverName: '',
    telegramBotToken: '',
    telegramChatId: '',
    alertIntervalMinutes: 60
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Carregar dados (aceita token explícito ou busca no localStorage/state)
  const loadDashboardData = async (tokenOverride = null) => {
    try {
      setLoading(true);
      const tokenToUse =
        tokenOverride !== null
          ? tokenOverride
          : authToken || (typeof window !== 'undefined' ? localStorage.getItem('fluig_admin_token') : '') || '';

      const headers = tokenToUse ? { Authorization: `Bearer ${tokenToUse}` } : {};
      const res = await fetch('/api/history', { headers });
      const json = await res.json();
      
      if (json.success) {
        setData(json);
        if (json.authenticated !== undefined) {
          setIsAuthenticated(Boolean(json.authenticated));
          if (!json.authenticated && tokenToUse) {
            // Se o servidor rejeitou o token existente
            localStorage.removeItem('fluig_admin_token');
            setAuthToken('');
          }
        }
        setFormData({
          fluigUrl: json.config?.fluigUrl || '',
          timeoutSeconds: json.config?.timeoutSeconds || 15,
          serverName: json.config?.serverName || '',
          telegramBotToken: json.config?.telegramBotToken || '',
          telegramChatId: json.config?.telegramChatId || '',
          alertIntervalMinutes: json.config?.alertIntervalMinutes || 60
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // Inicialização única
  useEffect(() => {
    const savedToken = localStorage.getItem('fluig_admin_token') || '';
    if (savedToken) {
      setAuthToken(savedToken);
      loadDashboardData(savedToken);
    } else {
      loadDashboardData('');
    }

    // Auto refresh a cada 30 segundos usando o token ativo
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('fluig_admin_token') || '';
      loadDashboardData(currentToken);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Se perder autenticação e estiver em aba restrita, voltar para 'overview'
  useEffect(() => {
    if (!isAuthenticated && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [isAuthenticated, activeTab]);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password: loginPassword })
      });
      const json = await res.json();
      if (json.success && json.token) {
        const token = json.token;
        localStorage.setItem('fluig_admin_token', token);
        setAuthToken(token);
        setIsAuthenticated(true);
        setShowLoginModal(false);
        setLoginPassword('');
        showToast('Autenticado com sucesso como Administrador!');
        // Atualiza imediatamente o dashboard com o novo token validado
        await loadDashboardData(token);
      } else {
        setLoginError(json.error || 'Senha incorreta.');
      }
    } catch (err) {
      setLoginError('Falha ao conectar com o servidor.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('fluig_admin_token');
    setAuthToken('');
    setIsAuthenticated(false);
    setActiveTab('overview');
    showToast('Você saiu da área administrativa.', 'info');
    loadDashboardData('');
  };

  // Alterar Senha
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passData.newPass !== passData.confirmPass) {
      showToast('A nova senha e a confirmação não coincidem.', 'error');
      return;
    }
    try {
      setChangingPass(true);
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          action: 'change-password',
          currentPass: passData.currentPass,
          newPass: passData.newPass
        })
      });
      const json = await res.json();
      if (json.success && json.token) {
        setAuthToken(json.token);
        localStorage.setItem('fluig_admin_token', json.token);
        setPassData({ currentPass: '', newPass: '', confirmPass: '' });
        showToast('Senha administrativa alterada com sucesso!');
      } else {
        showToast(json.error || 'Erro ao alterar senha', 'error');
      }
    } catch (err) {
      showToast('Falha na requisição de troca de senha', 'error');
    } finally {
      setChangingPass(false);
    }
  };

  // Executar checagem manual
  const handleManualCheck = async () => {
    try {
      setCheckingNow(true);
      const res = await fetch('/api/check');
      const json = await res.json();
      if (json.success) {
        showToast(`Verificação concluída: Servidor ${json.data.status} (${json.data.responseTimeMs}ms)`);
        await loadDashboardData();
      } else {
        showToast(json.error || 'Erro na verificação', 'error');
      }
    } catch (err) {
      showToast('Falha ao conectar com o serviço de checagem', 'error');
    } finally {
      setCheckingNow(false);
    }
  };

  // Salvar configurações
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Configurações salvas com sucesso!');
        await loadDashboardData();
      } else {
        showToast(json.error || 'Erro ao salvar', 'error');
      }
    } catch (err) {
      showToast('Falha ao salvar configurações', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Testar Telegram
  const handleTestTelegram = async () => {
    try {
      setTestingTelegram(true);
      const res = await fetch('/api/test-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          telegramBotToken: formData.telegramBotToken,
          telegramChatId: formData.telegramChatId
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message, 'success');
      } else {
        showToast(json.error || 'Erro ao testar Telegram', 'error');
      }
    } catch (err) {
      showToast('Falha na requisição de teste do Telegram', 'error');
    } finally {
      setTestingTelegram(false);
    }
  };

  // Render SVG Chart
  const renderLatencyChart = () => {
    const historyList = [...(data.history || [])].reverse().slice(-20);
    if (historyList.length < 2) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Realize mais verificações para gerar o gráfico de latência.
        </div>
      );
    }

    const maxMs = Math.max(...historyList.map((h) => h.responseTimeMs || 0), 1000);
    const width = 600;
    const height = 140;
    const padding = 20;

    const points = historyList.map((item, index) => {
      const x = padding + (index / (historyList.length - 1)) * (width - padding * 2);
      const y = height - padding - ((item.responseTimeMs || 0) / maxMs) * (height - padding * 2);
      return { x, y, ...item };
    });

    const pathD = points.reduce((acc, curr, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`;
    }, '');

    return (
      <div className="chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart">
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />

          <path
            d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
            fill="url(#latencyGradient)"
            opacity="0.25"
          />
          <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />

          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={pt.status === 'OFFLINE' ? '5' : '3.5'}
              fill={pt.status === 'OFFLINE' ? '#f43f5e' : '#06b6d4'}
              stroke="#090d16"
              strokeWidth="2"
            >
              <title>{`${new Date(pt.timestamp).toLocaleTimeString()}: ${pt.responseTimeMs}ms (${pt.status})`}</title>
            </circle>
          ))}

          <defs>
            <linearGradient id="latencyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          <span>Mais antigo</span>
          <span>Tempo Máx: {maxMs}ms</span>
          <span>Mais recente</span>
        </div>
      </div>
    );
  };

  const statusClass =
    data.state?.status === 'ONLINE'
      ? 'status-online'
      : data.state?.status === 'SLOW'
      ? 'status-slow'
      : data.state?.status === 'OFFLINE'
      ? 'status-offline'
      : 'status-slow';

  const statusLabel =
    data.state?.status === 'ONLINE'
      ? 'DISPONÍVEL / OPERACIONAL'
      : data.state?.status === 'SLOW'
      ? 'OPERACIONAL (LENTIDÃO DETECTADA)'
      : data.state?.status === 'OFFLINE'
      ? 'INDISPONÍVEL / FORA DO AR'
      : 'AGUARDANDO VERIFICAÇÃO';

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`alert-banner ${toast.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">
              Monitor Dinâmico Fluig <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(99,102,241,0.2)', color: '#818cf8', borderRadius: '6px' }}>v1.0</span>
            </h1>
            <p className="brand-subtitle">Acompanhamento contínuo de disponibilidade e alertas em tempo real</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={loadDashboardData} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Atualizar
          </button>
          
          <button className="btn btn-primary" onClick={handleManualCheck} disabled={checkingNow}>
            {checkingNow ? (
              <span>Checando...</span>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Verificar Agora
              </>
            )}
          </button>

          {/* Autenticação: Botão Login ou Logout */}
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="admin-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Admin
              </span>
              <button className="btn btn-secondary" onClick={handleLogout} title="Encerrar sessão de administrador">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sair
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setShowLoginModal(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Área Restrita
            </button>
          )}
        </div>
      </header>

      {/* Hero Status Card */}
      <div className="glass-card hero-status-card">
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            STATUS ATUAL DO SERVIDOR ({data.config?.serverName || 'Fluig'})
          </div>
          <div className={`status-badge-hero ${statusClass}`}>
            <span className="status-dot"></span>
            {statusLabel}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            URL: <strong style={{ color: '#fff' }}>{data.config?.fluigUrl}</strong>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ÚLTIMA VERIFICAÇÃO</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
            {data.state?.lastCheck ? new Date(data.state.lastCheck).toLocaleTimeString('pt-BR') : 'Nenhuma'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {data.state?.lastCheck ? new Date(data.state.lastCheck).toLocaleDateString('pt-BR') : ''}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="dashboard-grid">
        <div className="glass-card metric-card">
          <div className="metric-title">
            <span>UPTIME TOTAL</span>
            <span style={{ color: '#10b981' }}>📊</span>
          </div>
          <div className="metric-value">{data.state?.uptimePercentage || 100}%</div>
          <div className="metric-sub">Baseado nas últimas 100 checagens</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-title">
            <span>TEMPO DE RESPOSTA</span>
            <span style={{ color: '#06b6d4' }}>⚡</span>
          </div>
          <div className="metric-value">
            {data.state?.lastResponseTimeMs !== null ? `${data.state.lastResponseTimeMs} ms` : '--'}
          </div>
          <div className="metric-sub">
            {data.state?.lastResponseTimeMs > 5000 ? '⚠️ Alerta de lentidão' : 'Desempenho estável'}
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-title">
            <span>CÓDIGO HTTP</span>
            <span style={{ color: '#818cf8' }}>🌐</span>
          </div>
          <div className="metric-value">{data.state?.lastStatusCode || '--'}</div>
          <div className="metric-sub">{data.state?.lastStatusCode === 200 ? 'HTTP 200 OK' : data.state?.lastError || 'Aguardando'}</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-title">
            <span>ALERTAS TELEGRAM</span>
            <span style={{ color: '#f59e0b' }}>🔔</span>
          </div>
          <div className="metric-value" style={{ fontSize: '1.35rem' }}>
            {data.config?.isTelegramConfigured || (data.config?.telegramBotToken && data.config?.telegramChatId) ? 'Ativo' : 'Pendente'}
          </div>
          <div className="metric-sub">
            Frequência: de {data.config?.alertIntervalMinutes || 60} em {data.config?.alertIntervalMinutes || 60} min na queda
          </div>
        </div>
      </div>

      {/* Tabs Navigation (Abas protegidas ficam visíveis somente se autenticado) */}
      <div className="tabs-nav">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📈 Gráfico & Histórico
        </button>
        {isAuthenticated && (
          <>
            <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              ⚙️ Configurações do Servidor Fluig
            </button>
            <button className={`tab-btn ${activeTab === 'telegram' ? 'active' : ''}`} onClick={() => setActiveTab('telegram')}>
              📱 Alertas Push no Celular via Telegram Bot
            </button>
            <button className={`tab-btn ${activeTab === 'deploy' ? 'active' : ''}`} onClick={() => setActiveTab('deploy')}>
              🚀 Deploy no Vercel
            </button>
            <button className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
              🔑 Alterar Senha de Acesso
            </button>
          </>
        )}
      </div>

      {/* Tab: Overview & History (Visão Pública e Privada) */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Latência das Últimas Verificações (ms)
            </h3>
            {renderLatencyChart()}
          </div>

          <div className="glass-card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1rem' }}>
              Logs Detalhados de Verificação
            </h3>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Status</th>
                    <th>Código HTTP</th>
                    <th>Tempo de Resposta</th>
                    <th>Detalhes / Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history && data.history.length > 0 ? (
                    data.history.map((row) => (
                      <tr key={row.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {new Date(row.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td>
                          <span
                            className="badge-pill"
                            style={{
                              background:
                                row.status === 'ONLINE'
                                  ? 'rgba(16,185,129,0.15)'
                                  : row.status === 'SLOW'
                                  ? 'rgba(245,158,11,0.15)'
                                  : 'rgba(244,63,94,0.15)',
                              color:
                                row.status === 'ONLINE'
                                  ? '#34d399'
                                  : row.status === 'SLOW'
                                  ? '#fbbf24'
                                  : '#fb7185',
                              border: `1px solid ${
                                row.status === 'ONLINE'
                                  ? 'rgba(16,185,129,0.3)'
                                  : row.status === 'SLOW'
                                  ? 'rgba(245,158,11,0.3)'
                                  : 'rgba(244,63,94,0.3)'
                              }`
                            }}
                          >
                            ● {row.status}
                          </span>
                        </td>
                        <td>
                          <strong>{row.statusCode || '--'}</strong>
                        </td>
                        <td>
                          <span style={{ color: row.responseTimeMs > 3000 ? '#fbbf24' : '#34d399' }}>
                            {row.responseTimeMs} ms
                          </span>
                        </td>
                        <td style={{ color: row.error ? '#fb7185' : 'var(--text-muted)' }}>
                          {row.error || 'Resposta OK'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Nenhum registro no histórico. Clique em "Verificar Agora".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Settings (Privado) */}
      {isAuthenticated && activeTab === 'settings' && (
        <div className="glass-card" style={{ maxWidth: '650px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
            Configurações do Servidor Fluig
          </h2>

          <form onSubmit={handleSaveConfig}>
            <div className="form-group">
              <label className="form-label">Nome de Identificação do Servidor</label>
              <input
                type="text"
                className="form-control"
                value={formData.serverName}
                onChange={(e) => setFormData({ ...formData, serverName: e.target.value })}
                placeholder="Ex: Fluig Produção"
              />
            </div>

            <div className="form-group">
              <label className="form-label">URL do Servidor Fluig</label>
              <input
                type="url"
                required
                className="form-control"
                value={formData.fluigUrl}
                onChange={(e) => setFormData({ ...formData, fluigUrl: e.target.value })}
                placeholder="https://processos.sebrae.com.br"
              />
              <p className="form-help">URL completa que o monitor tentará acessar periodicamente.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Timeout de Conexão (segundos)</label>
              <input
                type="number"
                min="3"
                max="60"
                className="form-control"
                value={formData.timeoutSeconds}
                onChange={(e) => setFormData({ ...formData, timeoutSeconds: e.target.value })}
              />
              <p className="form-help">Tempo máximo de espera antes de considerar o servidor indisponível.</p>
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingConfig} style={{ width: '100%', marginTop: '1rem' }}>
              {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Telegram Alerts (Privado) */}
      {isAuthenticated && activeTab === 'telegram' && (
        <div className="glass-card" style={{ maxWidth: '650px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.75rem' }}>📱</div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>
                Alertas Push no Celular via Telegram Bot
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Receba alertas sonoros no seu celular sempre que o servidor estiver fora do ar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveConfig}>
            <div className="form-group">
              <label className="form-label">Telegram Bot Token</label>
              <input
                type="text"
                className="form-control"
                value={formData.telegramBotToken}
                onChange={(e) => setFormData({ ...formData, telegramBotToken: e.target.value })}
                placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              />
              <p className="form-help">
                Obtido gratuitamente com o <strong>@BotFather</strong> no Telegram.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Telegram Chat ID (Usuário, Grupo ou Múltiplos IDs)</label>
              <input
                type="text"
                className="form-control"
                value={formData.telegramChatId}
                onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                placeholder="Ex: 123456789 ou -100123456789 ou 123456, 987654"
              />
              <p className="form-help">
                Você pode informar o seu <strong>Chat ID</strong>, o ID de um <strong>Grupo</strong> (ex: <code>-100...</code>) ou <strong>múltiplos IDs separados por vírgula</strong>.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Intervalo de Reenvio na Indisponibilidade (Minutos)</label>
              <input
                type="number"
                min="10"
                max="1440"
                className="form-control"
                value={formData.alertIntervalMinutes}
                onChange={(e) => setFormData({ ...formData, alertIntervalMinutes: e.target.value })}
              />
              <p className="form-help">
                Padrão: <strong>60 minutos (1 hora)</strong>. Se o servidor continuar fora do ar, você será alertado a cada 1 hora. Quando estiver online, nenhuma notificação é enviada.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingConfig}>
                {savingConfig ? 'Salvando...' : 'Salvar Credenciais'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestTelegram}
                disabled={testingTelegram || !formData.telegramBotToken || !formData.telegramChatId}
              >
                {testingTelegram ? 'Enviando...' : 'Testar no Celular 📲'}
              </button>
            </div>
          </form>

          {/* Quick Guide */}
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '0.85rem', border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: '#818cf8', display: 'block', marginBottom: '0.5rem' }}>
              Como criar seu Bot do Telegram em 1 minuto:
            </strong>
            <ol style={{ paddingLeft: '1.25rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <li>Abra o Telegram e pesquise por <strong>@BotFather</strong>.</li>
              <li>Envie o comando <code>/newbot</code> e siga as instruções para dar um nome ao seu bot.</li>
              <li>Copie o <strong>Token</strong> gerado e cole no campo acima.</li>
              <li>Pesquise por <strong>@userinfobot</strong> no Telegram para ver seu <strong>Id</strong> (Chat ID).</li>
              <li>Abra uma conversa com o seu novo bot, clique em <strong>Começar (/start)</strong> e depois clique em "Testar no Celular".</li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab: Deploy Vercel (Privado) */}
      {isAuthenticated && activeTab === 'deploy' && (
        <div className="glass-card" style={{ maxWidth: '750px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1rem' }}>
            🚀 Como Hospedar Gratuitamente no Vercel com Cron Automático
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <div style={{ padding: '1rem', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
              <strong style={{ color: '#818cf8' }}>Por que a Vercel é ideal?</strong>
              <p style={{ marginTop: '0.25rem' }}>
                A Vercel oferece hospedagem gratuita para aplicações Next.js com suporte nativo a <strong>Vercel Cron Jobs</strong> (configurado no arquivo <code>vercel.json</code>), permitindo que o monitor execute verificações automáticas de forma 100% gratuita 24h por dia.
              </p>
            </div>

            <div>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>Passo 1: Subir o projeto para o GitHub</h4>
              <p>Crie um repositório no seu GitHub (público ou privado) e suba os arquivos desta pasta:</p>
              <pre style={{ background: '#020617', padding: '0.75rem 1rem', borderRadius: '8px', color: '#38bdf8', overflowX: 'auto', marginTop: '0.5rem' }}>
                git init{'\n'}
                git add .{'\n'}
                git commit -m "Initial commit - Fluig Monitor"{'\n'}
                git remote add origin https://github.com/SEU_USUARIO/monitor-fluig.git{'\n'}
                git push -u origin main
              </pre>
            </div>

            <div>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>Passo 2: Importar no Vercel</h4>
              <ol style={{ paddingLeft: '1.25rem' }}>
                <li>Acesse <a href="https://vercel.com" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>vercel.com</a> e faça login com sua conta do GitHub.</li>
                <li>Clique em <strong>Add New... &gt; Project</strong> e selecione o repositório <code>monitor-fluig</code>.</li>
                <li>Adicione a variável de ambiente opcional <code>ADMIN_PASSWORD</code> para definir sua senha de administrador.</li>
                <li>Clique em <strong>Deploy</strong>. Em menos de 1 minuto seu painel estará online com link seguro HTTPS!</li>
              </ol>
            </div>

            <div>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>Passo 3: Cron Automático</h4>
              <p>
                O arquivo <code>vercel.json</code> incluído no projeto já configura automaticamente o endpoint <code>/api/cron</code> para rodar de forma contínua.
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                <em>Dica Extra:</em> Você também pode cadastrar o link do seu monitor no serviço gratuito <a href="https://cron-job.org" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>cron-job.org</a> ou <a href="https://uptimerobot.com" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>uptimerobot.com</a> apontando para <code>https://seu-app.vercel.app/api/cron</code> para executar a cada 1 minuto!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Segurança & Senha (Privado) */}
      {isAuthenticated && activeTab === 'security' && (
        <div className="glass-card" style={{ maxWidth: '550px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🔑</div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>
                Alterar Senha de Acesso Administrativo
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Defina uma nova senha para proteger as configurações e credenciais do monitor.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Senha Atual</label>
              <input
                type="password"
                required
                className="form-control"
                value={passData.currentPass}
                onChange={(e) => setPassData({ ...passData, currentPass: e.target.value })}
                placeholder="Digite a senha atual"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nova Senha</label>
              <input
                type="password"
                required
                minLength={4}
                className="form-control"
                value={passData.newPass}
                onChange={(e) => setPassData({ ...passData, newPass: e.target.value })}
                placeholder="Mínimo 4 caracteres"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                minLength={4}
                className="form-control"
                value={passData.confirmPass}
                onChange={(e) => setPassData({ ...passData, confirmPass: e.target.value })}
                placeholder="Repita a nova senha"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={changingPass} style={{ width: '100%', marginTop: '1rem' }}>
              {changingPass ? 'Atualizando...' : 'Salvar Nova Senha'}
            </button>
          </form>
        </div>
      )}

      {/* Modal de Autenticação */}
      {showLoginModal && (
        <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '36px', height: '36px', background: 'rgba(99,102,241,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  🔒
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>Área Administrativa</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Acesso restrito às configurações</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowLoginModal(false)}>✕</button>
            </div>

            {loginError && (
              <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Senha de Administrador</label>
                <input
                  type="password"
                  required
                  autoFocus
                  className="form-control"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite a senha..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLoginModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.5 }} disabled={loggingIn || !loginPassword}>
                  {loggingIn ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
