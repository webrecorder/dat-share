'use strict';

module.exports = function(fastify, opts, next) {
  fastify.register(require('./dat'));
  next();
};
