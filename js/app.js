window.App = (function() {
    'use strict';

    // =========================================
    // ÉTAT SIMPLIFIÉ
    // =========================================
    let appState = {
        currentView: 'startup',
        currentTab: 'teams',
        projectInfo: null,
        initialized: false
    };

    
    // =========================================
    // UI HELPERS COMPATIBLES
    // =========================================
    const ui = {
        // Toast compatible avec ton HTML existant
        toast(message, type = 'info', duration = 3000) {
            // Chercher le conteneur existant ou le créer
            let container = document.querySelector('.notifications-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'notifications-container';
                document.body.appendChild(container);
            }
            
            const toast = document.createElement('div');
            toast.className = `toast toast-${type} show`;
            toast.innerHTML = `<span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
            
            container.appendChild(toast);
            
            if (duration > 0) {
                setTimeout(() => toast.remove(), duration);
            }
        },

        // Modal compatible
        modal: {
            current: null,

            show(title, content, footer = '') {
                this.hide(); // Fermer modal existante

                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                    <div class="modal-content modal-medium">
                        <span class="modal-close" onclick="App.ui.modal.hide()">&times;</span>
                        ${title ? `<div class="modal-header"><h3 class="modal-title">${title}</h3></div>` : ''}
                        <div class="modal-body">${content}</div>
                        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
                    </div>
                `;
                
                // Fermer en cliquant sur l'overlay
                modal.onclick = (e) => {
                    if (e.target === modal) this.hide();
                };

                document.body.appendChild(modal);
                this.current = modal;
                return modal;
            },

            hide() {
                if (this.current) {
                    this.current.remove();
                    this.current = null;
                }
            },

            confirm(message) {
                return new Promise((resolve) => {
                    const footer = `
                        <button class="btn btn-primary" onclick="App.ui.modal._confirm(true)">Confirmer</button>
                        <button class="btn btn-secondary" onclick="App.ui.modal._confirm(false)">Annuler</button>
                    `;
                    this.show('Confirmation', `<p>${message}</p>`, footer);
                    this._confirmResolve = resolve;
                });
            },

            _confirm(result) {
                if (this._confirmResolve) {
                    this._confirmResolve(result);
                    this._confirmResolve = null;
                }
                this.hide();
            }
        },

        // Loader compatible avec ton HTML
        loader: {
            show(message = 'Chargement...') {
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
                        <p class="loader-text">${message}</p>
                    </div>
                `;
                loader.style.display = 'flex';
            },

            hide() {
                const loader = document.getElementById('app-loader');
                if (loader) {
                    loader.style.display = 'none';
                }
            }
        },

        // Thème simple
        theme: {
            toggle() {
                const isDark = document.body.classList.toggle('dark-mode');
                localStorage.setItem('app_theme', isDark ? 'dark' : 'light');
                
                // Mettre à jour l'icône si elle existe
                const icon = document.getElementById('theme-icon');
                if (icon) icon.textContent = isDark ? '☀️' : '🌙';
            },

            apply() {
                const saved = localStorage.getItem('app_theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldBeDark = saved === 'dark' || (!saved && prefersDark);
                
                document.body.classList.toggle('dark-mode', shouldBeDark);
            }
        }
    };

    // =========================================
    // GESTION DES VUES SIMPLIFIÉE
    // =========================================
    const views = {
        // Dans app.js, dans l'objet views, ajouter cette fonction :
        renderStartup() {
            const container = document.getElementById('startup-container');
            if (!container) return;
            
            const project = localStorage.getItem('billing_projectInfo');
            const projectInfo = project ? JSON.parse(project) : null;
            
            container.innerHTML = `
                <div class="startup-content">
                    <div class="startup-header">
                        <h1>📊 Interface de Facturation</h1>
                        <p>Gestion de la facturation et des équipes</p>
                    </div>
                    
                    <div class="startup-form">
                        <div class="form-group">
                            <label for="projectTitle">Nom du projet *</label>
                            <input type="text" id="projectTitle" 
                                placeholder="Ex: Facturation Q1 2025" 
                                value="${projectInfo?.title || ''}" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Période de facturation</label>
                            <div class="date-range">
                                <input type="date" id="startDate" value="${projectInfo?.startDate || ''}">
                                <span>→</span>
                                <input type="date" id="endDate" value="${projectInfo?.endDate || ''}">
                            </div>
                        </div>
                        
                        <div class="startup-actions">
                            <button class="btn btn-primary btn-lg" onclick="App.startProject()">
                                🚀 Nouveau Projet
                            </button>
                            <button class="btn btn-secondary" onclick="App.loadProject()">
                                📂 Charger Projet
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        // Et modifier showStartup() pour appeler renderStartup() :
        showStartup() {
            document.getElementById('app-container').classList.remove('hidden');
            
            const startup = document.getElementById('startup-screen');
            const main = document.getElementById('main-interface');
            
            if (startup) startup.style.display = 'flex';
            if (main) main.classList.add('hidden');
            
            this.renderStartup(); // AJOUTER CETTE LIGNE
            appState.currentView = 'startup';
        },

        showMain() {
            document.getElementById('app-container').classList.remove('hidden');
            const startup = document.getElementById('startup-screen');
            const main = document.getElementById('main-interface');
            const header = document.getElementById('global-header');
            
            if (startup) startup.style.display = 'none';
            if (main) main.classList.remove('hidden');
            if (header) header.classList.remove('hidden');
            
            appState.currentView = 'main';
            
            // Activer l'onglet par défaut si les onglets existent
            setTimeout(() => {
                const firstTab = document.querySelector('.tab-button');
                if (firstTab) {
                    firstTab.click();
                }
            }, 100);
        }
    };

    // =========================================
    // ACTIONS PRINCIPALES
    // =========================================
    const actions = {
        startProject() {
            const title = document.getElementById('projectTitle')?.value.trim();
            if (!title) {
                ui.toast('Le nom du projet est requis', 'error');
                return;
            }
            
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;
            
            // Sauvegarder via Core si disponible, sinon localStorage
            if (window.Core) {
                Core.state.set('projectInfo', { title, startDate, endDate });
            } else {
                localStorage.setItem('billing_projectInfo', JSON.stringify({ title, startDate, endDate }));
            }
            
            views.showMain();
            ui.toast(`Projet "${title}" créé`, 'success');
        },

        save() {
            if (window.Core) {
                Core.storage.saveState();
                ui.toast('Projet sauvegardé', 'success');
            } else {
                ui.toast('Sauvegarde automatique activée', 'info');
            }
        },

        loadProject() {
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
                        
                        if (window.Core && data.state) {
                            Core.state.setAll(data.state);
                        }
                        
                        views.showMain();
                        ui.toast('Projet chargé', 'success');
                    } catch (error) {
                        ui.toast('Fichier invalide', 'error');
                    }
                };
                reader.readAsText(file);
            };
            
            input.click();
        }
    };

    // =========================================
    // ÉVÉNEMENTS
    // =========================================
    function setupEvents() {
        // Navigation par onglets si ils existent
        document.addEventListener('click', (e) => {
            if (e.target.matches('.tab-button')) {
                // Désactiver tous les onglets
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
                
                // Activer l'onglet sélectionné
                e.target.classList.add('active');
                const tabName = e.target.dataset.tab;
                const panel = document.querySelector(`.tab-panel[data-tab="${tabName}"]`);
                if (panel) panel.classList.add('active');
                
                appState.currentTab = tabName;
            }
        });

        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        actions.save();
                        break;
                    case 'o':
                        e.preventDefault();
                        actions.loadProject();
                        break;
                }
            }
            
            if (e.key === 'Escape') {
                ui.modal.hide();
            }
        });
    }

    // =========================================
    // API PUBLIQUE COMPATIBLE
    // =========================================
    return {
        // État
        state: appState,
        
        // Modules UI
        ui: ui,
        views: views,
        
        // Actions principales
        async init() {
            try {
                console.log('🚀 App v2.0 - Initialisation compatible');
                
                // Appliquer le thème
                ui.theme.apply();
                
                // Configurer les événements
                setupEvents();
                
                // Vérifier s'il y a un projet en cours
                let projectInfo = null;
                if (window.Core) {
                    projectInfo = Core.state.get('projectInfo');
                } else {
                    const saved = localStorage.getItem('billing_projectInfo');
                    if (saved) projectInfo = JSON.parse(saved);
                }
                
                if (projectInfo) {
                    views.showMain();
                } else {
                    views.showStartup();
                }
                
                // Masquer le loader
                ui.loader.hide();
                appState.initialized = true;
                
                console.log('✅ App prêt - Version compatible');
                
            } catch (error) {
                console.error('❌ Erreur App:', error);
                ui.loader.hide();
                ui.modal.show('Erreur', `
                    <p>Impossible de démarrer l'application</p>
                    <p><small>${error.message}</small></p>
                    <button class="btn btn-primary" onclick="location.reload()">Recharger</button>
                `);
            }
        },

        // Actions exposées - compatible avec ton HTML
        startProject: () => actions.startProject(),
        continueProject: () => views.showMain(),
        save: () => actions.save(),
        loadProject: () => actions.loadProject(),
        
        // Fonctions appelées depuis le HTML
        toggleTheme: () => ui.theme.toggle(),
        
        // Raccourcis
        toast: (msg, type) => ui.toast(msg, type),
        modal: ui.modal,
        confirm: ui.modal.confirm.bind(ui.modal)
    };
})();
