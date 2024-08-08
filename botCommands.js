const { askClaude } = require('./claudeApi');
const { isAdmin, isSuperAdmin, setRole, getRole, isBalance} = require('./userRoles');
const contextManager = require('./contextManager');
const { superAdminId } = require('./config');
const {addRequest, addTokens} = require("./tokens");
const {spendTokens} = require("./database");

const waitingStates = {};

const handleStart = async (bot, chatId) => {
    return `Привет! Добро пожаловать в бота.`;
};

const handleInfo = async (bot, chatId, userId, firstName) => {
    const role = await getRole(userId);
    return `Тебя зовут ${firstName}. Твоя роль: ${role}`;
};

const handlePrompt = async (bot, chatId, userId) => {
    if (!await isBalance(userId)) {
        return "У вас недостаточно токенов.";
    }
    waitingStates[chatId] = 'waiting_for_prompt';
    return "Пожалуйста, введите ваш запрос для искусственного интелекта. Используйте /cancel для отмены."
};
const handleAddTokens = async (bot, chatId, userId) => {
    if (!await isSuperAdmin(userId)) {
        return "Только супер-администратор может устанавливать токены.";
    }
    waitingStates[chatId] = 'waiting_for_add_tokens';
    await bot.sendMessage(chatId, `Напишите кол-во токенов id пользователя в формате userId: count `);
};
const handleGetBalanceUser = async (bot, chatId, userId) => {
    await bot.sendMessage(chatId, 'Введите id пользователя');
    waitingStates[chatId] = 'waiting_for_get_tokens';
};
const handleSetRole = async (bot, chatId, userId, args) => {
    if (!await isSuperAdmin(userId)) {
        return "Только супер-администратор может устанавливать роли.";
    }
    if (args.length !== 2) {
        return "Использование: /setrole [user_id] [role]";
    }
    const targetUserId = args[0];
    const newRole = args[1];
    await setRole(targetUserId, newRole);
    return `Роль пользователя ${targetUserId} установлена как ${newRole}`;
};
const handleGenerateIdeas = async (bot, chatId, userId) => {
    if (!await isBalance(userId)) {
        return "У вас недостаточно токенов.";
    }
    const context = await contextManager.getActiveContext(userId);
    if (!context) {
        return "Пожалуйста, сначала установите контекст с помощью команды \"Установить контекст\"";
    }
    const prompt = `Контекст: ${context.contextData}\n\nСгенерируйте 5 идей для постов, учитывая данный контекст.`;
    try {
        const response = await askClaude(prompt);
        await addRequest(userId, response.usage.input_tokens,response.usage.output_tokens,prompt)
        await spendTokens(userId, response.usage.output_tokens)
        return response.content[0].text;
    } catch (error) {
        console.error('Error generating ideas:', error);
        return "Извините, произошла ошибка при генерации идей.";
    }
};

const handleGeneratePostPrompt = async (bot, chatId, userId) => {
    if (!await isBalance(userId)) {
        return "У вас недостаточно токенов.";
    }
    const context = await contextManager.getActiveContext(userId);
    if (!context) {
        return "Пожалуйста, сначала установите контекст с помощью команды /setcontext";
    }
    waitingStates[chatId] = 'waiting_for_post_prompt';
    return "Пожалуйста, введите дополнительные инструкции или тему для генерации поста. Используйте /cancel для отмены.";
};

const handleGeneratePost = async (bot, chatId, userId, context, userPrompt, size) => {
    if (!await isBalance(userId)) {
        return "У вас недостаточно токенов.";
    }
    if (!context) {
        return "Активный контекст не установлен. Пожалуйста, установите контекст перед генерацией поста.";
    }
    const systemPrompt = `Ты - опытный копирайтер. Твоя задача - создать продающий и интересный текст для поста в социальных сетях. Текст должен быть привлекательным, информативным и побуждать к действию. Используй эмоциональные триггеры, задавай вопросы аудитории, и заканчивай призывом к действию. Длина поста должна быть около ${ size === 'large' ? '1500' : (size === 'medium' ? '1000' : '500')  } символов.`;

    const prompt = `${systemPrompt}\n\nКонтекст: ${context}\n\nДополнительные инструкции пользователя: ${userPrompt}\n\nСоздай текст поста для социальных сетей, учитывая данный контекст и инструкции пользователя. Используйте релевантные хэштеги и эмодзи для увеличения вовлеченности.`;

    try {
        const response = await askClaude(prompt);
        await spendTokens(userId, response.usage.output_tokens)
        return response.content[0].text;

    } catch (error) {
        console.error('Error generating post:', error);
        return "Извините, произошла ошибка при генерации поста.";
    }
};


const handleUnknownCommand = (bot, chatId) => {
    return 'Я тебя не понимаю, попробуй еще раз!';
};
/*
const handleSetContext = async (bot, chatId, userId) => {
    if (!await isAdmin(userId)) {
        return "У вас нет прав для использования этой команды.";
    }
    waitingStates[chatId] = 'waiting_for_context';
    return "Введите новый контекст и его название в формате 'название: контекст':";
};
*/


const handleSaveContext = async (bot, chatId, userId) => {
    waitingStates[chatId] = 'waiting_for_context_save';
    return "Введите название и содержание контекста в формате \n'название: контекст'\nНапример:\nПроект X: Детали проекта X, включая цели и сроки";
};

const handleSaveContextConfirm = async (bot, chatId, userId, input) => {
    const [contextName, ...contextParts] = input.split(':');
    const contextData = contextParts.join(':').trim();
    if (!contextName || !contextData) {
        return "Неверный формат. Используйте 'название: контекст'.";
    }
    try {
        await contextManager.saveContext(userId, contextName.trim(), contextData, false);
        await contextManager.setActiveContext(userId, contextName.trim())
        return `Контекст "${contextName.trim()}" успешно сохранен.`;
    } catch (error) {
        console.error('Error saving context:', error);
        return "Произошла ошибка при сохранении контекста.";
    }
};

const handleListContexts = async (bot, chatId, userId) => {
    const contexts = await contextManager.getContexts(userId);
    const contextList = Object.entries(contexts).map(([name, { isActive }]) =>
        `${name}${isActive ? ' (активный)' : ''}`
    ).join('\n');
    const activeContext = await contextManager.getActiveContext(userId);
    return contextList  ? `Ваши сохраненные контексты:\n${contextList}\n\nАктивный контекст - ${activeContext ? activeContext.contextData : 'не установелен'}` : "У вас нет сохраненных контекстов.";
};

const handleSwitchContext = async (bot, chatId, userId) => {
    const contexts = await contextManager.getContexts(userId);
    if (Object.keys(contexts).length === 0) {
        return "У вас нет сохраненных контекстов.";
    }
    const contextList = Object.keys(contexts).join('\n');
    const activeContext = await contextManager.getActiveContext(userId);
    waitingStates[chatId] = 'waiting_for_context_switch';
    return `Доступные контексты:\n${contextList}\n\nАктивный контекст - ${activeContext ? activeContext.contextData : 'не установлен'}\n\nВведите имя контекста, на который хотите переключиться:`;
};

const handleSwitchContextConfirm = async (bot, chatId, userId, contextName) => {
    try {
        await contextManager.setActiveContext(userId, contextName);
        return `Контекст успешно изменен на "${contextName}".`;
    } catch (error) {
        console.error('Error switching context:', error);
        return "Произошла ошибка при переключении контекста.";
    }
};

const handleCheckActiveContext = async (bot, chatId, userId) => {
    if (!await isAdmin(userId)) {
        return "У вас нет прав для использования этой команды.";
    }
    try {
        const activeContext = await contextManager.getActiveContext(userId);
        if (activeContext) {
            const contextData = activeContext.contextData
            const contextName = activeContext.contextName
            return `Текущий активный контекст:\nНазвание: ${contextName || 'Без названия'}\nТекст: ${contextData}`;
        } else {
            return "Активный контекст не установлен.";
        }
    } catch (error) {
        console.error('Error checking active context:', error);
        return "Произошла ошибка при проверке активного контекста.";
    }
};

const handleDeleteContext = async (bot, chatId, userId) => {
    const contexts = await contextManager.getContexts(userId);
    if (Object.keys(contexts).length === 0) {
        return "У вас нет сохраненных контекстов.";
    }
    const contextList = Object.keys(contexts).join('\n');
    const activeContext = await contextManager.getActiveContext(userId);
    waitingStates[chatId] = 'waiting_for_context_delete';
    return `Доступные контексты:\n${contextList}\n${activeContext ? activeContext.contextName : ''}\n\nВведите имя контекста, который хотите удалить:`;
};


const handleCancel = (bot, chatId) => {
    if (waitingStates[chatId]) {
        delete waitingStates[chatId];
        return bot.sendMessage(chatId, "Текущая операция отменена.")
    }
    return "Нет активных операций для отмены.";
};

module.exports = {
    handleStart,
    handleInfo,
    handlePrompt,
    handleSetRole,
    handleUnknownCommand,
    handleAddTokens,
    handleGetBalanceUser,
    handleSaveContext,
    handleSaveContextConfirm,
    handleListContexts,
    handleSwitchContext,
    handleSwitchContextConfirm,
    handleCheckActiveContext,
    handleGenerateIdeas,
    handleGeneratePost,
    handleGeneratePostPrompt,
    handleCancel,
    handleDeleteContext,
    waitingStates
};


