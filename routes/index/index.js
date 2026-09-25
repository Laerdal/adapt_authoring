const configuration = require('../../lib/configuration');
const express = require('express');
const server = module.exports = express();
const origin = require('../../');
const app = origin();
const installHelper = require('../../lib/installHelpers');
const logger = require('../../lib/logger');
const permissions = require('../../lib/permissions');

let _versions = {};

server.set('views', __dirname);
server.set('view engine', 'hbs');

// Classic (legacy Backbone) UI. Was the bare "/" - moved to make way for the
// new UI, which now owns "/" (see routes/new/index.js's redirect). Publicly
// loadable pre-login, same posture root always had.
// permissions.shouldIgnore() tests this against req.url, which includes the
// query string (e.g. "/classic/?embed=translation") - the trailing "?.*"
// absorbs that, matching the convention used by the other ignoreRoute calls.
permissions.ignoreRoute(/^\/classic\/?(\?.*)?$/);

server.get('/classic', async function (req, res, next) {
  const dateStamp = new Date();
  const dateStampAsString = dateStamp.toISOString().replace(/[^0-9]/g, '');
  const isProduction = configuration.getConfig('isProduction');
  const useAnalytics = configuration.getConfig('useAnalytics') || false;
  const trackingId = configuration.getConfig('trackingId') || 'UA-XXXXX-Y';
  const versions = await getVersions();

  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.render('index', Object.assign({
    isProduction: isProduction,
    dateStampAsString: dateStampAsString,
    loading: app.polyglot.t('app.loading'),
    productName: app.polyglot.t('app.productname'),
    useAnalytics: useAnalytics,
    trackingId: trackingId
  }, versions));
});

async function getVersions() {
  if (Object.keys(_versions).length) return _versions;

  installHelper.getInstalledVersions((error, data) => {
    if (error) {
      logger.log('error', error);
    }
    _versions = data;
    return _versions;
  });
}
