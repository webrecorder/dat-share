'use strict'

const fastify = require('fastify')()

fastify.register(require('fastify-boom'))

fastify.register(require('fastify-graceful-shutdown'))

fastify.register(require('./dat/swarmManager').fastifyPlugin, {
  rootDir: process.env.ROOT_DIR,
  port: process.env.SWARM_PORT,
})

fastify.register(require('./routes/dat'))

module.exports = fastify
