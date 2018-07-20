'use strict'
const Boom = require('boom')

function datRoutesInit(fastify, opts, next) {
  /** @type {SwarmManager} */
  const swarmManager = fastify.swarmManager

  async function validateCollDirRequest(body) {
    if (!body) {
      throw Boom.badRequest('No request body')
    }
    if (!body.collDir) {
      throw Boom.badRequest('Did not supply collDir')
    }
    fastify.log.info(swarmManager.actualDirPath(body.collDir))
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
    url: '/init',
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
            discoveryKey: { type: 'string' },
            datKey: { type: 'string' },
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
      const { collDir } = request.body
      return swarmManager.initDat(collDir)
    },
  })

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
            discoveryKey: { type: 'string' },
            datKey: { type: 'string' },
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
      const { collDir } = request.body
      return swarmManager.shareDir(collDir)
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
      const { collDir } = request.body
      return { success: swarmManager.unshareDir(collDir) }
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
      return { success: swarmManager.updateDir(request.body.collDir) }
    },
  })

  fastify.route({
    method: 'POST',
    url: '/sync',
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
                  discoveryKey: { type: 'string' },
                  datKey: { type: 'string' },
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
      return await swarmManager.sync(request.body)
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

  next()
}

module.exports = datRoutesInit
