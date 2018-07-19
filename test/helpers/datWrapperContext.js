import * as fs from 'fs-extra'

export default class DatWrapperContext {
  constructor() {
    this.shouldCreateDir = 'idonotexist'
  }

  cleanUpCreatedDir() {
    return fs.remove(this.shouldCreateDir)
  }
}
