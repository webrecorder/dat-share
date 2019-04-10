'use strict';
const program = require('commander');
const chalk = require('chalk').default;
const pkg = require('../package');

/**
 * Prints a warning for invalid environment config values
 * @param {string} key
 * @param {string} value
 * @param {*} defaultValue
 */
function invalidValue(key, value, defaultValue) {
  console.log(chalk.bold.red(`Invalid value for ${key}: ${value}`));
  console.log(chalk.bold.red(`Using default value: ${defaultValue}`));
}

function convertEnvInt(key, defaultValue) {
  const envValue = process.env[key];
  let value = defaultValue;
  if (envValue != null) {
    try {
      value = parseInt(envValue, 10);
    } catch (e) {
      invalidValue(key, envValue, defaultValue);
    }
    if (isNaN(value)) {
      invalidValue(key, envValue, defaultValue);
      value = defaultValue;
    }
  }
  return value;
}

/**
 * Returns the default port the api server will listen on.
 * If the env variable SWARM_MAN_API_HOST is set returns it's value
 * otherwise returns 127.0.0.1
 * @return {string}
 */
function getDefaultHost() {
  if (process.env.SWARM_API_HOST != null) {
    return process.env.SWARM_API_HOST;
  }
  return process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
}

program
  .version(pkg.version)
  .option(
    '-p, --port [port]',
    'The port the api server is to bind to',
    convertEnvInt('SWARM_API_PORT', 3000)
  )
  .option(
    '-h, --host [host]',
    'The host address the server is listen on',
    parseInt,
    getDefaultHost()
  )
  .option(
    '-s, --swarm-port [port]',
    'The port the swarm is to bind to',
    parseInt,
    convertEnvInt('SWARM_PORT', 3282)
  )
  .option(
    '-r, --rootDir <dir>',
    'The root directory that contains the contents to be shared via dat',
    process.env.SWARM_ROOT
  )
  .option('-l, --log', 'should logging be enabled')
  .parse(process.argv);

module.exports = {
  host: program.host,
  port: program.port,
  swarmManager: {
    port: program.swarmPort,
    rootDir: program.rootDir,
  },
  fastifyOpts: {
    trustProxy: true,
    logger: program.log || process.env.LOG != null,
  },
};
