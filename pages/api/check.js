const { runHealthCheck } = require('../../lib/monitor');

export default async function handler(req, res) {
  try {
    const result = await runHealthCheck(true);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
