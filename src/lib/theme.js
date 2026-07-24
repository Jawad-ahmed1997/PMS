import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pms.theme";
const THEMES = ["light", "dark", "system"];
let currentTheme = "system";
let resolvedTheme = "light";
let initialized = false;
let mediaQuery;
const listeners = new Set();

function isTheme(value) {
  return THEMES.includes(value);
}

function resolveTheme(theme) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  resolvedTheme = resolveTheme(theme);
  document.documentElement.dataset.theme = resolvedTheme;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function handleSystemChange() {
  if (currentTheme === "system") applyTheme(currentTheme);
  notify();
}

function syncSystemListener() {
  if (typeof window === "undefined") return;
  const shouldListen = currentTheme === "system";
  if (shouldListen && !mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener?.("change", handleSystemChange);
  } else if (!shouldListen && mediaQuery) {
    mediaQuery.removeEventListener?.("change", handleSystemChange);
    mediaQuery = undefined;
  }
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  currentTheme = isTheme(stored) ? stored : "system";
  applyTheme(currentTheme);
  syncSystemListener();
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    currentTheme = isTheme(event.newValue) ? event.newValue : "system";
    applyTheme(currentTheme);
    syncSystemListener();
    notify();
  });
  notify();
}

export function setTheme(theme) {
  if (!isTheme(theme) || typeof window === "undefined") return;
  initialize();
  currentTheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  syncSystemListener();
  notify();
}

function subscribe(listener) {
  listeners.add(listener);
  initialize();
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentTheme;
}

function getResolvedSnapshot() {
  return resolvedTheme;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system");
  const activeTheme = useSyncExternalStore(subscribe, getResolvedSnapshot, () => "light");
  return { currentTheme: theme, resolvedTheme: activeTheme, setTheme };
}
