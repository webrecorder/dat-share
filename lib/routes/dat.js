'use strict'
const Boom = require('boom')

module.exports = function(fastify, opts, next) {
  const swarmManager = fastify.swarmManager

  async function validateCollDirRequest(body) {
    if (!body) {
      throw Boom.badRequest('No request body')
    }
    if (!body.collDir) {
      throw Boom.badRequest('Did not supply collDir')
    }
    const exists = await swarmManager.canShareDir(body.collDir)
    if (!exists) {
      throw Boom.notFound(
        'The collection requested to be shared does not exist',
        body.collDir
      )
    }
  }

  fastify.route({
    method: 'POST',
    url: '/share',
    schema: {
      body: {
        type: 'object',
        properties: {
          collDir: { type: 'string' },
          metadata: {
            type: 'object',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            dat: { type: 'string' },
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
    async handler(request, reply) {
      await validateCollDirRequest(request.body)
      const { collDir, metadata } = request.body
      const dat = await swarmManager.shareDir(collDir, { metadata })
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
        400: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
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
    async handler(request, reply) {
      await validateCollDirRequest(request.body)
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
        400: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
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
    async handler(request, reply) {
      await validateCollDirRequest(request.body)
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
          dirs: {
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
                  dir: { type: 'string' },
                },
              },
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  dir: { type: 'string' },
                },
              },
            },
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
    async handler(request, reply) {
      if (!request.body) {
        throw Boom.badRequest('No request body')
      }
      if (!request.body.dirs) {
        throw Boom.badRequest('Did not supply collDir')
      }
      return await swarmManager.bulkShare(request.body)
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
      const num = await swarmManager.numSharing()
      return { num }
    },
  })

  fastify.route({
    method: 'GET',
    url: '/numDats',
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
      return { num: swarmManager.numDats() }
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
