import test from 'ava';
import * as fs from 'fs-extra';
import rp from 'request-promise';
import { TestContext } from './helpers';

test.before(async t => {
  t.context = new TestContext();
  await t.context.startServer();
});

test.after.always(async t => {
  await t.context.cleanUp();
});

test.serial('post /init should initialize the dat', async t => {
  const res = await rp({
    method: 'POST',
    uri: 'http://localhost:3000/init',
    body: {
      collDir: t.context.dir1,
    },
    json: true,
  });
  t.truthy(res, 'The post /init request should return a response');
  t.true(res.datKey != null, 'The response should send a non null dataKey');
  t.true(
    res.discoveryKey != null,
    'The response should send a non null discoveryKey'
  );
  t.true(
    await fs.pathExists(t.context.dir1DatPath),
    'The .dat should be created'
  );
  t.context.deferredDatCleanup(t.context.dir1);
});

test.serial(
  'get /numSharing initialize the dat should return 0 but get /numDats should return 1',
  async t => {
    let res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numSharing',
      json: true,
    });
    t.truthy(res, 'The post /numSharing request should return a response');
    t.is(res.num, 0, 'The response should indicate we have 0 shared dats');
    res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numDats',
      json: true,
    });
    t.truthy(res, 'The post /numDats request should return a response');
    t.is(res.num, 1, 'The response should indicate we have 1 dat');
  }
);

test.serial('post /share after post /init should share the dat', async t => {
  const res = await rp({
    method: 'POST',
    uri: 'http://localhost:3000/share',
    body: {
      collDir: t.context.dir1,
    },
    json: true,
  });
  const sharedProm = new Promise((resolve, reject) => {
    const to = setTimeout(
      () => reject(new Error('failed to share dat after 10sec')),
      10000
    );
    t.context.once('shared-dat', dk => {
      clearTimeout(to);
      resolve(dk);
    });
  });
  t.truthy(res, 'The post /share request should return a response');
  t.true(res.datKey != null, 'The response should send a non null dataKey');
  t.true(
    res.discoveryKey != null,
    'The response should send a non null discoveryKey'
  );
  const serverKey = await sharedProm;
  t.is(
    res.discoveryKey,
    serverKey,
    'The responses discoveryKey should be equal to the one the sever uses to join the swarm'
  );
  let replicatingKey = '';
  t.context.once('replicating', key => {
    replicatingKey = key;
  });
  const { cloneDir } = await t.context.cloneDat(res.datKey, t.context.dir1);
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
    serverKey,
    'The replicatingKey should be equal to the one the sever uses to join the swarm'
  );
  t.is(
    replicatingKey,
    res.discoveryKey,
    'The replicatingKey should be equal to the responses discoveryKey'
  );
});

test.serial(
  'get /numSharing sharing the dat should return 1 and get /numDats should return 1',
  async t => {
    let res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numSharing',
      json: true,
    });
    t.truthy(res, 'The post /numSharing request should return a response');
    t.is(res.num, 1, 'The response should indicate we are sharing 1 dat');
    res = await rp({
      method: 'GET',
      uri: 'http://localhost:3000/numDats',
      json: true,
    });
    t.truthy(res, 'The post /numDats request should return a response');
    t.is(res.num, 1, 'The response should indicate we have 1 dat');
  }
);
