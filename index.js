const { Client, Defaults, Subscriber } = require('redis-request-broker')
const send = require('koa-send');
const cors = require('@koa/cors');
const Koa = require('koa');
const app = new Koa();
const db = require('./cache');
const dl = require('./download');
// response
app.use(cors());
app.use(onRequest);

const actions = {
    'meta': getMeta,
    'file': getFile,
}

let server;

async function onRequest(ctx, next) {
    console.log("Request");

    if (ctx.request.method !== 'GET')
        return await next();


    const location = ctx.request.path.split('/');
    console.log('GET', location);

    try {
        // Index
        if (location.length < 2)
            return 'OK';

        // No action specified: request file
        // Else: what ever defined
        const id = location[1];
        const action = location.length < 3
            ? getFile
            : actions[location[2]];

        if (!action)
            throw "Invalid action.";

        return await action(ctx, id)
    }
    catch (error) {
        console.error(error);
        throw "Failed to handle request.";
    }
}

async function getMeta(ctx, id) {
    let meta = await db.get(id);
    if (!meta)
        meta = await dl.downloadMeme(id);

    if (!meta) {
        ctx.reponse.status = 404;
        return;
    }

    ctx.body = meta;
    return meta;
}

async function getFile(ctx, id) {
    let meta = await db.get(id);
    if (!meta)
        meta = await dl.downloadMeme(id);

    if (!meta) {
        ctx.reponse.status = 404;
        return;
    }
    return await send(ctx, meta.path);
}

async function restart() {
    console.log("Restarting...");
    await stop();
    await init();
}

async function stop() {
    console.log("Stopping...");
    await new Promise((resolve, _) => {
        if (server)
            server.close(resolve);

        resolve();
    });
    console.log("Shutdown complete.");
}

async function init() {

    console.log("Starting up...");

    console.log(process.env.REDIS_PREFIX);
    // Set rrb defaults
    Defaults.setDefaults({
        redis: {
            prefix: process.env.REDIS_PREFIX || 'mh:',
            host: process.env.REDIS_HOST || "mhredis",
            port: process.env.REDIS_PORT || undefined,
            db: process.env.REDIS_DB || undefined,
            password: process.env.REDIS_PASSWORD || undefined
        }
    });

    // Get config and lua on startup
    console.log("Getting config...");
    let config;
    try {
        config = await getConfig();
    } catch (e) {
        console.error('Cannot load config. Exiting.');
        console.error(e);
        process.exit(1);
    }

    // Trigger restart on config change
    console.log("Listening for config changes...");
    restartSubscriber = new Subscriber(config.rrb.channels.config.changed, onConfigChange);
    await restartSubscriber.listen();

    console.log("initializing...");
    db.init(config);
    dl.init(config);
    server = app.listen(config.port);
    console.log("Startup complete.");
}

async function getConfig() {
    const client = new Client('config:get', { timeout: 10000 });
    await client.connect();
    const [media_server, telegram, rrb] = await client.request(['media_server', 'telegram', 'rrb']);

    // Set defaults, if config does not exist
    if (!media_server)
        media_server = await setDefaultConfig();

    await client.disconnect();
    return { token: telegram.bot_token, ...media_server, rrb };
}

async function setDefaultConfig() {
    console.log("Setting default config");
    const config = {
        port: 3344,
        cache_path: './cache',
        cache_size: 100,
        local_db_file: './meme.json',
        local_db_collection: 'memes'
    }

    const client = new Client('config:set', { timeout: 10000 });
    await client.connect();
    const ok = await client.request({
        media_server: config
    });

    if (!ok)
        console.log("Failed to update config.");

    return config;
}

async function onConfigChange(keys) {
    if (!Array.isArray(keys))
        restart();

    if (keys.some(k => k.startsWith('telegram') || k.startsWith('media_server') || k.startsWith('rrb')))
        restart();
}

process.on('beforeExit', async () => {
    console.log("BEFORE EXIT");
    await stop();
});

init()