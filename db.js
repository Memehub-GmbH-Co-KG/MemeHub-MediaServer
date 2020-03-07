const lowdb = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
require('dotenv').config();

const collection = process.env.LOCAL_DB_COLLECTION;
const adapter = new FileAsync(process.env.LOCAL_DB_FILE);
let db;

(async () => {
    db = await lowdb(adapter);
    await db.defaults({ [collection]: [] })
        .write();
})();

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