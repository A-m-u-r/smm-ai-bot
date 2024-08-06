const { askClaude } = require('./claudeApi');
const { isAdmin, isSuperAdmin, setRole, getRole } = require('./userRoles');
const contextManager = require('./contextManager');

const waitingStates = {};

const handleStart = async (bot, chatId) => {
    return `Привет! Добро пожаловать в бота.`;
};

const handleInfo = async (bot, chatId, userId, firstName) => {
    const role = await getRole(userId);
    return `Тебя зовут ${firstName}. Твоя роль: ${role}`;
};

const handlePrompt = async (bot, chatId, userId) => {
    if (!await isAdmin(userId)) {
        return "У вас нет прав для использования этой команды.";
    }
    waitingStates[chatId] = 'waiting_for_prompt';
    return "Пожалуйста, введите ваш запрос для Claude. Используйте /cancel для отмены.";
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

const handleSetContext = async (bot, chatId, userId) => {
    waitingStates[chatId] = 'waiting_for_context';
    return "Введите новый контекст:";
};

const handleGenerateIdeas = async (bot, chatId, userId) => {
    const context = await contextManager.getActiveContext(userId);
    if (!context) {
        return "Пожалуйста, сначала установите контекст с помощью команды /setcontext";
    }
    const prompt = `Контекст: ${context}\n\nСгенерируйте 5 идей для постов, учитывая данный контекст.`;
    try {
        const response = await askClaude(prompt);
        return response.content[0].text;
    } catch (error) {
        console.error('Error generating ideas:', error);
        return "Извините, произошла ошибка при генерации идей.";
    }
};

const handleGeneratePostPrompt = async (bot, chatId, userId) => {
    const context = await contextManager.getActiveContext(userId);
    if (!context) {
        return "Пожалуйста, сначала установите контекст с помощью команды /setcontext";
    }
    waitingStates[chatId] = 'waiting_for_post_prompt';
    return "Пожалуйста, введите дополнительные инструкции или тему для генерации поста. Используйте /cancel для отмены.";
};
const handleCheckActiveContext = async (bot, chatId, userId) => {
    const activeContext = contextManager.getActiveContext(userId);
    if (activeContext) {
        const contextName = Object.keys(await contextManager.getContexts(userId)).find(key => contextManager.getContexts(userId)[key] === activeContext);
        return `Текущий активный контекст:\nНазвание: ${contextName}\nТекст: ${activeContext}`;
    } else {
        return "Активный контекст не установлен.";
    }
};


const handleGeneratePost = async (bot, chatId, userId, userPrompt, size) => {
    const context = contextManager.getActiveContext(userId);
    if (!context) {
        return "Активный контекст не установлен. Пожалуйста, установите контекст перед генерацией поста.";
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
    return 'Я тебя не понимаю, попробуй еще раз!';
};

const handleSaveContext = async (bot, chatId, userId) => {
    const activeContext = contextManager.getActiveContext(userId);
    if (!activeContext) {
        return "Активный контекст не установлен. Сначала установите контекст.";
    }
    waitingStates[chatId] = 'waiting_for_context_name';
    return "Пожалуйста, введите имя для сохранения контекста:";
};


const handleListContexts = async (bot, chatId, userId) => {
    const contexts = await contextManager.getContexts(userId);
    const contextList = Object.keys(contexts).join('\n');
    return contextList ? `Ваши сохраненные контексты:\n${contextList}` : "У вас нет сохраненных контекстов.";
};

const handleSwitchContext = async (bot, chatId, userId) => {
    const contexts = await contextManager.getContexts(userId);
    if (Object.keys(contexts).length === 0) {
        return "У вас нет сохраненных контекстов.";
    }
    const contextList = Object.keys(contexts).join('\n');
    waitingStates[chatId] = 'waiting_for_context_switch';
    return `Доступные контексты:\n${contextList}\n\nВведите имя контекста, на который хотите переключиться:`;
};
const handleDeleteContext = async (bot, chatId, userId) => {
    const contexts = await contextManager.getContexts(userId);
    if (Object.keys(contexts).length === 0) {
        return "У вас нет сохраненных контекстов.";
    }
    const contextList = Object.keys(contexts).join('\n');
    waitingStates[chatId] = 'waiting_for_context_delete';
    return `Доступные контексты:\n${contextList}\n\nВведите имя контекста, который хотите удалить:`;
};


const handleCancel = (bot, chatId) => {
    if (waitingStates[chatId]) {
        delete waitingStates[chatId];
        return "Текущая операция отменена.";
    }
    return "Нет активных операций для отмены.";
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
    handleSaveContext,
    handleListContexts,
    handleSwitchContext,
    handleCheckActiveContext,
    handleDeleteContext,
    waitingStates
};


