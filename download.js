const fs = require('fs').promises;
const Path = require('path');
const Telegram = require('telegraf/telegram');
const FileType = require('file-type');
const fetch = require('node-fetch');
const db = require('./cache');
require('dotenv').config();

let telegram;
let config;
module.exports.init = async function init(_config) {
    config = _config;
    telegram = new Telegram(config.token);
}

/**
 * Downloads a meme, saves it locally and returns the file path.
 * @param {string} memeId The id of the meme.
 */
module.exports.downloadMeme = async function downloadMeme(memeId) {
    try {
        console.log("Downloading", memeId);
        const link = await telegram.getFileLink(memeId)
        const res = await fetch(link);
        if (!res.ok)
            throw "Failed to download file: invalid status code.";

        const buffer = await res.buffer();
        const type = await FileType.fromBuffer(buffer);

        if (!type)
            throw 'Faild to download file: Cannot determine file type.';

        const relPath = `${memeId}.${type.ext}`;
        const path = Path.join(config.cache_path, relPath);
        await fs.writeFile(path, buffer);

        const meta = {
            id: memeId,
            ext: type.ext,
            mime: type.mime,
            path
        };
        await db.add(meta);
        return meta;
    }
    catch (error) {
        console.error(error);
    }
}