'use strict'
const path = require('path')
const Datastore = require('nedb-core')

/**
 * Append only, json datastore for keying track of dat `Dat`
 */
class DatDB {
  constructor() {
    const filename = process.env.DB_DIR
      ? path.join(process.env.DB_DIR, 'datTracker.db')
      : 'datTracker.db'
    /**
     * @type {Datastore}
     */
    this.db = new Datastore({ filename, autoload: true })
    this.db.ensureIndex({ fieldName: 'dir', unique: true }, err => {
      if (err) {
        console.error(err)
      }
    })
  }

  /**
   * @desc Remove all entries in the db
   * @return {Promise<number>}
   */
  clear() {
    return this.remove({}, { multi: true })
  }

  /**
   * @desc Returns the number of db entries matching query
   * @param {Object} query
   * @return {Promise<number>}
   */
  count(query) {
    return new Promise((resolve, reject) => {
      this.db.count(query, (err, count) => {
        if (err) return reject(err)
        resolve(count)
      })
    })
  }

  /**
   * @desc Find multiple entries matching the query
   * @param {Object} query
   * @return {Promise<Object[]>}
   */
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

  /**
   * @desc Find a single entry matching the query
   * @param {Object} query
   * @return {Promise<Object>}
   */
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

  /**
   * @desc Find a entries matching the query and apply a projection
   * @param {Object} query
   * @param {Object} select
   * @return {Promise<Object[]>}
   */
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

  /**
   * @desc Retrieve all entries in the db
   * @return {Promise<Object[]>}
   */
  getAll() {
    return this.find({})
  }

  /**
   * @desc Remove entries matching query
   * @param {Object} query
   * @param {Object} [opts = {}]
   * @return {Promise<number>}
   */
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

  /**
   * @desc Insert one or many items in the db
   * @param {Object | Object[]} insertMe
   * @return {Promise<Object[]>}
   */
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

  /**
   * @desc Update entry(s) in the db
   * @param {Object} updateWho
   * @param {Object} theUpdate
   * @param {Object} [opts = {}]
   * @return {Promise<Object>}
   */
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
            resolve({ numAffected, affectedDocuments, upsert })
          }
        }
      )
    })
  }

  /**
   * @desc Update all entries in the db
   * @param {Object} theUpdate
   * @param {Object} [opts = {multi: true}]
   * @return {Promise<Object>}
   */
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
            resolve({ numAffected, affectedDocuments, upsert })
          }
        }
      )
    })
  }

  /**
   * @desc Updates the sharing status field of the db entry
   * @param {string} dir
   * @param {boolean} sharing
   * @return {Promise<Object>}
   */
  updateSharingStatus(dir, sharing) {
    return this.update({ dir }, { $set: { sharing } })
  }
}

module.exports = DatDB
