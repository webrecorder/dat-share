import test from 'ava';
import * as fs from 'fs-extra';
import path from 'path';
import { TestContext } from './helpers';
import SwarmManager from '../lib/dat/swarmManager';

test.beforeEach(t => {
  t.context = new TestContext();
});

test.afterEach.always(async t => {
  if (t.context.hasCleanUp()) {
    await t.context.cleanUp();
  }
});

test('new SwarmManager() should throw an error if incorrect arguments are supplied', async t => {
  let error = t.throws(
    () => new SwarmManager(),
    Error,
    'Creating a new SwarmManger with no arguments should throw an exception'
  );
  t.is(
    error.message,
    'new SwarmManager(rootDir, port): both rootDir and port are undefined'
  );

  error = t.throws(
    () => new SwarmManager(null, 1),
    Error,
    'Creating a new SwarmManger with only the port arguments should throw an exception'
  );
  t.is(error.message, 'new SwarmManager(rootDir, port): rootDir is undefined');

  error = t.throws(
    () => new SwarmManager(''),
    Error,
    'Creating a new SwarmManger with only the rootDir arguments should throw an exception'
  );
  t.is(error.message, 'new SwarmManager(rootDir, port): port is undefined');

  error = t.throws(
    () => new SwarmManager({}, 1),
    Error,
    'Creating a new SwarmManger with wrong type of rootDir arguments should throw an exception'
  );
  t.is(
    error.message,
    "new SwarmManager(rootDir, port): rootDir should be a 'string' received 'object'"
  );
});

test('creating a new SwarmManager should not initialize dats or swarm', async t => {
  const { context } = t;
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort);
  t.is(
    swarmMan.rootDir,
    context.rootDir,
    'the SwarmManager rootDir should be equal to the one used to create it'
  );
  t.is(
    swarmMan.port,
    context.swarmPort,
    'the SwarmManager port should be equal to the value of swarmPort used to create it'
  );
  t.is(
    swarmMan.numDats(),
    0,
    'the SwarmManager should not indicate it has dats right after creation'
  );
  t.is(
    swarmMan.numSharing(),
    0,
    'the SwarmManager should not indicate it is sharing dats right after creation'
  );
  t.is(
    swarmMan._dkToDat.size,
    0,
    'the SwarmManager should not indicate it has dats right after creation'
  );
  t.is(
    swarmMan._dirToDk.size,
    0,
    'the SwarmManager should not indicate it has dats right after creation'
  );
  t.is(
    swarmMan._connIdCounter,
    0,
    'the SwarmManager should not have recieved connections after creation'
  );
  t.is(
    swarmMan._swarm,
    null,
    'the SwarmManager should not have joined the swarm after creation'
  );
  t.false(
    swarmMan._closeServerShutDown,
    'the SwarmManager should not have shut down after creation'
  );
  t.truthy(
    swarmMan.networkId,
    'the SwarmManager should have assigned itself a network id'
  );
});

test('SwarmManager should indicate if it can share a directory if it exists under rootdir otherwise should indicate cant', async t => {
  const { context } = t;
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort);
  t.true(
    await swarmMan.canShareDir(context.dir1),
    'should indicate ability to share a directory under rootdir'
  );
  t.true(
    await swarmMan.canShareDir(context.dir2),
    'should indicate ability to share a directory under rootdir'
  );
  t.false(
    await swarmMan.canShareDir(context.notUnderRoot),
    'should indicate inability to share a directory not under rootdir'
  );
});

test('SwarmManager.actualDirPath should join the supplied path to the rootdir correctly', async t => {
  const { context } = t;
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort);

  const fp1 = swarmMan.actualDirPath(context.dir1);
  t.true(
    fp1.startsWith(context.rootDir),
    'actualDirPath(dir1) should start with rootDir'
  );
  t.true(await fs.pathExists(fp1), 'fp1 should exist');
  t.true((await fs.stat(fp1)).isDirectory(), 'fp1 should be a dir');
  t.false(
    swarmMan
      .actualDirPath(fp1)
      .startsWith(path.join(context.rootDir, context.rootDir)),
    'actualDirPath should not prefix rootDir if the supplied path starts with it'
  );

  const fp2 = swarmMan.actualDirPath(context.dir2);
  t.true(
    fp2.startsWith(context.rootDir),
    'actualDirPath(dir2) should start with rootDir'
  );
  t.true(await fs.pathExists(fp2), 'fp2 should exist');
  t.true((await fs.stat(fp2)).isDirectory(), 'fp2 should be a dir');
  t.false(
    swarmMan
      .actualDirPath(fp2)
      .startsWith(path.join(context.rootDir, context.rootDir)),
    'actualDirPath should not prefix rootDir if the supplied path starts with it'
  );

  const fp3 = swarmMan.actualDirPath(context.notUnderRoot);
  t.true(
    fp3.startsWith(context.rootDir),
    'actualDirPath(notUnderRoot) should start with rootDir'
  );
  t.false(await fs.pathExists(fp3), 'fp3 should not exist');
  t.false(
    swarmMan
      .actualDirPath(fp3)
      .startsWith(path.join(context.rootDir, context.rootDir)),
    'actualDirPath should not prefix rootDir if the supplied path starts with it'
  );
});

test.serial(
  'SwarmManager should not emit "listening" when the swarm is listening and "close" when the swarm closes',
  async t => {
    const { context } = t;
    const swarmMan = new SwarmManager(context.rootDir, context.swarmPort);

    const listening = await new Promise((resolve, reject) => {
      swarmMan.initSwarm();
      swarmMan.once('listening', () => resolve(true));
      setTimeout(() => resolve(false), 4000);
    });
    t.true(listening, 'SwarmManager failed to emit listening');

    swarmMan.close().then();
    const closed = await new Promise((resolve, reject) => {
      swarmMan.once('close', () => resolve(true));
      setTimeout(() => resolve(false), 4000);
    });
    t.true(
      closed,
      'SwarmManager failed to emit close or the swarm did not close'
    );
  }
);

test.serial(
  'SwarmManager.initDat should initialize a dat in the supplied directory',
  async t => {
    const { context } = t;
    context.deferredDatCleanup(context.dir1);
    const swarmMan = new SwarmManager(context.rootDir, context.swarmPort);

    const datInfo = await swarmMan.initDat(context.dir1);
    t.truthy(datInfo, 'The return value of initDat should be non-null');
    t.true(
      typeof datInfo === 'object',
      'The return value of initDat should be an object'
    );
    t.true(
      typeof datInfo.discoveryKey === 'string',
      'datInfo.discoveryKey should be a string'
    );
    t.true(
      typeof datInfo.datKey === 'string',
      'datInfo.datKey should be a string'
    );

    const dirP = swarmMan.actualDirPath(context.dir1);
    t.true(
      swarmMan.isActiveDir(context.dir1),
      "Once a directory is init'd, isActiveDir should return true"
    );
    t.is(
      swarmMan.numDats(),
      1,
      "Once a directory is init'd, numDats should return 1"
    );
    t.is(
      swarmMan.numSharing(),
      0,
      "Once a directory is init'd, numSharing should be 0"
    );

    const dat = swarmMan.getDat(datInfo.discoveryKey);
    t.truthy(
      dat,
      "Once a directory is init'd, getDat should return the dat associated with the directory"
    );
    t.true(
      swarmMan.getDatForDir(context.dir1) === dat,
      "Once a directory is init'd, the dat retrieved using getDatForDir, should match the dat returned from getDat"
    );
    t.true(
      swarmMan.getDiscoveryKeyForDir(context.dir1) === datInfo.discoveryKey,
      "Once a directory is init'd, the discovery key returned by getDiscoveryKeyForDir should match the datInfo's"
    );
    t.true(
      dat.discoveryKey('hex') === datInfo.discoveryKey,
      "Once a directory is init'd, dat.discoveryKey('hex') should match the datInfo's"
    );
    t.true(
      dat.key('hex') === datInfo.datKey,
      "Once a directory is init'd, dat.key('hex') should match the datInfo's"
    );
    t.false(
      dat.sharing(),
      "Once a directory is init'd, the dat retrieved using getDat, should not indicate it is being shared after init"
    );

    const reinit = await swarmMan.initDat(context.dir1);
    t.true(
      typeof reinit === 'object',
      'The return value of initDat should be an object'
    );
    t.true(
      typeof reinit.discoveryKey === 'string',
      'The return value of initDat 2x should have a discoveryKey property'
    );
    t.true(
      reinit.discoveryKey === datInfo.discoveryKey,
      'The return value of initDat 2x should have a discoveryKey property equal to first init value'
    );
    t.true(
      typeof reinit.datKey === 'string',
      'The return value of initDat 2x should have a datKey property'
    );
    t.true(
      reinit.datKey === datInfo.datKey,
      'The return value of initDat 2x should have a datKey property equal to first init value'
    );

    t.is(
      swarmMan.numDats(),
      1,
      'The return value of numDats after init 2x should be 1'
    );
    t.is(
      swarmMan.numSharing(),
      0,
      'The return value of numSharing after init 2x should be 0'
    );

    context.addCleanUpable(dat.close());
  }
);

test.serial(
  'SwarmManager should share and unshare a directory after it was inited',
  async t => {
    const { context } = t;
    const swarmMan = new SwarmManager(context.rootDir, context.swarmPort);
    await context.startSwarmMan(swarmMan);
    const tTO = setTimeout(
      () =>
        t.fail('SwarmMan share unshare failed to complete after 60 seconds'),
      60000
    );
    context.deferredDatCleanup(context.dir1);
    const initInfo = await swarmMan.initDat(context.dir1);
    const shareInfo = await swarmMan.shareDir(context.dir1);
    t.is(
      initInfo.datKey,
      shareInfo.datKey,
      'The initInfo.datKey should equal shareInfo.datKey'
    );
    t.is(
      initInfo.discoveryKey,
      shareInfo.discoveryKey,
      'The initInfo.discoveryKey should equal shareInfo.discoveryKey'
    );
    const sharedDK = await new Promise((resolve, reject) => {
      const to = setTimeout(
        () => reject(new Error('failed to share dat after 4sec')),
        10000
      );
      swarmMan.once('shared-dat', dk => {
        clearTimeout(to);
        resolve(dk);
      });
    });
    t.is(
      sharedDK,
      shareInfo.discoveryKey,
      'The sharedDK should be equal to shareInfo.discoveryKey'
    );
    t.is(
      sharedDK,
      initInfo.discoveryKey,
      'The sharedDK should be equal to initInfo.discoveryKey'
    );
    t.is(
      swarmMan.numDats(),
      1,
      'After init and share numDats should still be 1'
    );
    t.is(
      swarmMan.numSharing(),
      1,
      'After init and share numSharing should be 1'
    );

    const dat = swarmMan.getDat(shareInfo.discoveryKey);
    t.true(
      dat.sharing(),
      'After init and share the dat returned from getDat should indicate it is being shared'
    );
    let replicatingKey = '';
    swarmMan.once('replicating', key => {
      replicatingKey = key;
    });

    const { cloneDir } = await context.cloneDat(shareInfo.datKey, context.dir1);
    t.true(
      (await fs.stat(cloneDir.datP)).isDirectory(),
      'After cloning the dat cloned dat directory should exist'
    );
    t.true(
      (await fs.stat(cloneDir.contentP)).isFile(),
      'After cloning the dats content directory should exist'
    );
    t.is(
      (await fs.readdir(cloneDir.datP)).length,
      10,
      'After cloning the dats content directory should contain content'
    );

    t.is(
      replicatingKey,
      dat.discoveryKey('hex'),
      'the replicating key from emitted from SwarmMan should equal the dats'
    );
    t.is(
      replicatingKey,
      initInfo.discoveryKey,
      'the replicating key from emitted from SwarmMan should equal initInfo.discoveryKey'
    );
    t.is(
      replicatingKey,
      shareInfo.discoveryKey,
      'the replicating key from emitted from SwarmMan should equal shareInfo.discoveryKey'
    );

    t.true(
      swarmMan.unshareDir(context.dir1),
      'SwarmMan should return true from unshareDir when unsharing a dir that is shared'
    );
    t.is(
      swarmMan.numDats(),
      0,
      'After unsharing a directory numDats should be 0'
    );
    t.is(
      swarmMan.numSharing(),
      0,
      'After unsharing a directory numSharing should be 0'
    );
    t.false(
      swarmMan.isActiveDir(swarmMan.actualDirPath(context.dir1)),
      'After unsharing a directory isActiveDir should return false for the unshared dir'
    );

    clearTimeout(tTO);
  }
);

test.serial('SwarmManager should sync directories correctly', async t => {
  const { context } = t;
  const swarmMan = new SwarmManager(context.rootDir, context.swarmPort);
  await context.startSwarmMan(swarmMan);
  const tTO = setTimeout(
    () => t.fail('SwarmMan sync failed to complete after 60 seconds'),
    60000
  );
  context.deferredDatCleanup(context.dir1);
  context.deferredDatCleanup(context.dir2);
  await swarmMan.initDat(context.dir1);
  const d1ShareInfo = await swarmMan.shareDir(context.dir1);
  const sharedDK1 = await new Promise((resolve, reject) => {
    const to = setTimeout(
      () => reject(new Error('failed to share dat after 4sec')),
      10000
    );
    swarmMan.once('shared-dat', dk => {
      clearTimeout(to);
      resolve(dk);
    });
  });
  t.is(
    sharedDK1,
    d1ShareInfo.discoveryKey,
    'sharedDK1 should equal d1ShareInfo.discoveryKey'
  );
  t.is(swarmMan.numDats(), 1, 'numDats should be 1');
  t.is(swarmMan.numSharing(), 1, 'numSharing should be 1');

  const dat1 = swarmMan.getDatForDir(context.dir1);
  const { errors, results } = await swarmMan.sync({ dirs: [context.dir2] });
  t.is(
    errors.length,
    0,
    'syncing should not return errors for an existing dir'
  );
  t.is(results.length, 1, 'syncing should return 1 result for syncing one dir');
  t.false(
    dat1.sharing(),
    'the previously shared dat after syncing should indicate it is not being shared'
  );

  const { dir, discoveryKey, datKey } = results[0];
  t.is(swarmMan.numDats(), 1, 'after sync numDats should be 1');
  t.is(swarmMan.numSharing(), 1, 'after sync numSharing should be 1');

  const sharedDat = swarmMan.getDatForDir(context.dir2);
  t.is(
    discoveryKey,
    sharedDat.discoveryKey('hex'),
    'the newly shared dat (from sync) discoveryKey should equal the sync results discoveryKey'
  );
  t.is(
    datKey,
    sharedDat.key('hex'),
    'the newly shared dat (from sync) datKey should equal the sync results datKey'
  );
  t.true(
    sharedDat.sharing(),
    'the newly shared dat (from sync) datKey should indicate it is being shared'
  );

  let replicatingKey = '';
  swarmMan.once('replicating', key => {
    replicatingKey = key;
  });

  const { cloneDir } = await context.cloneDat(datKey, context.dir2);
  t.true(
    (await fs.stat(cloneDir.datP)).isDirectory(),
    'After cloning the dat cloned dat directory should exist'
  );
  t.true(
    (await fs.stat(cloneDir.contentP)).isFile(),
    'After cloning the dats content directory should exist'
  );
  t.is(
    (await fs.readdir(cloneDir.datP)).length,
    10,
    'After cloning the dats content directory should contain content'
  );

  t.is(
    replicatingKey,
    sharedDat.discoveryKey('hex'),
    'replicating key should equal shared dat discoveryKey '
  );
  t.is(
    replicatingKey,
    discoveryKey,
    'replicating key should equal discovery key'
  );

  t.true(
    swarmMan.unshareDir(context.dir2),
    'SwarmMan should return true from unshareDir when unsharing a dir that is shared'
  );
  t.is(
    swarmMan.numDats(),
    0,
    'After unsharing a directory numDats should be 0'
  );
  t.is(
    swarmMan.numSharing(),
    0,
    'After unsharing a directory numSharing should be 0'
  );
  t.false(
    swarmMan.isActiveDir(context.dir2),
    'After unsharing a directory isActiveDir should return false for the unshared dir'
  );
  clearTimeout(tTO);
});
