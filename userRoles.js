const { superAdminId } = require('./config');

const userRoles = {};

const isAdmin = (userId) => {
    return userRoles[userId] === 'admin' || userId.toString() === superAdminId;
};

const isSuperAdmin = (userId) => {
    return userId.toString() === superAdminId;
};

const setRole = (userId, role) => {
    userRoles[userId] = role;
};

const getRole = (userId) => {
    if (userId.toString() === superAdminId) return 'супер-админ';
    return userRoles[userId] || 'пользователь';
};

module.exports = { isAdmin, isSuperAdmin, setRole, getRole };