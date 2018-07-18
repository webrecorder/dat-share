'use strict'
const path = require('path')
const fs = require('fs-extra')
const DatNode = require('dat-node')
const Dat = require('dat-node/dat')
const DatJson = require('dat-json')

/**
 * @desc Wrapper around both dat-node and dat-json that provides ease of use
 * for both
 */
class DatWrapper {
  /**
   * @param {Dat} dat - The dat to wrap
   */
  constructor(dat) {
    /**
     * @desc The wrapped dat
     * @type {Dat}
     */
    this.dat = dat

    /**
     * @desc The `dat.json` associated with this dat
     * @type {Object}
     */
    this._json = null

    /**
     * @desc are we sharing this dat (joined the swarm)
     * @type {boolean}
     * @private
     */
    this._sharing = false
  }

  /**
   * Create a Dat instance, archive storage, and ready the archive.
   * @param {string|object|Dat} datOrDirOrStorage - Dat instance, directory, or hyperdrive storage object.
   * @param {object} [opts] - Dat-node options and any hyperdrive init options.
   * @param {string|Buffer} [opts.key] - Hyperdrive key
   * @param {Boolean} [opts.createIfMissing = true] - Create storage if it does not exit.
   * @param {Boolean} [opts.errorIfExists = false] - Error if storage exists.
   * @param {Boolean} [opts.temp = false] - Use random-access-memory for temporary storage
   * @return {Promise<DatWrapper> | DatWrapper} The new Dat instance
   */
  static from(datOrDirOrStorage, opts) {
    if (datOrDirOrStorage instanceof Dat) {
      return new DatWrapper(datOrDirOrStorage)
    }
    if (!opts) opts = {}
    return new Promise((resolve, reject) => {
      if (typeof opts !== 'object') {
        return reject(new Error(`DatWrapper.from: opts should be type object`))
      }
      if (!!datOrDirOrStorage) {
        DatNode(datOrDirOrStorage, opts, (err, dat) => {
          if (err) return reject(err)
          resolve(new DatWrapper(dat))
        })
      } else {
        reject(new Error('DatWrapper.from: directory or storage required'))
      }
    })
  }

  /**
   * @desc Are we sharing this dat (joined the swarm)
   * @return {boolean} - True if this dat has joined the swarm otherwise false
   */
  sharing() {
    return this._sharing
  }

  /**
   * @desc Retrieve the `dat.json` file associated with this dat
   * @return {Object} - The DatJson object
   */
  json() {
    if (!this._json) {
      this._json = DatJson(this.dat.archive, {
        file: path.join(this.dat.path, 'dat.json'),
      })
    }
    return this._json
  }

  /**
   * @desc Create (initialize) this dats `dat.json`. Optionally with data
   * @param {Object} [data] - The data to initially add to this dats `dat.json`
   * @return {Promise<void>}
   */
  jsonCreate(data) {
    return new Promise((resolve, reject) => {
      this.json().create(data, err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  /**
   * @desc Create (initialize) this dats `dat.json`. Optionally with data
   * @param {Object} [data] - The data to initially add to this dats `dat.json`
   * @return {Promise<void>}
   */
  async jsonCreateOrUpdate(data) {
    let exists = true
    try {
      await fs.lstat(path.join(this.dat.path, 'dat.json'))
    } catch (e) {
      exists = false
    }
    // if does not exist unconditionally create it
    if (!exists) return this.jsonCreate(data)
    // does exist and only write to it if data is non-null
    if (data != null) return this.jsonWrite(data)
  }

  /**
   * @desc Write a key value pair (optionally just key) to this dats `dat.json`
   * @param {string|Object} key - The key to write
   * @param {Any?} [value] -  The optional value
   * @return {Promise<void>}
   */
  jsonWrite(key, value) {
    return new Promise((resolve, reject) => {
      this.json().write(key, value, err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  /**
   * @desc Read the contents of this dats `dat.json`
   * @return {Promise<Object>} - The contents of the dats `dat.json`
   */
  jsonRead() {
    return new Promise((resolve, reject) => {
      this.json().read((err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }

  /**
   * @desc Stat a path in the archive
   * @param {string} archivePath - The path in the archive to stat
   * @return {Promise<Object>}
   */
  stat(archivePath) {
    return new Promise((resolve, reject) => {
      this.dat.archive.stat(archivePath, (error, stats) => {
        if (error) return reject(error)
        resolve(stats)
      })
    })
  }

  /**
   * @desc Retrieve this dats hyperdrive
   * @return {Object} - The dats hyperdrive
   */
  archive() {
    return this.dat.archive
  }

  close() {
    return new Promise((resolve, reject) => {
      this.closeCB(resolve)
    })
  }

  closeCB(cb) {
    this.dat.archive.close(cb)
  }

  /**
   * @desc Retrieve the dat's archive discoveryKey
   * @param {string?} [as] - The format of the discoveryKey's string representation
   * @return {string | Buffer} - The dats discoveryKey
   */
  discoveryKey(as) {
    if (as) return this.dat.archive.discoveryKey.toString(as)
    return this.dat.archive.discoveryKey
  }

  /**
   * @desc Retrieve the dat's archive key
   * @param {string?} [as] - The format of the key's string representation
   * @return {string | Buffer} - The dat's archive key
   */
  key(as) {
    if (as) return this.dat.archive.key.toString(as)
    return this.dat.archive.key
  }

  /**
   * @desc Import files to archive via mirror-folder
   * @param {String} [src=dat.path] - Directory or File to import to `archive`.
   * @param {Function} [cb] - Callback after import is finished
   * @param {Object} [opts] - Options passed to `mirror-folder` and `dat-ignore`
   * @returns {Object} - Import progress
   */
  importFilesCB(src, opts, cb) {
    return this.dat.importFiles(src, opts, cb)
  }

  /**
   * @desc Import files to archive via mirror-folder
   * @param {String} [src=dat.path] - Directory or File to import to `archive`.
   * @param {Object} [opts] - Options passed to `mirror-folder` and `dat-ignore`
   * @return {Promise<void>}
   */
  importFiles(src, opts) {
    return new Promise(resolve => {
      const importer = this.dat.importFiles(src, opts)
      importer.on('end', function() {
        resolve()
      })
    })
  }

  /**
   * @desc Join the swarm (share this dat)
   * @param {Swarm} swarm - The swarm instance to join
   * @param {function?} [cb] - A callback that is called once first discovery happens
   */
  joinSwarmCB(swarm, cb) {
    this._sharing = true
    swarm.join(this.discoveryKey(), { announce: true }, cb)
  }

  /**
   * @desc Join the swarm (share this dat)
   * @param {Swarm} swarm - The swarm instance to leave
   * @return {Promise<void>}
   */
  joinSwarm(swarm) {
    return new Promise(resolve => {
      this.joinSwarmCB(swarm, () => {
        resolve()
      })
    })
  }

  /**
   * @desc Leave the swarm
   * @param {Swarm} swarm - The swarm instance to leave
   */
  leaveSwarm(swarm) {
    if (!this._sharing) return
    swarm.leave(this.discoveryKey())
    this._sharing = false
  }

  /**
   * @desc Replicate the dat via the supplied hypercoreProtocol stream
   * @param {Protocol} stream - The hypercoreProtocol stream to replicate to
   * @return {Protocol} - The hypercoreProtocol stream replicated to
   */
  replicate(stream) {
    return this.archive().replicate({
      stream: stream,
      live: false,
      upload: true,
      download: true,
    })
  }
}

module.exports = DatWrapper
