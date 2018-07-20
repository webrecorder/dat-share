import test from 'ava'
import * as fs from 'fs-extra'
import rp from 'request-promise'
import { DatShareContext } from './helpers'

test.before(async t => {
  t.context = new DatShareContext()
  await t.context.startServer()
})

test.after.always(async t => {
  await t.context.closeServer()
  await t.context.cleanUp()
})

test.serial.only('post /init should initialize the dat', async t => {
  const res = await rp({
    method: 'POST',
    uri: 'http://localhost:3000/init',
    body: {
      collDir: t.context.dir1,
    },
    json: true,
  })
  t.truthy(res)
  t.true(res.datKey != null)
  t.true(res.discoveryKey != null)
  t.true(await fs.pathExists(t.context.dir1DatPath))
  t.context.deferredDatCleanup(t.context.dir1)
})

test.serial.only(
  'get /numSharing initialize the dat should return 0 but get /numDats should return 1',
  async t => {
    let res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numSharing',
      json: true,
    })
    t.truthy(res)
    t.is(res.num, 0)
    res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numDats',
      json: true,
    })
    t.truthy(res)
    t.is(res.num, 1)
  }
)

test.serial.only(
  'post /share after post /init should share the dat',
  async t => {
    const res = await rp({
      method: 'POST',
      uri: 'http://localhost:3000/share',
      body: {
        collDir: t.context.dir1,
      },
      json: true,
    })
    const sharedProm = new Promise((resolve, reject) => {
      const to = setTimeout(
        () => reject(new Error('failed to share dat after 10sec')),
        10000
      )
      t.context.once('shared-dat', dk => {
        clearTimeout(to)
        resolve(dk)
      })
    })
    t.truthy(res)
    t.true(res.datKey != null)
    t.true(res.discoveryKey != null)
    const serverKey = await sharedProm
    t.is(res.discoveryKey, serverKey)
    let replicatingKey = ''
    t.context.once('replicating', key => {
      replicatingKey = key
    })
    const { cloneDir } = await t.context.cloneDat(res.datKey, t.context.dir1)
    t.true((await fs.stat(cloneDir.datP)).isDirectory())
    t.true((await fs.stat(cloneDir.contentP)).isFile())
    t.is((await fs.readdir(cloneDir.datP)).length, 10)
  }
)

test.serial.only(
  'get /numSharing sharing the dat should return 1 and get /numDats should return 1',
  async t => {
    let res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numSharing',
      json: true,
    })
    t.truthy(res)
    t.is(res.num, 1)
    res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numDats',
      json: true,
    })
    t.truthy(res)
    t.is(res.num, 1)
  }
)
