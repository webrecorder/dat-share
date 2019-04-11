dat-share
=======================

Webrecorders dat integration backend.

### Installation
To use this project you must first install its dependencies

```bash
$ yarn install
# or "npm install"
```

### Usage
dat-share provides a cli to help you use this project.

The commands available to you are displayed below 

```bash
$ ./run.js --help
Usage: run [options]

Options:
  -V, --version            output the version number
  -p, --port [port]        The port the api server is to bind to (default: 3000)
  -h, --host [host]        The host address the server is listen on (default: "127.0.0.1")
  -s, --swarm-port [port]  The port the swarm is to bind to (default: 3282)
  -r, --rootDir <dir>      The root directory that contains the contents to be shared via dat
  -l --log                 should logging be enabled for both the api server and swarm manager
  --help                   output usage information
```

Some configuration of the server can be done via the environment variables listed below
- `SWARM_API_HOST`: the host the api server will use (e.g. 127.0.0.1)
- `SWARM_API_PORT`: the port the api server will listen on (e.g. 3000)
- `SWARM_PORT`: the port the swarm will listen on (e.g. 3282)
- `SWARM_ROOT`: the root directory that contains the contents to be shared via dat
- `LOG`: should logging be enabled (exists **yes**, does not exists **no**)
- `Debug=SwarmManager`: enables logging of the actions performed by the swarm manager only 



