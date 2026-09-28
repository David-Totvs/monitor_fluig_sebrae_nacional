const { runHealthCheck } = require('../../lib/monitor');

export default async function handler(req, res) {
  // Permite execuções automáticas do Vercel Cron ou de webhooks agendados (como Cron-job.org / UptimeRobot)
  try {
    const result = await runHealthCheck(false);
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('[Cron Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
