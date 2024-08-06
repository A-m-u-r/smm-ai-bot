const TelegramApi = require("node-telegram-bot-api");
const { token } = require('./config');
const { askClaude } = require('./claudeApi');
const { isAdmin, isSuperAdmin, setRole, getRole } = require('./userRoles');
const { activeContexts, userContexts } = require("./contextManager");

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
    waitingStates,
    handleSaveContext,
    handleListContexts,
    handleSwitchContext,
} = require('./botCommands');

const bot = new TelegramApi(token, {polling: true});

const userPrompts = {};

function createMainKeyboard(userId) {
    const keyboard = [
        [{text: 'Старт'}, {text: 'Инфо'}, {text: 'Промпт'}],
        [{text: 'Контекст'}, {text: 'Генерировать идеи'}, {text: 'Генерировать пост'}],
        [{text: 'Отмена'}]
    ];

    if (isSuperAdmin(userId)) {
        keyboard.push([{text: 'Установить роль'}]);
    }

    return {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
    };
}
function createContextKeyboard() {
    return {
        keyboard: [
            [{text: 'Установить контекст'}, {text: 'Сохранить контекст'}],
            [{text: 'Список контекстов'}, {text: 'Переключить контекст'}],
            [{text: 'Назад'}]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}


function createSizeKeyboard() {
    return {
        inline_keyboard: [
            [{text: 'Маленький', callback_data: 'size_small'},
                {text: 'Средний', callback_data: 'size_medium'},
                {text: 'Большой', callback_data: 'size_large'}]
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
            const context = activeContexts[userId];
            const prompt = userPrompts[userId];

            if (!context || !prompt) {
                await bot.answerCallbackQuery(query.id, {text: "Ошибка: контекст или тема не установлены"});
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
                } else if (waitingStates[chatId] === 'waiting_for_context') {
                    activeContexts[userId] = text;
                    await bot.sendMessage(chatId, "Контекст успешно установлен.", {
                        reply_markup: createMainKeyboard(isAdmin)
                    });
                } else if (waitingStates[chatId] === 'waiting_for_post_prompt') {
                    userPrompts[userId] = text;
                    await bot.sendMessage(chatId, "Выберите размер поста:", {
                        reply_markup: createSizeKeyboard()
                    });
                    return;
                } else if (waitingStates[chatId] === 'waiting_for_context_name') {
                    if (!userContexts[userId]) userContexts[userId] = {};
                    userContexts[userId][text] = activeContexts[userId];
                    await bot.sendMessage(chatId, `Контекст "${text}" успешно сохранен.`);
                } else if (waitingStates[chatId] === 'waiting_for_context_switch') {
                    if (userContexts[userId] && userContexts[userId][text]) {
                        activeContexts[userId] = userContexts[userId][text];
                        await bot.sendMessage(chatId, `Контекст успешно изменен на "${text}".`);
                    } else {
                        await bot.sendMessage(chatId, `Контекст "${text}" не найден.`);
                    }
                }
                if (waitingMessage) {
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
        } else {
            let response;
            if (text.startsWith('/')) {
                // Обработка команд
                const command = text.split(' ')[0].toLowerCase();
                const args = text.split(' ').slice(1);
                switch (command) {
                    case '/start':
                        response = await handleStart(bot, chatId);
                        break;
                    case '/info':
                        response = await handleInfo(bot, chatId, userId, msg.from.first_name);
                        break;
                    case '/prompt':
                        response = await handlePrompt(bot, chatId, userId);
                        break;
                    case '/setcontext':
                        response = await handleSetContext(bot, chatId, userId);
                        break;
                    case '/savecontext':
                        response = await handleSaveContext(bot, chatId, userId);
                        break;
                    case '/listcontexts':
                        response = await handleListContexts(bot, chatId, userId);
                        break;
                    case '/switchcontext':
                        response = await handleSwitchContext(bot, chatId, userId);
                        break;
                    case '/generateideas':
                        response = await handleGenerateIdeas(bot, chatId, userId);
                        break;
                    case '/generatepost':
                        response = await handleGeneratePostPrompt(bot, chatId, userId);
                        break;
                    case '/cancel':
                        response = await handleCancel(bot, chatId);
                        break;
                    case '/setrole':
                        if (isSuperAdmin(userId)) {
                            response = await handleSetRole(bot, chatId, userId, args);
                        } else {
                            response = "У вас нет прав для использования этой команды.";
                        }
                        break;
                    default:
                        response = await handleUnknownCommand(bot, chatId);
                }
            } else {
                // Обработка текстовых сообщений (не команд)
                switch (text) {
                    case 'Старт':
                        response = await handleStart(bot, chatId);
                        break;
                    case 'Инфо':
                        response = await handleInfo(bot, chatId, userId, msg.from.first_name);
                        break;
                    case 'Промпт':
                        response = await handlePrompt(bot, chatId, userId);
                        break;
                    case 'Контекст':
                        await bot.sendMessage(chatId, "Выберите действие с контекстом:", {
                            reply_markup: createContextKeyboard()
                        });
                        return;
                    case 'Назад':
                        await bot.sendMessage(chatId, "Выберите команду:", {
                            reply_markup: createMainKeyboard(userId)
                        });
                        return;

                    case 'Установить контекст':
                        response = await handleSetContext(bot, chatId, userId);
                        await bot.sendMessage(chatId, response, {
                            reply_markup: createContextKeyboard()
                        });
                        return;
                    case 'Сохранить контекст':
                        response = await handleSaveContext(bot, chatId, userId);
                        await bot.sendMessage(chatId, response, {
                            reply_markup: createContextKeyboard()
                        });
                        return;
                    case 'Список контекстов':
                        response = await handleListContexts(bot, chatId, userId);
                        await bot.sendMessage(chatId, response, {
                            reply_markup: createContextKeyboard()
                        });
                        return;
                    case 'Переключить контекст':
                        response = await handleSwitchContext(bot, chatId, userId);
                        await bot.sendMessage(chatId, response, {
                            reply_markup: createContextKeyboard()
                        });
                        return;

                    case 'Генерировать идеи':
                        response = await handleGenerateIdeas(bot, chatId, userId);
                        break;
                    case 'Генерировать пост':
                        response = await handleGeneratePostPrompt(bot, chatId, userId);
                        break;
                    case 'Отмена':
                        response = await handleCancel(bot, chatId);
                        break;
                    case 'Установить роль':
                        if (isSuperAdmin(userId)) {
                            response = "Пожалуйста, используйте команду в формате: /setrole [user_id] [role]";
                        } else {
                            response = "У вас нет прав для использования этой команды.";
                        }
                        break;
                    default:
                        response = await handleUnknownCommand(bot, chatId);
                }
            }

            // Отправляем ответ и клавиатуру после каждого сообщения
            await bot.sendMessage(chatId, response || "Выберите команду:", {
                reply_markup: createMainKeyboard(userId)
            });
        }
    })
}
start()