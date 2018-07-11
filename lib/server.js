const fastify = require('fastify')({
  logger: true,
})

fastify.register(require('fastify-boom'))

fastify.register(require('fastify-redis'), {
  host: '127.0.0.1',
  dropBufferSupport: true,
})

fastify.register(require('fastify-graceful-shutdown'))

require('./routes')(fastify)

module.exports = fastify
