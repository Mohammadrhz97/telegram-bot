// src/state/state.js
// Smart Global State Manager
// Handles per-user flow and temporary data in memory.
// userState[userId] = { flow: "...", step: "..." }
// userTempData[userId] = { key: value, ... }

import "dotenv/config";

// In-memory stores for session flow and temporary data
const userState = new Map();
const userTempData = new Map();

/**
 * Set or overwrite the current flow/step for a user.
 */
export function setState(userId, flow, step) {
  userState.set(userId, { flow, step });
}

/**
 * Get the current flow/step for a user, null if not set.
 */
export function getState(userId) {
  return userState.get(userId) || null;
}

/**
 * Clear a user's flow/step.
 */
export function clearState(userId) {
  userState.delete(userId);
}

/**
 * Merge/update temporary key-value data for a user.
 */
export function setTemp(userId, dataObject) {
  const prev = userTempData.get(userId) || {};
  userTempData.set(userId, { ...prev, ...dataObject });
}

/**
 * Retrieve all temporary data for a user.
 * Returns empty object if none exists.
 */
export function getTemp(userId) {
  return userTempData.get(userId) || {};
}

/**
 * Clear all temporary data for a user.
 */
export function clearTemp(userId) {
  userTempData.delete(userId);
}

/**
 * Check if a user is currently in a specific flow.
 */
export function inFlow(userId, flow) {
  const s = getState(userId);
  return !!s && s.flow === flow;
}

/**
 * Update only the step of a user's current flow.
 * No-op if user has no state yet.
 */
export function setStep(userId, step) {
  const s = getState(userId);
  if (s) userState.set(userId, { ...s, step });
}
