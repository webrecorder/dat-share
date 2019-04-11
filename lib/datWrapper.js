'use strict';
const path = require('path');
const fs = require('fs-extra');
const DatStorage = require('dat-storage');
const hyperdrive = require('hyperdrive');
const importFiles = require('dat-node/lib/import-files');
const S3HybridStorage = require('dat-s3-hybrid-storage');

/**
 * @desc Wrapper around both dat-node and dat-json that provides ease of use
 * for both
 */
class DatWrapper {
  /**
   *
   * @param {Hyperdrive} drive
   * @param {function(): Promise<void>} importer
   */
  constructor(drive, importer) {
    /**
     * @desc The wrapped hyperdrive
     * @type {Hyperdrive}
     */
    this.drive = drive;

    /**
     * @desc Source url or File dir for importing files, or null for read-only
     * @type {function(): Promise<void>}
     */
    this.importFiles = importer;

    /**
     * @desc are we sharing this dat (joined the swarm)
     * @type {boolean}
     * @private
     */
    this._sharing = false;
  }

  /**
   * @desc Create a Dat instance, archive storage, and ready the archive.
   * @param {string} dir - Path to the directory of the dat
   * @param {string} fullDir - Full path to directory of the dat
   * @param {Object} [options = {}] - Dat-node options and any hyperdrive init options.
   * @param {string|Buffer} [options.key] - Hyperdrive key
   * @param {Boolean} [options.latest = true] - Create storage if it does not exit.
   * @param {string} [options.dir]
   * @return {Promise<DatWrapper>} The new Dat instance
   */
  static async create(dir, fullDir, options = {}) {
    let storage = null;
    let drive = null;
    let importer = null;

    const opts = { latest: true, dir: fullDir, ...options };

    // S3 SUPPORT!
    if (process.env.S3_ROOT) {
      await fs.ensureDir(fullDir);

      const srcUrl = process.env.S3_ROOT + dir;
      const s3_storage = new S3HybridStorage(srcUrl, fullDir);

      storage = s3_storage.storage();

      drive = hyperdrive(storage, opts);

      importer = function() {
        return s3_storage.importer().importFiles(drive);
      };
    } else {
      storage = DatStorage(fullDir);

      drive = hyperdrive(storage, opts);

      importer = function() {
        return new Promise(resolve => {
          importFiles(drive, fullDir, { indexing: true }, () => {
            resolve();
          });
        });
      };
    }

    const hasDat = fs.existsSync(path.join(fullDir, '.dat'));

    await new Promise((resolve, reject) => {
      drive.on('error', reject);
      drive.ready(() => {
        drive.removeListener('error', reject);
        drive.resumed = !!(hasDat || (drive.metadata.has(0) && drive.version));
        resolve();
      });
    });

    return new DatWrapper(drive, importer);
  }

  /**
   * @desc Are we sharing this dat (joined the swarm)
   * @return {boolean} - True if this dat has joined the swarm otherwise false
   */
  sharing() {
    return this._sharing;
  }

  /**
   * @desc Stat a path in the archive
   * @param {string} archivePath - The path in the archive to stat
   * @return {Promise<Object>}
   */
  stat(archivePath) {
    return new Promise((resolve, reject) => {
      this.drive.stat(archivePath, (error, stats) => {
        if (error) return reject(error);
        resolve(stats);
      });
    });
  }

  /**
   * @desc Retrieve this dats hyperdrive
   * @return {Object} - The dats hyperdrive
   */
  archive() {
    return this.drive;
  }

  /**
   * @desc Close the underlying hyperdrive
   * @returns {Promise<void>}
   */
  close() {
    return new Promise((resolve, reject) => {
      this.closeCB(resolve);
    });
  }

  /**
   * @desc Close the underlying hyperdrive
   * @param {function()} [cb]
   */
  closeCB(cb) {
    this.drive.close(cb);
  }

  /**
   * @desc Retrieve the dat's archive discoveryKey
   * @param {string?} [as = 'hex'] - The format of the discoveryKey's string representation
   * @return {string} - The dats discoveryKey
   */
  discoveryKey(as = 'hex') {
    return this.drive.discoveryKey.toString(as);
  }

  /**
   * @desc Retrieve the dat's archive key
   * @param {string?} [as = 'hex'] - The format of the key's string representation
   * @return {string} - The dat's archive key
   */
  key(as = 'hex') {
    return this.drive.key.toString(as);
  }

  /**
   * @desc Join the swarm (share this dat)
   * @param {Swarm} swarm - The swarm instance to join
   * @param {function?} [cb] - A callback that is called once first discovery happens
   */
  joinSwarmCB(swarm, cb) {
    this._sharing = true;
    swarm.join(this.drive.discoveryKey, { announce: true }, cb);
  }

  /**
   * @desc Join the swarm (share this dat)
   * @param {Swarm} swarm - The swarm instance to leave
   * @return {Promise<void>}
   */
  joinSwarm(swarm) {
    return new Promise(resolve => {
      this.joinSwarmCB(swarm, () => {
        resolve();
      });
    });
  }

  /**
   * @desc Leave the swarm
   * @param {Swarm} swarm - The swarm instance to leave
   */
  leaveSwarm(swarm) {
    if (!this._sharing) return;
    swarm.leave(this.drive.discoveryKey);
    this._sharing = false;
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
    });
  }
}

module.exports = DatWrapper;
