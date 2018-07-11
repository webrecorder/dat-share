const Dat = require('dat-node')

class DatWorker {
  constructor(port) {
    this.port = port
    this.on_message = this.on_message.bind(this)
    this.port.on('message', this.on_message)
    this.port.postMessage({ type: 'alive' })
    this.dat = null
    this.dp = null
  }

  on_message(msg) {
    switch (msg.type) {
      case 'datMe':
        return this._datMe(msg.path)
          .then(dp => {
            this.dp = dp
            this.port.postMessage({ wasError: false, value: dp })
          })
          .catch(error => {
            this.port.postMessage({ wasError: true, value: error.toString() })
          })
      case 'stopDatingMe':
        return this._stopDat()
          .then(() => {
            this.port.postMessage({ wasError: false })
            process.exit()
          })
          .catch(error => {
            this.port.postMessage({ wasError: true, value: error.toString() })
            process.exit()
          })
    }
  }

  _getDat(path) {
    return new Promise((resolve, reject) => {
      Dat(path, (err, dat) => {
        if (err) return reject(err)
        resolve(dat)
      })
    })
  }

  _stopDat() {
    return new Promise((resolve, reject) => {
      this.dat.leave(error => {
        if (error) return reject(error)
        resolve()
      })
    })
  }

  _importFiles() {
    return new Promise((resolve, reject) => {
      this.dat.importFiles(error => {
        if (error) return reject(error)
        resolve()
      })
    })
  }

  async _datMe(path) {
    this.dat = await this._getDat(path)
    this.dat.importFiles()
    this.dat.joinNetwork()
    return `dat://${this.dat.key.toString('hex')}`
  }
}
