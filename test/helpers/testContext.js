import * as cp from 'child_process';
import path from 'path';
import EventEmitter from 'eventemitter3';
import * as fs from 'fs-extra';
import getServer from '../../lib/server';

export default class TestContext extends EventEmitter {
  constructor() {
    super();
    this.swarmPort = 3282;
    this.rootDir = path.resolve(__dirname, '../fixtures/swarmMan');
    this.dir1 = 'd1';
    this.dir2 = 'd2';
    this.notUnderRoot = 'notUnderRoot';
    this.shouldCreateDir = 'idonotexist';
    this._cleanupables = [];
  }

  get dir1DatPath() {
    return path.join(this.rootDir, this.dir1, '.dat');
  }

  get dir2DatPath() {
    return path.join(this.rootDir, this.dir2, '.dat');
  }

  hasCleanUp() {
    return this._cleanupables.length > 0;
  }

  async cleanUp() {
    const cleanUp = [];
    for (let i = 0; i < this._cleanupables.length; ++i) {
      cleanUp.push(this._cleanupables[i]());
    }
    try {
      await Promise.all(cleanUp);
    } catch (e) {
      console.error(e);
    }
    this._cleanupables = [];
  }

  cloneDat(datKey, which) {
    const cloneTo = path.join(this.rootDir, 'clone');
    const datP = path.join(cloneTo, '.dat');
    const contentP = path.join(
      cloneTo,
      which === this.dir1 ? 'a.txt' : 'b.txt'
    );
    this._cleanupables.push(async () => {
      try {
        await fs.remove(datP);
      } catch (e) {}
      try {
        await fs.remove(contentP);
      } catch (e) {}
    });
    return new Promise((resolve, reject) => {
      cp.exec(
        `yarn run dat clone -d ${cloneTo} ${datKey}`,
        {
          env: process.env,
        },
        (error, stdout, stderr) => {
          if (error) return reject(error);
          resolve({
            cloneDir: {
              datP,
              contentP,
            },
            stdout,
            stderr,
          });
        }
      );
    });
  }

  async startServer() {
    this.server = await getServer(this.rootDir, this.swarmPort);
    this.server.swarmManager.on('replicating', key =>
      this.emit('replicating', key)
    );
    this.server.swarmManager.on('shared-dat', key =>
      this.emit('shared-dat', key)
    );
    this._cleanupables.push(async () => {
      try {
        await this.closeServer();
      } catch (e) {
        console.error(e);
      }
    });
  }

  closeServer() {
    return new Promise((resolve, reject) => {
      const to = setTimeout(
        () => reject(new Error('failed to close server withing 10 seconds')),
        10000
      );
      this.server.close(() => {
        clearTimeout(to);
        resolve();
      });
    });
  }

  startSwarmMan(swarmMam) {
    return new Promise((resolve, reject) => {
      swarmMam.initSwarm();
      const to = setTimeout(
        () => reject(new Error('failed to start swarm man after 5sec')),
        5000
      );
      swarmMam.once('listening', () => {
        this._cleanupables.push(async () => {
          try {
            await this.shutDownSwarmMan(swarmMam);
          } catch (e) {}
        });
        clearTimeout(to);
        resolve();
      });
    });
  }

  shutDownSwarmMan(swarmMan) {
    return Promise.all([
      swarmMan.close(),
      new Promise((resolve, reject) => {
        const to = setTimeout(
          () => reject(new Error('failed to close swarm man after 4sec')),
          4000
        );
        swarmMan.once('close', () => {
          clearTimeout(to);
          resolve();
        });
      }),
    ]);
  }

  /**
   * @param {string} dir
   */
  deferredDatCleanup(dir) {
    this._cleanupables.push(async () => {
      try {
        await fs.remove(path.join(this.rootDir, dir, '.dat'));
      } catch (e) {}
    });
  }

  /**
   * @param {Promise | function } promOrFn
   */
  addCleanUpable(promOrFn) {
    const tst = promOrFn[Symbol.toStringTag];
    if (tst === 'AsyncFunction') {
      this._cleanupables.push(promOrFn);
    } else if (tst === 'Promise') {
      this._cleanupables.push(() => promOrFn);
    } else {
      this._cleanupables.push(async () => {
        try {
          typeof promOrFn.then === 'function'
            ? await promOrFn
            : await promOrFn();
        } catch (e) {}
      });
    }
  }
}
