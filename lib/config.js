'use strict';
const program = require('commander');
const chalk = require('chalk').default;
const fs = require('fs-extra');
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

function validateArgs(prog) {
  const rootDir = prog.rootDir;
  let isError = false;
  if (!rootDir) {
    console.log(
      chalk.bold.red('The rootDir argument was not supplied and is required')
    );
    isError = true;
  } else if (!fs.pathExistsSync(rootDir)) {
    console.log(
      chalk.bold.red(
        `The directory specified by the rootDir argument (${rootDir}) does not exist`
      )
    );
    isError = true;
  } else if (!fs.statSync(rootDir).isDirectory()) {
    console.log(
      chalk.bold.red(
        `The value for the rootDir argument (${rootDir}) is not a directory`
      )
    );
    isError = true;
  }

  if (!isError && isNaN(prog.swarmPort)) {
    isError = true;
    console.log(
      chalk.bold.red('The value for the swarmPort argument is not a number')
    );
  }

  if (!isError && isNaN(prog.port)) {
    isError = true;
    console.log(
      chalk.bold.red('The value for the port argument is not a number')
    );
  }

  if (isError) {
    program.help(chalk.bold.red);
  }
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
    getDefaultHost()
  )
  .option(
    '-s, --swarm-port [port]',
    'The port the swarm is to bind to',
    convertEnvInt('SWARM_PORT', 3282)
  )
  .option(
    '-r, --rootDir <dir>',
    'The root directory that contains the contents to be shared via dat',
    process.env.SWARM_ROOT
  )
  .option(
    '-l --log',
    'should logging be enabled for both the api server and swarm manager'
  )
  .parse(process.argv);

if (process.env.NODE_ENV !== 'test') validateArgs(program);

if (program.log) {
  process.env.DEBUG = 'SwarmManager';
}

module.exports = {
  host: program.host,
  port: program.port,
  log: program.log,
  swarmManager: {
    port: program.swarmPort,
    rootDir: program.rootDir,
  },
  fastifyOpts: {
    trustProxy: true,
    logger: program.log,
  },
};
