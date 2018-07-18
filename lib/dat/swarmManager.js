'use strict'
const fp = require('fastify-plugin')
const fs = require('fs-extra')
const path = require('path')
const crypto = require('crypto')
const EventEmitter = require('eventemitter3')
const swarmDefaults = require('dat-swarm-defaults')
const discoverySwarm = require('discovery-swarm')
const hypercoreProtocol = require('hypercore-protocol')
const debug = require('debug')('SwarmManager')
const DatWrapper = require('./datWrapper')

/**
 * @desc Class for managing the discovery swarm and dats shared
 */
class SwarmManager extends EventEmitter {
  /**
   * @desc Construct a new instance of SwarmManager
   * @param {string} rootDir - The root path of the directories to be shared
   * @param {number} port - The port the discovery swarm will listen on
   */
  constructor(rootDir, port) {
    super()

    /**
     * @desc The port the discovery swarm will listen on
     * @type {number}
     */
    this.port = port

    /**
     * @desc The root path of the directories to be shared
     * @type {string}
     */
    this.rootDir = rootDir

    /**
     * @desc The discovery swarm instance
     * @type {Swarm}
     * @private
     */
    this._swarm = null

    /**
     * @desc A map of active discovery keys to their dats
     * @type {Map<string, DatWrapper>}
     * @private
     */
    this._dkToDat = new Map()

    /**
     * @desc A map of active dat directories to their discovery key
     * @type {Map<string, string>}
     * @private
     */
    this._dirToDk = new Map()

    /**
     * @desc indicates if the the swarm close event was caused by us closing it
     * @type {boolean}
     * @private
     */
    this._closeServerShutDown = false

    /**
     * @desc An id for ourselves
     * @type {Buffer}
     */
    this.networkId = crypto.randomBytes(32)
    this._connIdCounter = 0 // for debugging

    this._replicate = this._replicate.bind(this)
  }

  /**
   * @desc Returns the number of managed dats that we are actively sharing
   * @return {number}
   */
  numSharing() {
    let sharing = 0
    for (const dw of this._dkToDat.values()) {
      if (dw.sharing()) {
        sharing += 1
      }
    }
    return sharing
  }

  /**
   * @desc Retrieve the number of managed dats
   * @return {number}
   */
  numDats() {
    return this._dkToDat.size
  }

  /**
   * @desc Retrieve the tracked dat associated wih the supplied discovery key
   * @param {string} discoveryKey - The discoveryKey associated with an active dat
   * @return {DatWrapper | undefined} - The dat associated with the discovery key if it exists
   */
  getDat(discoveryKey) {
    return this._dkToDat.get(discoveryKey)
  }

  /**
   * @desc Retrieve the discoveryKey associated with the supplied directory
   * @param {string} dir - The directory to retrieve the discoveryKey for
   * @return {string | undefined} - The discovery key associated with the directory if it exists
   */
  getDiscoveryKeyForDir(dir) {
    return this._dirToDk.get(dir)
  }

  /**
   * @desc Retrieve the tracked dat associated wih the supplied directory
   * @param {string} dir - The full path to a actively shared directory
   * @return {DatWrapper | undefined} - The actively shared dat if it exists
   */
  getDatForDir(dir) {
    if (!dir.startsWith(this.rootDir)) {
      dir = this._actualDirPath(dir)
    }
    const dk = this.getDiscoveryKeyForDir(dir)
    return this.getDat(dk)
  }

  /**
   * @desc Determine if we are actively managing the directory
   * @param {string} dir - The directory to check
   * @return {boolean} - True if the directory is actively shared otherwise false
   */
  isActiveDir(dir) {
    return this._dirToDk.has(dir)
  }

  /**
   * @desc Determine if the supplied discovery key is associated with an active dat
   * @param {string} discoveryKey - The discovery key to check
   * @return {boolean} - True if the discovery key is associated with an active dat otherwise false
   */
  isActiveDiscoveryKey(discoveryKey) {
    return this._dkToDat.has(discoveryKey)
  }

  /**
   * @desc Checks for the existence (sharability) of the supplied dir path
   * @param {string} directory - The directory under {@link rootDir} to check if it exists (can be shared)
   * @return {Promise<boolean>} - True if the directory can be shared otherwise false
   */
  canShareDir(directory) {
    return fs.pathExists(this._actualDirPath(directory))
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
      // this._postSwarmListeningInit().catch(error => {
      //   console.error(error)
      // })
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

  _doSync(toSync) {
    const keep = new Set()
    for (let i = 0; i < toSync.length; ++i) {
      let sync = toSync[i]
      keep.add(this._actualDirPath(sync))
    }
    for (const [haveDir, dk] of this._dirToDk.entries()) {
      if (!keep.has(haveDir)) {
        this.unshareDir(haveDir)
        this._dirToDk.delete(haveDir)
        this._dkToDat.delete(dk)
      }
    }
  }

  /**
   * @desc Bulk share directories
   * @param {Object} toSync
   * @property {Array<string>} toSync.dirs
   * @return {Promise<{results: Array<{dir: string, discoveryKey: string, datKey: string}>, errors: Array<{dir: string, error: string}>}>}
   */
  async sync({ dirs }) {
    this._doSync(dirs)
    const shared = { results: [], errors: [] }
    for (let i = 0; i < dirs.length; ++i) {
      const toShare = dirs[i]
      const canShare = await this.canShareDir(toShare)
      if (!canShare) {
        shared.errors.push({
          toShare,
          error: `Directory ${toShare} can not be shared`,
        })
        continue
      }
      try {
        const results = await this.shareDir(toShare)
        results.dir = toShare
        shared.results.push(results)
      } catch (e) {
        shared.errors.push({ dir, error: e.toString() })
      }
    }
    return shared
  }

  /**
   * @desc Share a directory using dat.
   * @param {string} directory - The directory to share via dat
   * @param {Object?} [metadata] - Optional metadata to be added to the dat's `dat.json`
   * @return {Promise<{discoveryKey: string, datKey: string}>} - Information about the dat
   */
  async shareDir(directory, metadata) {
    const actualPath = this._actualDirPath(directory)
    if (this.isActiveDir(actualPath)) {
      const discoveryKey = this.getDiscoveryKeyForDir(actualPath)
      const existingDat = this.getDat(discoveryKey)
      await existingDat.importFiles()
      if (!existingDat.sharing()) {
        this._shareDat(existingDat, discoveryKey)
      }
      return { discoveryKey, datKey: existingDat.key('hex') }
    }
    debug(`Share Dir: ${actualPath}`)
    // we maybe know about this dat but have not init it or are sharing it
    const { discoveryKey, datKey, dat } = await this._initDat(
      actualPath,
      metadata
    )
    debug(`Sharing DAT: ${datKey}`)
    this._shareDat(dat, discoveryKey)
    return { discoveryKey, datKey }
  }

  /**
   * @desc Stop sharing a directory
   * @param {string} directory - The directory to unshare
   * @return {boolean} - True if the directory was unshared otherwise false
   */
  unshareDir(directory) {
    const actualPath = this._actualDirPath(directory)
    debug(`UnShare Dir: ${actualPath}`)
    if (!this.isActiveDir(directory)) {
      return false
    }
    const discoveryKey = this.getDiscoveryKeyForDir(actualPath)
    const existingDat = this.getDat(discoveryKey)
    if (!existingDat.sharing()) {
      return true
    }
    existingDat.leaveSwarm(this._swarm)
    this._unmarkDatAsActive(actualPath, discoveryKey)
    return true
  }

  /**
   * @desc Update the files sharing for a dat
   * @param {string} directory - Full path to the directory to re-import files from
   * @return {boolean} - True if the import is scheduled to happen otherwise false
   */
  updateDir(directory) {
    const actualPath = this._actualDirPath(directory)
    debug(`Update Dir: ${actualPath}`)
    if (!this.isActiveDir(actualPath)) {
      return false
    }
    const existingDat = this.getDatForDir(actualPath)
    if (!existingDat.sharing()) {
      return false
    }
    existingDat.importFiles().catch(error => {
      debug(`An error occurred updating ${directory} %O`, error)
    })
    return true
  }

  /**
   * @desc Close the swarm connection
   * @param {function} [cb] - Optional callback that is called once the swarm connection was closed
   */
  close(cb) {
    this._closeServerShutDown = true
    this._swarm.close(() => {
      this._clearActive()
      if (cb) cb()
    })
  }

  /**
   * @desc Clear the active dat state
   * @private
   */
  _clearActive() {
    this._dirToDk.clear()
    this._dkToDat.clear()
  }

  /**
   * @desc Convert a path to a directory under {@link rootDir} to its full fs path
   * @param {string} directory - A directory under {@link rootDir}
   * @return {string} - The full path to the directory
   * @private
   */
  _actualDirPath(directory) {
    if (directory.startsWith(this.rootDir)) {
      return directory
    }
    return path.join(this.rootDir, directory)
  }

  /**
   * @desc Initialize a dat
   * @param {string} dir - The full path to the directory to initialize the dat in
   * @param {Object?} [metadata] - Optional metadata to add to the dats `dat.json`
   * @return {Promise<{discoveryKey: string, datKey: string, dat: DatWrapper}>}
   * @private
   */
  async _initDat(dir, metadata) {
    const dat = await DatWrapper.from(dir)
    await dat.jsonCreateOrUpdate(metadata)
    await dat.importFiles()
    const discoveryKey = dat.discoveryKey('hex')
    const datKey = dat.key('hex')
    this._markDatAsActive(dir, discoveryKey, dat)
    return { discoveryKey, datKey, dat }
  }

  /**
   * @desc Add dat information to the tracking state
   * @param {string} dir - The directory path to associate with the discovery key
   * @param {string} discoveryKey - The discoveryKey to associate with the Dat
   * @param {DatWrapper} dat - The dat associated with the dir and discovery key
   * @private
   */
  _markDatAsActive(dir, discoveryKey, dat) {
    this._dirToDk.set(dir, discoveryKey)
    this._dkToDat.set(discoveryKey, dat)
  }

  /**
   * @desc Remove dat information from the tracking state
   * @param {string} dir - The directory path to disassociate with the discovery key
   * @param {string} discoveryKey - The discoveryKey to disassociate with a Dat
   * @private
   */
  _unmarkDatAsActive(dir, discoveryKey) {
    this._dirToDk.delete(dir)
    this._dkToDat.delete(discoveryKey)
  }

  /**
   * @desc Replicate a dat if the streams discovery key (dk) is known to us
   * @param {Object} info - The info about the connection
   * @return {Protocol} - The hypecoreProtocol stream
   * @private
   */
  _replicate(info) {
    let connId = ++this._connIdCounter
    debug(
      `replicating to connection ${connId}:${info.type} ${info.host}:${
        info.port
      }`
    )
    const stream = hypercoreProtocol({
      id: this.networkId,
      live: false,
      encrypt: true,
    })

    stream.on('error', function(err) {
      debug(`Connection ${connId}: replication stream error: ${err}`)
    })
    stream.on('close', function() {
      debug(`Connection ${connId}: stream closed`)
    })
    stream.on('end', function() {
      debug(`Connection ${connId}: stream ended`)
    })

    stream.on('feed', dk => {
      const key = dk.toString('hex')
      if (this._dkToDat.has(key)) {
        debug(`Connection ${connId}: DAT found, uploading...`)
        this._dkToDat.get(key).replicate(stream)
      } else {
        debug(`Connection ${connId}: DAT not found (discoveryKey: ${key})...`)
      }
    })

    return stream
  }

  /**
   * @desc Start sharing the supplied dat by having it join the swarm
   * @param {DatWrapper} dat - The dat to have join the swarm
   * @param {string?} [dk] - The dat's discovery key
   * @private
   */
  _shareDat(dat, dk) {
    if (!dk) {
      dk = dat.discoveryKey('hex')
    }
    dat.joinSwarm(this._swarm).then(() => {
      debug(`Added discoveryKey to swarm: ${dk}`)
    })
  }
}

function swarmManagerPlugin(fastify, opts, next) {
  debug('Initializing')
  const swarmMan = new SwarmManager(opts.rootDir, opts.port)
  fastify
    .decorate('swarmManager', swarmMan)
    .addHook('onClose', function close(fastify, done) {
      fastify.swarmManager.close(done)
    })
  swarmMan.initSwarm()
  next()
}

module.exports = {
  fastifyPlugin: fp(swarmManagerPlugin, {
    fastify: '>=1.0.0',
    name: 'fastify-dat-swarm-manager',
  }),
  SwarmManager,
}
