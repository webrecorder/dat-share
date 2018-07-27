// const Transform = require('readable-stream/transform')
const { Transform } = require('stream')

class S3StreamTransform extends Transform {
  constructor(size) {
    super()
    this.size = size || 65536
    this._zeroPadding = false
    this._buffered = []
    this._bufferedBytes = 0
  }

  _transform(buf, enc, next) {
    this._bufferedBytes += buf.length
    this._buffered.push(buf)

    while (this._bufferedBytes >= this.size) {
      let b = Buffer.concat(this._buffered)
      this._bufferedBytes -= this.size
      this.push(b.slice(0, this.size))
      this._buffered = [b.slice(this.size, b.length)]
    }
    next()
  }

  _flush(next) {
    if (this._bufferedBytes && this._zeroPadding) {
      this._buffered.push(Buffer.alloc(this.size - this._bufferedBytes, 0))
      this.push(Buffer.concat(this._buffered))
      this._buffered = null
    } else if (this._bufferedBytes) {
      this.push(Buffer.concat(this._buffered))
      this._buffered = null
    }
    this.push(null)
    next()
  }
}

module.exports = S3StreamTransform
