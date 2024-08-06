const TelegramApi = require("node-telegram-bot-api");
const { token } = require('./config');
const { askClaude } = require('./claudeApi');
const { isAdmin, isSuperAdmin, setRole, getRole } = require('./userRoles');

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

function createMainKeyboard(isAdmin) {
    const keyboard = [
        [{text: '/start'}, {text: '/info'}, {text: '/prompt'}],
        [{text: '/setcontext'}, {text: '/generateideas'}, {text: '/generatepost'}],
        [{text: '/cancel'}]
    ];

    if (isSuperAdmin) {
        keyboard.push([{text: '/setrole'}]);
    }

    return {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

function createSizeKeyboard() {
    return {
        inline_keyboard: [
            [{text: 'Small', callback_data: 'size_small'},
                {text: 'Medium', callback_data: 'size_medium'},
                {text: 'Large', callback_data: 'size_large'}]
        ]
    };
}

const start = () => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;

        if (data.startsWith('size_')) {
            const size = data.split('_')[1];
            const context = userContexts[userId];
            const prompt = userPrompts[userId];

            if (!context || !prompt) {
                await bot.answerCallbackQuery(query.id, { text: "Ошибка: контекст или тема не установлены" });
                return;
            }

            let waitingMessage;
            try {
                waitingMessage = await bot.sendMessage(chatId, "Генерирую пост, пожалуйста, подождите...");
                const response = await handleGeneratePost(bot, chatId, userId, context, prompt, size);
                await bot.sendMessage(chatId, response, {
                    reply_markup: createMainKeyboard(isAdmin)
                });
                await bot.deleteMessage(chatId, waitingMessage.message_id);
            } catch (error) {
                console.error('Error:', error);
                await bot.sendMessage(chatId, "Извините, произошла ошибка при генерации поста.", {
                    reply_markup: createMainKeyboard(isAdmin)
                });
                if (waitingMessage) {
                    await bot.deleteMessage(chatId, waitingMessage.message_id);
                }
            }

            await bot.answerCallbackQuery(query.id);
            delete waitingStates[chatId];
        }
    });

    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        const userId = msg.from.id;



        if (waitingStates[chatId]) {
            if (text === '/cancel') {
                return handleCancel(bot, chatId);
            }
            if (text.startsWith('/')) {
                await bot.sendMessage(chatId, "Пожалуйста, сначала ответьте на предыдущий запрос или используйте /cancel для отмены текущей операции.", {
                    reply_markup: createMainKeyboard(isAdmin)
                });
                return;
            }

            let waitingMessage;
            try {
                let response;
                if (waitingStates[chatId] === 'waiting_for_prompt') {
                    waitingMessage = await bot.sendMessage(chatId, "Пожалуйста, подождите...");
                    response = await askClaude(text);
                    await bot.sendMessage(chatId, response.content[0].text, {
                        reply_markup: createMainKeyboard(isAdmin)
                    });
                }
                else if (waitingStates[chatId] === 'waiting_for_context') {
                    userContexts[userId] = text;
                    await bot.sendMessage(chatId, "Контекст успешно установлен.", {
                        reply_markup: createMainKeyboard(isAdmin)
                    });
                }
                else if (waitingStates[chatId] === 'waiting_for_post_prompt') {
                    userPrompts[userId] = text;
                    await bot.sendMessage(chatId, "Выберите размер поста:", {
                        reply_markup: createSizeKeyboard()
                    });
                    return;
                }
                if(waitingMessage){
                    await bot.deleteMessage(chatId, waitingMessage.message_id);
                }

            } catch (error) {
                console.error('Error:', error);
                await bot.sendMessage(chatId, "Извините, произошла ошибка при обработке вашего запроса.", {
                    reply_markup: createMainKeyboard(isAdmin)
                });
                if (waitingMessage) {
                    await bot.deleteMessage(chatId, waitingMessage.message_id);
                }
            }
            delete waitingStates[chatId];
            return;
        }

        switch(text) {
            case '/start':
                await handleStart(bot, chatId);
                break;
            case '/info':
                await handleInfo(bot, chatId, userId, msg.from.first_name);
                break;
            case '/prompt':
                await handlePrompt(bot, chatId, userId);
                break;
            case '/setcontext':
                await handleSetContext(bot, chatId);
                break;
            case '/generateideas':
                await handleGenerateIdeas(bot, chatId, userId, userContexts[userId]);
                break;
            case '/generatepost':
                await handleGeneratePostPrompt(bot, chatId, userId, userContexts[userId]);
                break;
            case '/cancel':
                await handleCancel(bot, chatId);
                break;
            default:
                if (text.startsWith('/setrole')) {
                    const args = text.split(' ').slice(1);
                    return handleSetRole(bot, chatId, userId, args);
                }
           /* case '/setrole':
                if (isSuperAdmin) {
                    await handleSetRole(bot, chatId, userId, []);
                } else {
                    await bot.sendMessage(chatId, "У вас нет прав для использования этой команды.", {
                        reply_markup: createMainKeyboard(isAdmin)
                    });
                }*/
                return handleUnknownCommand(bot, chatId);
        }

        // Отправляем клавиатуру после каждого сообщения, если не ожидаем ввода
        if (!waitingStates[chatId]) {
            await bot.sendMessage(chatId, "Выберите команду:", {
                reply_markup: createMainKeyboard(isAdmin)
            });
        }
    });
}

start();


