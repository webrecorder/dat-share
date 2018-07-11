const fs = require('fs-extra')
const Boom = require('boom')
const Dater = require('../dat/dater')

const dater = new Dater()

module.exports = function(fastify) {
  fastify.route({
    method: 'GET',
    url: '/datme',
    schema: {
      response: {
        200: {
          type: 'string',
          items: {
            type: 'string',
          },
        },
      },
    },
    async handler(request, reply) {
      await dater.datMe()
      return 'yes'
    },
  })
  fastify.get(
    '/list-date',
    {
      schema: {
        querystring: {
          date: { type: 'string' },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          400: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, response) => {
      if (!request.query.date) {
        throw Boom.badRequest('must supply ?date=<date wish to list>')
      }
      return fs.readdir('data/storage')
    }
  )
}
