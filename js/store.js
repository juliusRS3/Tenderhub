// Picks the data store: Supabase when keys are set in config.js, otherwise demo mode.
const CFG = window.TENDERHUB_CONFIG;
const live = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
export const store = live ? (await import("./store-supabase.js")).store : (await import("./store-local.js")).store;
