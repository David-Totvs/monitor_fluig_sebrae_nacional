# ⚡ Monitor Dinâmico de Disponibilidade - TOTVS Fluig

Aplicação web moderna desenvolvida em **Next.js / React / Node.js** para acompanhamento em tempo real da saúde, tempo de resposta e disponibilidade do servidor TOTVS Fluig, com **alertas sonoros instantâneos via Telegram Bot** no celular a cada 1 hora durante quedas ou indisponibilidades.

---

## ✨ Principais Recursos

- 📊 **Dashboard Dinâmico em Tempo Real:** Status atual (Online, Lento, Fora do Ar), % de Uptime, Código HTTP e Tempo de Resposta (ms).
- 📈 **Gráfico Interativo de Latência:** Visualização das últimas medições de latência em milissegundos.
- 📱 **Alertas Push no Celular via Telegram Bot:**
  - Dispara alerta formatado com detalhes do erro no momento em que o servidor cai.
  - **Reenvio de hora em hora** enquanto o servidor permanecer indisponível.
  - **Sem notificações quando estiver disponível**, mantendo seu celular livre de ruídos desnecessários.
  - Botão de **Teste Imediato no Celular** direto na interface.
- ⚡ **Verificação Manual Instantânea:** Botão "Verificar Agora" para testes imediatos.
- 📜 **Histórico & Logs:** Tabela com histórico detalhado das últimas 100 checagens.
- ☁️ **Hospedagem 100% Gratuita na Vercel:** Pronto com `vercel.json` para executar checagens automáticas periódicas via Vercel Cron.

---

## 🚀 Como Rodar Localmente

1. Abra o terminal na pasta do projeto:
   ```bash
   cd "C:\Users\david.allan\Documents\Antigravity projects\monitorDinamicoFluig"
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse no navegador:
   ```
   http://localhost:3000
   ```

---

## 🤖 Como Configurar o Bot do Telegram

1. Abra o Telegram no seu celular ou computador e pesquise por **`@BotFather`**.
2. Envie o comando `/newbot` e siga as instruções para definir o nome e o usuário do bot.
3. O **@BotFather** vai gerar um **Token de Acesso HTTP** (ex: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
4. Para descobrir o seu **Chat ID**:
   - Pesquise por **`@userinfobot`** no Telegram e envie qualquer mensagem. Ele responderá com o seu **`Id`** (ex: `987654321`).
5. Abra uma conversa com o seu bot recém-criado e clique em **Começar (`/start`)**.
6. No painel do Monitor Fluig, vá até a aba **"📱 Alertas Telegram"**, preencha o Token e o Chat ID e clique em **"Testar no Celular 📲"**.

---

## ☁️ Como Fazer o Deploy Gratuito no Vercel

1. Suba o código para um repositório no seu **GitHub** (público ou privado).
2. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
3. Clique em **Add New... > Project** e importe o repositório.
4. Clique em **Deploy**.
5. O monitor estará online com certificado SSL automático (HTTPS) e executando as checagens periódicas via **Vercel Cron** configurado em `vercel.json`.

---

## 🛠️ Estrutura do Projeto

```
monitorDinamicoFluig/
├── lib/
│   ├── monitor.js       # Lógica de verificação HTTP e envio de alertas no Telegram
│   └── storage.js       # Gerenciamento de estado e persistência leve
├── pages/
│   ├── api/
│   │   ├── check.js         # Endpoint de checagem manual
│   │   ├── config.js        # Endpoint de leitura/gravação de configurações
│   │   ├── cron.js          # Endpoint de agendamento automático Vercel Cron
│   │   ├── history.js       # Endpoint de histórico e métricas
│   │   └── test-telegram.js # Endpoint de teste de alerta Telegram
│   ├── _app.js          # Estrutura base da aplicação
│   └── index.js         # Dashboard visual interativo
├── styles/
│   └── globals.css      # Design System, Glassmorphism e Dark Mode
├── package.json
├── vercel.json          # Configuração do Cron Job para a Vercel
└── README.md
```
