'use strict'

const fastify = require('fastify')({
  logger:
    process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
})

fastify.use(require('cors')())

fastify.register(require('./errorPlugin'))

fastify.register(require('fastify-graceful-shutdown'))

fastify.register(require('fastify-response-time'))

if (process.env.NODE_ENV === 'test') {
  module.exports = async (rootDir, port) => {
    fastify.register(require('./dat').fastifyPlugin, {
      rootDir,
      port,
    })
    fastify.register(require('./routes'))
    fastify.get('/testDump', async (requests, response) => {
      const swm = fastify.swarmManager
      return { rootDir: swm.rootDir, swarmPort: swm.port }
    })
    await fastify.listen(3000, '127.0.0.1')
    return fastify
  }
} else {
  fastify.register(require('./dat').fastifyPlugin, {
    rootDir: process.env.ROOT_DIR,
    port: process.env.SWARM_PORT,
  })

  fastify.register(require('./routes'))

  module.exports = fastify
}
