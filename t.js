const Dat = require('dat-node')

Dat('data/storage/2018-07-03/mwqbv5jxxv42txga', (err, dat) => {
  console.log(err, dat)
  dat.importFiles()
  dat.joinNetwork()
  console.log('My Dat link is: dat://', dat.key.toString('hex'))
  dat.leaveNetwork()
})
