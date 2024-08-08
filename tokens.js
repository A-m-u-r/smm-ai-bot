const db = require('./database');

let userTokens = {};

const  addRequest = async (userId, inputTokens,  outputTokens, prompt) => {
    await db.addRequest(userId, inputTokens,  outputTokens, prompt);
    userTokens[userId] = inputTokens;
};
const  addTokens = async (userId, count) => {
    await db.addTokens(userId, count);
};


module.exports = { addRequest,addTokens };
