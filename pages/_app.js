import '../styles/globals.css';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Monitor Fluig - Disponibilidade em Tempo Real</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Monitoramento dinâmico de disponibilidade e latência do servidor TOTVS Fluig com alertas via Telegram." />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%20%220%22%20%22100%22%20%22100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
