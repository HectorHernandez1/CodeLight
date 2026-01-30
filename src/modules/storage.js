// Storage Manager Module
// Handles local storage for preferences and session data

export class StorageManager {
    constructor() {
        this.prefix = 'codelight_';
    }

    async get(key) {
        try {
            const value = localStorage.getItem(this.prefix + key);
            return value ? JSON.parse(value) : null;
        } catch (err) {
            console.error('Storage get error:', err);
            return null;
        }
    }

    async set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (err) {
            console.error('Storage set error:', err);
            return false;
        }
    }

    async remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (err) {
            console.error('Storage remove error:', err);
            return false;
        }
    }

    async clear() {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
            keys.forEach(k => localStorage.removeItem(k));
            return true;
        } catch (err) {
            console.error('Storage clear error:', err);
            return false;
        }
    }

    // Get all stored keys
    async keys() {
        return Object.keys(localStorage)
            .filter(k => k.startsWith(this.prefix))
            .map(k => k.replace(this.prefix, ''));
    }
}
