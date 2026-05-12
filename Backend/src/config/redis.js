const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

async function connectRedis() {
    await redisClient.connect();
    console.log('Conectado a Redis Stack en la nube');
}

connectRedis();

module.exports = redisClient;