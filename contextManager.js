// contextManager.js
const db = require('./database');

let userContexts = {};
let activeContexts = {};

async function loadContexts() {
    try {
        activeContexts = await db.getActiveContexts();
    } catch (error) {
        console.error('Error loading active contexts:', error);
    }
}

loadContexts();

module.exports = {
    userContexts,
    activeContexts,
    saveContext: async (userId, contextName, contextData) => {
        await db.saveContext(userId, contextName, contextData);
        if (!userContexts[userId]) userContexts[userId] = {};
        userContexts[userId][contextName] = contextData;
    },
    getContexts: async (userId) => {
        if (!userContexts[userId]) {
            userContexts[userId] = await db.getContexts(userId);
        }
        return userContexts[userId];
    },

    setActiveContext: async (userId, contextData) => {
        await db.saveActiveContext(userId, contextData);
        activeContexts[userId] = contextData;
    },
    getActiveContext: (userId) => {
        return activeContexts[userId] || null;
    },
    deleteContext: async (userId, contextName) => {
        await db.deleteContext(userId, contextName);
        if (userContexts[userId]) {
            delete userContexts[userId][contextName];
        }
    },

};
