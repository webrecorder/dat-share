'use strict'
const fs = require('fs-extra')
const path = require('path')
const crypto = require('crypto')
const EventEmitter = require('eventemitter3')
const swarmDefaults = require('dat-swarm-defaults')
const discoverySwarm = require('discovery-swarm')
const hypercoreProtocol = require('hypercore-protocol')
const debug = require('debug')('SwarmManager')
const DatWrapper = require('./datWrapper')

function noop() {}

function validateArgs(rootDir, port) {
  const undefRd = rootDir == null
  const undefPort = port == null
  if (undefRd || undefPort) {
    throw new Error(
      `new SwarmManager(rootDir, port): ${
        undefRd && undefPort
          ? 'both rootDir and port are'
          : undefRd
            ? 'rootDir is'
            : 'port is'
      } undefined`
    )
  }
  if (typeof rootDir !== 'string') {
    throw new Error(
      `new SwarmManager(rootDir, port): rootDir should be a 'string' received '${typeof rootDir}'`
    )
  }
}

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
    validateArgs(rootDir, port)

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
    return fs.pathExists(this.actualDirPath(directory))
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
    })

    this._swarm.on('close', () => {
      if (!this._closeServerShutDown) {
        debug('swarm closed but not server we have an issue')
      } else {
        debug('swarm closed')
      }
      this.emit('close', this._closeServerShutDown)
    })

    this._swarm.on('error', err => {
      debug('Swarm error: %O', err)
    })

    this._swarm.listen(this.port)
  }

  /**
   * @desc Unshare and remove all tracked dats not in the set of keys to be kept (sync'd)
   * @param {Array<string>} toSync
   * @private
   */
  _doSyncRemoval(toSync) {
    const keep = new Set()
    for (let i = 0; i < toSync.length; ++i) {
      keep.add(toSync[i])
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
    debug(`Sync: ${dirs}`)
    this._doSyncRemoval(dirs)
    const shared = { results: [], errors: [] }
    for (let i = 0; i < dirs.length; ++i) {
      const dir = dirs[i]
      const canShare = await this.canShareDir(dir)
      if (!canShare) {
        shared.errors.push({
          dir,
          error: `Directory ${dir} can not be shared`,
        })
        continue
      }

      try {
        let results = await this.shareDir(dir)
        results[dir] = dir
        shared.results.push(results)
      } catch (e) {
        shared.errors.push({ dir, error: e.toString() })
      }
    }
    return shared
  }

  /**
   * @desc Initialize a dat in the supplied directory
   * @param {string} directory
   * @return {Promise<{discoveryKey: string, datKey: string}>}
   */
  async initDat(directory) {
    debug(`Init DAT: ${directory}`)

    const { discoveryKey, datKey } = await this._loadDat(directory)
    return { discoveryKey, datKey }
  }

  /**
   * @desc Share a directory using dat.
   * @param {string} directory - The directory to share via dat
   * @param {boolean} [skipImport = false] - Should importing files be skipped
   * @return {Promise<{discoveryKey: string, datKey: string}>} - Information about the dat
   */
  async shareDir(directory, skipImport = false) {
    const { discoveryKey, datKey, dat } = await this._loadDat(directory)

    if (!skipImport) {
      await dat.importFiles()
    }

    if (!dat.sharing()) {
      this._shareDat(dat, discoveryKey, datKey)
    }

    return { discoveryKey, datKey }
  }

  /**
   * @desc Stop sharing a directory
   * @param {string} dir - The directory to unshare
   * @return {boolean} - True if the directory was unshared otherwise false
   */
  unshareDir(dir) {
    debug(`UnShare Dir: ${dir}`)
    if (!this.isActiveDir(dir)) {
      return false
    }
    const discoveryKey = this.getDiscoveryKeyForDir(dir)
    const existingDat = this.getDat(discoveryKey)
    if (!existingDat.sharing()) {
      return true
    }
    existingDat.leaveSwarm(this._swarm)
    existingDat.closeCB(noop)
    this._unmarkDatAsActive(dir, discoveryKey)
    return true
  }

  /**
   * @desc Close the swarm connection
   * @param {function} [cb] - Optional callback that is called once the swarm connection was closed
   */
  async close(cb) {
    this._closeServerShutDown = true
    await this._closeAndClear()
    this._swarm.close(cb)
  }

  async _closeAndClear() {
    const toClose = []
    for (const dat of this._dkToDat.values()) {
      toClose.push(dat.close())
    }
    try {
      await Promise.all(toClose)
    } catch (e) {}
    this._dirToDk.clear()
    this._dkToDat.clear()
  }

  /**
   * @desc Clear the active dat state
   * @private
   */
  _clearActive() {
    for (const dat of this._dkToDat.values()) {
      dat.closeCB(noop)
    }
    this._dirToDk.clear()
    this._dkToDat.clear()
  }

  /**
   * @desc Convert a path to a directory under {@link rootDir} to its full fs path
   * @param {string} directory - A directory under {@link rootDir}
   * @return {string} - The full path to the directory
   */
  actualDirPath(directory) {
    if (directory.startsWith(this.rootDir)) {
      return directory
    }
    return path.join(this.rootDir, directory)
  }

  /**
   * @desc Initialize or load cached dat
   * @param {string} dir - The full path to the directory to initialize the dat in.
   * Returns the previously created dat if no initialization is needed.
   * @return {Promise<{discoveryKey: string, datKey: string, dat: DatWrapper}>}
   * @private
   */
  async _loadDat(dir) {
    if (this.isActiveDir(dir)) {
      const discoveryKey = this.getDiscoveryKeyForDir(dir)
      const dat = this.getDat(discoveryKey)
      const datKey = dat.key()

      return { discoveryKey, datKey, dat }
    } else {
      const fullDir = this.actualDirPath(dir)

      const dat = await DatWrapper.create(dir, fullDir)
      const discoveryKey = dat.discoveryKey()
      const datKey = dat.key()

      this._markDatAsActive(dir, discoveryKey, dat)

      return { discoveryKey, datKey, dat }
    }
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
      live: true,
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
      debug('OnFeed')
      dk = dk.toString('hex')
      const dat = this.getDat(dk)
      if (dat) {
        debug(
          `Connection ${connId}: DAT found, (discoveryKey: ${dk}, datKey: ${dat.key()}), uploading...`
        )
        this.emit('replicating', dk)
        dat.replicate(stream)
      } else {
        debug(`Connection ${connId}: DAT not found (discoveryKey: ${dk})...`)
      }
    })

    return stream
  }

  /**
   * @desc Start sharing the supplied dat by having it join the swarm
   * @param {DatWrapper} dat - The dat to have join the swarm
   * @param {string?} [dk] - The dat's discovery key
   * @param {string?} [datKey] - The dat key
   * @private
   */
  _shareDat(dat, dk, datKey) {
    if (!dk) {
      dk = dat.discoveryKey()
    }
    if (!datKey) {
      datKey = dat.key()
    }
    debug(`Sharing DAT: ${datKey}`)

    dat.joinSwarm(this._swarm).then(() => {
      this.emit('shared-dat', dk)
      debug(`Added discoveryKey to swarm: ${dk}`)
    })
  }
}

module.exports = SwarmManager
