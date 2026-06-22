const express = require('express');
const http = require('http');
const https = require('https');
const configuration = require('../../lib/configuration');

const server = module.exports = express();

const DEFAULT_SUPPORT_URL = 'https://laerdal.atlassian.net/servicedesk/customer/portal/2';
const SUPPORT_CHECK_TIMEOUT_MS = 5000;

function checkUrlAvailable(urlString) {
  return new Promise((resolve) => {
    let parsedUrl;

    try {
      parsedUrl = new URL(urlString);
    } catch (error) {
      resolve({ available: false, error: 'Support URL is invalid' });
      return;
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const request = transport.request(urlString, {
      method: 'HEAD',
      timeout: SUPPORT_CHECK_TIMEOUT_MS
    }, function(response) {
      response.resume();
      const available = response.statusCode < 500;
      resolve({
        available,
        error: available ? null : 'Support portal returned status ' + response.statusCode
      });
    });

    request.on('error', function() {
      resolve({ available: false, error: 'Support portal is not reachable' });
    });

    request.on('timeout', function() {
      request.destroy();
      resolve({ available: false, error: 'Support portal check timed out' });
    });

    request.end();
  });
}

server.get('/api/support/health', async function(req, res) {
  const supportLink = configuration.getConfig('supportLink');
  const effectiveSupportUrl = supportLink || DEFAULT_SUPPORT_URL;
  const availability = await checkUrlAvailable(effectiveSupportUrl);

  const checks = {
    supportLinkConfigured: Boolean(effectiveSupportUrl),
    portalAvailable: availability.available
  };

  res.json({
    status: availability.available ? 'ok' : 'down',
    checks,
    error: availability.available ? null : availability.error,
    timestamp: new Date().toISOString()
  });
});