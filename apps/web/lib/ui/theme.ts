export type ThemeChoice = 'dark' | 'light' | 'system';
export const THEME_KEY = 'morrow-theme';
/** Dark is the default; "system" follows the OS and is an explicit choice. */
export const DEFAULT_THEME: ThemeChoice = 'dark';

/**
 * Inline <head> script: applies the stored (or default) theme before first paint, so there is no flash.
 * <html> is server-rendered with data-theme="dark"; "system" removes it so tokens.css follows the OS.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');var r=document.documentElement;if(t==='system')delete r.dataset.theme;else r.dataset.theme=t==='light'?'light':'${DEFAULT_THEME}'}catch(e){}`;
