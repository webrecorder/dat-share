'use strict'
const Datastore = require('nedb-core')

/**
 * Append only, json datastore for keying track of dat `Dat`
 */
class DatDB {
  constructor() {
    this.db = new Datastore({ filename: 'datTracker.db', autoload: true })
  }

  clearTracking() {
    return this.remove({}, { multi: true })
  }

  find(query) {
    return new Promise((resolve, reject) => {
      this.db.find(query, (err, docs) => {
        if (err) {
          reject(err)
        } else {
          resolve(docs)
        }
      })
    })
  }

  findOne(query) {
    return new Promise((resolve, reject) => {
      this.db.findOne(query, (err, doc) => {
        if (err) {
          reject(err)
        } else {
          resolve(doc)
        }
      })
    })
  }

  findSelect(query, select) {
    return new Promise((resolve, reject) => {
      this.db.find(query, select, (err, docs) => {
        if (err) {
          reject(err)
        } else {
          resolve(docs)
        }
      })
    })
  }

  getAll() {
    return this.find({})
  }

  remove(query, opts = {}) {
    return new Promise((resolve, reject) => {
      this.db.remove(query, opts, (err, rmc) => {
        if (err) {
          reject(err)
        } else {
          resolve(rmc)
        }
      })
    })
  }

  insert(insertMe) {
    return new Promise((resolve, reject) => {
      this.db.insert(insertMe, (err, docs) => {
        if (err) {
          reject(err)
        } else {
          resolve(docs)
        }
      })
    })
  }

  update(updateWho, theUpdate, opts = {}) {
    return new Promise((resolve, reject) => {
      this.db.update(
        updateWho,
        theUpdate,
        opts,
        (err, numAffected, affectedDocuments, upsert) => {
          if (err) {
            reject(err)
          } else {
            resolve(affectedDocuments)
          }
        }
      )
    })
  }

  updateAll(theUpdate, opts = { multi: true }) {
    return new Promise((resolve, reject) => {
      this.db.update(
        {},
        theUpdate,
        opts,
        (err, numAffected, affectedDocuments, upsert) => {
          if (err) {
            reject(err)
          } else {
            resolve(affectedDocuments)
          }
        }
      )
    })
  }
}

module.exports = DatDB
