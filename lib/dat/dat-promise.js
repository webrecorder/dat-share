const DatNode = require('dat-node')
const Dat = require('dat-node/dat')

function promisify(DatClz) {
  const cbRe = /function\s\(([^)]+)\)/
  for (const prop of Reflect.ownKeys(DatClz.prototype)) {
    if (prop === 'constructor') continue
    const fn = DatClz.prototype[prop]
    const match = cbRe.exec(fn.toString().split('\n')[0])
    if (match && match[1].indexOf('cb') !== -1) {
      DatClz.prototype[`${prop}Sync`] = fn
      DatClz.prototype[prop] = function() {
        return new Promise((resolve, reject) => {
          arguments[arguments.length] = (err, res) => {
            if (err) return reject(err)
            resolve(res)
          }
          arguments.length++
          fn.apply(this, arguments)
        })
      }
    }
  }
}

promisify(Dat)

/**
 * @param dirOrStorage
 * @param opts
 * @return {Promise<Dat>}
 */
function DatPromise(dirOrStorage, opts) {
  if (!opts) opts = {}
  return new Promise((resolve, reject) => {
    if (typeof opts !== 'object') {
      return reject(new Error(`dat-promise: opts should be type object`))
    }
    if (!!dirOrStorage) {
      DatNode(dirOrStorage, opts, (err, dat) => {
        if (err) return reject(err)
        resolve(dat)
      })
    } else {
      reject(new Error('dat-promise: directory or storage required'))
    }
  })
}

module.exports = DatPromise
