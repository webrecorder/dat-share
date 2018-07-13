'use strict'
const DatNode = require('dat-node')
const Dat = require('dat-node/dat')
const storage = require('dat-storage')
const hyperdrive = require('hyperdrive')

/**
 * Create a Dat instance, archive storage, and ready the archive.
 * @param {string|object} dirOrStorage - Directory or hyperdrive storage object.
 * @param {object} [opts] - Dat-node options and any hyperdrive init options.
 * @param {String|Buffer} [opts.key] - Hyperdrive key
 * @param {Boolean} [opts.createIfMissing = true] - Create storage if it does not exit.
 * @param {Boolean} [opts.errorIfExists = false] - Error if storage exists.
 * @param {Boolean} [opts.temp = false] - Use random-access-memory for temporary storage
 * @return {Promise<Dat>} The new Dat instance
 */
function initDat(dirOrStorage, opts) {
  if (!opts) opts = {}
  return new Promise((resolve, reject) => {
    if (typeof opts !== 'object') {
      return reject(new Error(`newDat: opts should be type object`))
    }
    if (!!dirOrStorage) {
      DatNode(dirOrStorage, opts, (err, dat) => {
        if (err) return reject(err)
        resolve(dat)
      })
    } else {
      reject(new Error('initDat: directory or storage required'))
    }
  })
}

function initHyperdrive(drivePath) {
  const options = {
    latest: true,
    indexing: true,
    dir: drivePath,
  }
  return new Promise((resolve, reject) => {
    const datDrive = hyperdrive(storage(drivePath), null, options)
    datDrive.on('ready', () => {
      resolve(datDrive)
    })
  })
}

function importFilesDat(dat) {
  return new Promise(resolve => {
    const importer = dat.importFiles()
    importer.on('end', function() {
      resolve()
    })
  })
}

module.exports = {
  initDat,
  initHyperdrive,
  importFilesDat,
}
