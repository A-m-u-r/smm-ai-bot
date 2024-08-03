const TelegramApi = require("node-telegram-bot-api");
const { token } = require('./config');
const { askClaude } = require('./claudeApi');
const {
    handleStart,
    handleInfo,
    handlePrompt,
    handleSetRole,
    handleUnknownCommand
} = require('./botCommands');

const bot = new TelegramApi(token, {polling: true});

// Объект для хранения состояния чатов
const chatStates = {};

const start = () => {
    bot.setMyCommands([
        {command: '/start', description: 'Начальное приветствие'},
        {command: '/info', description: 'Инфо о пользователе'},
        {command: '/prompt', description: 'Задать вопрос Claude'},
        {command: '/setrole', description: 'Установить роль пользователя (только для супер-админа)'},
    ]);

    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Проверяем, ожидает ли чат промпта
        if (chatStates[chatId] === 'waiting_for_prompt') {
            chatStates[chatId] = 'processing';
            try {
                const response = await askClaude(text);
                const claudeResponse = response.content[0].text;
                await bot.sendMessage(chatId, claudeResponse);
            } catch (error) {
                console.error('Error in Claude response:', error);
                await bot.sendMessage(chatId, "Извините, произошла ошибка при обработке вашего запроса.");
            }
            delete chatStates[chatId];
            return;
        }

        if (text === '/start') {
            return handleStart(bot, chatId);
        }

        if (text === '/info') {
            return handleInfo(bot, chatId, userId, msg.from.first_name);
        }

        if (text === '/prompt') {
            chatStates[chatId] = 'waiting_for_prompt';
            return handlePrompt(bot, chatId, userId);
        }

        if (text.startsWith('/setrole')) {
            const args = text.split(' ').slice(1);
            return handleSetRole(bot, chatId, userId, args);
        }

        return handleUnknownCommand(bot, chatId);
    });
}

start();

/*
const TelegramApi = require("node-telegram-bot-api");
const axios = require('axios');
const token = '7085722719:AAFTn4XZX_erwtiAGO1fdVbD2hiMpodkOUM';

const bot = new TelegramApi(token, {polling: true});

// Объект для хранения состояния чатов
const chatStates = {};

// Объект для хранения ролей пользователей
const userRoles = {};

// ID супер-администратора
const superAdminId = 562533452; // Замените на реальный ID пользователя https://t.me/bufferse

const askClaude = async (prompt) => {
    try {
        const response = await axios.post('http://localhost:3001/api/anthropic', {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1000,
            messages: [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        return response.data;
    } catch (error) {
        console.error('Error calling Anthropic API:', error);
        throw error;
    }
}

const isAdmin = (userId) => {
    return userRoles[userId] === 'admin' || userId === superAdminId;
}

const isSuperAdmin = (userId) => {
    return userId === superAdminId;
}

const setRole = (userId, role) => {
    userRoles[userId] = role;
}

const start = () => {
    bot.setMyCommands([
        {command: '/start', description: 'Начальное приветствие'},
        {command: '/info', description: 'Инфо о пользователе'},
        {command: '/prompt', description: 'Задать вопрос Claude'},
        {command: '/setrole', description: 'Установить роль пользователя (только для супер-админа)'},
    ]);

    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        const userId = msg.from.id;


        // Проверяем, ожидает ли чат промпта
        if (chatStates[chatId] === 'waiting_for_prompt') {
            chatStates[chatId] = 'processing';
            try {
                const response = await askClaude(text);
                const claudeResponse = response.content[0].text;
                await bot.sendMessage(chatId, claudeResponse);
            } catch (error) {
                console.error('Error in Claude response:', error);
                await bot.sendMessage(chatId, "Извините, произошла ошибка при обработке вашего запроса.");
            }
            delete chatStates[chatId];
            return;
        }

        if (text === '/start') {
            await bot.sendSticker(chatId, `https://tlgrm.ru/_/stickers/e65/38d/e6538d88-ed55-39d9-a67f-ad97feea9c01/1.webp`);
            return bot.sendMessage(chatId, `Привет! Ты написал ${text}`);
        }

        if (text === '/info') {
            const role = userRoles[userId] || 'пользователь';
            return bot.sendMessage(chatId, `Тебя зовут ${msg.from.first_name}. Твоя роль: ${role}`);
        }

        if (text === '/prompt') {
            if (!isAdmin(userId)) {
                return bot.sendMessage(chatId, "У вас нет прав для использования этой команды.");
            }
            chatStates[chatId] = 'waiting_for_prompt';
            return bot.sendMessage(chatId, "Пожалуйста, введите ваш запрос для Claude:");
        }

        if (text.startsWith('/setrole')) {
            if (!isSuperAdmin(userId)) {
                return bot.sendMessage(chatId, "Только супер-администратор может устанавливать роли.");
            }
            const args = text.split(' ');
            if (args.length !== 3) {
                return bot.sendMessage(chatId, "Использование: /setrole [user_id] [role]");
            }
            const targetUserId = args[1];
            const newRole = args[2];
            setRole(targetUserId, newRole);
            return bot.sendMessage(chatId, `Роль пользователя ${targetUserId} установлена как ${newRole}`);
        }

        return bot.sendMessage(chatId, 'Я тебя не понимаю, попробуй еще раз!');
    });
}

start();

*/
