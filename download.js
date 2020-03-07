const fs = require('fs').promises;
const Path = require('path');
const Telegram = require('telegraf/telegram');
const FileType = require('file-type');
const fetch = require('node-fetch');
const db = require('./db');
require('dotenv').config();

const telegram = new Telegram(process.env.BOT_TOKEN);
(async () => {
    try {
        await fas.mkdir(process.env.MEME_PATH);
    }
    catch (_) {
        //ignore
    }
})();

/**
 * Downloads a meme, saves it locally and returns the file path.
 * @param {string} memeId The id of the meme.
 */
module.exports.downloadMeme = async function downloadMeme(memeId) {
    try {
        const link = await telegram.getFileLink(memeId)
        const res = await fetch(link);
        if (!res.ok) 
            throw "Failed to download file: invalid status code.";

        const buffer = await res.buffer();
        const type = await FileType.fromBuffer(buffer);

        if (!type)
            throw 'Faild to download file: Cannot determine file type.';

        const relPath = `${memeId}.${type.ext}`;
        const path = Path.join(process.env.MEME_PATH, relPath);
        fs.writeFile(path, buffer);

        const meta = {
            id: memeId,
            ext: type.ext,
            mime: type.mime,
            path: relPath
        };
        await db.add(meta);
        return meta;
    }
    catch (error) {
        console.error(error);
    }
}