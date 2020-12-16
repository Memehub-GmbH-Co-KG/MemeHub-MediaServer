const fs = require('fs').promises;
const lowdb = require('lowdb');
const FileAsync = require('lowdb/adapters/FileAsync');
require('dotenv').config();

let collection;
let db;
let cache_size = 100;
let cache_path = 'cache';

module.exports.init = async function (config) {
    collection = config.local_db_collection;
    cache_size = config.cache_size;
    cache_path = config.cache_path;
    const adapter = new FileAsync(config.local_db_file);
    db = await lowdb(adapter);
    await db.defaults({ [collection]: [] })
        .write();
    await reset();
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

    // Queue to limit the cache
    limit();
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

/**
 * Checks if the size of the cache is larger than allowed 
 * and removes elements if necessary.
 */
async function limit() {
    const count = await db.get(collection)
        .size()
        .value();

    if (count <= cache_size)
        return;

    const to_remove = [...Array(count - cache_size).keys()];

    const removed = await db.get(collection)
        .pullAt(to_remove)
        .value();

    try {
        for (const meta of removed)
            await fs.unlink(meta.path);

        // If that worked, persist data
        await db.write();
    }
    catch (error) {
        console.error("Failed to remove media from cache:");
        console.error(error);
        await reset();
    }
}

/**
 * Clears the whole cache by removing all cached files
 * and resetting low db.
 */
async function reset() {
    console.warn("Resetting cache");

    try {
        // Reset low db
        await db.set(collection, [])
            .write();

        // Remove whole cache directory and recreate it
        await fs.rm(cache_path, {
            recursive: true,
            force: true
        });
        await fs.mkdir(cache_path);
    }
    catch (e) {
        console.error("Failed to reset cache:");
        console.error(e);
    }

}