const { askClaude } = require('./claudeApi');
const { isAdmin, isSuperAdmin, setRole, getRole } = require('./userRoles');

const waitingStates = {};

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
    waitingStates[chatId] = 'waiting_for_prompt';
    return bot.sendMessage(chatId, "Пожалуйста, введите ваш запрос для Claude. Используйте /cancel для отмены.");
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

const handleSetContext = (bot, chatId) => {
    waitingStates[chatId] = 'waiting_for_context';
    return bot.sendMessage(chatId, "Пожалуйста, введите контекст для ваших постов. Используйте /cancel для отмены.");
};

const handleGenerateIdeas = async (bot, chatId, userId, context) => {
    if (!context) {
        return bot.sendMessage(chatId, "Пожалуйста, сначала установите контекст с помощью команды /setcontext");
    }
    const prompt = `Контекст: ${context}\n\nСгенерируйте 5 идей для постов, учитывая данный контекст.`;
    try {
        const response = await askClaude(prompt);
        return bot.sendMessage(chatId, response.content[0].text);
    } catch (error) {
        console.error('Error generating ideas:', error);
        return bot.sendMessage(chatId, "Извините, произошла ошибка при генерации идей.");
    }
};

const handleGeneratePostPrompt = async (bot, chatId, userId, context) => {
    if (!context) {
       await bot.sendMessage(chatId, "Пожалуйста, сначала установите контекст с помощью команды /setcontext");
        return;
    }
    waitingStates[chatId] = 'waiting_for_post_prompt';
    return bot.sendMessage(chatId, "Пожалуйста, введите дополнительные инструкции или тему для генерации поста. Используйте /cancel для отмены.");
};

const handleGeneratePost = async (bot, chatId, userId, context, userPrompt,size ) => {
    if (!context) {
        return "Пожалуйста, сначала установите контекст с помощью команды /setcontext";
    }
    const systemPrompt = `Ты - опытный копирайтер. Твоя задача - создать продающий и интересный текст для поста в социальных сетях. Текст должен быть привлекательным, информативным и побуждать к действию. Используй эмоциональные триггеры, задавай вопросы аудитории, и заканчивай призывом к действию. Длина поста должна быть около ${ size === 'large' ? '1500' : (size === 'medium' ? '1000' : '500')  } символов.`;

    const prompt = `${systemPrompt}\n\nКонтекст: ${context}\n\nДополнительные инструкции пользователя: ${userPrompt}\n\nСоздай текст поста для социальных сетей, учитывая данный контекст и инструкции пользователя. Используйте релевантные хэштеги и эмодзи для увеличения вовлеченности.`;

    try {
        const response = await askClaude(prompt);
        return response.content[0].text;
    } catch (error) {
        console.error('Error generating post:', error);
        return "Извините, произошла ошибка при генерации поста.";
    }
};

const handleUnknownCommand = (bot, chatId) => {
    return bot.sendMessage(chatId, 'Я тебя не понимаю, попробуй еще раз!');
};

const handleCancel = (bot, chatId) => {
    if (waitingStates[chatId]) {
        delete waitingStates[chatId];
        return bot.sendMessage(chatId, "Текущая операция отменена.");
    }
    return bot.sendMessage(chatId, "Нет активных операций для отмены.");
};

module.exports = {
    handleStart,
    handleInfo,
    handlePrompt,
    handleSetRole,
    handleUnknownCommand,
    handleSetContext,
    handleGenerateIdeas,
    handleGeneratePost,
    handleGeneratePostPrompt,
    handleCancel,
    waitingStates
};
