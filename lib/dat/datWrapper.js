'use strict'
const path = require('path')
const fs = require('fs-extra')
const DatStorage = require('dat-storage')
const hyperdrive = require('hyperdrive')
const importFiles = require('dat-node/lib/import-files')

const AWS = require('aws-sdk')
const S3HybridStorage = require('dat-s3-hybrid-storage')
//const S3HybridStorage = require('./s3storage')


/**
 * @desc Wrapper around both dat-node and dat-json that provides ease of use
 * for both
 */
class DatWrapper {
  /**
   * @param {Dat} dat - The dat to wrap
   */
  constructor(drive, importer) {
    /**
     * @desc The wrapped hyperdrive
     * @type {Dat}
     */
    this.drive = drive


    /**
     * @desc Source url or File dir for importing files, or null for read-only
     * @type {string}
     */
    this.importFiles = importer;

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
   * @return {Promise<DatWrapper>} The new Dat instance
   */
  static async create(dir, fullDir, opts) {
    let storage = null;
    let drive = null;
    let importer = null;

    if (!opts) {
      opts = {
              //"indexing": true,
              "latest": true,
              "dir": fullDir,
             }

    }

    // S3 SUPPORT!
    if (process.env.S3_ROOT) {
      await fs.ensureDir(fullDir)

      const srcUrl = process.env.S3_ROOT + dir;
      const s3_storage = new S3HybridStorage(srcUrl, fullDir);

      storage = s3_storage.storage();

      drive = hyperdrive(storage, opts);

      importer = function() {
        return s3_storage.importer().importFiles(drive);
      }

    } else {
      storage = DatStorage(fullDir);

      drive = hyperdrive(storage, opts);

      importer = function() {
        return new Promise(resolve => {
          importFiles(drive, fullDir, {}, () => {
            resolve()
          })
        })
      }
    }

    const hasDat = fs.existsSync(path.join(fullDir, '.dat'))

    await new Promise((resolve, reject) => {
      drive.on('error', reject)
      drive.ready(() => {
        drive.removeListener('error', reject)
        drive.resumed = !!(hasDat || (drive.metadata.has(0) && drive.version))
        resolve()
      })
    })

    return new DatWrapper(drive, importer);
  }

  /**
   * @desc Are we sharing this dat (joined the swarm)
   * @return {boolean} - True if this dat has joined the swarm otherwise false
   */
  sharing() {
    return this._sharing
  }

  /**
   * @desc Stat a path in the archive
   * @param {string} archivePath - The path in the archive to stat
   * @return {Promise<Object>}
   */
  stat(archivePath) {
    return new Promise((resolve, reject) => {
      this.drive.stat(archivePath, (error, stats) => {
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
    return this.drive;
  }

  close() {
    return new Promise((resolve, reject) => {
      this.closeCB(resolve)
    })
  }

  closeCB(cb) {
    this.drive.close(cb)
  }

  /**
   * @desc Retrieve the dat's archive discoveryKey
   * @param {string?} [as] - The format of the discoveryKey's string representation
   * @return {string | Buffer} - The dats discoveryKey
   */
  discoveryKey(as = 'hex') {
    return this.drive.discoveryKey.toString(as)
  }

  /**
   * @desc Retrieve the dat's archive key
   * @param {string?} [as] - The format of the key's string representation
   * @return {string | Buffer} - The dat's archive key
   */
  key(as = 'hex') {
    return this.drive.key.toString(as)
  }

  /**
   * @desc Join the swarm (share this dat)
   * @param {Swarm} swarm - The swarm instance to join
   * @param {function?} [cb] - A callback that is called once first discovery happens
   */
  joinSwarmCB(swarm, cb) {
    this._sharing = true
    swarm.join(this.drive.discoveryKey, { announce: true }, cb)
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
    swarm.leave(this.drive.discoveryKey)
    this._sharing = false
  }

  /**
   * @desc Replicate the dat via the supplied hypercoreProtocol stream
   * @param {Protocol} stream - The hypercoreProtocol stream to replicate to
   * @return {Protocol} - The hypercoreProtocol stream replicated to
   */
  replicate(stream) {
    return this.drive.replicate({
      stream: stream,
      live: true,
      upload: true,
      download: true,
    })
  }
}

module.exports = DatWrapper
