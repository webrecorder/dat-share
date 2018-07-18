const fp = require('fastify-plugin')

module.exports =
  process.env.NODE_ENV === 'production'
    ? require('fastify-boom')
    : fp(
        function fastifyErrorPage(fastify, options, next) {
          fastify.setErrorHandler(function errorHandler(error, request, reply) {
            console.error(error)
            if (error && error.isBoom) {
              reply
                .code(error.output.statusCode)
                .type('application/json')
                .headers(error.output.headers)
                .send(error.output.payload)

              return
            }

            reply.send(error || new Error('Got non-error: ' + error))
          })

          next()
        },
        {
          fastify: '>=0.43',
          name: 'fastify-boom',
        }
      )
