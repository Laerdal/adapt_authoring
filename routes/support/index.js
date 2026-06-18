const express = require('express');
const configuration = require('../../lib/configuration');

const server = module.exports = express();

const DEFAULT_SUPPORT_URL = 'https://laerdal.atlassian.net/servicedesk/customer/portal/2';

server.get('/api/support/health', function(req, res) {
  const supportLink = configuration.getConfig('supportLink');

  res.json({
    status: 'ok',
    checks: {
      frontendDriven: true,
      supportLinkConfigured: Boolean(supportLink)
    },
    urls: {
      supportLink: supportLink || null,
      defaultSupportUrl: DEFAULT_SUPPORT_URL,
      effectiveSupportUrl: supportLink || DEFAULT_SUPPORT_URL
    },
    timestamp: new Date().toISOString()
  });
});