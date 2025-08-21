/**
 * INIT.JS - Script d'initialisation
 * Gère le démarrage de l'application et la vérification de l'environnement
 * @module Init
 */

(function() {
    'use strict';
    
    // =========================================
    // CONFIGURATION D'INITIALISATION
    // =========================================
    const INIT_CONFIG = {
        appName: 'Interface de Facturation',
        version: '1.0.0',
        buildDate: '2024-01-20',
        environment: 'production', // 'development' | 'production'
        
        // Modules requis et optionnels
        modules: {
            required: [
                { name: 'Core', file: 'js/core.js' },
                { name: 'UIModule', file: 'js/ui.module.js' }
            ],
            optional: [
                { name: 'ConfigModule', file: 'js/config.module.js' },
                { name: 'TeamsModule', file: 'js/teams.module.js' },
                { name: 'BillingModule', file: 'js/billing.module.js' }
            ]
        },
        
        // Timeouts
        loadTimeout: 10000, // 10 secondes
        initTimeout: 5000,  // 5 secondes
        
        // Features flags
        features: {
            autoSave: true,
            darkMode: true,
            analytics: false,
            debug: localStorage.getItem('app_debug') === 'true'
        },
        
        // Navigateurs supportés (versions minimales)
        browserSupport: {
            chrome: 80,
            firefox: 75,
            safari: 13,
            edge: 80
        }
    };
    
    // =========================================
    // DÉTECTION DE L'ENVIRONNEMENT
    // =========================================
    const EnvironmentDetector = {
        /**
         * Détecte le navigateur et sa version
         */
        getBrowserInfo: function() {
            const ua = navigator.userAgent;
            let browser = 'unknown';
            let version = 0;
            
            if (/Chrome\/(\d+)/.test(ua)) {
                browser = 'chrome';
                version = parseInt(RegExp.$1);
            } else if (/Firefox\/(\d+)/.test(ua)) {
                browser = 'firefox';
                version = parseInt(RegExp.$1);
            } else if (/Safari\/(\d+)/.test(ua) && /Version\/(\d+)/.test(ua)) {
                browser = 'safari';
                version = parseInt(RegExp.$1);
            } else if (/Edg\/(\d+)/.test(ua)) {
                browser = 'edge';
                version = parseInt(RegExp.$1);
            }
            
            return { browser, version };
        },
        
        /**
         * Vérifie la compatibilité du navigateur
         */
        checkBrowserCompatibility: function() {
            const browserInfo = this.getBrowserInfo();
            const minVersion = INIT_CONFIG.browserSupport[browserInfo.browser];
            
            if (!minVersion) {
                console.warn('⚠️ Navigateur non reconnu:', browserInfo.browser);
                return { compatible: true, warning: true };
            }
            
            if (browserInfo.version < minVersion) {
                return {
                    compatible: false,
                    message: `Votre navigateur ${browserInfo.browser} v${browserInfo.version} est trop ancien. Version minimale requise: v${minVersion}`
                };
            }
            
            return { compatible: true };
        },
        
        /**
         * Vérifie les fonctionnalités requises
         */
        checkRequiredFeatures: function() {
            const required = [
                { name: 'localStorage', check: () => typeof Storage !== 'undefined' },
                { name: 'Promise', check: () => typeof Promise !== 'undefined' },
                { name: 'fetch', check: () => typeof fetch !== 'undefined' },
                { name: 'CSS Variables', check: () => CSS && CSS.supports && CSS.supports('--test', '0') },
                { name: 'ES6', check: () => {
                    try {
                        eval('const test = () => {}; let x = 1;');
                        return true;
                    } catch {
                        return false;
                    }
                }}
            ];
            
            const missing = required.filter(feature => !feature.check());
            
            return {
                supported: missing.length === 0,
                missing: missing.map(f => f.name)
            };
        },
        
        /**
         * Détecte si on est en mode développement
         */
        isDevelopment: function() {
            return location.hostname === 'localhost' || 
                   location.hostname === '127.0.0.1' ||
                   location.protocol === 'file:';
        },
        
        /**
         * Obtient les informations système
         */
        getSystemInfo: function() {
            return {
                browser: this.getBrowserInfo(),
                screen: {
                    width: screen.width,
                    height: screen.height,
                    pixelRatio: window.devicePixelRatio || 1
                },
                platform: navigator.platform,
                language: navigator.language,
                online: navigator.onLine,
                touchDevice: 'ontouchstart' in window,
                mobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
                storage: {
                    localStorage: this.getStorageSize(),
                    quota: this.getStorageQuota()
                }
            };
        },
        
        /**
         * Calcule la taille utilisée du localStorage
         */
        getStorageSize: function() {
            let size = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    size += localStorage[key].length + key.length;
                }
            }
            return size;
        },
        
        /**
         * Obtient le quota de stockage (si disponible)
         */
        getStorageQuota: async function() {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                return {
                    usage: estimate.usage,
                    quota: estimate.quota
                };
            }
            return null;
        }
    };
    
    // =========================================
    // CHARGEUR DE MODULES
    // =========================================
    const ModuleLoader = {
        loadedModules: new Set(),
        failedModules: new Set(),
        
        /**
         * Charge un module
         */
        loadModule: function(moduleInfo) {
            return new Promise((resolve, reject) => {
                // Vérifier si le module est déjà chargé
                if (window[moduleInfo.name]) {
                    this.loadedModules.add(moduleInfo.name);
                    console.log(`✅ Module ${moduleInfo.name} déjà chargé`);
                    resolve(moduleInfo.name);
                    return;
                }
                
                // Vérifier si le fichier existe (en mode dev)
                if (EnvironmentDetector.isDevelopment()) {
                    // En dev, on suppose que les fichiers sont présents
                    setTimeout(() => {
                        if (window[moduleInfo.name]) {
                            this.loadedModules.add(moduleInfo.name);
                            resolve(moduleInfo.name);
                        } else {
                            this.failedModules.add(moduleInfo.name);
                            reject(new Error(`Module ${moduleInfo.name} non trouvé`));
                        }
                    }, 100);
                } else {
                    // En production, attendre le chargement
                    const checkInterval = setInterval(() => {
                        if (window[moduleInfo.name]) {
                            clearInterval(checkInterval);
                            this.loadedModules.add(moduleInfo.name);
                            resolve(moduleInfo.name);
                        }
                    }, 100);
                    
                    // Timeout
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        if (!window[moduleInfo.name]) {
                            this.failedModules.add(moduleInfo.name);
                            reject(new Error(`Timeout chargement ${moduleInfo.name}`));
                        }
                    }, INIT_CONFIG.loadTimeout);
                }
            });
        },
        
        /**
         * Charge tous les modules
         */
        loadAllModules: async function() {
            const results = {
                loaded: [],
                failed: [],
                skipped: []
            };
            
            // Charger les modules requis
            for (const module of INIT_CONFIG.modules.required) {
                try {
                    await this.loadModule(module);
                    results.loaded.push(module.name);
                } catch (error) {
                    console.error(`❌ Échec chargement module requis ${module.name}:`, error);
                    results.failed.push(module.name);
                    throw error; // Arrêter si un module requis échoue
                }
            }
            
            // Charger les modules optionnels
            for (const module of INIT_CONFIG.modules.optional) {
                try {
                    await this.loadModule(module);
                    results.loaded.push(module.name);
                } catch (error) {
                    console.warn(`⚠️ Module optionnel ${module.name} non chargé:`, error);
                    results.skipped.push(module.name);
                }
            }
            
            return results;
        }
    };
    
    // =========================================
    // INITIALISATION DE L'APPLICATION
    // =========================================
    const AppInitializer = {
        startTime: Date.now(),
        
        /**
         * Initialise l'application
         */
        async init() {
            console.log(`🚀 Démarrage ${INIT_CONFIG.appName} v${INIT_CONFIG.version}`);
            
            try {
                // 1. Vérifier l'environnement
                this.checkEnvironment();
                
                // 2. Afficher le loader
                this.showLoader('Vérification de l\'environnement...');
                
                // 3. Charger les modules
                this.showLoader('Chargement des modules...');
                const modules = await ModuleLoader.loadAllModules();
                console.log('📦 Modules chargés:', modules);
                
                // 4. Initialiser l'application principale
                this.showLoader('Initialisation de l\'application...');
                await this.initializeApp();
                
                // 5. Configurer l'environnement
                this.setupEnvironment();
                
                // 6. Masquer le loader et démarrer
                this.hideLoader();
                this.onReady();
                
                // Temps de chargement
                const loadTime = Date.now() - this.startTime;
                console.log(`✅ Application prête en ${loadTime}ms`);
                
                // Analytics (si activé)
                if (INIT_CONFIG.features.analytics) {
                    this.trackEvent('app_loaded', { loadTime, modules: modules.loaded });
                }
                
            } catch (error) {
                console.error('❌ Erreur fatale lors de l\'initialisation:', error);
                this.showError(error);
            }
        },
        
        /**
         * Vérifie l'environnement
         */
        checkEnvironment() {
            // Vérifier la compatibilité du navigateur
            const browserCheck = EnvironmentDetector.checkBrowserCompatibility();
            if (!browserCheck.compatible) {
                throw new Error(browserCheck.message);
            }
            if (browserCheck.warning) {
                console.warn('⚠️ Navigateur non testé, des problèmes peuvent survenir');
            }
            
            // Vérifier les fonctionnalités requises
            const featureCheck = EnvironmentDetector.checkRequiredFeatures();
            if (!featureCheck.supported) {
                throw new Error(`Fonctionnalités manquantes: ${featureCheck.missing.join(', ')}`);
            }
            
            // Mode développement
            if (EnvironmentDetector.isDevelopment()) {
                INIT_CONFIG.environment = 'development';
                console.log('🔧 Mode développement activé');
            }
            
            // Informations système
            if (INIT_CONFIG.features.debug) {
                console.log('📊 Informations système:', EnvironmentDetector.getSystemInfo());
            }
        },
        
        /**
         * Initialise l'application principale
         */
        async initializeApp() {
            // Initialiser App.js si disponible
            if (window.App && typeof window.App.init === 'function') {
                await window.App.init();
            } else {
                console.warn('⚠️ App.js non disponible, initialisation manuelle des modules');
                
                // Initialisation manuelle des modules
                if (window.Core) await this.initModule('Core');
                if (window.UIModule) await this.initModule('UIModule');
                if (window.ConfigModule) await this.initModule('ConfigModule');
                if (window.TeamsModule) await this.initModule('TeamsModule');
                if (window.BillingModule) await this.initModule('BillingModule');
            }
        },
        
        /**
         * Initialise un module individuellement
         */
        async initModule(moduleName) {
            try {
                const module = window[moduleName];
                if (module && typeof module.init === 'function') {
                    await module.init();
                    console.log(`✅ ${moduleName} initialisé`);
                }
            } catch (error) {
                console.error(`❌ Erreur initialisation ${moduleName}:`, error);
            }
        },
        
        /**
         * Configure l'environnement
         */
        setupEnvironment() {
            // Mode debug
            if (INIT_CONFIG.features.debug || INIT_CONFIG.environment === 'development') {
                window.DEBUG = true;
                console.log('🔧 Mode debug activé globalement');
                
                // Exposer les modules pour le debug
                window.__APP__ = {
                    config: INIT_CONFIG,
                    modules: ModuleLoader.loadedModules,
                    env: EnvironmentDetector.getSystemInfo()
                };
            }
            
            // Thème
            const savedTheme = localStorage.getItem('app_theme');
            if (savedTheme === 'dark' || 
                (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.body.classList.add('dark-mode');
            }
            
            // Désactiver les transitions au chargement
            document.body.classList.add('no-transitions');
            setTimeout(() => {
                document.body.classList.remove('no-transitions');
            }, 100);
            
            // Gestion des erreurs globales
            this.setupErrorHandling();
            
            // Service Worker (si disponible)
            this.setupServiceWorker();
        },
        
        /**
         * Configure la gestion d'erreurs
         */
        setupErrorHandling() {
            window.addEventListener('error', (event) => {
                console.error('Erreur globale:', event.error);
                
                if (INIT_CONFIG.environment === 'production') {
                    event.preventDefault();
                    this.trackError(event.error);
                }
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                console.error('Promise rejetée:', event.reason);
                
                if (INIT_CONFIG.environment === 'production') {
                    event.preventDefault();
                    this.trackError(event.reason);
                }
            });
        },
        
        /**
         * Configure le Service Worker
         */
        setupServiceWorker() {
            if ('serviceWorker' in navigator && INIT_CONFIG.environment === 'production') {
                navigator.serviceWorker.register('/sw.js').then(
                    (registration) => console.log('✅ Service Worker enregistré'),
                    (error) => console.warn('⚠️ Service Worker non enregistré:', error)
                );
            }
        },
        
        /**
         * Affiche le loader
         */
        showLoader(message = 'Chargement...') {
            let loader = document.getElementById('app-loader');
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'app-loader';
                loader.className = 'app-loader';
                document.body.appendChild(loader);
            }
            
            loader.innerHTML = `
                <div class="loader-content">
                    <div class="loader-spinner"></div>
                    <p>${message}</p>
                    <small>v${INIT_CONFIG.version}</small>
                </div>
            `;
            
            loader.style.display = 'flex';
        },
        
        /**
         * Masque le loader
         */
        hideLoader() {
            const loader = document.getElementById('app-loader');
            if (loader) {
                loader.classList.add('fade-out');
                setTimeout(() => {
                    loader.style.display = 'none';
                    loader.classList.remove('fade-out');
                }, 300);
            }
        },
        
        /**
         * Affiche une erreur
         */
        showError(error) {
            const loader = document.getElementById('app-loader');
            if (loader) {
                loader.innerHTML = `
                    <div class="loader-content error">
                        <div style="font-size: 48px;">❌</div>
                        <h2>Erreur de chargement</h2>
                        <p>${error.message || 'Une erreur inattendue s\'est produite'}</p>
                        <details style="margin-top: 20px;">
                            <summary>Détails techniques</summary>
                            <pre style="text-align: left; font-size: 12px;">${error.stack || error}</pre>
                        </details>
                        <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 20px;">
                            Recharger la page
                        </button>
                    </div>
                `;
            }
        },
        
        /**
         * Appelé quand l'app est prête
         */
        onReady() {
            // Émettre un événement
            const event = new CustomEvent('app:ready', {
                detail: {
                    version: INIT_CONFIG.version,
                    modules: Array.from(ModuleLoader.loadedModules),
                    loadTime: Date.now() - this.startTime
                }
            });
            document.dispatchEvent(event);
            
            // Callback global si défini
            if (typeof window.onAppReady === 'function') {
                window.onAppReady();
            }
        },
        
        /**
         * Track des événements (placeholder)
         */
        trackEvent(eventName, data) {
            if (INIT_CONFIG.features.analytics) {
                console.log(`📊 Analytics: ${eventName}`, data);
                // Intégration avec Google Analytics, Matomo, etc.
            }
        },
        
        /**
         * Track des erreurs (placeholder)
         */
        trackError(error) {
            if (INIT_CONFIG.environment === 'production') {
                console.log('📊 Error tracking:', error);
                // Intégration avec Sentry, Rollbar, etc.
            }
        }
    };
    
    // =========================================
    // DÉMARRAGE
    // =========================================
    
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            AppInitializer.init();
        });
    } else {
        // DOM déjà chargé
        AppInitializer.init();
    }
    
    // Exposer l'API si besoin
    window.AppInit = {
        config: INIT_CONFIG,
        restart: () => AppInitializer.init(),
        getLoadedModules: () => Array.from(ModuleLoader.loadedModules),
        getSystemInfo: () => EnvironmentDetector.getSystemInfo()
    };
    
})();
