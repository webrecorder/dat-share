import test from 'ava'
import * as fs from 'fs-extra'
import path from 'path'
import { SwarmManagerContext } from './helpers'
import { SwarmManager } from '../lib/dat/swarmManager'

test.before(t => {
  t.context = new SwarmManagerContext()
})

test('new SwarmManager() should throw an error if incorrect arguments are supplied', async t => {
  let error = t.throws(
    () => new SwarmManager(),
    Error,
    'Creating a new SwarmManger with no arguments should throw an exception'
  )
  t.is(
    error.message,
    'new SwarmManager(rootDir, port): both rootDir and port are undefined'
  )

  error = t.throws(
    () => new SwarmManager(null, 1),
    Error,
    'Creating a new SwarmManger with only the port arguments should throw an exception'
  )
  t.is(error.message, 'new SwarmManager(rootDir, port): rootDir is undefined')

  error = t.throws(
    () => new SwarmManager(''),
    Error,
    'Creating a new SwarmManger with only the rootDir arguments should throw an exception'
  )
  t.is(error.message, 'new SwarmManager(rootDir, port): port is undefined')

  error = t.throws(
    () => new SwarmManager({}, 1),
    Error,
    'Creating a new SwarmManger with wrong type of rootDir arguments should throw an exception'
  )
  t.is(
    error.message,
    "new SwarmManager(rootDir, port): rootDir should be a 'string' received 'object'"
  )
})

test('creating a new SwarmManager should not initialize dats or swarm', async t => {
  const { context } = t
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)
  t.is(swarmMan.rootDir, context.rootDir)
  t.is(swarmMan.port, context.swarmPort)
  t.is(swarmMan.numDats(), 0)
  t.is(swarmMan.numSharing(), 0)
  t.is(swarmMan._dkToDat.size, 0)
  t.is(swarmMan._dirToDk.size, 0)
  t.is(swarmMan._connIdCounter, 0)
  t.is(swarmMan._swarm, null)
  t.false(swarmMan._closeServerShutDown)
  t.truthy(swarmMan.networkId)
})

test('SwarmManager should indicate if it can share a directory if it exists under rootdir otherwise should indicate cant', async t => {
  const { context } = t
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)
  t.true(
    await swarmMan.canShareDir(context.dir1),
    'should indicate ability to share a directory under rootdir'
  )
  t.true(
    await swarmMan.canShareDir(context.dir2),
    'should indicate ability to share a directory under rootdir'
  )
  t.false(
    await swarmMan.canShareDir(context.notUnderRoot),
    'should indicate inability to share a directory not under rootdir'
  )
})

test('SwarmManager.actualDirPath should join the supplied path to the rootdir correctly', async t => {
  const { context } = t
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)

  const fp1 = swarmMan.actualDirPath(context.dir1)
  t.true(fp1.startsWith(context.rootDir))
  t.true(await fs.pathExists(fp1))
  t.true((await fs.stat(fp1)).isDirectory())

  const fp2 = swarmMan.actualDirPath(context.dir2)
  t.true(fp2.startsWith(context.rootDir))
  t.true(await fs.pathExists(fp2))
  t.true((await fs.stat(fp2)).isDirectory())

  const fp3 = swarmMan.actualDirPath(context.notUnderRoot)
  t.true(fp3.startsWith(context.rootDir))
  t.false(await fs.pathExists(fp3))
  t.false(
    swarmMan
      .actualDirPath(fp1)
      .startsWith(path.join(context.rootDir, context.rootDir))
  )
})

test('SwarmManager.shareDir should not share a directory if it was not inited', async t => {
  const { context } = t
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)

  const error = await t.throws(() => swarmMan.shareDir(context.dir1), Error)
  t.is(error.message, `Cannot share ${context.dir1}. It is not initialized`)
})

test.serial(
  'SwarmManager should not emit "listening" when the swarm is listening and "close" when the swarm closes',
  async t => {
    const { context } = t
    const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)

    const listening = await new Promise((resolve, reject) => {
      swarmMan.initSwarm()
      swarmMan.once('listening', () => resolve(true))
      setTimeout(() => resolve(false), 4000)
    })
    t.true(listening, 'SwarmManager failed to emit listening')

    swarmMan.close().then()
    const closed = await new Promise((resolve, reject) => {
      swarmMan.once('close', () => resolve(true))
      setTimeout(() => resolve(false), 4000)
    })
    t.true(
      closed,
      'SwarmManager failed to emit close or the swarm did not close'
    )
  }
)

test.serial(
  'SwarmManager.initDat should initialize a dat in the supplied directory',
  async t => {
    const { context } = t
    context.deferredDatCleanup(context.dir1)
    const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)

    const datInfo = await swarmMan.initDat(context.dir1)
    t.truthy(datInfo, 'The return value of initDat should be non-null')
    t.true(
      typeof datInfo === 'object',
      'The return value of initDat should be an object'
    )
    t.true(typeof datInfo.discoveryKey === 'string')
    t.true(typeof datInfo.datKey === 'string')

    const dirP = swarmMan.actualDirPath(context.dir1)
    t.true(swarmMan.isActiveDir(dirP))
    t.is(swarmMan.numDats(), 1)
    t.is(swarmMan.numSharing(), 0)

    const dat = swarmMan.getDat(datInfo.discoveryKey)
    t.true(swarmMan.getDatForDir(dirP) === dat)
    t.true(swarmMan.isActiveDiscoveryKey(datInfo.discoveryKey))
    t.true(swarmMan.getDiscoveryKeyForDir(dirP) === datInfo.discoveryKey)
    t.true(dat.discoveryKey('hex') === datInfo.discoveryKey)
    t.true(dat.key('hex') === datInfo.datKey)
    t.false(dat.sharing())

    const reinit = await swarmMan.initDat(context.dir1)
    t.true(
      typeof reinit === 'object',
      'The return value of initDat should be an object'
    )
    t.true(typeof reinit.discoveryKey === 'string')
    t.true(reinit.discoveryKey === datInfo.discoveryKey)
    t.true(typeof reinit.datKey === 'string')
    t.true(reinit.datKey === datInfo.datKey)

    t.is(swarmMan.numDats(), 1)
    t.is(swarmMan.numSharing(), 0)

    context.addCleanUpable(dat.close())
    await context.cleanUp()
  }
)

test.serial(
  'SwarmManager should share and unshare a directory after it was inited',
  async t => {
    const { context } = t
    const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)
    await context.startSwarmMan(swarmMan)
    const tTO = setTimeout(
      () =>
        t.fail('SwarmMan share unshare failed to complete after 60 seconds'),
      60000
    )
    context.deferredDatCleanup(context.dir1)
    const initInfo = await swarmMan.initDat(context.dir1)
    const shareInfo = await swarmMan.shareDir(context.dir1)
    t.is(initInfo.datKey, shareInfo.datKey)
    t.is(initInfo.discoveryKey, shareInfo.discoveryKey)
    const sharedDK = await new Promise((resolve, reject) => {
      const to = setTimeout(
        () => reject(new Error('failed to share dat after 4sec')),
        10000
      )
      swarmMan.once('shared-dat', dk => {
        clearTimeout(to)
        resolve(dk)
      })
    })
    t.is(sharedDK, shareInfo.discoveryKey)
    t.is(sharedDK, initInfo.discoveryKey)
    t.is(swarmMan.numDats(), 1)
    t.is(swarmMan.numSharing(), 1)

    const dat = swarmMan.getDat(shareInfo.discoveryKey)
    t.true(dat.sharing())
    let replicatingKey = ''
    swarmMan.once('replicating', key => {
      replicatingKey = key
    })

    const { cloneDir } = await context.cloneDat(shareInfo.datKey, context.dir1)
    t.true((await fs.stat(cloneDir.datP)).isDirectory())
    t.true((await fs.stat(cloneDir.contentP)).isFile())
    t.is((await fs.readdir(cloneDir.datP)).length, 10)

    t.is(replicatingKey, dat.discoveryKey('hex'))
    t.is(replicatingKey, initInfo.discoveryKey)
    t.is(replicatingKey, shareInfo.discoveryKey)

    t.true(swarmMan.unshareDir(context.dir1))
    t.is(swarmMan.numDats(), 0)
    t.is(swarmMan.numSharing(), 0)
    t.false(swarmMan.isActiveDir(swarmMan.actualDirPath(context.dir1)))

    clearTimeout(tTO)
    await context.cleanUp()
  }
)

test.serial('SwarmManager should sync directories correctly', async t => {
  const { context } = t
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort)
  await context.startSwarmMan(swarmMan)
  const tTO = setTimeout(
    () => t.fail('SwarmMan sync failed to complete after 60 seconds'),
    60000
  )
  context.deferredDatCleanup(context.dir1)
  context.deferredDatCleanup(context.dir2)
  await swarmMan.initDat(context.dir1)
  const d1ShareInfo = await swarmMan.shareDir(context.dir1)
  const sharedDK1 = await new Promise((resolve, reject) => {
    const to = setTimeout(
      () => reject(new Error('failed to share dat after 4sec')),
      10000
    )
    swarmMan.once('shared-dat', dk => {
      clearTimeout(to)
      resolve(dk)
    })
  })
  t.is(sharedDK1, d1ShareInfo.discoveryKey)
  t.is(swarmMan.numDats(), 1)
  t.is(swarmMan.numSharing(), 1)

  const dat1 = swarmMan.getDatForDir(context.dir1)
  const { errors, results } = await swarmMan.sync({ dirs: [context.dir2] })
  t.is(errors.length, 0)
  t.is(results.length, 1)
  t.false(dat1.sharing())

  const { dir, discoveryKey, datKey } = results[0]
  t.is(dir, context.dir2)
  t.is(swarmMan.numDats(), 1)
  t.is(swarmMan.numSharing(), 1)

  const sharedDat = swarmMan.getDatForDir(dir)
  t.is(discoveryKey, sharedDat.discoveryKey('hex'))
  t.is(datKey, sharedDat.key('hex'))
  t.true(sharedDat.sharing())

  let replicatingKey = ''
  swarmMan.once('replicating', key => {
    replicatingKey = key
  })

  const { cloneDir } = await context.cloneDat(datKey, context.dir2)
  t.true((await fs.stat(cloneDir.datP)).isDirectory())
  t.true((await fs.stat(cloneDir.contentP)).isFile())
  t.is((await fs.readdir(cloneDir.datP)).length, 10)

  t.is(replicatingKey, sharedDat.discoveryKey('hex'))
  t.is(replicatingKey, discoveryKey)

  t.true(swarmMan.unshareDir(context.dir2))
  t.is(swarmMan.numDats(), 0)
  t.is(swarmMan.numSharing(), 0)
  t.false(swarmMan.isActiveDir(swarmMan.actualDirPath(context.dir1)))
  clearTimeout(tTO)
  await context.cleanUp()
})
