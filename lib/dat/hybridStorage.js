const DatStorage = require('dat-storage')
const RandomS3FS = require('./randomS3FS')

class HybridStorage {
  constructor(realDir, s3prefix, s3) {
    this.s3 = s3
    this.localStorage = DatStorage(realDir)

    this.loadFile = this.loadFile.bind(this)

    // use store with custom loadFile to return s3 reader
    this.s3Store = DatStorage(this.loadFile)

    this.overriderDS = this.overriderDS.bind(this)

    this.s3prefix = s3prefix
  }

  /**
   *
   * @param {string} realDir
   * @param {RandomS3FS | string} s3
   * @param {string} s3Prefix
   * @return {{metadata, content}}
   */
  static create(realDir, s3, s3Prefix) {
    if (typeof s3 === 'string') {
      s3 = new RandomS3FS(s3)
    }
    const hs = new HybridStorage(realDir, s3Prefix, s3)
    return hs.overriderDS()
  }

  loadFile(filename) {
    const path = this.s3prefix + filename
    return this.s3.raFile(path)
  }

  importFiles(archive) {
    const from = this.s3prefix.endsWith('/')
      ? this.s3prefix
      : this.s3prefix + '/'
    return this.s3.importToArchive(from, '/', archive)
  }

  overriderDS() {
    return {
      metadata: (file, opts) => {
        return this.localStorage.metadata(file, opts)
      },
      content: (file, opts, archive) => {
        if (file === 'data') {
          return this.s3Store.content(file, opts, archive)
        }
        return this.localStorage.content(file, opts, archive)
      },
    }
  }
}

module.exports = HybridStorage
