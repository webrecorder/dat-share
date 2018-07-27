const Hyperdrive = require('hyperdrive')
const HybridStorage = require('./hybridStorage')
const { getInstance } = require('./randomS3FS')

class S3HyperDrive extends Hyperdrive {
  /**
   *
   * @param {HybridStorage} hybridStorage
   * @param {Object} hyperOpts
   */
  constructor(hybridStorage, hyperOpts) {
    super(hybridStorage.overriderDS(), hyperOpts)
    this.hybridStorage = hybridStorage
  }

  readyPromise() {
    return new Promise((resolve, reject) => {
      this.once('ready', resolve)
    })
  }

  importFiles() {
    return this.hybridStorage.importFiles(this)
  }

  /**
   *
   * @param {string} realDir
   * @param {string} s3prefix
   * @param {RandomS3FS | string}  s3
   * @param {Object} hyperOpts
   * @return {S3HyperDrive}
   */
  static create({ realDir, s3prefix, s3, hyperOpts }) {
    if (typeof s3 === 'string') {
      s3 = getInstance(s3)
    }
    const storage = new HybridStorage(realDir, s3prefix, s3)
    return new S3HyperDrive(storage, hyperOpts || { latest: true })
  }
}

module.exports = S3HyperDrive
