import * as cp from 'child_process'
import * as fs from 'fs-extra'
import path from 'path'

export default class SwarmManagerContext {
  constructor() {
    this.swarmPort = 3282
    this.rootDir = path.resolve(__dirname, '../fixtures/swarmMan')
    this.dir1 = 'd1'
    this.dir2 = 'd2'
    this.notUnderRoot = 'notUnderRoot'

    this._cleanupables = []
    this._autoCloseSwarmMan = false
    this._swarmMan = null
  }

  hasCleanUp() {
    return this._cleanupables.length > 0 || this._autoCloseSwarmMan
  }

  async cleanUp() {
    const cleanUp = []
    if (this._autoCloseSwarmMan) {
      cleanUp.push(this.shutDownSwarmMan(this._swarmMan))
    }
    cleanUp.push(...this._cleanupables.map(fn => fn()))
    try {
      await Promise.all(cleanUp)
    } catch (e) {
      console.error(e)
    }
    this._cleanupables = []
    this._autoCloseSwarmMan = false
    this._swarmMan = null
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

  startSwarmMan(swarmMam) {
    this._autoCloseSwarmMan = true
    this._swarmMan = swarmMam
    return new Promise((resolve, reject) => {
      swarmMam.initSwarm()
      const to = setTimeout(
        () => reject(new Error('failed to start swarm man after 4sec')),
        4000
      )
      swarmMam.once('listening', () => {
        clearTimeout(to)
        resolve()
      })
    })
  }

  shutDownSwarmMan(swarmMan) {
    return Promise.all([
      swarmMan.close(),
      new Promise((resolve, reject) => {
        const to = setTimeout(
          () => reject(new Error('failed to close swarm man after 4sec')),
          4000
        )
        swarmMan.once('close', () => {
          clearTimeout(to)
          resolve()
        })
      }),
    ])
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
