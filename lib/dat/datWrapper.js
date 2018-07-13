'use strict'
const DatNode = require('dat-node')
const Dat = require('dat-node/dat')

class DatWrapper {
  /**
   * @param {Dat} dat
   */
  constructor(dat) {
    /**
     * @type {Dat}
     */
    this.dat = dat
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

  archive() {
    return this.dat.archive
  }

  /**
   * @desc Retrieve the dat archive discoveryKey
   * @param {string?} as
   * @return {string | Buffer}
   */
  discoveryKey(as) {
    if (as) return this.dat.archive.discoveryKey.toString(as)
    return this.dat.archive.discoveryKey
  }

  /**
   * @desc Retrieve the dat key
   * @param {string?} as
   * @return {string | Buffer}
   */
  key(as) {
    if (as) return this.dat.archive.key.toString(as)
    return this.dat.archive.key
  }

  /**
   * @desc Import files to archive via mirror-folder
   * @type {Function}
   * @param {String} [src=dat.path] - Directory or File to import to `archive`.
   * @param {Function} [cb] - Callback after import is finished
   * @param {Object} [opts] - Options passed to `mirror-folder` and `dat-ignore`
   * @returns {Object} - Import progress
   */
  importFiles(src, opts, cb) {
    return this.dat.importFiles(src, opts, cb)
  }

  /**
   * Import files to archive via mirror-folder
   * @param {String} [src=dat.path] - Directory or File to import to `archive`.
   * @param {Object} [opts] - Options passed to `mirror-folder` and `dat-ignore`
   * @return {Promise<void>}
   */
  importFilesAsync(src, opts) {
    return new Promise(resolve => {
      const importer = this.dat.importFiles(src, opts)
      importer.on('end', function() {
        resolve()
      })
    })
  }

  /**
   * @param {Swarm} swarm
   * @param {function?} cb
   */
  joinSwarm(swarm, cb) {
    swarm.join(this.discoveryKey(), { announce: true }, cb)
  }

  /**
   * @param {Swarm} swarm
   * @return {Promise<void>}
   */
  joinSwarmAsync(swarm) {
    return new Promise(resolve => {
      this.joinSwarm(swarm, () => {
        resolve()
      })
    })
  }

  /**
   * @param {Swarm} swarm
   */
  leaveSwarm(swarm) {
    swarm.leave(this.discoveryKey())
  }

  replicate(stream) {
    return this.archive().replicate({
      stream: stream,
      live: false,
      upload: true,
      download: false,
    })
  }
}

module.exports = DatWrapper
