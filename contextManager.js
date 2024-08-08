// contextManager.js
const db = require('./database');

let userContexts = {};

module.exports = {
    saveContext: async (userId, contextName, contextData, isActive = false) => {
        console.log(`Saving context ${userId}, contextName: ${contextName}, contextData ${contextData}, isActive: ${isActive}`);
        try {
            const contextDataString = typeof contextData === 'string'
                ? contextData
                : JSON.stringify(contextData);

            await db.saveContext(userId, contextName, contextDataString, isActive);
            if (!userContexts[userId]) userContexts[userId] = {};
            userContexts[userId][contextName] = { data: contextData, isActive };
            console.log(`Context saved successfully for user ${userId}`);
        } catch (error) {
            console.error(`Error saving context for user ${userId}:`, error);
            throw error;
        }
    },
    getContexts: async (userId) => {
        console.log(`Getting contexts for user ${userId}`);
        try {
            if (!userContexts[userId]) {
                userContexts[userId] = await db.getContexts(userId);
            }
            console.log(userContexts[userId]);
            return userContexts[userId];
        } catch (error) {
            console.error(`Error getting contexts for user ${userId}:`, error);
            throw error;
        }
    },
    setActiveContext: async (userId, contextName) => {
        console.log(`Setting active context for user ${userId}`);
        try {
            await db.setActiveContext(userId, contextName);
            const contexts = await db.getContexts(userId);
            Object.keys(contexts).forEach(name => {
                contexts[name].isActive = (name === contextName);
            });
            console.log(`Active context set successfully for user ${userId}`);
        } catch (error) {
            console.error(`Error setting active context for user ${userId}:`, error);
            throw error;
        }
    },
    getActiveContext: async (userId) => {
        try {
            const context = await db.getActiveContext(userId);
            console.log(`Retrieved active context for user ${userId}:`, context);
            return context;
        } catch (error) {
            console.error(`Error getting active context for user ${userId}:`, error);
            throw error;
        }
    },
    deleteContext: async (userId, contextName) => {
        console.log(`Deleting context for user ${userId}, context: ${contextName}`);
        try {
            await db.deleteContext(userId, contextName);
            if (userContexts[userId]) {
                delete userContexts[userId][contextName];
            }
            console.log(`Context deleted successfully for user ${userId}`);
        } catch (error) {
            console.error(`Error deleting context for user ${userId}:`, error);
            throw error;
        }
    },
};
