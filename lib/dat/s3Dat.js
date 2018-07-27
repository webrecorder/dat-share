const DatNode = require('dat-node')
const Dat = require('dat-node/dat')
const path = require('path')
const fs = require('fs-extra')
const DatWrapper = require('./datWrapper')
const S3HyperDrive = require('./s3HyperDrive')

async function checkIfExists(dir, datOpts) {
  let dirContents
  try {
    dirContents = await fs.readdir(path.join(dir, '.dat'))
  } catch (e) {}
  if (dirContents) {
  }
}

class S3Dat {
  static async create(realDir, s3prefix, s3, datOpts = {}) {
    const contents = await fs.readdir(path.join(realDir, '.dat'))

    const hd = S3HyperDrive.create({ realDir, s3prefix, s3 })
  }
}
