const DatStorage = require('dat-storage')
const ras3 = require('random-access-s3')
const multi = require('multi-random-access')
const AWS = require('aws-sdk')
const messages = require('append-tree/messages')
const stat = require('hyperdrive/lib/messages').Stat

function get(metadata, btm, seq, cb) {
  if (seq < btm) return cb(null, -1, null)

  // TODO: this can be done a lot faster using the hypercore internal iterators, expose!
  let i = seq
  while (!metadata.has(i) && i > btm) i--
  if (!metadata.has(i)) return cb(null, -1, null)

  metadata.get(i, { valueEncoding: messages.Node }, function(err, node) {
    if (err) return cb(err)

    let st = node.value && stat.decode(node.value)

    if (
      !node.value ||
      (!st.offset && !st.blocks) ||
      (!st.byteOffset && !st.blocks)
    ) {
      return get(metadata, btm, i - 1, cb) // TODO: check the index instead for fast lookup
    }

    cb(null, i, node, st)
  })
}

function find(metadata, bytes, cb) {
  let top = metadata.length - 1
  let btm = 1
  let mid = Math.floor((top + btm) / 2)

  get(metadata, btm, mid, function loop(err, actual, node, st) {
    if (err) return cb(err)

    let oldMid = mid

    if (!node) {
      btm = mid
      mid = Math.floor((top + btm) / 2)
    } else {
      let start = st.byteOffset
      let end = st.byteOffset + st.size

      if (start <= bytes && bytes < end) return cb(null, node, st, actual)
      if (top <= btm) return cb(null, null, null, -1)

      if (bytes < start) {
        top = mid
        mid = Math.floor((top + btm) / 2)
      } else {
        btm = mid
        mid = Math.floor((top + btm) / 2)
      }
    }

    if (mid === oldMid) {
      if (btm < top) mid++
      else return cb(null, null, null, -1)
    }

    get(metadata, btm, mid, loop)
  })
}

class HybridStorage {
  constructor(realDir, bucket) {
    this.s3 = new AWS.S3({ apiVersion: '2006-03-01' })
    this.localStorage = DatStorage(realDir)
    this.overriderDS = this.overriderDS.bind(this)
    this.createStorage = this.createStorage.bind(this)
    this.s3Options = {
      bucket,
      s3: this.s3,
      verbose: true,
    }
  }

  static newOne(realDir, bucket) {
    const hs = new HybridStorage(realDir, bucket)
    return hs.overriderDS()
  }

  overriderDS() {
    return {
      metadata: (file, opts) => {
        return this.localStorage.metadata(file, opts)
      },
      content: (file, opts, archive) => {
        if (file === 'data') {
          return this.createStorage(archive, this.s3Options)
        }
        return this.localStorage.content(file, opts, archive)
      },
    }
  }

  createStorage(archive, options) {
    if (!archive.latest) {
      throw new Error('Currently only "latest" mode is supported.')
    }

    let latest = archive.latest
    let head = null
    const storage = multi({ limit: 128 }, function locate(offset, cb) {
      archive.ready(function(err) {
        if (err) return cb(err)

        find(archive.metadata, offset, function(err, node, st, index) {
          if (err) return cb(err)
          if (!node) return cb(new Error('Could not locate data'))

          let v = latest ? '' : '.' + index

          cb(null, {
            start: st.byteOffset,
            end: st.byteOffset + st.size,
            storage: ras3(node.name + v, options),
          })
        })
      })
    })

    // TODO: this should be split into two events, 'appending' and 'append'
    archive.on('appending', function onappending(name, opts) {
      if (head) head.end = archive.content.byteLength

      let v = latest ? '' : '.' + archive.metadata.length

      head = {
        start: archive.content.byteLength,
        end: Infinity,
        storage: ras3(name + v, options),
      }

      storage.add(head)
    })

    archive.on('append', function onappend(name, opts) {
      if (head) head.end = archive.content.byteLength
    })

    return storage
  }
}
