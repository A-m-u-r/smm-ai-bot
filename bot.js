const TelegramApi = require("node-telegram-bot-api");
const {token, superAdminId} = require('./config');
const {askClaude, askClaudeImage} = require('./claudeApi');
const {isAdmin, isSuperAdmin, setRole, getRole} = require('./userRoles');
const {activeContexts, userContexts} = require("./contextManager");
const contextManager = require('./contextManager');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
    handleStart,
    handleInfo,
    handlePrompt,
    handleSetRole,
    handleUnknownCommand,
    handleGenerateIdeas,
    handleGeneratePost,
    handleGeneratePostPrompt,
    handleCancel,
    waitingStates,
    handleSaveContext,
    handleListContexts,
    handleSwitchContext,
    handleCheckActiveContext,
    handleDeleteContext,
    handleSwitchContextConfirm,
    handleSaveContextConfirm, handleAddTokens, handleGetBalanceUser,
} = require('./botCommands');

const bot = new TelegramApi(token, {polling: true});

const userPrompts = {};
const db = require('./database');
const {addTokens} = require("./tokens");
const {getBalance, spendTokens, addUserWithInitialBalance} = require("./database");

db.init().then(() => {
    console.log('Database initialized');

}).then(() => {
    console.log('Contexts loaded');
    start();
}).catch(error => {
    console.error('Error during initialization:', error);
});

function createMainKeyboard(userId) {
    const keyboard = [
        [{text: 'Ask AI'}],
        [{text: 'Генерировать идеи'}, {text: 'Генерировать пост'}],
        [{text: 'Контекст'}, {text: 'Баланс'}],
        [{text: 'Отмена'}]
    ];

    if (isSuperAdmin(userId)) {
        keyboard.push([{text: 'Установить роль'}, {text: 'Добавить токены'}]);
    }

    return {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
    };
}/*
case '/getbalance':
response = await getBalance(userId);
break;
function createGenerationKeyboard() {
    return {
        keyboard: [
            [[{text: 'Генерировать идеи'}, {text: 'Генерировать пост'}]],
            [{text: 'Назад'}]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}*/
function createContextKeyboard() {
    return {
        keyboard: [
            [/*{text: 'Установить контекст'},*/ {text: 'Сохранить контекст'}],
            [{text: 'Список контекстов'}, {text: 'Переключить контекст'}],
            [{text: 'Удалить контекст'}, {text: 'Проверить контекст'}],
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

const downloadFile = async (fileLink, filePath) => {
    const response = await get(fileLink, {responseType: 'arraybuffer'});
    fs.writeFileSync(filePath, Buffer.from(response.data, 'binary'));
    return Buffer.from(response.data, 'binary');
};
const start = () => {
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;

        if (data.startsWith('size_')) {
            const size = data.split('_')[1];
            const context = await contextManager.getActiveContext(userId);
            const prompt = userPrompts[userId];

            if (!context || !prompt) {
                await bot.answerCallbackQuery(query.id, {text: "Ошибка: контекст или тема не установлены"});
                return;
            }

            let waitingMessage;
            try {
                waitingMessage = await bot.sendMessage(chatId, "Генерирую пост, пожалуйста, подождите...");
                const response = await handleGeneratePost(bot, chatId, userId, context.contextData, prompt, size);
                await bot.sendMessage(chatId, response, {
                    reply_markup: createMainKeyboard(userId)
                });
                await bot.deleteMessage(chatId, waitingMessage.message_id);
            } catch (error) {
                console.error('Error:', error);
                await bot.sendMessage(chatId, "Извините, произошла ошибка при генерации поста.", {
                    reply_markup: createMainKeyboard(userId)
                });
                if (waitingMessage) {
                    await bot.deleteMessage(chatId, waitingMessage.message_id);
                }
            }

            await bot.answerCallbackQuery(query.id);
            delete waitingStates[chatId];
            delete userPrompts[userId];
        }

    });
    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        const fileId = msg.photo[msg.photo.length - 1].file_id;

        try {
            const fileLink = await bot.getFileLink(fileId);
            const imageBuffer = await downloadFile(fileLink);

            // Определяем тип изображения
            const fileInfo = await bot.getFile(fileId);
            const fileExtension = path.extname(fileInfo.file_path).toLowerCase();
            let mediaType;

            switch (fileExtension) {
                case '.jpg':
                case '.jpeg':
                    mediaType = 'image/jpeg';
                    break;
                case '.png':
                    mediaType = 'image/png';
                    break;
                case '.gif':
                    mediaType = 'image/gif';
                    break;
                case '.webp':
                    mediaType = 'image/webp';
                    break;
                default:
                    mediaType = 'application/octet-stream'; // Общий тип для неизвестных форматов
            }

            const imageData = imageBuffer.toString('base64');

            const response = await axios.post('http://localhost:3001/api/anthropic', {
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 1024,
                messages: [
                    {
                        "role": 'user',
                        "content": [
                            {
                                "type": 'image',
                                "source": {
                                    "type": 'base64',
                                    "media_type": mediaType,
                                    "data": imageData,
                                },
                            },
                            {"type": "text", "text": "Что на этом изображении?"},
                        ],
                    },
                ],
            });

            await bot.sendMessage(chatId, response.data.content[0].text);
        } catch (error) {
            console.error('Error processing image:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при обработке изображения');
        }
    });

    const downloadFile = async (fileLink) => {
        const response = await axios.get(fileLink, {responseType: 'arraybuffer'});
        return Buffer.from(response.data);
    };


    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        if (msg.photo) {
            return;
        }
        const comm = ['Установить контекст', 'Сохранить контекст', 'Список контекстов', 'Переключить контекст', 'Удалить контекст', 'Проверить контекст', 'Ask AI', 'Контекст', 'Генерировать идеи', 'Генерировать пост']
        if (waitingStates[chatId]) {
            if (text === '/cancel' || text === 'Отмена') {
                return handleCancel(bot, chatId);
            }
            if (text === 'Назад') {
                handleCancel(bot, chatId);
                await bot.sendMessage(chatId, "Выберите команду:", {
                    reply_markup: createMainKeyboard(userId)
                });
                return;
            }
            if (text.startsWith('/') || comm.includes(text)) {
                await bot.sendMessage(chatId, "Пожалуйста, сначала ответьте на предыдущий запрос или используйте /cancel для отмены текущей операции.", {
                    reply_markup: createMainKeyboard(isAdmin)
                });
                return;
            }

            let waitingMessage;
            try {

                if (waitingStates[chatId] === 'waiting_for_prompt') {
                    waitingMessage = await bot.sendMessage(chatId, "Пожалуйста, подождите...");
                    /* if (msg.photo) {
                         const fileId = msg.photo[msg.photo.length - 1].file_id;
                         const fileLink = await bot.getFileLink(fileId);
                         const imagePath = path.join(__dirname, 'received_image.jpg');
                         const imageBuffer = await downloadFile(fileLink, imagePath);

                         // Запрос к Claude для распознавания изображения
                         const response = await askClaudeImage('Распознайте и опишите это изображение:', imageBuffer);

                         // Отправляем результат распознавания пользователю
                         await bot.sendMessage(chatId, response.content[0].text);
                     } else {*/
                    await bot.sendMessage(superAdminId, `Пользователь ${msg.from.username || msg.from.first_name} (ID: ${userId}) отправил промпт:\n\n${text}`);

                    let response = await askClaude(text);
                    await spendTokens(userId, response.usage.output_tokens)
                    await bot.sendMessage(chatId, response.content[0].text, {
                        reply_markup: createMainKeyboard(isAdmin)
                    });
                }

                if (waitingStates[chatId] === 'waiting_for_context') {
                    await handleSaveContext(bot, chatId, userId, text);

                } else if (waitingStates[chatId] === 'waiting_for_add_tokens') {
                    try {
                        const [user, ...tokens] = text.split(':');
                        const numberTokens = parseInt(tokens)
                        await addTokens(user, numberTokens)
                        await bot.sendMessage(chatId, `Токены "${text}" успешно добавлены`);
                    } catch (error) {
                        console.error('Error saving context:', error);
                        await bot.sendMessage(chatId, "Произошла ошибка при Добавлении токенов.");
                    }
                } else if (waitingStates[chatId] === 'waiting_for_get_tokens') {
                    let response = await getBalance(text);
                    await bot.sendMessage(chatId, `Токены "${response}"`);
                } else if (waitingStates[chatId] === 'waiting_for_context_save') {
                    const [contextName, ...contextParts] = text.split(':');
                    const contextData = contextParts.join(':').trim();
                    console.log(contextName, contextData)
                    let response = await handleSaveContextConfirm(bot, chatId, userId, text);
                    await bot.sendMessage(chatId, `${response}`, {
                        reply_markup: createContextKeyboard()
                    });
                } else if (waitingStates[chatId] === 'waiting_for_post_prompt') {
                    await bot.sendMessage(superAdminId, `Пользователь ${msg.from.username || msg.from.first_name} (ID: ${userId}) отправил промпт на генерацию поста:\n\n${text}`);

                    userPrompts[userId] = text;
                    await bot.sendMessage(chatId, "Выберите размер поста:", {
                        reply_markup: createSizeKeyboard()
                    });
                    return;
                } else if (waitingStates[chatId] === 'waiting_for_context_switch') {
                    let response = await handleSwitchContextConfirm(bot, chatId, userId, text);
                    await bot.sendMessage(chatId, `${response}`, {
                        reply_markup: createContextKeyboard()
                    });
                } else if (waitingStates[chatId] === 'waiting_for_context_delete') {
                    const contexts = await contextManager.getContexts(userId);
                    if (contexts[text]) {
                        await contextManager.deleteContext(userId, text);
                        await bot.sendMessage(chatId, `Контекст "${text}" успешно удален.`, {
                            reply_markup: createContextKeyboard()
                        });
                    } else {
                        await bot.sendMessage(chatId, `Контекст "${text}" не найден.`, {
                            reply_markup: createContextKeyboard()
                        });
                    }
                }


                if (waitingMessage) {
                    await bot.deleteMessage(chatId, waitingMessage.message_id);
                }
                delete waitingStates[chatId];
                /*if(response){
                    await bot.sendMessage(chatId, response, {
                        reply_markup: createMainKeyboard(userId)
                    });
                    return;
                }*/

            } catch (error) {
                console.error('Error:', error);
                await bot.sendMessage(chatId, "Извините, произошла ошибка при обработке вашего запроса.", {
                    reply_markup: createMainKeyboard(isAdmin)
                });
                if (waitingMessage) {
                    await bot.deleteMessage(chatId, waitingMessage.message_id);
                }
            }

            return;
        } else {

            let response;
            if (text.startsWith('/')) {
                // Обработка команд
                const command = text.split(' ')[0].toLowerCase();
                const args = text.split(' ').slice(1);
                switch (command) {
                    case '/start':
                        await addUserWithInitialBalance(userId)
                        response = await handleStart(bot, chatId);
                        break;
                    case '/info':
                        response = await handleInfo(bot, chatId, userId, msg.from.first_name);
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
                    case '/checkcontext':
                        response = await handleCheckActiveContext(bot, chatId, userId);
                        break;
                    case '/generateideas':
                        response = await handleGenerateIdeas(bot, chatId, userId);
                        break;
                    case '/generatepost':
                        response = await handleGeneratePostPrompt(bot, chatId, userId);
                        break;
                    case '/getbalance':
                        response = await getBalance(userId);
                        break;
                    case '/getbalanceuser':
                        response = await handleGetBalanceUser(bot, chatId);
                        break;
                    case '/cancel':
                        response = await handleCancel(bot, chatId);
                        break;
                    case '/getmyid':
                        response = userId
                        break;
                    case '/setrole':
                        if (isSuperAdmin(userId)) {
                            response = await handleSetRole(bot, chatId, userId, args);
                        } else {
                            response = "У вас нет прав для использования этой команды.";
                        }
                        break;
                    case '/addtokens':
                        if (isSuperAdmin(userId)) {
                            response = await handleAddTokens(bot, chatId, userId);
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
                    case 'Ask AI':
                        response = await handlePrompt(bot, chatId, userId);
                        break;
                    case 'Контекст':
                        await bot.sendMessage(chatId, "Выберите действие с контекстом:", {
                            reply_markup: createContextKeyboard()
                        });
                        return;
                    case 'Удалить контекст':
                        response = await handleDeleteContext(bot, chatId, userId);
                        await bot.sendMessage(chatId, response, {
                            reply_markup: createContextKeyboard()
                        });
                        return;
                    case 'Проверить контекст':
                        response = await handleCheckActiveContext(bot, chatId, userId);
                        await bot.sendMessage(chatId, response, {
                            reply_markup: createContextKeyboard()
                        });
                        return;
                    case 'Назад':
                        await bot.sendMessage(chatId, "Выберите команду:", {
                            reply_markup: createMainKeyboard(userId)
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
                        let waitingMessage = await bot.sendMessage(chatId, "Пожалуйста, подождите...");
                        response = await handleGenerateIdeas(bot, chatId, userId);
                        if (waitingMessage) {
                            await bot.deleteMessage(chatId, waitingMessage.message_id);
                        }
                        break;
                    case 'Генерировать пост':
                        response = await handleGeneratePostPrompt(bot, chatId, userId);
                        break;
                    case 'Баланс':
                        response = await getBalance(userId);
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
                    case 'Добавить токены':
                        if (isSuperAdmin(userId)) {
                            response = await handleAddTokens(bot, chatId, userId);
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
