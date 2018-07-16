const fastify = require('./lib/server')

const start = async () => {
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
  try {
    const address = await fastify.listen(3000, host)
    console.log(`server listening on ${address}`)
    fastify.log.info(`server listening on ${address}`)
  } catch (err) {
    console.error(err)
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
