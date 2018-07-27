const path = require('path')
const AWS = require('aws-sdk')
const randomAccess = require('random-access-storage')
const S3FS = require('./safeRequireS3fs')
const S3StreamTransform = require('./s3StreamTransform')
const { pipeline } = require('stream')

/**
 * @extends S3FS
 */
class RandomS3FS extends S3FS {
  /**
   * @param {string} bucket
   * @param {S3} [s3]
   */
  constructor(bucket, s3) {
    super(bucket, s3)
  }

  /**
   * @param {string} bucket
   * @param {S3} [s3]
   */
  static create(bucket, s3) {
    if (!s3) {
      s3 = new AWS.S3({ apiVersion: '2006-03-01' })
    }
    return new RandomS3FS(bucket, s3)
  }

  static _sanitizeKeyForS3(key) {
    if (typeof key === 'string' && key.length && key[0] === '/') {
      return key.slice(1)
    }
    return key
  }

  async importToArchive(src, dest, archive) {
    const files = await this.readdirp(src)
    const proms = []
    for (let i = 0; i < files.length; ++i) {
      const file = files[i]
      const s3ReadStream = this.createReadStream(src + file)
      const localWrite = archive.createWriteStream(path.join(dest, file))
      proms.push(
        new Promise((resolve, reject) => {
          pipeline(s3ReadStream, new S3StreamTransform(), localWrite, err => {
            if (err) {
              console.error('Pipeline failed', err)
            } else {
              console.log('Pipeline succeeded')
            }
            resolve()
          })
        })
      )
    }
    return Promise.all(proms)
  }

  raFile(filename) {
    const key = RandomS3FS._sanitizeKeyForS3(filename)
    return randomAccess({
      read: req => {
        const params = {
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=${req.offset}-${req.offset + req.size - 1}`,
        }
        this.s3.getObject(params, (err, data) => {
          if (err) {
            return req.callback(err)
          }
          req.callback(null, data.Body)
        })
      },
      write: function(req) {
        req.callback()
      },
      del: function(req) {
        req.callback()
      },
    })
  }
}

let INSTANCE

module.exports = RandomS3FS

module.exports.getInstance = function(bucket) {
  if (!INSTANCE) {
    if (typeof bucket !== 'string') {
      throw new Error(
        'Cannot create a new singleton instance of RandomS3FS without a bucket!'
      )
    }
    INSTANCE = new RandomS3FS(bucket)
  }
  return INSTANCE
}
