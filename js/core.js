/**
 * CORE.JS - Module Central
 * Gère l'état global, les événements, le stockage et les utilitaires
 * @module Core
 */

window.Core = (function() {
    'use strict';
    
    // =========================================
    // CONFIGURATION PRIVÉE
    // =========================================
    const config = {
        storagePrefix: 'billing_',
        maxStorageSize: 5 * 1024 * 1024, // 5MB
        debugMode: false,
        version: '1.0.0'
    };
    
    // =========================================
    // ÉTAT GLOBAL PRIVÉ
    // =========================================
    let globalState = {};
    let stateListeners = new Map();
    let eventListeners = new Map();
    
    // =========================================
    // GESTION DE L'ÉTAT
    // =========================================
    const state = {
        /**
         * Obtient une valeur de l'état global
         * @param {string} key - Clé de la valeur (supporte la notation pointée)
         * @param {*} defaultValue - Valeur par défaut si non trouvée
         * @returns {*} La valeur trouvée ou la valeur par défaut
         */
        get: function(key, defaultValue = null) {
            const keys = key.split('.');
            let value = globalState;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    return defaultValue;
                }
            }
            
            return value;
        },
        
        /**
         * Définit une valeur dans l'état global
         * @param {string} key - Clé de la valeur (supporte la notation pointée)
         * @param {*} value - Valeur à définir
         * @returns {boolean} Succès de l'opération
         */
        set: function(key, value) {
            const keys = key.split('.');
            const lastKey = keys.pop();
            let target = globalState;
            
            // Naviguer jusqu'au parent
            for (const k of keys) {
                if (!(k in target) || typeof target[k] !== 'object') {
                    target[k] = {};
                }
                target = target[k];
            }
            
            // Stocker l'ancienne valeur pour la comparaison
            const oldValue = target[lastKey];
            const hasChanged = !utils.deepEqual(oldValue, value);
            
            // Définir la nouvelle valeur
            target[lastKey] = value;
            
            // Notifier les listeners si changement
            if (hasChanged) {
                this.notify(key, value, oldValue);
            }
            
            // Sauvegarder automatiquement
            if (config.autoSave) {
                storage.saveState();
            }
            
            return true;
        },
        
        /**
         * Supprime une valeur de l'état
         * @param {string} key - Clé à supprimer
         */
        remove: function(key) {
            const keys = key.split('.');
            const lastKey = keys.pop();
            let target = globalState;
            
            for (const k of keys) {
                if (!(k in target)) return false;
                target = target[k];
            }
            
            if (lastKey in target) {
                const oldValue = target[lastKey];
                delete target[lastKey];
                this.notify(key, undefined, oldValue);
                return true;
            }
            
            return false;
        },
        
        /**
         * S'abonner aux changements d'une clé
         * @param {string} key - Clé à observer
         * @param {Function} callback - Fonction appelée lors des changements
         * @returns {Function} Fonction de désabonnement
         */
        subscribe: function(key, callback) {
            if (!stateListeners.has(key)) {
                stateListeners.set(key, new Set());
            }
            
            stateListeners.get(key).add(callback);
            
            // Retourner une fonction de désabonnement
            return () => {
                const listeners = stateListeners.get(key);
                if (listeners) {
                    listeners.delete(callback);
                    if (listeners.size === 0) {
                        stateListeners.delete(key);
                    }
                }
            };
        },
        
        /**
         * Notifie les listeners d'un changement
         * @private
         */
        notify: function(key, newValue, oldValue) {
            // Notifier les listeners spécifiques
            const listeners = stateListeners.get(key);
            if (listeners) {
                listeners.forEach(callback => {
                    try {
                        callback(newValue, oldValue, key);
                    } catch (error) {
                        console.error(`Erreur dans le listener pour ${key}:`, error);
                    }
                });
            }
            
            // Notifier les listeners globaux (*)
            const globalListeners = stateListeners.get('*');
            if (globalListeners) {
                globalListeners.forEach(callback => {
                    try {
                        callback({ key, newValue, oldValue });
                    } catch (error) {
                        console.error('Erreur dans le listener global:', error);
                    }
                });
            }
        },
        
        /**
         * Obtient tout l'état
         */
        getAll: function() {
            return utils.deepClone(globalState);
        },
        
        /**
         * Remplace tout l'état
         */
        setAll: function(newState) {
            const oldState = globalState;
            globalState = utils.deepClone(newState);
            this.notify('*', globalState, oldState);
            return true;
        },
        
        /**
         * Réinitialise l'état
         */
        reset: function() {
            const oldState = globalState;
            globalState = {};
            this.notify('*', globalState, oldState);
            storage.clear();
        }
    };
    
    // =========================================
    // SYSTÈME D'ÉVÉNEMENTS
    // =========================================
    const events = {
        /**
         * Écoute un événement
         * @param {string} event - Nom de l'événement
         * @param {Function} callback - Fonction à appeler
         * @returns {Function} Fonction de désabonnement
         */
        on: function(event, callback) {
            if (!eventListeners.has(event)) {
                eventListeners.set(event, new Set());
            }
            
            eventListeners.get(event).add(callback);
            
            // Log en mode debug
            if (config.debugMode) {
                console.log(`📡 Listener ajouté pour "${event}"`);
            }
            
            // Retourner fonction de désabonnement
            return () => this.off(event, callback);
        },
        
        /**
         * Écoute un événement une seule fois
         */
        once: function(event, callback) {
            const wrapper = (...args) => {
                callback(...args);
                this.off(event, wrapper);
            };
            return this.on(event, wrapper);
        },
        
        /**
         * Retire un listener
         */
        off: function(event, callback) {
            const listeners = eventListeners.get(event);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    eventListeners.delete(event);
                }
            }
        },
        
        /**
         * Émet un événement
         * @param {string} event - Nom de l'événement
         * @param {*} data - Données à transmettre
         */
        emit: function(event, data) {
            if (config.debugMode) {
                console.log(`📢 Événement émis: "${event}"`, data);
            }
            
            // Listeners spécifiques
            const listeners = eventListeners.get(event);
            if (listeners) {
                listeners.forEach(callback => {
                    try {
                        callback(data, event);
                    } catch (error) {
                        console.error(`Erreur dans listener pour ${event}:`, error);
                    }
                });
            }
            
            // Listeners globaux
            const globalListeners = eventListeners.get('*');
            if (globalListeners) {
                globalListeners.forEach(callback => {
                    try {
                        callback({ event, data });
                    } catch (error) {
                        console.error('Erreur dans listener global:', error);
                    }
                });
            }
        },
        
        /**
         * Émet un événement de manière asynchrone
         */
        emitAsync: function(event, data) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.emit(event, data);
                    resolve();
                }, 0);
            });
        },
        
        /**
         * Supprime tous les listeners d'un événement
         */
        clear: function(event) {
            if (event) {
                eventListeners.delete(event);
            } else {
                eventListeners.clear();
            }
        }
    };
    
    // =========================================
    // GESTION DU STOCKAGE
    // =========================================
    const storage = {
        /**
         * Sauvegarde une donnée
         */
        save: function(key, data) {
            try {
                const fullKey = config.storagePrefix + key;
                const serialized = JSON.stringify(data);
                
                // Vérifier la taille
                if (serialized.length > config.maxStorageSize) {
                    console.warn(`⚠️ Données trop volumineuses pour ${key}`);
                    events.emit('storage:error', { 
                        type: 'size_exceeded', 
                        key, 
                        size: serialized.length 
                    });
                    return false;
                }
                
                localStorage.setItem(fullKey, serialized);
                events.emit('storage:saved', { key, size: serialized.length });
                return true;
                
            } catch (error) {
                console.error(`Erreur sauvegarde ${key}:`, error);
                events.emit('storage:error', { type: 'save_failed', key, error });
                
                // Gérer le quota dépassé
                if (error.name === 'QuotaExceededError') {
                    this.handleQuotaExceeded();
                }
                
                return false;
            }
        },
        
        /**
         * Charge une donnée
         */
        load: function(key, defaultValue = null) {
            try {
                const fullKey = config.storagePrefix + key;
                const data = localStorage.getItem(fullKey);
                
                if (data === null) {
                    return defaultValue;
                }
                
                const parsed = JSON.parse(data);
                events.emit('storage:loaded', { key });
                return parsed;
                
            } catch (error) {
                console.error(`Erreur chargement ${key}:`, error);
                events.emit('storage:error', { type: 'load_failed', key, error });
                return defaultValue;
            }
        },
        
        /**
         * Supprime une donnée
         */
        remove: function(key) {
            try {
                const fullKey = config.storagePrefix + key;
                localStorage.removeItem(fullKey);
                events.emit('storage:removed', { key });
                return true;
            } catch (error) {
                console.error(`Erreur suppression ${key}:`, error);
                return false;
            }
        },
        
        /**
         * Vérifie si une clé existe
         */
        exists: function(key) {
            const fullKey = config.storagePrefix + key;
            return localStorage.getItem(fullKey) !== null;
        },
        
        /**
         * Liste toutes les clés de l'application
         */
        keys: function() {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(config.storagePrefix)) {
                    keys.push(key.substring(config.storagePrefix.length));
                }
            }
            return keys;
        },
        
        /**
         * Efface toutes les données de l'application
         */
        clear: function() {
            const keys = this.keys();
            keys.forEach(key => this.remove(key));
            events.emit('storage:cleared');
        },
        
        /**
         * Sauvegarde l'état global
         */
        saveState: function() {
            return this.save('state', globalState);
        },
        
        /**
         * Charge l'état global
         */
        loadState: function() {
            const loadedState = this.load('state', {});
            if (loadedState && typeof loadedState === 'object') {
                globalState = loadedState;
                events.emit('state:loaded', globalState);
                return true;
            }
            return false;
        },
        
        /**
         * Exporte toutes les données
         */
        export: function() {
            const data = {
                version: config.version,
                timestamp: new Date().toISOString(),
                state: globalState,
                storage: {}
            };
            
            // Collecter toutes les données
            this.keys().forEach(key => {
                if (key !== 'state') {
                    data.storage[key] = this.load(key);
                }
            });
            
            return data;
        },
        
        /**
         * Importe des données
         */
        import: function(data) {
            try {
                // Vérifier la structure
                if (!data || !data.version) {
                    throw new Error('Format de données invalide');
                }
                
                // Importer l'état
                if (data.state) {
                    globalState = data.state;
                    this.saveState();
                }
                
                // Importer le stockage
                if (data.storage) {
                    Object.entries(data.storage).forEach(([key, value]) => {
                        this.save(key, value);
                    });
                }
                
                events.emit('storage:imported', data);
                return true;
                
            } catch (error) {
                console.error('Erreur import:', error);
                events.emit('storage:error', { type: 'import_failed', error });
                return false;
            }
        },
        
        /**
         * Gère le dépassement de quota
         * @private
         */
        handleQuotaExceeded: function() {
            console.warn('⚠️ Quota localStorage dépassé');
            
            // Essayer de nettoyer les vieilles données
            const keys = this.keys();
            const sizes = {};
            
            keys.forEach(key => {
                const data = localStorage.getItem(config.storagePrefix + key);
                if (data) {
                    sizes[key] = data.length;
                }
            });
            
            // Trier par taille
            const sorted = Object.entries(sizes).sort((a, b) => b[1] - a[1]);
            
            console.log('📊 Utilisation du stockage:', sorted);
            events.emit('storage:quota_exceeded', { sizes: sorted });
        },
        
        /**
         * Obtient la taille utilisée
         */
        getSize: function() {
            let totalSize = 0;
            this.keys().forEach(key => {
                const data = localStorage.getItem(config.storagePrefix + key);
                if (data) {
                    totalSize += data.length;
                }
            });
            return totalSize;
        }
    };
    
    // =========================================
    // UTILITAIRES
    // =========================================
    const utils = {
        /**
         * Clone profond d'un objet
         */
        deepClone: function(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof Array) return obj.map(item => this.deepClone(item));
            if (obj instanceof RegExp) return new RegExp(obj);
            
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        },
        
        /**
         * Comparaison profonde
         */
        deepEqual: function(a, b) {
            if (a === b) return true;
            
            if (a === null || b === null) return false;
            if (typeof a !== typeof b) return false;
            
            if (typeof a !== 'object') return a === b;
            
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            for (const key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!this.deepEqual(a[key], b[key])) return false;
            }
            
            return true;
        },
        
        /**
         * Debounce
         */
        debounce: function(func, wait = 300) {
            let timeout;
            return function debounced(...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), wait);
            };
        },
        
        /**
         * Throttle
         */
        throttle: function(func, limit = 300) {
            let inThrottle;
            return function throttled(...args) {
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        /**
         * Génère un ID unique
         */
        generateId: function(prefix = 'id') {
            return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },
        
        /**
         * Formate une date
         */
        formatDate: function(date, format = 'DD/MM/YYYY') {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            
            return format
                .replace('DD', day)
                .replace('MM', month)
                .replace('YYYY', year);
        },
        
        /**
         * Parse un CSV
         */
        parseCSV: function(text, delimiter = ',') {
            const lines = text.split('\n');
            const result = [];
            const headers = lines[0].split(delimiter).map(h => h.trim());
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(delimiter);
                if (values.length === headers.length) {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index].trim();
                    });
                    result.push(obj);
                }
            }
            
            return result;
        },
        
        /**
         * Convertit en CSV
         */
        toCSV: function(data, delimiter = ',') {
            if (!data || data.length === 0) return '';
            
            const headers = Object.keys(data[0]);
            const csv = [headers.join(delimiter)];
            
            data.forEach(item => {
                const row = headers.map(header => {
                    const value = item[header];
                    // Échapper les valeurs contenant le délimiteur
                    if (typeof value === 'string' && value.includes(delimiter)) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csv.push(row.join(delimiter));
            });
            
            return csv.join('\n');
        },
        
        /**
         * Valide un email
         */
        isValidEmail: function(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },
        
        /**
         * Capitalise la première lettre
         */
        capitalize: function(str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        },
        
        /**
         * Tronque un texte
         */
        truncate: function(str, length = 50, suffix = '...') {
            if (!str || str.length <= length) return str;
            return str.substring(0, length - suffix.length) + suffix;
        },
        
        /**
         * Formate un montant
         */
        formatCurrency: function(amount, currency = '€') {
            const formatted = parseFloat(amount).toFixed(2);
            return `${formatted}${currency}`;
        },
        
        /**
         * Sleep (pour async/await)
         */
        sleep: function(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };
    
    // =========================================
    // API PUBLIQUE
    // =========================================
    const CoreAPI = {
        // Configuration
        config: config,
        
        // Modules
        state: state,
        events: events,
        storage: storage,
        utils: utils,
        
        /**
         * Initialise le Core
         */
        init: function(customConfig = {}) {
            // Merger la configuration
            Object.assign(config, customConfig);
            
            // Activer le mode debug si demandé
            if (config.debugMode) {
                console.log('🔧 Core - Mode debug activé');
            }
            
            // Charger l'état sauvegardé
            if (storage.loadState()) {
                console.log('✅ Core - État restauré');
            } else {
                console.log('📝 Core - Nouvel état créé');
            }
            
            // Auto-save périodique si activé
            if (config.autoSave && config.autoSaveInterval) {
                setInterval(() => {
                    storage.saveState();
                    if (config.debugMode) {
                        console.log('💾 Core - Sauvegarde automatique');
                    }
                }, config.autoSaveInterval);
            }
            
            // Émettre l'événement d'initialisation
            events.emit('core:initialized', config);
            
            console.log('✅ Core initialisé v' + config.version);
            return this;
        },
        
        /**
         * Réinitialise le Core
         */
        reset: function() {
            state.reset();
            events.clear();
            storage.clear();
            console.log('🔄 Core réinitialisé');
        },
        
        /**
         * Active/désactive le mode debug
         */
        setDebugMode: function(enabled) {
            config.debugMode = enabled;
            console.log(`🔧 Mode debug ${enabled ? 'activé' : 'désactivé'}`);
        },
        
        /**
         * Obtient la version
         */
        getVersion: function() {
            return config.version;
        }
    };
    
    // Retourner l'API publique
    return CoreAPI;
    
})();

// Auto-initialisation si le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.Core._initialized) {
            window.Core.init();
            window.Core._initialized = true;
        }
    });
} else {
    // DOM déjà chargé
    if (!window.Core._initialized) {
        window.Core.init();
        window.Core._initialized = true;
    }
}
