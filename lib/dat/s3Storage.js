const DatStorage = require('dat-storage')
const ras3 = require('random-access-s3')
const multi = require('multi-random-access')
const AWS = require('aws-sdk')
const messages = require('append-tree/messages')
const stat = require('hyperdrive/lib/messages').Stat

class HybridStorage {
  constructor(realDir, bucket, s3prefix) {
    this.s3 = new AWS.S3({ apiVersion: '2006-03-01' })
    this.localStorage = DatStorage(realDir)

    this.loadFile = this.loadFile.bind(this);

    // use store with custom loadFile to return s3 reader
    this.s3Store = DatStorage(this.loadFile);

    this.overriderDS = this.overriderDS.bind(this)

    this.s3Options = {
      bucket,
      s3prefix,
      s3: this.s3,
      verbose: true,
    }
  }

  static newOne(realDir, bucket, prefix) {
    const hs = new HybridStorage(realDir, bucket, prefix)
    return hs.overriderDS()
  }

  loadFile(filename) {
    const path = this.s3Options.s3prefix + filename;

    return ras3(path, this.s3Options);
  }

  overriderDS() {
    return {
      metadata: (file, opts) => {
        return this.localStorage.metadata(file, opts)
      },
      content: (file, opts, archive) => {
        if (file === 'data') {
          return this.s3Store.content(file, opts, archive);

        }
        return this.localStorage.content(file, opts, archive)
      },
    }
  }
}

module.exports = HybridStorage

