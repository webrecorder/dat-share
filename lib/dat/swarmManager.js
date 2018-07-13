'use strict'
const fp = require('fastify-plugin')
const fs = require('fs-extra')
const path = require('path')
const EventEmitter = require('eventemitter3')
const swarmDefaults = require('dat-swarm-defaults')
const discoverySwarm = require('discovery-swarm')
const hypercoreProtocol = require('hypercore-protocol')
const debug = require('debug')('SwarmManager')
const DatDB = require('./datDB')
const DatWrapper = require('./datWrapper')

class SwarmManager extends EventEmitter {
  /**
   * @param {String} rootDir
   * @param {Number} port
   */
  constructor(rootDir, port) {
    super()
    /**
     * @type {number}
     */
    this.port = port

    this.rootDir = rootDir

    /**
     * @type {Swarm}
     * @private
     */
    this._swarm = null

    /**
     * @type {Map<string, DatWrapper>}
     * @private
     */
    this._allDats = new Map()

    this._datdb = new DatDB()

    this._closeServerShutDown = false
  }

  numSharing() {
    return this._allDats.size
  }

  canShareDir(directory) {
    return fs.pathExists(path.join(this.rootDir, directory))
  }

  initSwarm() {
    this._swarm = discoverySwarm(
      swarmDefaults({
        hash: false,
        stream: info => this._replicate(info),
      })
    )

    this._swarm.on('listening', () => {
      debug('Swarm Listening...')
      this.emit('listening')
    })

    this._swarm.on('close', () => {
      if (!this._closeServerShutDown) {
        debug('swarm closed but not server we have an issue')
      } else {
        debug('swarm closed')
      }
    })

    this._swarm.on('error', err => {
      debug('Swarm error: %O', err)
    })

    this._swarm.listen(this.port)
  }

  _shareDat(dat, dir, dk) {
    if (!dk) {
      dk = dat.discoveryKey('hex')
    }
    dat.joinSwarm(this._swarm, () => {
      debug(`Added discoveryKey to swarm: ${dk}`)
      this._datdb.update({ dir }, { $set: { sharing: true } }).catch(error => {
        debug(`Error updating sharing info for ${dk} %O`, error)
      })
    })
  }

  async shareDir(directory, dontUpdate = false) {
    const fullDir = path.join(this.rootDir, directory)
    debug(`Share Dir: ${fullDir}`)
    const dbe = await this._datdb.findOne({ dir: fullDir })
    if (dbe) {
      debug(`Share Dir: ${fullDir} existed in db`)
      if (this._allDats.has(dbe.discoveryKey)) {
        if (dbe.sharing) {
          debug(
            `Share Dir: ${fullDir} existed in allDats and we are sharing it`
          )
        } else {
          debug(
            `Share Dir: ${fullDir} existed in allDats and we are not sharing it`
          )
          const dat = this._allDats.get(dbe.discoveryKey)
          this._shareDat(dat, dbe.dir, dbe.discoveryKey)
        }
        return dbe.key
      }
    }
    // if not dontUpdate, auto init Dat if needed and importFiles, then add to swarm
    const dat = await DatWrapper.from(fullDir)
    dat.dir = fullDir
    if (!dontUpdate) {
      await dat.importFilesAsync()
    }
    const dk = dat.discoveryKey('hex')
    debug(`Sharing DAT: ${dk}`)
    this._allDats.set(dk, dat)
    this._shareDat(dat, fullDir, dk)
    const datKey = dat.key('hex')
    if (!dbe) {
      this._datdb
        .insert({ dir: fullDir, discoveryKey: dk, datKey, sharing: false })
        .catch(error => {
          debug(`Error inserting into datdb ${dk} %O`, error)
        })
    }
    return datKey
  }

  async unshareDir(directory) {
    const fullDir = path.join(this.rootDir, directory)
    debug(`UnShare Dir: ${fullDir}`)
    const dbe = await this._datdb.findOne({ dir: fullDir })
    if (!dbe) {
      debug(`UnShare Dir: we do not have db entry for ${fullDir}`)
      return false
    }
    this._allDats.get(dbe.discoveryKey).leaveSwarm(this._swarm)
    try {
      await this._datdb.update({ dir: dbe.dir }, { $set: { sharing: false } })
    } catch (e) {
      return false
    }
    return true
  }

  async updateDir(directory) {
    const fullDir = path.join(this.rootDir, directory)
    debug(`Update Dir: ${fullDir}`)
    const dbe = await this._datdb.findOne({ dir: fullDir })
    if (!dbe) return false
    if (this._allDats.has(dbe.discoveryKey)) {
      debug(`Update Dir: ${fullDir} existed and we are updating`)
      this._allDats.get(dbe.discoveryKey).importFiles(() => {
        debug(`Update Dir: ${fullDir} existed and we are done updating`)
      })
      return true
    }
    return false
  }

  datInfo() {
    return this._datdb.getAll()
  }

  _replicate(info) {
    debug('replicating', info)
    const stream = hypercoreProtocol({
      live: true,
      encrypt: true,
    })
    stream.on('error', function(err) {
      debug(`Stream Error: ${err}`)
    })

    stream.on('close', function() {
      debug('Closed Stream')
    })

    stream.on('end', function() {
      debug('Done Uploading')
    })
    // only send if channel is available?
    if (info.channel) {
      debug(`Replicating: ${info.channel.toString('hex')}`)

      stream.on('feed', dk => {
        const key = dk.toString('hex')
        if (this._allDats.has(key)) {
          debug('DAT found, uploading...')
          this._allDats.get(key).replicate(stream)
        } else {
          debug(`Dat Not Found (discoveryKey: ${key})`)
        }
      })
    } else {
      // do nothing, likely duplicate connection on same host
    }
    return stream
  }

  async close(cb) {
    await this._datdb.updateAll({ $set: { sharing: false } })
    this._closeServerShutDown = true
    this._swarm.close(cb)
  }
}

function swarmManagerPlugin(fastify, opts, next) {
  const swarmMan = new SwarmManager(opts.rootDir, opts.port)
  swarmMan.initSwarm()
  fastify
    .decorate('swarmManager', swarmMan)
    .addHook('onClose', async function close(fastify, done) {
      await fastify.swarmManager.close(done)
    })
  next()
}

module.exports = {
  fastifyPlugin: fp(swarmManagerPlugin, {
    fastify: '>=1.0.0',
    name: 'fastify-dat-swarm-manager',
  }),
  SwarmManager,
}

// const ROOT_DIR = '/home/john/WebstormProjects/dat-share/data/storage'
// const swarmMan = new SwarmManager(ROOT_DIR, 3282)
// swarmMan.initSwarm()
// swarmMan.on('listening', async () => {
//   await swarmMan.shareDir('2018-07-03/mwqbv5jxxv42txga')
// })
//
// const signals = ['SIGINT', 'SIGTERM']
// signals.forEach(sig => {
//   process.once(sig, () => {
//     swarmMan.close()
//   })
// })
