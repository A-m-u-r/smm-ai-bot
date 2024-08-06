// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'bot_data.db'));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS contexts (userId TEXT, contextName TEXT, contextData TEXT, PRIMARY KEY (userId, contextName))");
    db.run("CREATE TABLE IF NOT EXISTS active_contexts (userId TEXT PRIMARY KEY, contextData TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS roles (userId TEXT PRIMARY KEY, role TEXT)");
});

module.exports = {
    init: () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("CREATE TABLE IF NOT EXISTS contexts (userId TEXT, contextName TEXT, contextData TEXT, PRIMARY KEY (userId, contextName))", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    },
    saveContext: (userId, contextName, contextData) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT OR REPLACE INTO contexts (userId, contextName, contextData) VALUES (?, ?, ?)",
                [userId, contextName, JSON.stringify(contextData)], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });
    },
    getContexts: (userId) => {
        return new Promise((resolve, reject) => {
            db.all("SELECT contextName, contextData FROM contexts WHERE userId = ?", [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.reduce((acc, row) => {
                    acc[row.contextName] = JSON.parse(row.contextData);
                    return acc;
                }, {}));
            });
        });
    },
    saveActiveContext: (userId, contextData) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT OR REPLACE INTO active_contexts (userId, contextData) VALUES (?, ?)",
                [userId, JSON.stringify(contextData)], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });
    },
    getActiveContexts: () => {
        return new Promise((resolve, reject) => {
            db.all("SELECT userId, contextData FROM active_contexts", (err, rows) => {
                if (err) reject(err);
                else resolve(rows.reduce((acc, row) => {
                    acc[row.userId] = JSON.parse(row.contextData);
                    return acc;
                }, {}));
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
