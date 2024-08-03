const { askClaude } = require('./claudeApi');
const { isAdmin, isSuperAdmin, setRole, getRole } = require('./userRoles');

const handleStart = async (bot, chatId) => {
    await bot.sendSticker(chatId, `https://tlgrm.ru/_/stickers/e65/38d/e6538d88-ed55-39d9-a67f-ad97feea9c01/1.webp`);
    return bot.sendMessage(chatId, `Привет! Добро пожаловать в бота.`);
};

const handleInfo = (bot, chatId, userId, firstName) => {
    const role = getRole(userId);
    return bot.sendMessage(chatId, `Тебя зовут ${firstName}. Твоя роль: ${role}`);
};

const handlePrompt = (bot, chatId, userId) => {
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, "У вас нет прав для использования этой команды.");
    }
    return bot.sendMessage(chatId, "Пожалуйста, введите ваш запрос для Claude:");
};

const handleSetRole = (bot, chatId, userId, args) => {
    if (!isSuperAdmin(userId)) {
        return bot.sendMessage(chatId, "Только супер-администратор может устанавливать роли.");
    }
    if (args.length !== 2) {
        return bot.sendMessage(chatId, "Использование: /setrole [user_id] [role]");
    }
    const targetUserId = args[0];
    const newRole = args[1];
    setRole(targetUserId, newRole);
    return bot.sendMessage(chatId, `Роль пользователя ${targetUserId} установлена как ${newRole}`);
};

const handleUnknownCommand = (bot, chatId) => {
    return bot.sendMessage(chatId, 'Я тебя не понимаю, попробуй еще раз!');
};

module.exports = {
    handleStart,
    handleInfo,
    handlePrompt,
    handleSetRole,
    handleUnknownCommand
};

