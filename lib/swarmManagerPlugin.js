'use strict';
const fp = require('fastify-plugin');
const SwarmManager = require('./dat/swarmManager');

function swarmManagerPlugin(fastify, opts, next) {
  const swarmMan = new SwarmManager(opts.rootDir, opts.port);
  fastify
    .decorate('swarmManager', swarmMan)
    .addHook('onClose', async function close(fastify, done) {
      await fastify.swarmManager.close(done);
    });
  swarmMan.initSwarm();
  next();
}

module.exports = fp(swarmManagerPlugin, {
  fastify: '>=1.0.0',
  name: 'fastify-dat-swarm-manager',
});
