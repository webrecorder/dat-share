// Dat modules
const storage = require('dat-storage')
const hyperdrive = require('hyperdrive')
const hypercoreProtocol = require('hypercore-protocol')
const discoverySwarm = require('discovery-swarm')
const swarmDefaults = require('dat-swarm-defaults')
const Dat = require('dat-node')

// ===========================================================================
function initSwarm(port) {
  let swarm = discoverySwarm(
    swarmDefaults({
      hash: false,
      stream: function(info) {
        return replicate(info)
      },
    })
  )

  swarm.listen(port)

  swarm.on('error', function(err) {
    console.log(err)
  })
  swarm.on('connection', function(conn, info) {
    // not used, stream callback called instead?
    //console.log(`Conn Channel: ${info.channel.toString('hex')}`);
    //console.log(`Conn Id: ${info.id.toString('hex')}`);
    //console.log(conn);
    //console.log(info);
  })

  swarm.on('peer', function(peer) {
    console.debug(`Peer: ${peer.id}`)
  })
  return swarm
}

// ===========================================================================
function shareDir(fullDir, swarm, allDats, dontUpdate) {
  console.log(`Share Dir: ${fullDir}`)

  // if not dontUpdate, auto init Dat if needed and importFiles, then add to swarm
  if (!dontUpdate) {
    Dat(fullDir, function(err, dat) {
      if (err) {
        throw err
      }

      let importer = dat.importFiles()
      importer.on('end', function() {
        addToSwarm(dat.archive)
      })
    })

    // else, only add existing add existing dat/hyperdrive
  } else {
    let opts = {
      latest: true,
      indexing: true,
      dir: fullDir,
    }

    let datDrive = hyperdrive(storage(fullDir), null, opts)
    datDrive.on('ready', function() {
      addToSwarm(datDrive)
    })
  }

  function addToSwarm(datDrive) {
    let dk = datDrive.discoveryKey.toString('hex')
    let key = datDrive.key.toString('hex')

    console.log(`Sharing DAT: ${key}`)
    //console.log(`Sharing Discovery Key: ${dk}`);

    // map discoveryKey hex -> hyperdrive
    allDats[dk] = datDrive

    swarm.join(datDrive.discoveryKey, { announce: true }, function() {
      console.log(`Added discoveryKey to swarm: ${dk}`)
    })
  }
}

// ===========================================================================
function replicate(info) {
  let stream = hypercoreProtocol({
    live: true,
    encrypt: true,
  })

  stream.on('error', function(err) {
    console.log(`Stream Error: ${err}`)
  })

  stream.on('close', function() {
    console.log('Closed Stream')
  })

  stream.on('end', function() {
    console.log('Done Uploading')
  })

  // only send if channel is available?
  if (info.channel) {
    console.log(`Replicating: ${info.channel.toString('hex')}`)

    stream.on('feed', doSend)

    function doSend(dk) {
      console.log(arguments)
      var dk = dk.toString('hex')

      var datDrive = allDats[dk]

      if (datDrive) {
        console.log('DAT found, uploading...')
        datDrive.replicate({
          stream: stream,
          live: false,
          upload: true,
          download: false,
        })
      } else {
        console.log(`Dat Not Found (discoveryKey: ${dk})`)
      }
    }
  } else {
    // do nothing, likely duplicate connection on same host
  }

  return stream
}

// ===========================================================================
// Sample Usage
const DEFAULT_PORT = 3282

// const ROOT_DIR = '/path/to/webrecorder/data/storage/'
const ROOT_DIR = '/home/john/WebstormProjects/dat-share/data/storage'
const path = require('path')

const allDats = {}

const swarm = initSwarm(DEFAULT_PORT)

swarm.on('listening', function() {
  console.log('Swarm Listening...')

  // Add DAT Collections Here...
  shareDir(path.join(ROOT_DIR, '2018-07-03/mwqbv5jxxv42txga'), swarm, allDats)
})
