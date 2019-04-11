#!/usr/bin/env node
'use strict';
const util = require('util');
const config = require('./lib/config');
const initServer = require('./lib/initServer');

console.log(
  `Dat Share API server starting with config\n${util.inspect(config, {
    depth: null,
    compact: false,
  })}\n`
);

initServer(config).catch(error => {
  console.error(error);
});
