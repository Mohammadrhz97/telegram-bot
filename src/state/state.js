// src/state/state.js
// Smart Global State Manager
// Structure:
// userState[userId] = { flow: "...", step: "..." }
// userTempData[userId] = { key: value, ... }

import "dotenv/config";

const userState = new Map();
const userTempData = new Map();

export function setState(userId, flow, step) {
  userState.set(userId, { flow, step });
}

export function getState(userId) {
  return userState.get(userId) || null;
}

export function clearState(userId) {
  userState.delete(userId);
}

export function setTemp(userId, dataObject) {
  const prev = userTempData.get(userId) || {};
  userTempData.set(userId, { ...prev, ...dataObject });
}

export function getTemp(userId) {
  return userTempData.get(userId) || {};
}

export function clearTemp(userId) {
  userTempData.delete(userId);
}

// Optional helpers
export function inFlow(userId, flow) {
  const s = getState(userId);
  return !!s && s.flow === flow;
}

export function setStep(userId, step) {
  const s = getState(userId);
  if (s) userState.set(userId, { ...s, step });
}
