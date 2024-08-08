// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'bot_data.db'));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS contexts (userId TEXT, contextName TEXT, contextData TEXT, isActive INTEGER, PRIMARY KEY (userId, contextName))");
    db.run("CREATE TABLE IF NOT EXISTS roles (userId TEXT PRIMARY KEY, role TEXT)");

});

module.exports = {
    init: () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("CREATE TABLE IF NOT EXISTS contexts (userId TEXT, contextName TEXT, contextData TEXT, isActive INTEGER, PRIMARY KEY (userId, contextName))", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    },
 /*   getTokens: (userId) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT inputTokens, outputTokens FROM tokens WHERE userId = ?", [userId], (err, row) => {
                if (err) {
                    console.log(`Err get tokens for user ${userId}:`, err);
                    reject(err);
                } else {
                    let result = null;
                    if (row) {
                        result = {
                            inputTokens: row.inputTokens,
                            outputTokens: row.outputTokens
                        };
                    }
                    console.log(`Tokens ${userId}:`, result);
                    resolve(result);
                }
            });
        })
    },

    addTokens: (userId, inputTokens, outputTokens) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT OR REPLACE INTO tokens (userId, inputTokens, outputTokens) VALUES (?, ?, ?)",
                [userId, inputTokens, outputTokens],
                function(err) {
                    if (err) {
                        console.log(`Err add tokens for user ${userId}:`, err);
                        reject(err);
                    } else {
                        console.log(`Added tokens for user ${userId}: input=${inputTokens}, output=${outputTokens}`);
                        resolve(this.lastID);
                    }
                }
            );
        })
    },
*/

    saveContext: (userId, contextName, contextData, isActive) => {
        return new Promise((resolve, reject) => {
            let contextDataString;
            console.log(`SAVECONTEXT ${contextData}`);

            if (typeof contextData === 'string') {
                contextDataString = contextData.trim();
            } else if (typeof contextData === 'object' && contextData !== null) {
                contextDataString = JSON.stringify(contextData);
            }

            if (contextDataString === '""' || contextDataString === '{}') {
                console.warn('Warning: Empty context data for user:', userId, 'context:', contextName, contextDataString);
            }

            db.run("INSERT OR REPLACE INTO contexts (userId, contextName, contextData, isActive) VALUES (?, ?, ?, ?)",
                [userId, contextName, contextDataString, isActive ? 1 : 0], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });
    },
    getContexts: (userId) => {
        return new Promise((resolve, reject) => {
            db.all("SELECT contextName, contextData FROM contexts WHERE userId = ? AND isActive = 0", [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.reduce((acc, row) => {
                    acc[row.contextName] = {
                        data: row.contextData,
                        isActive: row.isActive === 1
                    };
                    return acc;
                }, {}));
            });
        });
    },
    getActiveContext: (userId) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT contextName, contextData FROM contexts WHERE userId = ? AND isActive = 1", [userId], (err, row) => {
                if (err) {
                    console.log(`Err get active context for user ${userId}:`, err);
                    reject(err);
                } else {
                    let result = null;
                    if (row) {
                        result = {
                            contextName: row.contextName,
                            contextData: row.contextData
                        };
                    }
                    console.log(`Active context getActiveContext ${userId}:`, result);
                    resolve(result);
                }
            });
        });
    },

    setActiveContext: (userId, contextName) => {
        return new Promise((resolve, reject) => {
            db.run("UPDATE contexts SET isActive = CASE WHEN contextName = ? THEN 1 ELSE 0 END WHERE userId = ?", [contextName, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    deleteContext: (userId, contextName) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM contexts WHERE userId = ? AND contextName = ?", [userId, contextName], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    saveRole: (userId, role) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT OR REPLACE INTO roles (userId, role) VALUES (?, ?)", [userId, role], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    getRoles: () => {
        return new Promise((resolve, reject) => {
            db.all("SELECT userId, role FROM roles", (err, rows) => {
                if (err) reject(err);
                else resolve(rows.reduce((acc, row) => {
                    acc[row.userId] = row.role;
                    return acc;
                }, {}));
            });
        });
    },
};
