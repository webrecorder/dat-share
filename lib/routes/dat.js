'use strict';
const Boom = require('boom');

/**
 * @desc Initialize the dat-share routes
 */
function datRoutesInit(fastify, opts, next) {
  /** @type {SwarmManager} */
  const swarmManager = fastify.swarmManager;

  async function validateCollDirRequest(body) {
    if (!body) {
      throw Boom.badRequest('No request body');
    }
    if (!body.collDir) {
      throw Boom.badRequest('Did not supply collDir');
    }
    fastify.log.info(swarmManager.actualDirPath(body.collDir));
    const exists = await swarmManager.canShareDir(body.collDir);
    if (!exists) {
      throw Boom.notFound(
        'The collection requested to be shared does not exist',
        body.collDir
      );
    }
  }

  fastify.route({
    method: 'POST',
    url: '/init',
    schema: {
      description:
        `Initialize a collection's dat and receive the collections discovery and dat key.
         If the collection was previously initialized and or currently being shared,` +
        `no action is performed other than to return it's discovery and dat key.`,
      summary: `Initialize a collection's dat`,
      tags: ['dat'],
      body: {
        type: 'object',
        properties: {
          collDir: {
            type: 'string',
            description: 'Path to the collection to be initialized',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            discoveryKey: {
              type: 'string',
              description: 'The discovery key associated with the collection',
            },
            datKey: {
              type: 'string',
              description: 'The dat key associated with the collection',
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: {
              type: 'string',
              description: 'The type of Error thrown',
            },
            message: {
              type: 'string',
              description: 'The thrown Errors message',
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: {
              type: 'string',
              description: 'The type of Error thrown',
            },
            message: {
              type: 'string',
              description: 'The thrown Errors message',
            },
          },
        },
      },
    },
    async handler(request, reply) {
      const { collDir } = request.body;
      return swarmManager.initDat(collDir);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/share',
    schema: {
      description: `Import the collections files and start sharing a collection via the dat protocol. 
      If the collection was not previously initialized it is initialized.`,
      summary: 'Start sharing a collection via the dat protocol.',
      tags: ['dat'],
      body: {
        type: 'object',
        properties: {
          collDir: {
            type: 'string',
            description: 'Path to the collection to be shared',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            discoveryKey: {
              type: 'string',
              description: 'The discovery key associated with the collection',
            },
            datKey: {
              type: 'string',
              description: 'The dat key associated with the collection',
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: {
              type: 'string',
              description: 'The type of Error thrown',
            },
            message: {
              type: 'string',
              description: 'The thrown Errors message',
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: {
              type: 'string',
              description: 'The type of Error thrown',
            },
            message: {
              type: 'string',
              description: 'The thrown Errors message',
            },
          },
        },
      },
    },
    async handler(request, reply) {
      await validateCollDirRequest(request.body);
      const { collDir } = request.body;
      return swarmManager.shareDir(collDir);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/unshare',
    schema: {
      description: 'Stop sharing a collection via the dat protocol.',
      summary: 'Stop sharing a collection via the dat protocol.',
      tags: ['dat'],
      body: {
        type: 'object',
        collDir: {
          type: 'string',
          description: 'Path to the collection to be un-shared',
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Default response',
          properties: {
            success: {
              type: 'boolean',
              description:
                'Indicates if the un-share operation was successful or not',
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: {
              type: 'string',
              description: 'The type of Error thrown',
            },
            message: {
              type: 'string',
              description: 'The thrown Errors message',
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: {
              type: 'string',
              description: 'The type of Error thrown',
            },
            message: {
              type: 'string',
              description: 'The thrown Errors message',
            },
          },
        },
      },
    },
    async handler(request, reply) {
      await validateCollDirRequest(request.body);
      const { collDir } = request.body;
      return { success: swarmManager.unshareDir(collDir) };
    },
  });

  fastify.route({
    method: 'POST',
    url: '/sync',
    schema: {
      description:
        'Sync collections currently being shared by un-sharing all ' +
        'collection not provided in the post-body and share any that were not being shared.',
      summary: 'Sync collections currently being shared',
      tags: ['dat'],
      body: {
        type: 'object',
        properties: {
          dirs: {
            type: 'array',
            description: `List of collection paths to be sync'd`,
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
              description: 'The successful results of the sync',
              items: {
                type: 'object',
                properties: {
                  discoveryKey: {
                    type: 'string',
                    description:
                      'The discovery key associated with the collection',
                  },
                  datKey: {
                    type: 'string',
                    description: 'The dat key associated with the collection',
                  },
                  dir: {
                    type: 'string',
                    description: `The directory sync'd`,
                  },
                },
              },
            },
            errors: {
              type: 'array',
              description:
                'The un-successful results of the sync (An error was thrown)',
              items: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    description: 'The message of the thrown Error',
                  },
                  dir: {
                    type: 'string',
                    description: `The directory not sync'd`,
                  },
                },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: {
              type: 'string',
              description: 'The type of Error thrown',
            },
            message: {
              type: 'string',
              description: 'The thrown Errors message',
            },
          },
        },
      },
    },
    async handler(request, reply) {
      if (!request.body) {
        throw Boom.badRequest('No request body');
      }
      if (!request.body.dirs) {
        throw Boom.badRequest('Did not supply collDir');
      }
      return swarmManager.sync(request.body);
    },
  });

  fastify.route({
    method: 'GET',
    url: '/numSharing',
    schema: {
      description: 'Retrieve the number of collections currently being shared',
      summary: 'Retrieve the number of collections currently being shared',
      tags: ['dat'],
      response: {
        200: {
          type: 'object',
          properties: {
            num: {
              type: 'number',
              description: 'The number of collections shared',
            },
          },
        },
      },
    },
    async handler(request, reply) {
      return { num: swarmManager.numSharing() };
    },
  });

  fastify.route({
    method: 'GET',
    url: '/numDats',
    schema: {
      description: 'Retrieve the number of collections with dats',
      summary: 'Retrieve the number of collections with dats',
      tags: ['dat'],
      response: {
        200: {
          type: 'object',
          properties: {
            num: {
              type: 'number',
              description: 'The number of collections with dats',
            },
          },
        },
      },
    },
    async handler(request, reply) {
      return { num: swarmManager.numDats() };
    },
  });

  next();
}

module.exports = datRoutesInit;
