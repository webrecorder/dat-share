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
   * @param {string} rootDir
   * @param {number} port
   */
  constructor(rootDir, port) {
    super()
    /**
     * @type {number}
     */
    this.port = port

    /**
     * @type {string}
     */
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

    /**
     * @type {DatDB}
     * @private
     */
    this._datdb = new DatDB()

    /**
     * @desc indicates if the the swarm close event was caused by us closing it
     * @type {boolean}
     * @private
     */
    this._closeServerShutDown = false

    this._replicate = this._replicate.bind(this)
  }

  /**
   * @desc Returns the number of managed dats that we are actively sharing
   * @return {Promise<number>}
   */
  numSharing() {
    return this._datdb.count({
      $where: function() {
        return this.sharing
      },
    })
  }

  /**
   * @desc Retrieve the number of managed dats
   * @return {number}
   */
  numDats() {
    return this._allDats.size
  }

  /**
   * @desc Checks for the existence (sharability) of the supplied dir path
   * @param {string} directory
   * @return {Promise<boolean>}
   */
  canShareDir(directory) {
    return fs.pathExists(path.join(this.rootDir, directory))
  }

  /**
   * @desc Initialize the swarm and re-init dats from state
   */
  initSwarm() {
    this._swarm = discoverySwarm(
      swarmDefaults({
        hash: false,
        stream: this._replicate,
      })
    )

    this._swarm.on('listening', () => {
      debug('Swarm Listening...')
      this.emit('listening')
      this._postSwarmListeningInit().catch(error => {
        console.error(error)
      })
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

  /**
   * @desc Bulk share directories
   * @param {Array<string | {dir: string, metadata?: Object}>} dirs
   * @return {Promise<{results: Array<{dir: string, dat: string}>, errors: Array<{dir: string, error: string}>}>}
   */
  async bulkShare({ dirs }) {
    const shared = { results: [], errors: [] }
    for (let i = 0; i < dirs.length; ++i) {
      const toShare = dirs[i]
      let dir
      let metadata
      if (typeof toShare === 'object') {
        dir = toShare.dir
        metadata = toShare.metadata
      } else {
        dir = toShare
      }
      const canShare = await this.canShareDir(dir)
      if (!canShare) {
        shared.errors.push({
          dir,
          error: `Directory ${dir} can not be shared`,
        })
        continue
      }
      try {
        const datKey = await this.shareDir(dir, { metadata })
        shared.results.push({ dir, dat: datKey })
      } catch (e) {
        shared.errors.push({ dir, error: e.toString() })
      }
    }
    return shared
  }

  /**
   * @desc Share a directory using dat.
   * @param {string} directory
   * @param {{metadata: ?Object, dontUpdate: ?boolean}} [options]
   * @return {Promise<string>}
   */
  async shareDir(directory, { metadata, dontUpdate } = {}) {
    const fullDir = path.join(this.rootDir, directory)
    debug(`Share Dir: ${fullDir}`)
    const { dbe, noInit } = await this._checkExistingDatShare(fullDir)
    if (dbe && noInit) {
      // we already init this dat and are sharing it
      debug(`Already sharing init DAT: ${dbe.datKey}`)
      return dbe.datKey
    }
    // we maybe know about this dat but have not init it or are sharing it
    const { dk, datKey, dat } = await this._initDat(
      fullDir,
      dontUpdate,
      dbe != null
    )
    if (metadata) {
      dat.jsonCreate(metadata).catch(error => {
        debug(`Sharing DAT: error creating metadata ${error}`)
      })
    }
    debug(`Sharing DAT: ${dk}`)
    this._shareDat(dat, fullDir, dk)
    return datKey
  }

  /**
   * @desc Stop sharing a directory
   * @param {string} directory
   * @return {Promise<boolean>}
   */
  async unshareDir(directory) {
    const fullDir = path.join(this.rootDir, directory)
    debug(`UnShare Dir: ${fullDir}`)
    const dbe = await this._datdb.findOne({ dir: fullDir })
    if (!dbe) {
      debug(`UnShare Dir: we do not have db entry for ${fullDir}`)
      return false
    }
    if (!dbe.sharing) {
      return true
    }
    this._allDats.get(dbe.discoveryKey).leaveSwarm(this._swarm)
    try {
      await this._datdb.updateSharingStatus(dbe.dir, false)
    } catch (e) {
      return false
    }
    return true
  }

  /**
   * @desc Update the files sharing for a dat
   * @param {string} directory
   * @return {Promise<boolean>}
   */
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

  /**
   * @desc Retrieve the dat state from the db
   * @return {Promise<Object[]>}
   */
  datInfo() {
    return this._datdb.getAll()
  }

  close(cb) {
    this._closeServerShutDown = true
    this._swarm.close(cb)
  }

  /**
   * @desc Checks to see if the directory to be shared is tracked and already inited.
   * If the directory corresponds to a dat in the db, dbe will not be null
   * If the corresponding dir has a dat that we know about and we have already
   * init the directory, noInit is true.
   * @param {string} dir
   * @return {Promise<{dbe?: Object, noInit: boolean}>}
   * @private
   */
  async _checkExistingDatShare(dir) {
    const dbe = await this._datdb.findOne({ dir })
    const results = { dbe, noInit: false }
    if (dbe) {
      debug(`Share Dir: ${dir} existed in db`)
      if (this._allDats.has(dbe.discoveryKey)) {
        results.noInit = true
        if (dbe.sharing) {
          debug(`Share Dir: ${dir} existed in allDats and we are sharing it`)
        } else {
          debug(
            `Share Dir: ${dir} existed in allDats and we are not sharing it`
          )
          const dat = this._allDats.get(dbe.discoveryKey)
          this._shareDat(dat, dbe.dir, dbe.discoveryKey)
        }
      }
    }
    return results
  }

  /**
   * @desc Initialize a dat
   * @param {string} dir
   * @param {boolean} dontUpdate
   * @param {boolean} [inDB = false]
   * @return {Promise<{dk: string, datKey: string, dat: DatWrapper}>}
   * @private
   */
  async _initDat(dir, dontUpdate, inDB = false) {
    const dat = await DatWrapper.from(dir)
    if (!dontUpdate) {
      await dat.importFilesAsync()
    }
    const dk = dat.discoveryKey('hex')
    const datKey = dat.key('hex')
    this._allDats.set(dk, dat)
    if (!inDB) {
      this._datdb
        .insert({ dir, discoveryKey: dk, datKey, sharing: false })
        .catch(error => {
          debug(`Error inserting into datdb ${dk} %O`, error)
        })
    }
    return { dk, datKey, dat }
  }

  /**
   * @desc Reinitialize dat state after shutdown
   * @return {Promise<void>}
   * @private
   */
  async _postSwarmListeningInit() {
    // retrieve state
    const dbDats = await this._datdb.getAll()
    if (dbDats.length > 0) {
      // if we had state, restore it
      await Promise.all(
        dbDats.map(async dbdat => {
          const { dk, dat } = await this._initDat(dbdat.dir, true, true)
          if (dbdat.sharing) {
            debug(`PostSwarmListeningInit DAT: ${dk}`)
            dat.joinSwarm(this._swarm, error => {
              if (error) {
                debug(
                  `PostSwarmListeningInit error sharing dat ${dk}: %O`,
                  error
                )
              } else {
                debug(
                  `PostSwarmListeningInit added discoveryKey to swarm: ${dk}`
                )
              }
            })
          }
        })
      )
    }
  }

  /**
   * @desc Replicate a dat if the streams discovery key (dk) is known to us
   * @param info
   * @return {Protocol}
   * @private
   */
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

  /**
   * @desc Start sharing the supplied dat by having it join the swarm
   * @param {DatWrapper} dat
   * @param {string} dir
   * @param {string} dk
   * @private
   */
  _shareDat(dat, dir, dk) {
    if (!dk) {
      dk = dat.discoveryKey('hex')
    }
    dat.joinSwarm(this._swarm, () => {
      debug(`Added discoveryKey to swarm: ${dk}`)
      this._datdb.updateSharingStatus(dir, true).catch(error => {
        debug(`Error updating sharing info for ${dk} %O`, error)
      })
    })
  }
}

function swarmManagerPlugin(fastify, opts, next) {
  const swarmMan = new SwarmManager(opts.rootDir, opts.port)
  swarmMan.initSwarm()
  fastify
    .decorate('swarmManager', swarmMan)
    .addHook('onClose', function close(fastify, done) {
      fastify.swarmManager.close(done)
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
