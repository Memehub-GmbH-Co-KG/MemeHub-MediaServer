const { Worker, Defaults } = require('redis-request-broker');
const db = require('./db');
const dl = require('./download');
require('dotenv').config();

const worker = new Worker('downloader:get', downloadOrGet);

worker.listen();

async function downloadOrGet(request) {

    try {
        const id = request.memeId;
        const meta = await db.get(id);
        if (!meta)
            return await dl.downloadMeme(id);
        return meta;
    }
    catch (error) {
        console.error(error);
        throw "Failed to get meme.";
    }
}

process.on('beforeExit', async () => {
    await worker.stop();
});