const express = require('express');
const database = require('../../lib/database');
const pkg = require('../../package.json');

const server = module.exports = express();

/**
 * GET /api/health
 *
 * Unauthenticated liveness + readiness probe. Returns 200 when the server and
 * database are operational, 503 when any critical check fails. Intended for
 * CI smoke gates, load-balancer health checks, and uptime monitors.
 *
 * Response shape:
 *   { status, version, uptime, timestamp, memory: { heapUsedMB, heapTotalMB, rssMB }, checks: { database } }
 */
server.get('/api/health', function(req, res) {
  database.checkConnection(function(dbError) {
    const mem = process.memoryUsage();
    const healthy = !dbError;

    const body = {
      status: healthy ? 'ok' : 'error',
      version: pkg.version,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576)
      },
      checks: {
        database: dbError ? String(dbError) : 'ok'
      }
    };

    res.status(healthy ? 200 : 503).json(body);
  });
});
