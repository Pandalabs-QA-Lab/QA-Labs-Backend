const service = require('../services/publicReports.service');

async function get(req, res) {
  const report = await service.getPublicReport(req.params.shareToken);
  res.json(report);
}

module.exports = { get };
