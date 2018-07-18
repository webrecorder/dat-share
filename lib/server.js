'use strict'

const fastify = require('fastify')({
  logger: process.env.NODE_ENV !== 'production',
})

fastify.use(require('cors')())

fastify.register(require('./errorPlugin'))

fastify.register(require('fastify-graceful-shutdown'))

fastify.register(require('fastify-response-time'))

fastify.register(require('./dat').fastifyPlugin, {
  rootDir: process.env.ROOT_DIR,
  port: process.env.SWARM_PORT,
})

fastify.register(require('./routes'))

module.exports = fastify
