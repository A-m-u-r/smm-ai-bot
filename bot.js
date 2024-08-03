const TelegramApi = require("node-telegram-bot-api");
const { token } = require('./config');
const { askClaude } = require('./claudeApi');
const {
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
} = require('./botCommands');

const bot = new TelegramApi(token, {polling: true});


const chatStates = {};
const userContexts = {};
const userPrompts = {};

const start = () => {
    bot.setMyCommands([
        {command: '/start', description: 'Начальное приветствие'},
        {command: '/info', description: 'Инфо о пользователе'},
        {command: '/prompt', description: 'Задать вопрос Claude'},
        {command: '/setrole', description: 'Установить роль пользователя (только для супер-админа)'},
        {command: '/setcontext', description: 'Задать контекст для постов'},
        {command: '/generateideas', description: 'Генерировать идеи постов'},
        {command: '/generatepost', description: 'Генерировать текст поста'},
        {command: '/cancel', description: 'Отменить текущую операцию'},
    ]);

    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Проверяем, находится ли чат в состоянии ожидания
        if (waitingStates[chatId]) {
            if (text === '/cancel') {
                return handleCancel(bot, chatId);
            }
            if (text.startsWith('/')) {
                await bot.sendMessage(chatId, "Пожалуйста, сначала ответьте на предыдущий запрос или используйте /cancel для отмены текущей операции.");
                return;
            }

            // Обработка ожидаемого ответа
            let waitingMessage;
            try {
                waitingMessage = await bot.sendMessage(chatId, "Пожалуйста, подождите...");
                let response;
                if (waitingStates[chatId] === 'waiting_for_prompt') {
                    response = await askClaude(text);
                    await bot.sendMessage(chatId, response.content[0].text);
                } else if (waitingStates[chatId] === 'waiting_for_context') {
                    userContexts[userId] = text;
                    await bot.sendMessage(chatId, "Контекст успешно установлен.");
                } else if (waitingStates[chatId] === 'waiting_for_post_prompt') {
                    userPrompts[userId] = text;
                    response = await handleGeneratePost(bot, chatId, userId, userContexts[userId], userPrompts[userId]);
                    await bot.sendMessage(chatId, response);
                }
                await bot.deleteMessage(chatId, waitingMessage.message_id);
            } catch (error) {
                console.error('Error:', error);
                await bot.sendMessage(chatId, "Извините, произошла ошибка при обработке вашего запроса.");
                if (waitingMessage) {
                    await bot.deleteMessage(chatId, waitingMessage.message_id);
                }
            }
            delete waitingStates[chatId];
            return;
        }

        // Обработка команд
        switch(text) {
            case '/start':
                return handleStart(bot, chatId);
            case '/info':
                return handleInfo(bot, chatId, userId, msg.from.first_name);
            case '/prompt':
                return handlePrompt(bot, chatId, userId);
            case '/setcontext':
                return handleSetContext(bot, chatId);
            case '/generateideas':
                return handleGenerateIdeas(bot, chatId, userId, userContexts[userId]);
            case '/generatepost':
                return handleGeneratePostPrompt(bot, chatId, userId, userContexts[userId]);
            case '/cancel':
                return handleCancel(bot, chatId);
            default:
                if (text.startsWith('/setrole')) {
                    const args = text.split(' ').slice(1);
                    return handleSetRole(bot, chatId, userId, args);
                }
                return handleUnknownCommand(bot, chatId);
        }
    });
}

start();


