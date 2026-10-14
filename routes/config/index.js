/**
 * Exposes selected server-side configurations to the client-side
 **/
var express = require('express');
var server = module.exports = express();
var configuration = require('../../lib/configuration');
var configData;

server.get('/config/studio-hotjar-analytics.json', function (req, res) {
  var settings = configuration.getConfig('studioHotjarAnalytics') || {};
  var tagId = typeof settings.tagId === 'string' ? settings.tagId.trim() : '';
  var requireConsent = settings.requireConsent !== false;
  var enabled = settings.enabled === true && /^[a-f0-9]{13}$/.test(tagId);

  res.set('Cache-Control', 'no-store');
  return res.json({
    enabled: enabled,
    tagId: enabled ? tagId : '',
    requireConsent: requireConsent
  });
});

server.get('/config/config.json', function (req, res, next) {
  if (!configData) {
    configData = configuration.getAllClientSideConfigs();
  } 

  return res.json(configData);
});
