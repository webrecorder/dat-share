const path = require('path')
const fs = require('fs-extra')
const Dat = require('./dat-promise')

class Dater {
  constructor() {
    this._active = new Map()
    this._mapping = new Map()
  }

  isActive(key) {
    return this._mapping.has(key)
  }

  active() {
    return Array.from(this._active.keys())
  }

  async datMe(datPath) {
    if (this.isActive(datPath)) {
      return this._active.get(datPath).key
    }
    const dat = await Dat(datPath)
    const exists = await fs.pathExists(path.join(datPath, '.dat'))
    if (!exists) {
      dat.importFilesSync()
    }
    dat.joinNetworkSync()
    const datKey = `dat://${dat.key.toString('hex')}`
    this._active.set(datPath, { dat, key: datKey })
    return datKey
  }

  async stopDating(datPath) {
    if (!this.isActive(datPath)) {
      return true
    }
    const { dat } = this._active.get(datPath)
    await dat.close()
    this._active.delete(datPath)
  }

  async close() {
    for (const { dat } of this._active.values()) {
      await dat.close()
    }
  }
}

module.exports = Dater
