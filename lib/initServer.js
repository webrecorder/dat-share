'use strict';
const fastify = require('fastify');
const SwarmManager = require('./swarmManager');

/**
 *
 * @param {Object} config
 * @return {Promise<fastify.FastifyInstance>}
 */
module.exports = async function initServer(config) {
  const swarmMan = new SwarmManager(config.swarmManager);
  const server = fastify(config.fastifyOpts);
  server
    .decorate('conf', config)
    .decorate('swarmManager', swarmMan)
    .use(require('cors')())
    .register(require('fastify-graceful-shutdown'), { timeout: 3000 })
    .register(require('fastify-swagger'), {
      routePrefix: '/swagger',
      exposeRoute: true,
      swagger: {
        info: {
          title: 'dat-share',
          description: "Webrecorder's dat integration",
          version: require('../package').version,
        },
        host: 'localhost',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [{ name: 'dat', description: 'Dat Endpoints' }],
      },
    })
    .register(require('./errorPlugin'))
    .register(require('./routes'))
    .addHook('onClose', async (server, done) => {
      await swarmMan.close(done);
    })
    .ready(() => {
      swarmMan.initSwarm();
    });
  const listeningOn = await server.listen(config.port, config.host);
  console.log(
    `Dat Share api server listening on\n${
      listeningOn.startsWith('http://127.0.0.1')
        ? listeningOn.replace('http://127.0.0.1', 'http://localhost')
        : listeningOn
    }`
  );
  console.log(server.printRoutes());
  return server;
};
