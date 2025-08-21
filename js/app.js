/**
 * APP.JS - Orchestrateur principal
 * Coordonne tous les modules et gère le cycle de vie de l'application
 * @module App
 */

window.App = (function() {
    'use strict';
    
    // =========================================
    // CONFIGURATION DE L'APPLICATION
    // =========================================
    const config = {
        version: '1.0.0',
        name: 'Interface de Facturation',
        debug: localStorage.getItem('app_debug') === 'true',
        autoSave: true,
        autoSaveInterval: 60000, // 1 minute
        modules: {
            required: ['Core', 'UIModule'],
            optional: ['ConfigModule', 'TeamsModule', 'BillingModule']
        },
        defaultState: {
            currentView: 'startup',
            currentTab: 'teams',
            projectInfo: null,
            isInitialized: false
        }
    };
    
    // =========================================
    // ÉTAT DE L'APPLICATION
    // =========================================
    let appState = {
        ...config.defaultState,
        modules: {
            loaded: [],
            failed: []
        },
        timers: {
            autoSave: null,
            session: null
        }
    };
    
    // =========================================
    // GESTION DES MODULES
    // =========================================
    const ModuleManager = {
        /**
         * Vérifie la disponibilité des modules
         */
        checkModules: function() {
            const results = {
                loaded: [],
                missing: [],
                failed: []
            };
            
            // Vérifier les modules requis
            config.modules.required.forEach(moduleName => {
                if (window[moduleName]) {
                    results.loaded.push(moduleName);
                    console.log(`✅ Module ${moduleName} détecté`);
                } else {
                    results.missing.push(moduleName);
                    console.error(`❌ Module requis manquant: ${moduleName}`);
                }
            });
            
            // Vérifier les modules optionnels
            config.modules.optional.forEach(moduleName => {
                if (window[moduleName]) {
                    results.loaded.push(moduleName);
                    console.log(`✅ Module optionnel ${moduleName} détecté`);
                } else {
                    console.warn(`⚠️ Module optionnel non chargé: ${moduleName}`);
                }
            });
            
            appState.modules = results;
            return results;
        },
        
        /**
         * Initialise tous les modules disponibles
         */
        initializeModules: async function() {
            const initPromises = [];
            
            // Initialiser Core en premier
            if (window.Core && window.Core.init) {
                try {
                    await window.Core.init({
                        debugMode: config.debug,
                        autoSave: config.autoSave,
                        autoSaveInterval: config.autoSaveInterval
                    });
                    console.log('✅ Core initialisé');
                } catch (error) {
                    console.error('❌ Erreur initialisation Core:', error);
                    throw error;
                }
            }
            
            // Initialiser UIModule
            if (window.UIModule && window.UIModule.init) {
                try {
                    await window.UIModule.init({
                        theme: localStorage.getItem('app_theme') || 'light'
                    });
                    console.log('✅ UIModule initialisé');
                } catch (error) {
                    console.error('❌ Erreur initialisation UIModule:', error);
                }
            }
            
            // Initialiser les autres modules
            const otherModules = ['ConfigModule', 'TeamsModule', 'BillingModule'];
            
            for (const moduleName of otherModules) {
                if (window[moduleName] && window[moduleName].init) {
                    try {
                        await window[moduleName].init();
                        console.log(`✅ ${moduleName} initialisé`);
                    } catch (error) {
                        console.error(`⚠️ Erreur initialisation ${moduleName}:`, error);
                        appState.modules.failed.push(moduleName);
                    }
                }
            }
            
            return appState.modules;
        },
        
        /**
         * Crée des modules factices pour les modules manquants
         */
        createMockModules: function() {
            const mockModule = {
                init: function() { 
                    console.log(`Mock module initialized`);
                    return this;
                },
                render: function() {},
                getAll: function() { return []; },
                add: function() { return true; },
                update: function() { return true; },
                remove: function() { return true; }
            };
            
            // Créer les modules manquants
            appState.modules.missing.forEach(moduleName => {
                if (!window[moduleName]) {
                    window[moduleName] = { ...mockModule };
                    console.log(`📝 Module factice créé: ${moduleName}`);
                }
            });
        }
    };
    
    // =========================================
    // GESTION DES VUES
    // =========================================
    const ViewManager = {
        /**
         * Affiche l'écran de démarrage
         */
        showStartup: function() {
            const startupScreen = document.getElementById('startup-screen');
            const mainInterface = document.getElementById('main-interface');
            
            if (startupScreen) startupScreen.style.display = 'flex';
            if (mainInterface) mainInterface.classList.add('hidden');
            
            this.renderStartupContent();
            appState.currentView = 'startup';
        },
        
        /**
         * Affiche l'interface principale
         */
        showMain: function() {
            const startupScreen = document.getElementById('startup-screen');
            const mainInterface = document.getElementById('main-interface');
            const globalHeader = document.getElementById('global-header');
            const appFooter = document.getElementById('app-footer');
            
            if (startupScreen) startupScreen.style.display = 'none';
            if (mainInterface) mainInterface.classList.remove('hidden');
            if (globalHeader) globalHeader.classList.remove('hidden');
            if (appFooter) appFooter.classList.remove('hidden');
            
            this.renderMainContent();
            appState.currentView = 'main';
            
            // Activer l'onglet par défaut
            if (window.UIModule && window.UIModule.navigation) {
                window.UIModule.navigation.switchTab(appState.currentTab);
            }
        },
        
        /**
         * Génère le contenu de l'écran de démarrage
         */
        renderStartupContent: function() {
            const container = document.getElementById('startup-container');
            if (!container) return;
            
            const savedProject = Core ? Core.state.get('projectInfo') : null;
            const hasTeams = Core ? Core.state.get('teams', []).length > 0 : false;
            
            container.innerHTML = `
                <div class="startup-content">
                    <div class="startup-header">
                        <h1>📊 ${config.name}</h1>
                        <p>Gestion de la facturation et des équipes</p>
                    </div>
                    
                    <div class="startup-form">
                        <div class="form-group">
                            <label for="projectTitle">Nom du projet *</label>
                            <input type="text" id="projectTitle" 
                                   placeholder="Ex: Facturation Q1 2025" 
                                   value="${savedProject?.title || ''}" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Période de facturation</label>
                            <div class="date-range">
                                <input type="date" id="startDate" value="${savedProject?.startDate || ''}">
                                <span>→</span>
                                <input type="date" id="endDate" value="${savedProject?.endDate || ''}">
                            </div>
                        </div>
                        
                        <div class="startup-actions">
                            <button class="btn btn-primary btn-lg" onclick="App.startNewProject()">
                                🚀 Nouveau Projet
                            </button>
                            ${savedProject && hasTeams ? `
                                <button class="btn btn-success btn-lg" onclick="App.continueProject()">
                                    ▶️ Continuer "${savedProject.title}"
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary" onclick="App.loadProject()">
                                📂 Charger Projet
                            </button>
                        </div>
                    </div>
                    
                    <div class="startup-footer">
                        <small>Version ${config.version}</small>
                    </div>
                </div>
            `;
            
            // Auto-remplir les dates
            if (!savedProject) {
                const today = new Date();
                const startOfYear = new Date(today.getFullYear(), 0, 1);
                
                const startDateEl = document.getElementById('startDate');
                const endDateEl = document.getElementById('endDate');
                
                if (startDateEl) startDateEl.value = startOfYear.toISOString().split('T')[0];
                if (endDateEl) endDateEl.value = today.toISOString().split('T')[0];
            }
        },
        
        /**
         * Génère le contenu principal
         */
        renderMainContent: function() {
            // Mise à jour du header
            this.updateHeader();
            
            // Mise à jour de la toolbar
            this.renderToolbar();
            
            // Mise à jour des stats
            this.updateStats();
            
            // Rendu du contenu de l'onglet actif
            this.renderActiveTab();
        },
        
        /**
         * Met à jour le header
         */
        updateHeader: function() {
            const projectInfo = Core ? Core.state.get('projectInfo') : null;
            const headerActions = document.getElementById('header-actions');
            
            if (headerActions) {
                headerActions.innerHTML = `
                    <span class="project-name">${projectInfo?.title || 'Sans titre'}</span>
                    <button class="btn btn-ghost" onclick="App.saveProject()">
                        💾 Sauvegarder
                    </button>
                    <button class="btn btn-ghost" onclick="App.exportProject()">
                        📤 Exporter
                    </button>
                    <button class="btn btn-ghost" onclick="App.toggleTheme()">
                        <span id="theme-icon">${document.body.classList.contains('dark-mode') ? '☀️' : '🌙'}</span>
                    </button>
                    <button class="btn btn-ghost" onclick="App.showSettings()">
                        ⚙️
                    </button>
                `;
            }
        },
        
        /**
         * Génère la toolbar
         */
        renderToolbar: function() {
            const container = document.getElementById('toolbar-container');
            if (!container) return;
            
            container.innerHTML = `
                <div class="toolbar">
                    <div class="toolbar-group">
                        <button class="btn btn-primary" onclick="App.showAddForm()">
                            ➕ Ajouter Équipe
                        </button>
                        <button class="btn btn-secondary" onclick="App.importData()">
                            📥 Importer
                        </button>
                        <button class="btn btn-secondary" onclick="App.exportData()">
                            📤 Exporter
                        </button>
                    </div>
                    <div class="toolbar-group">
                        <input type="text" class="search-input" 
                               placeholder="Rechercher..." 
                               onkeyup="App.handleSearch(this.value)">
                    </div>
                </div>
            `;
        },
        
        /**
         * Met à jour les statistiques
         */
        updateStats: function() {
            const container = document.getElementById('stats-container');
            if (!container) return;
            
            let stats = {
                totalTeams: 0,
                totalSessions: 0,
                totalAmount: 0
            };
            
            // Récupérer les stats des modules
            if (window.TeamsModule && window.TeamsModule.getStatistics) {
                stats = window.TeamsModule.getStatistics();
            } else if (window.Core) {
                const teams = Core.state.get('teams', []);
                stats.totalTeams = teams.length;
            }
            
            container.innerHTML = `
                <div class="stats-cards">
                    <div class="stat-card">
                        <div class="stat-value">${stats.totalTeams}</div>
                        <div class="stat-label">Équipes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.totalSessions || 0}</div>
                        <div class="stat-label">Sessions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${(stats.totalAmount || 0).toFixed(2)}€</div>
                        <div class="stat-label">Total</div>
                    </div>
                </div>
            `;
        },
        
        /**
         * Rendu de l'onglet actif
         */
        renderActiveTab: function() {
            const tab = appState.currentTab;
            
            switch(tab) {
                case 'teams':
                    if (window.TeamsModule && window.TeamsModule.render) {
                        window.TeamsModule.render();
                    } else {
                        this.renderEmptyState('teams');
                    }
                    break;
                    
                case 'billing':
                    if (window.BillingModule && window.BillingModule.render) {
                        window.BillingModule.render();
                    } else {
                        this.renderEmptyState('billing');
                    }
                    break;
                    
                case 'config':
                    if (window.ConfigModule && window.ConfigModule.renderConfigUI) {
                        window.ConfigModule.renderConfigUI();
                    } else {
                        this.renderEmptyState('config');
                    }
                    break;
                    
                case 'reports':
                    this.renderReports();
                    break;
                    
                default:
                    this.renderEmptyState(tab);
            }
        },
        
        /**
         * Affiche un état vide
         */
        renderEmptyState: function(section) {
            const container = document.getElementById(`${section}-container`);
            if (!container) return;
            
            const messages = {
                teams: 'Module Équipes non chargé',
                billing: 'Module Facturation non chargé',
                config: 'Module Configuration non chargé',
                reports: 'Aucun rapport disponible'
            };
            
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>${messages[section] || 'Section vide'}</h3>
                    <p>Cette section sera bientôt disponible</p>
                </div>
            `;
        },
        
        /**
         * Génère la vue des rapports
         */
        renderReports: function() {
            const container = document.getElementById('reports-container');
            if (!container) return;
            
            // Récupérer les données
            const teams = Core ? Core.state.get('teams', []) : [];
            const projectInfo = Core ? Core.state.get('projectInfo') : {};
            
            container.innerHTML = `
                <div class="reports-view">
                    <h2>📈 Rapports et Analyses</h2>
                    
                    <div class="report-section">
                        <h3>Résumé du projet</h3>
                        <div class="report-content">
                            <p><strong>Projet:</strong> ${projectInfo.title || 'Sans titre'}</p>
                            <p><strong>Période:</strong> ${projectInfo.startDate || 'N/A'} - ${projectInfo.endDate || 'N/A'}</p>
                            <p><strong>Nombre d'équipes:</strong> ${teams.length}</p>
                        </div>
                    </div>
                    
                    <div class="report-actions">
                        <button class="btn btn-primary" onclick="App.generatePDFReport()">
                            📄 Générer PDF
                        </button>
                        <button class="btn btn-secondary" onclick="App.generateExcelReport()">
                            📊 Générer Excel
                        </button>
                    </div>
                </div>
            `;
        }
    };
    
    // =========================================
    // GESTION DES ÉVÉNEMENTS
    // =========================================
    const EventManager = {
        /**
         * Configure tous les listeners
         */
        setupEventListeners: function() {
            // Écouter les changements d'onglets
            if (window.Core) {
                Core.events.on('ui:tab:changed', (tabName) => {
                    appState.currentTab = tabName;
                    ViewManager.renderActiveTab();
                });
                
                // Écouter les changements de données
                Core.events.on('team:added', () => ViewManager.updateStats());
                Core.events.on('team:updated', () => ViewManager.updateStats());
                Core.events.on('team:removed', () => ViewManager.updateStats());
                
                // Écouter les erreurs
                Core.events.on('error', (error) => {
                    console.error('Erreur application:', error);
                    if (window.UIModule) {
                        UIModule.toast.error(error.message || 'Une erreur est survenue');
                    }
                });
            }
            
            // Raccourcis clavier
            document.addEventListener('keydown', (e) => {
                // Ctrl+S : Sauvegarder
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.saveProject();
                }
                
                // Ctrl+N : Nouvelle équipe
                if (e.ctrlKey && e.key === 'n') {
                    e.preventDefault();
                    this.showAddForm();
                }
                
                // Ctrl+O : Ouvrir/Charger
                if (e.ctrlKey && e.key === 'o') {
                    e.preventDefault();
                    this.loadProject();
                }
                
                // Échap : Fermer les modales
                if (e.key === 'Escape') {
                    if (window.UIModule && window.UIModule.modal) {
                        UIModule.modal.hide();
                    }
                }
            });
            
            // Gestion de la fermeture de page
            window.addEventListener('beforeunload', (e) => {
                if (appState.hasUnsavedChanges) {
                    e.preventDefault();
                    e.returnValue = 'Des modifications non sauvegardées seront perdues.';
                }
            });
        }
    };
    
    // =========================================
    // API PUBLIQUE
    // =========================================
    const AppAPI = {
        /**
         * Initialise l'application
         */
        init: async function() {
            console.log('🚀 Initialisation de l\'application...');
            
            try {
                // Vérifier les modules
                const modules = ModuleManager.checkModules();
                
                // Créer des modules factices si nécessaire
                if (modules.missing.length > 0) {
                    ModuleManager.createMockModules();
                }
                
                // Initialiser les modules
                await ModuleManager.initializeModules();
                
                // Configurer les événements
                EventManager.setupEventListeners();
                
                // Vérifier s'il y a un projet en cours
                const projectInfo = Core ? Core.state.get('projectInfo') : null;
                const hasTeams = Core ? Core.state.get('teams', []).length > 0 : false;

                // CORRECTION : Toujours masquer le loader et afficher l'interface
                this.hideLoaderAndShowInterface();

                if (projectInfo && hasTeams) {
                    // Continuer le projet existant
                    ViewManager.showMain();
                } else {
                    // Afficher l'écran de démarrage
                    ViewManager.showStartup();
                }

                
                appState.isInitialized = true;
                console.log('✅ Application prête');
                
                // Démarrer l'auto-save
                if (config.autoSave) {
                    this.startAutoSave();
                }
                
            } catch (error) {
                console.error('❌ Erreur fatale:', error);
                this.showError(error);
            }
        },
        
        /**
         * Démarre un nouveau projet
         */
        startNewProject: function() {
            const title = document.getElementById('projectTitle')?.value.trim();
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;
            
            if (!title) {
                if (window.UIModule) {
                    UIModule.toast.error('Le nom du projet est requis');
                }
                return;
            }
            
            // Sauvegarder les infos du projet
            const projectInfo = { title, startDate, endDate };
            
            if (window.Core) {
                Core.state.set('projectInfo', projectInfo);
                Core.state.set('teams', []);
            }
            
            ViewManager.showMain();
            
            if (window.UIModule) {
                UIModule.toast.success(`Projet "${title}" créé`);
            }
        },
        
        /**
         * Continue le projet existant
         */
        continueProject: function() {
            ViewManager.showMain();
        },
        
        /**
         * Charge un projet
         */
        loadProject: function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        
                        if (window.Core && window.Core.storage) {
                            Core.storage.import(data);
                        }
                        
                        ViewManager.showMain();
                        
                        if (window.UIModule) {
                            UIModule.toast.success('Projet chargé avec succès');
                        }
                    } catch (error) {
                        if (window.UIModule) {
                            UIModule.toast.error('Erreur lors du chargement du fichier');
                        }
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        },
        
        /**
         * Sauvegarde le projet
         */
        saveProject: function() {
            if (window.Core && window.Core.storage) {
                Core.storage.saveState();
                
                if (window.UIModule) {
                    UIModule.toast.success('Projet sauvegardé');
                }
            }
        },
        
        /**
         * Exporte le projet
         */
        exportProject: function() {
            if (window.Core && window.Core.storage) {
                const data = Core.storage.export();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `facturation_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                
                if (window.UIModule) {
                    UIModule.toast.success('Projet exporté');
                }
            }
        },
        
        /**
         * Affiche le formulaire d'ajout
         */
        showAddForm: function() {
            if (window.TeamsModule && window.TeamsModule.showForm) {
                TeamsModule.showForm();
            } else if (window.UIModule) {
                UIModule.toast.warning('Module Équipes non disponible');
            }
        },
        
        /**
         * Gestion de la recherche
         */
        handleSearch: function(query) {
            if (window.TeamsModule && window.TeamsModule.search) {
                TeamsModule.search(query);
            }
        },
        
        /**
         * Import de données
         */
        importData: function() {
            if (window.TeamsModule && window.TeamsModule.importFile) {
                TeamsModule.importFile();
            }
        },
        
        /**
         * Export de données
         */
        exportData: function() {
            if (window.TeamsModule && window.TeamsModule.exportCSV) {
                TeamsModule.exportCSV();
            }
        },
        
        /**
         * Affiche les paramètres
         */
        showSettings: function() {
            if (window.ConfigModule) {
                UIModule.modal.show({
                    title: '⚙️ Configuration de l\'Application',
                    content: '<div id="config-container" style="max-height: 70vh; overflow-y: auto;"></div>',
                    size: 'large'
                });
                
                // Attendre que la modal soit affichée, puis créer l'interface
                setTimeout(() => {
                    const container = document.querySelector('#config-container');
                    
                    if (!container) {
                        console.warn('❌ Container config-container non trouvé');
                        return;
                    }
                    
                    const config = ConfigModule.getConfig();
                    
                    container.innerHTML = `
                        <div style="padding: 20px; font-family: Arial, sans-serif;">
                            <h3 style="color: #2563eb; margin-bottom: 20px;">⚙️ Configuration de l'Application</h3>
                            
                            <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
                                <h4 style="color: #1f2937; margin-bottom: 15px;">🔬 Microscopes (${config.microscopes?.length || 0})</h4>
                                <ul style="margin: 10px 0;">
                                    ${(config.microscopes || []).map(m => `
                                        <li style="padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
                                            <strong>${m}</strong>
                                            <span style="color: #6b7280; margin-left: 10px;">
                                                Interne: ${config.tarifs?.microscopes?.[m]?.interne || 0}€ | 
                                                Externe: ${config.tarifs?.microscopes?.[m]?.externe || 0}€ | 
                                                Privé: ${config.tarifs?.microscopes?.[m]?.prive || 0}€
                                            </span>
                                        </li>
                                    `).join('')}
                                </ul>
                                <button onclick="App.addMicroscope()" style="background: #2563eb; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">➕ Ajouter Microscope</button>
                            </div>
                            
                            <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
                                <h4 style="color: #1f2937; margin-bottom: 15px;">🧪 Services/Manipulations (${config.manipulations?.length || 0})</h4>
                                <ul style="margin: 10px 0;">
                                    ${(config.manipulations || []).map(s => `
                                        <li style="padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
                                            <strong>${s.icon || '🔬'} ${s.name}</strong>
                                            <span style="color: #6b7280; margin-left: 10px;">
                                                Interne: ${config.tarifs?.services?.[s.name]?.interne || 0}€ | 
                                                Externe: ${config.tarifs?.services?.[s.name]?.externe || 0}€ | 
                                                Privé: ${config.tarifs?.services?.[s.name]?.prive || 0}€
                                            </span>
                                        </li>
                                    `).join('')}
                                </ul>
                                <button onclick="App.addService()" style="background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">➕ Ajouter Service</button>
                            </div>
                            
                            <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
                                <h4 style="color: #1f2937; margin-bottom: 15px;">🏛️ Laboratoires Internes (${config.internalLaboratories?.length || 0})</h4>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    ${(config.internalLaboratories || []).map(lab => `
                                        <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 15px; font-size: 14px;">${lab}</span>
                                    `).join('')}
                                </div>
                                <button onclick="App.addLab()" style="background: #f59e0b; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">➕ Ajouter Laboratoire</button>
                            </div>
                            
                            <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px;">
                                <button onclick="ConfigModule.exportConfig()" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 0 5px;">📤 Exporter</button>
                                <button onclick="App.resetConfig()" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 0 5px;">🔄 Réinitialiser</button>
                            </div>
                        </div>
                    `;
                    
                    console.log('✅ Interface de configuration créée');
                }, 100);
            } else {
                UIModule.toast.error('Module Configuration non disponible');
            }
        
        },

        addMicroscope: function() {
            const name = prompt('Nom du microscope:');
            if (name) {
                ConfigModule.microscopes.add(name, { interne: 50, externe: 100, prive: 150 });
                this.showSettings(); // Rafraîchir l'interface
                UIModule.toast.success(`Microscope "${name}" ajouté`);
            }
        },

        addService: function() {
            const name = prompt('Nom du service:');
            if (name) {
                const icon = prompt('Icône (optionnel):', '🔬');
                ConfigModule.services.add(name, icon, { interne: 30, externe: 60, prive: 90 });
                this.showSettings(); // Rafraîchir l'interface
                UIModule.toast.success(`Service "${name}" ajouté`);
            }
        },

        addLab: function() {
            const code = prompt('Code du laboratoire:');
            if (code) {
                ConfigModule.laboratories.add(code);
                this.showSettings(); // Rafraîchir l'interface
                UIModule.toast.success(`Laboratoire "${code}" ajouté`);
            }
        },

        resetConfig: function() {
            if (confirm('Réinitialiser toute la configuration ?')) {
                ConfigModule.reset();
                this.showSettings(); // Rafraîchir l'interface
                UIModule.toast.success('Configuration réinitialisée');
            }
        },
        
        /**
         * Bascule le thème
         */
        toggleTheme: function() {
            if (window.UIModule && window.UIModule.theme) {
                UIModule.theme.toggle();
            } else {
                document.body.classList.toggle('dark-mode');
                localStorage.setItem('app_theme', 
                    document.body.classList.contains('dark-mode') ? 'dark' : 'light'
                );
            }
            
            // Mettre à jour l'icône
            const themeIcon = document.getElementById('theme-icon');
            if (themeIcon) {
                themeIcon.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
            }
        },
        
        /**
         * Auto-save
         */
        startAutoSave: function() {
            if (appState.timers.autoSave) {
                clearInterval(appState.timers.autoSave);
            }
            
            appState.timers.autoSave = setInterval(() => {
                this.saveProject();
                console.log('💾 Auto-save effectué');
            }, config.autoSaveInterval);
        },
        
        hideLoaderAndShowInterface: function() {
        // Masquer le loader
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.display = 'none';
        }
        
        // Afficher le conteneur principal
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.classList.remove('hidden');
        }
        
        // S'assurer que l'écran de démarrage est visible
        const startupScreen = document.getElementById('startup-screen');
        if (startupScreen) {
            startupScreen.style.display = 'flex';
        }
        
        console.log('✅ Interface débloquée automatiquement');
        },

        /**
         * Génère un rapport PDF (placeholder)
         */
        generatePDFReport: function() {
            if (window.UIModule) {
                UIModule.toast.info('Génération PDF en développement');
            }
        },
        
        /**
         * Génère un rapport Excel (placeholder)
         */
        generateExcelReport: function() {
            if (window.TeamsModule && window.TeamsModule.exportCSV) {
                TeamsModule.exportCSV();
            }
        },
        
        /**
         * Affiche une erreur
         */
        showError: function(error) {
            const message = error.message || 'Une erreur est survenue';
            
            if (window.UIModule) {
                UIModule.modal.show({
                    title: '❌ Erreur',
                    content: `
                        <div class="error-content">
                            <p>${message}</p>
                            <details>
                                <summary>Détails techniques</summary>
                                <pre>${error.stack || error}</pre>
                            </details>
                        </div>
                    `,
                    footer: '<button class="btn btn-primary" onclick="location.reload()">Recharger</button>'
                });
            } else {
                alert(`Erreur: ${message}`);
            }
        },
        
        /**
         * Obtient la version
         */
        getVersion: function() {
            return config.version;
        },
        
        /**
         * Mode debug
         */
        setDebugMode: function(enabled) {
            config.debug = enabled;
            localStorage.setItem('app_debug', enabled ? 'true' : 'false');
            
            if (window.Core) {
                Core.setDebugMode(enabled);
            }
            
            console.log(`🔧 Mode debug ${enabled ? 'activé' : 'désactivé'}`);
        }
    };
    
    // Retourner l'API publique
    return AppAPI;
    
})();
