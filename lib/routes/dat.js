const path = require('path')
const Boom = require('boom')
const Dater = require('../dat/dater')

const dater = new Dater()
const exportDir = process.env.exportDir

function validateRequest(body) {
  if (!body) {
    throw Boom.badRequest('Why no body')
  }
  if (!body.date && !body.dir) {
    throw Boom.badRequest('Must supply both date and dir')
  }
  if (body.date && !body.dir) {
    throw Boom.badRequest('Must supply date')
  }
  if (!body.date && body.dir) {
    throw Boom.badRequest('Must supply dir')
  }
}

module.exports = function(fastify) {
  fastify.addHook('onClose', async (instance, done) => {
    await dater.close()
    done()
  })
  fastify.route({
    method: 'POST',
    url: '/share',
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            datURL: { type: 'string' },
          },
        },
      },
    },
    async handler(request, reply) {
      const { body } = request
      validateRequest(body)
      const datURL = await dater.datMe(
        path.join(exportDir, body.date, body.dir)
      )
      return { datURL }
    },
  })
  fastify.route({
    method: 'POST',
    url: '/stop-share',
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'bool' },
          },
        },
      },
    },
    async handler(request, reply) {
      const { body } = request
      validateRequest(body)
      return {
        ok: await dater.stopDating(path.join(exportDir, body.date, body.dir)),
      }
    },
  })

  fastify.route({
    method: 'GET',
    url: '/sharing',
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    async handler(request, reply) {
      return dater.active()
    },
  })
}
