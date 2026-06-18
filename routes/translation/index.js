const express = require('express');
const configuration = require('../../lib/configuration');

const server = module.exports = express();

server.get('/api/translation/health', function(req, res) {
  const plugins = configuration.getConfig('plugins') || {};
  const cfg = plugins['adapt-services-translation'] || {};
  const smartling = cfg.smartling || {};
  const medialocate = cfg.medialocate || {};
  const leats = cfg.leats || {};

  res.json({
    status: 'ok',
    plugin: {
      name: 'adapt-services-translation',
      enabled: cfg.isEnabled !== false
    },
    checks: {
      configPresent: Boolean(cfg && Object.keys(cfg).length),
      adapters: {
        smartling: {
          configured: Boolean(smartling.userIdentifier && smartling.userSecret)
        },
        medialocate: {
          configured: Boolean(medialocate.baseUrl || medialocate.environment)
        },
        leats: {
          configured: Boolean(leats.azureEndpoint && leats.azureApiKey && leats.deployment)
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});