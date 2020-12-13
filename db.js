const lowdb = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
require('dotenv').config();

let collection = process.env.LOCAL_DB_COLLECTION;
let db;

module.exports.init = async function (config) {
    collection = config.local_db_collection;
    const adapter = new FileAsync(config.local_db_file);
    db = await lowdb(adapter);
    await db.defaults({ [collection]: [] })
        .write();
}

const requiredAttributes = [
    'id',
    'ext',
    'mime',
    'path'
]

/**
 * Adds meme metadata to the index.
 * @param {any} memeMeta The meta data of the meme.
 */
module.exports.add = async function add(memeMeta) {
    for (const attr of requiredAttributes) {
        if (!attr in memeMeta)
            throw `Cannot index meme: Missing attribute '${attr}'`;
    }

    await db.get(collection)
        .push(memeMeta)
        .write();
}

/**
 * Gets meme metadata from the index
 * @param {*} memeId 
 */
module.exports.get = async function get(memeId) {
    return await db.get(collection)
        .find({ id: memeId })
        .value();
}