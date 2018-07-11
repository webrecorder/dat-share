// const { Worker, MessagePort, isMainThread } = require('worker_threads')

class Dater {
  constructor() {
    this.active = {}
  }

  datMe(path) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        '/home/john/WebstormProjects/dat-share/lib/dat/worker.js'
      )
      worker.once('message', res => {
        console.log(res)
        worker.terminate(resolve)
      })
    })
  }
}

module.exports = Dater
