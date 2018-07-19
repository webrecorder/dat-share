import test from 'ava'
import * as fs from 'fs-extra'
import path from 'path'
import { DatWrapperContext } from './helpers'
import DW from '../lib/dat/datWrapper'

test.before(t => {
  t.context = new DatWrapperContext()
})

test('DatWrapper.from should throw an error if no arguments are supplied', async t => {
  const error = await t.throws(
    () => DW.from(),
    Error,
    'Creating a dat wrapper using a directory that does not exist should not throws'
  )
  t.is(error.message, 'DatWrapper.from: directory or storage required')
})

test('DatWrapper.from should throw an error if opts is not an object', async t => {
  const error = await t.throws(
    () => DW.from('', 1),
    Error,
    'Supplying non-object options to DatWrapper.from should throw an error'
  )
  t.is(error.message, 'DatWrapper.from: opts should be type object')
})

test('DatWrapper.from should not throw when creating an non existing dat dir', async t => {
  const scd = t.context.shouldCreateDir
  await t.notThrows(
    DW.from(scd),
    'Creating a dat wrapper using a directory that does not exist should not throws'
  )
  const datPath = path.join(scd, '.dat')
  const dirExists = await fs.pathExists(scd)
  const datDirExists = await fs.pathExists(datPath)
  t.true(
    dirExists && datDirExists,
    'The previously non-existent directory and dat directory should be created'
  )
  t.deepEqual(
    await fs.readdir(datPath),
    [
      'content.bitfield',
      'content.key',
      'content.signatures',
      'content.tree',
      'metadata.bitfield',
      'metadata.data',
      'metadata.key',
      'metadata.ogd',
      'metadata.signatures',
      'metadata.tree',
    ],
    'The newly created .dat dir should contain the dat information'
  )
  await t.notThrows(
    fs.remove(scd),
    'The previously non-existent dat directory that was created should be removable'
  )
})

test('DatWrapper._[json | sharing] should be set to the default values on create ', async t => {
  const scd = t.context.shouldCreateDir
  const dat = await DW.from(scd)
  t.false(dat.sharing(), 'The sharing function should return false')
  t.false(dat._sharing, 'The _sharing property should be false')
  t.is(dat._json, null, 'The _json property should not be initialized')
  await fs.remove(scd)
})
