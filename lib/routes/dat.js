'use strict'
const path = require('path')
const Boom = require('boom')

module.exports = function(fastify, opts, next) {
  const swarmManager = fastify.swarmManager

  async function validateCollDirRequest(request, reply, next) {
    if (!body) {
      throw Boom.badRequest('No request body')
    }
    const exists = await swarmManager.canShareDir(body.collDir)
    if (!exists) {
      throw Boom.notFound(
        'The collection requested to be shared does not exist',
        body.collDir
      )
    }
    next()
  }

  fastify.route({
    method: 'POST',
    url: '/share',
    schema: {
      body: {
        type: 'object',
        properties: {
          collDir: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            dat: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: validateCollDirRequest,
    async handler(request, reply) {
      const dat = await swarmManager.shareDir(request.body.collDir)
      return { dat }
    },
  })

  fastify.route({
    method: 'POST',
    url: '/unshare',
    schema: {
      body: {
        type: 'object',
        properties: {
          collDir: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: validateCollDirRequest,
    async handler(request, reply) {
      const success = await swarmManager.unshareDir(request.body.collDir)
      return { success }
    },
  })

  fastify.route({
    method: 'POST',
    url: '/update',
    schema: {
      body: {
        type: 'object',
        properties: {
          collDir: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: validateCollDirRequest,
    async handler(request, reply) {
      const success = await swarmManager.updateDir(request.body.collDir)
      return { success }
    },
  })

  fastify.route({
    method: 'POST',
    url: '/bulkShare',
    schema: {
      body: {
        type: 'object',
        properties: {
          dats: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dat: { type: 'string' },
                  success: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async handler(request, reply) {
      return { results: [{ dat: 'todo(John)', success: false }] }
    },
  })

  fastify.route({
    method: 'GET',
    url: '/numSharing',
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            num: {
              type: 'number',
            },
          },
        },
      },
    },
    async handler(request, reply) {
      return { num: swarmManager.numSharing() }
    },
  })

  fastify.route({
    method: 'GET',
    url: '/datInfo',
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  dir: { type: 'string' },
                  discoveryKey: { type: 'string' },
                  datKey: { type: 'string' },
                  sharing: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async handler(request, reply) {
      return { results: await swarmManager.datInfo() }
    },
  })

  next()
}
