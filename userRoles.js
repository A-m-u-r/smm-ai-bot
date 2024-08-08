// userRoles.js
const { superAdminId } = require('./config');
const db = require('./database');
const {getBalance} = require("./database");

let userRoles = {};

async function loadRoles() {
    try {
        userRoles = await db.getRoles();
    } catch (error) {
        console.error('Error loading roles:', error);
    }
}

loadRoles();
const isBalance = async (userId) =>{
    const response = await getBalance(userId)
    if (response < 300) {
        return false
    }else{
        return true;
    }

}
const isAdmin = (userId) => {
    return userRoles[userId] === 'admin' || userId.toString() === superAdminId;
};

const isSuperAdmin = (userId) => {
    return userId.toString() === superAdminId;
};

const setRole = async (userId, role) => {
    await db.saveRole(userId, role);
    userRoles[userId] = role;
};

const getRole = (userId) => {
    if (userId.toString() === superAdminId) return 'супер-админ';
    return userRoles[userId] || 'пользователь';
};

module.exports = { isAdmin, isSuperAdmin, setRole, getRole,isBalance };
