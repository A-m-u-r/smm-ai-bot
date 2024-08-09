// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'bot_data.db'));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS contexts (userId TEXT, contextName TEXT, contextData TEXT, isActive INTEGER, PRIMARY KEY (userId, contextName))");
    db.run("CREATE TABLE IF NOT EXISTS roles (userId TEXT PRIMARY KEY, role TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS tokens (userId TEXT, inputTokens INTEGER, outputTokens INTEGER, time TEXT, prompt TEXT, PRIMARY KEY (userId, time))");
    db.run("CREATE TABLE IF NOT EXISTS token_balances (userId TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)");

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
    addTokens: (userId, amount) => {
        return new Promise((resolve, reject) => {
            db.run("UPDATE token_balances SET balance = balance + ? WHERE userId = ?", [amount, userId], function(err) {
                if (err) {
                    console.log(`Err add tokens for user ${userId}:`, err);
                    reject(err);
                } else if (this.changes === 0) {
                    // Если запись не была обновлена, значит ее нужно создать
                    db.run("INSERT INTO token_balances (userId, balance) VALUES (?, ?)", [userId, amount], function(err) {
                        if (err) {
                            console.log(`Err add tokens for user ${userId}:`, err);
                            reject(err);
                        } else {
                            console.log(`Added ${amount} tokens for user ${userId}`);
                            resolve(this.lastID);
                        }
                    });
                } else {
                    console.log(`Added ${amount} tokens for user ${userId}`);
                    resolve(this.lastID);
                }
            });
        });
    },

    getBalance: (userId) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT balance FROM token_balances WHERE userId = ?", [userId], (err, row) => {
                if (err) {
                    console.log(`Err get balance for user ${userId}:`, err);
                    reject(err);
                } else {
                    const balance = row ? row.balance : 0;
                    console.log(`Balance for user ${userId}: ${balance}`);
                    resolve(balance);
                }
            });
        });
    },

    spendTokens: (userId, amount) => {
        return new Promise((resolve, reject) => {
            db.run("UPDATE token_balances SET balance = balance - ? WHERE userId = ?", [amount, userId], function (err) {
                if (err) {
                    console.log(`Err spend tokens for user ${userId}:`, err);
                    reject(err);
                } else {
                    console.log(`Spent ${amount} tokens for user ${userId}`);
                    resolve(this.changes);
                }
            });
        })
    },
    addRequest: (userId, inputTokens, outputTokens, prompt) => {
        const currentTime = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run("INSERT OR REPLACE INTO tokens (userId, inputTokens, outputTokens, time, prompt) VALUES (?, ?, ?, ?, ?)",
                [userId, inputTokens, outputTokens, currentTime, prompt],
                function(err) {
                    if (err) {
                        console.log(`Err add tokens for user ${userId}:`, err);
                        reject(err);
                    } else {
                        console.log(`Added tokens for user ${userId}: input=${inputTokens}, output=${outputTokens}, time=${currentTime}, prompt=${prompt}`);
                        resolve(this.lastID);
                    }
                }
            );
        })
    },

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
