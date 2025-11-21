// src/bot/state.js
// Shared in-memory states (per-process)
export const summaryByUser = new Map(); // telegramId -> { chatId, messageId }
export const userCheckoutState = new Map(); // telegramId -> { step, tempData }
export const adminAddProductState = new Map(); // telegramId -> { step, tempData }
