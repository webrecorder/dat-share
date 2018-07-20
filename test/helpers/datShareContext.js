import * as cp from 'child_process'
import * as fs from 'fs-extra'
import path from 'path'
import EventEmitter from 'eventemitter3'
import getServer from '../../lib/server'

export default class DatShareContext extends EventEmitter {
  constructor() {
    super()
    this.swarmPort = 3282
    this.rootDir = path.resolve(__dirname, '../fixtures/swarmMan')
    this.dir1 = 'd1'
    this.dir2 = 'd2'
    this.notUnderRoot = 'notUnderRoot'

    this._cleanupables = []
    this.server = null
  }

  async startServer() {
    this.server = await getServer(this.rootDir, this.swarmPort)
    this.server.swarmManager.on('replicating', key =>
      this.emit('replicating', key)
    )
    this.server.swarmManager.on('shared-dat', key =>
      this.emit('shared-dat', key)
    )
  }

  closeServer() {
    return new Promise((resolve, reject) => {
      this.server.close(resolve)
    })
  }

  get dir1DatPath() {
    return path.join(this.rootDir, this.dir1, '.dat')
  }

  get dir2DatPath() {
    return path.join(this.rootDir, this.dir2, '.dat')
  }

  async cleanUp() {
    const cleanUp = []
    cleanUp.push(...this._cleanupables.map(fn => fn()))
    try {
      await Promise.all(cleanUp)
    } catch (e) {
      console.error(e)
    }
    this._cleanupables = []
  }

  addCleanUpable(promOrFn) {
    const tst = promOrFn[Symbol.toStringTag]
    if (tst === 'AsyncFunction') {
      this._cleanupables.push(promOrFn)
    } else if (tst === 'Promise') {
      this._cleanupables.push(() => promOrFn)
    } else {
      this._cleanupables.push(async () => {
        try {
          typeof promOrFn.then === 'function'
            ? await promOrFn
            : await promOrFn()
        } catch (e) {}
      })
    }
  }

  deferredDatCleanup(dir) {
    this._cleanupables.push(async () => {
      try {
        await fs.remove(path.join(this.rootDir, dir, '.dat'))
      } catch (e) {}
    })
  }

  cloneDat(datKey, which) {
    const cloneTo = path.join(this.rootDir, 'clone')
    const datP = path.join(cloneTo, '.dat')
    const contentP = path.join(cloneTo, which === this.dir1 ? 'a.txt' : 'b.txt')
    this._cleanupables.push(async () => {
      try {
        await fs.remove(datP)
      } catch (e) {}
      try {
        await fs.remove(contentP)
      } catch (e) {}
    })
    return new Promise((resolve, reject) => {
      cp.exec(
        `yarn run dat clone -d ${cloneTo} ${datKey}`,
        {
          cwd: cloneTo,
          env: process.env,
        },
        (error, stdout, stderr) => {
          if (error) return reject(error)
          resolve({
            cloneDir: {
              datP,
              contentP,
            },
            stdout,
            stderr,
          })
        }
      )
    })
  }
}
