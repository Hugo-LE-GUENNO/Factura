/**
 * UI.MODULE.JS - Module Interface Utilisateur
 * Gère tous les composants UI réutilisables
 * @module UIModule
 */

window.UIModule = (function() {
    'use strict';
    
    // =========================================
    // CONFIGURATION
    // =========================================
    const config = {
        toastDuration: 3000,
        modalAnimationDuration: 300,
        theme: 'light'
    };
    
    // =========================================
    // GESTION DES MODALES
    // =========================================
    const modal = {
        current: null,
        
        show: function(options) {
            const defaults = {
                title: '',
                content: '',
                type: 'default',
                closable: true,
                footer: '',
                onClose: null,
                onConfirm: null,
                size: 'medium'
            };
            
            const settings = { ...defaults, ...options };
            lastClickTime: null,
            
            // Créer ou récupérer la modale
            let modalEl = document.getElementById('generic-modal');
            if (!modalEl) {
                modalEl = this.createModalElement();
            }
            
            // Configurer le contenu
            const contentEl = modalEl.querySelector('.modal-content') || modalEl.querySelector('[id*="modal-content"]');
            if (contentEl) {
                contentEl.className = `modal-content modal-${settings.size}`;
                contentEl.innerHTML = `
                    ${settings.closable ? '<span class="modal-close">&times;</span>' : ''}
                    ${settings.title ? `<h2 class="modal-title">${settings.title}</h2>` : ''}
                    <div class="modal-body">${settings.content}</div>
                    ${settings.footer ? `<div class="modal-footer">${settings.footer}</div>` : ''}
                `;
                
                // Gérer la fermeture
                if (settings.closable) {
                    const closeBtn = contentEl.querySelector('.modal-close');
                    if (closeBtn) {
                        closeBtn.onclick = () => this.hide();
                    }
                }
            }
            
            // Afficher
            modalEl.classList.remove('hidden');
            modalEl.style.display = 'flex';
            this.current = modalEl;
            
            // Callback
            if (settings.onClose) {
                modalEl.dataset.onClose = settings.onClose.toString();
            }
            
            Core.events.emit('ui:modal:shown', settings);
            return modalEl;
        },
        
        hide: function() {
            if (this.current) {
                this.current.classList.add('hidden');
                this.current.style.display = 'none';
                
                // Exécuter callback onClose si défini
                if (this.current.dataset.onClose) {
                    try {
                        eval(`(${this.current.dataset.onClose})()`);
                    } catch(e) {}
                }
                
                Core.events.emit('ui:modal:hidden');
                this.current = null;
            }
        },
        
        confirm: function(message, onConfirm, onCancel) {
            const footer = `
                <button class="btn btn-primary" id="modal-confirm-btn">Confirmer</button>
                <button class="btn btn-secondary" id="modal-cancel-btn">Annuler</button>
            `;
            
            const modalEl = this.show({
                title: 'Confirmation',
                content: message,
                footer: footer,
                closable: false
            });
            
            // Gérer les boutons
            const confirmBtn = modalEl.querySelector('#modal-confirm-btn');
            const cancelBtn = modalEl.querySelector('#modal-cancel-btn');
            
            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    this.hide();
                    if (onConfirm) onConfirm();
                };
            }
            
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    this.hide();
                    if (onCancel) onCancel();
                };
            }
            
            return modalEl;
        },
        
        prompt: function(message, defaultValue = '', onSubmit, onCancel) {
            const content = `
                <p>${message}</p>
                <input type="text" id="modal-prompt-input" class="form-input" value="${defaultValue}">
            `;
            
            const footer = `
                <button class="btn btn-primary" id="modal-submit-btn">Valider</button>
                <button class="btn btn-secondary" id="modal-cancel-btn">Annuler</button>
            `;
            
            const modalEl = this.show({
                title: 'Saisie',
                content: content,
                footer: footer,
                closable: false
            });
            
            const input = modalEl.querySelector('#modal-prompt-input');
            const submitBtn = modalEl.querySelector('#modal-submit-btn');
            const cancelBtn = modalEl.querySelector('#modal-cancel-btn');
            
            // Focus sur l'input
            if (input) {
                setTimeout(() => input.focus(), 100);
                
                // Valider avec Enter
                input.onkeypress = (e) => {
                    if (e.key === 'Enter' && submitBtn) {
                        submitBtn.click();
                    }
                };
            }
            
            if (submitBtn) {
                submitBtn.onclick = () => {
                    const value = input ? input.value : '';
                    this.hide();
                    if (onSubmit) onSubmit(value);
                };
            }
            
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    this.hide();
                    if (onCancel) onCancel();
                };
            }
            
            return modalEl;
        },
        
        createModalElement: function() {
            const modal = document.createElement('div');
            modal.id = 'generic-modal';
            modal.className = 'modal hidden';
            modal.innerHTML = '<div class="modal-content"></div>';
            
            // Fermer en cliquant sur l'overlay
            modal.onclick = (e) => {
                if (e.target === modal) {
                    this.hide();
                }
            };
            
            document.body.appendChild(modal);
            return modal;
        }
    };
    
    // =========================================
    // SYSTÈME DE TOASTS
    // =========================================
    const toast = {
        container: null,
        
        show: function(message, type = 'info', duration = config.toastDuration) {
            // Créer le conteneur si nécessaire
            if (!this.container) {
                this.container = document.getElementById('notifications-container');
                if (!this.container) {
                    this.container = document.createElement('div');
                    this.container.id = 'notifications-container';
                    this.container.className = 'notifications-container';
                    document.body.appendChild(this.container);
                }
            }
            
            // Créer le toast
            const toast = document.createElement('div');
            toast.className = `notification toast toast-${type}`;
            
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            
            toast.innerHTML = `
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close">&times;</button>
            `;
            
            // Ajouter au conteneur
            this.container.appendChild(toast);
            
            // Animation d'entrée
            setTimeout(() => toast.classList.add('show'), 10);
            
            // Gérer la fermeture
            const closeBtn = toast.querySelector('.toast-close');
            if (closeBtn) {
                closeBtn.onclick = () => this.remove(toast);
            }
            
            // Auto-fermeture
            if (duration > 0) {
                setTimeout(() => this.remove(toast), duration);
            }
            
            Core.events.emit('ui:toast:shown', { message, type });
            return toast;
        },
        
        remove: function(toast) {
            if (toast && toast.parentNode) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        },
        
        success: function(message, duration) {
            return this.show(message, 'success', duration);
        },
        
        error: function(message, duration) {
            return this.show(message, 'error', duration);
        },
        
        warning: function(message, duration) {
            return this.show(message, 'warning', duration);
        },
        
        info: function(message, duration) {
            return this.show(message, 'info', duration);
        }
    };
    
    // =========================================
    // GESTION DES TABLEAUX
    // =========================================
    const table = {
        render: function(options) {
            const defaults = {
                container: null,
                data: [],
                columns: [],
                sortable: true,
                filterable: true,
                paginate: true,
                pageSize: 10,
                emptyMessage: 'Aucune donnée'
            };
            
            const settings = { ...defaults, ...options };
            const container = typeof settings.container === 'string' 
                ? document.getElementById(settings.container) 
                : settings.container;
                
            if (!container) return;
            
            // Créer la structure du tableau
            let html = '';
            
            // Filtre
            if (settings.filterable) {
                html += `
                    <div class="table-filter">
                        <input type="text" class="table-search" placeholder="Rechercher...">
                    </div>
                `;
            }
            
            // Tableau
            html += '<div class="table-wrapper"><table class="data-table"><thead><tr>';
            
            // En-têtes
            settings.columns.forEach(col => {
                const sortClass = settings.sortable ? 'sortable' : '';
                html += `<th class="${sortClass}" data-field="${col.field}">${col.label}</th>`;
            });
            
            html += '</tr></thead><tbody>';
            
            // Données
            if (settings.data.length === 0) {
                html += `<tr><td colspan="${settings.columns.length}" class="empty-cell">${settings.emptyMessage}</td></tr>`;
            } else {
                settings.data.forEach(row => {
                    html += '<tr>';
                    settings.columns.forEach(col => {
                        const value = col.render ? col.render(row[col.field], row) : row[col.field];
                        html += `<td>${value || ''}</td>`;
                    });
                    html += '</tr>';
                });
            }
            
            html += '</tbody></table></div>';
            
            // Pagination
            if (settings.paginate && settings.data.length > settings.pageSize) {
                const totalPages = Math.ceil(settings.data.length / settings.pageSize);
                html += '<div class="table-pagination">';
                for (let i = 1; i <= totalPages; i++) {
                    html += `<button class="page-btn" data-page="${i}">${i}</button>`;
                }
                html += '</div>';
            }
            
            container.innerHTML = html;
            
            // Attacher les événements
            this.attachTableEvents(container, settings);
            
            Core.events.emit('ui:table:rendered', settings);
        },
        
        attachTableEvents: function(container, settings) {
            // Tri
            if (settings.sortable) {
                container.querySelectorAll('th.sortable').forEach(th => {
                    th.onclick = () => {
                        const field = th.dataset.field;
                        this.sort(settings.data, field);
                        this.render({ ...settings, container });
                    };
                });
            }
            
            // Filtre
            const searchInput = container.querySelector('.table-search');
            if (searchInput) {
                searchInput.oninput = Core.utils.debounce((e) => {
                    const filtered = this.filter(settings.data, e.target.value, settings.columns);
                    this.render({ ...settings, data: filtered, container });
                }, 300);
            }
        },
        
        sort: function(data, field, direction = 'asc') {
            return data.sort((a, b) => {
                const valA = a[field];
                const valB = b[field];
                
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        },
        
        filter: function(data, query, columns) {
            if (!query) return data;
            
            const lowerQuery = query.toLowerCase();
            return data.filter(row => {
                return columns.some(col => {
                    const value = row[col.field];
                    return value && value.toString().toLowerCase().includes(lowerQuery);
                });
            });
        }
    };
    
    // =========================================
    // GESTION DU THÈME
    // =========================================
    const theme = {
        current: config.theme,
        
        toggle: function() {
            this.current = this.current === 'light' ? 'dark' : 'light';
            this.apply();
        },
        
        set: function(themeName) {
            this.current = themeName;
            this.apply();
        },
        
        apply: function() {
            document.body.classList.toggle('dark-mode', this.current === 'dark');
            localStorage.setItem('app_theme', this.current);
            Core.events.emit('ui:theme:changed', this.current);
        },
        
        get: function() {
            return this.current;
        }
    };
    
    // =========================================
    // COMPOSANTS UI
    // =========================================
    const components = {
        createButton: function(options) {
            const defaults = {
                text: 'Button',
                type: 'primary',
                icon: null,
                onClick: null,
                disabled: false
            };
            
            const settings = { ...defaults, ...options };
            const button = document.createElement('button');
            button.className = `btn btn-${settings.type}`;
            button.disabled = settings.disabled;
            
            if (settings.icon) {
                button.innerHTML = `<span>${settings.icon}</span> ${settings.text}`;
            } else {
                button.textContent = settings.text;
            }
            
            if (settings.onClick) {
                button.onclick = settings.onClick;
            }
            
            return button;
        },
        
        createCard: function(options) {
            const defaults = {
                title: '',
                content: '',
                footer: '',
                className: ''
            };
            
            const settings = { ...defaults, ...options };
            const card = document.createElement('div');
            card.className = `card ${settings.className}`;
            
            let html = '';
            if (settings.title) {
                html += `<div class="card-header"><h3>${settings.title}</h3></div>`;
            }
            if (settings.content) {
                html += `<div class="card-body">${settings.content}</div>`;
            }
            if (settings.footer) {
                html += `<div class="card-footer">${settings.footer}</div>`;
            }
            
            card.innerHTML = html;
            return card;
        },
        
        createBadge: function(text, type = 'default') {
            const badge = document.createElement('span');
            badge.className = `badge badge-${type}`;
            badge.textContent = text;
            return badge;
        },
        
        createLoader: function(text = 'Chargement...') {
            const loader = document.createElement('div');
            loader.className = 'loader-container';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <p class="loader-text">${text}</p>
            `;
            return loader;
        },
        
        createProgress: function(value, max = 100) {
            const progress = document.createElement('div');
            progress.className = 'progress';
            progress.innerHTML = `
                <div class="progress-bar" style="width: ${(value/max)*100}%"></div>
                <span class="progress-text">${value}/${max}</span>
            `;
            return progress;
        }
    };
    
    // =========================================
    // GESTION DES FORMULAIRES
    // =========================================
    const forms = {
        validate: function(formEl) {
            const errors = [];
            const inputs = formEl.querySelectorAll('input[required], select[required], textarea[required]');
            
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    errors.push({
                        field: input.name || input.id,
                        message: 'Ce champ est requis'
                    });
                    input.classList.add('error');
                } else {
                    input.classList.remove('error');
                }
            });
            
            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },
        
        getData: function(formEl) {
            const data = {};
            const inputs = formEl.querySelectorAll('input, select, textarea');
            
            inputs.forEach(input => {
                const name = input.name || input.id;
                if (name) {
                    if (input.type === 'checkbox') {
                        data[name] = input.checked;
                    } else if (input.type === 'radio') {
                        if (input.checked) {
                            data[name] = input.value;
                        }
                    } else {
                        data[name] = input.value;
                    }
                }
            });
            
            return data;
        },
        
        setData: function(formEl, data) {
            Object.entries(data).forEach(([key, value]) => {
                const input = formEl.querySelector(`[name="${key}"], #${key}`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = value;
                    } else if (input.type === 'radio') {
                        const radio = formEl.querySelector(`[name="${key}"][value="${value}"]`);
                        if (radio) radio.checked = true;
                    } else {
                        input.value = value;
                    }
                }
            });
        },
        
        reset: function(formEl) {
            formEl.reset();
            formEl.querySelectorAll('.error').forEach(el => {
                el.classList.remove('error');
            });
        }
    };
    
    // =========================================
    // NAVIGATION ET ONGLETS
    // =========================================
    const navigation = {
        currentTab: null,
        
        initTabs: function() {
            // Supprimer l'ancien listener générique
            // document.addEventListener('click', (e) => { ... });
            
            // Nouveau système d'événements plus robuste
            this.setupTabNavigation();
            
            // Activer le premier onglet
            const firstTab = document.querySelector('.tab-button');
            if (firstTab) {
                this.switchTab(firstTab.dataset.tab);
            }
        },

        setupTabNavigation: function() {
        // CSS pour les styles des onglets
        this.addTabStyles();
        
        // Configurer les listeners sur tous les onglets
        document.querySelectorAll('.tab-button').forEach(btn => {
            // Nettoyer les anciens listeners
            btn.onclick = null;
            btn.removeEventListener('click', this.handleTabClick);
            
            // Nouveau listener optimisé
            btn.addEventListener('click', this.handleTabClick.bind(this));
            
            // Feedback visuel
            btn.addEventListener('mousedown', this.handleMouseDown);
            btn.addEventListener('mouseup', this.handleMouseUp);
            btn.addEventListener('mouseleave', this.handleMouseUp);
        });
        
        console.log('✅ Navigation des onglets configurée');
        },

        /**
         * 3. Ajoutez la méthode de gestion des clics :
         */

        handleTabClick: function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const tabName = e.target.dataset.tab;
            if (!tabName) return;
            
            console.log(`🖱️ Navigation vers ${tabName}`);
            
            // Débouncing pour éviter les double-clics
            if (this.lastClickTime && Date.now() - this.lastClickTime < 300) {
                console.log('🚫 Double-clic ignoré');
                return;
            }
            this.lastClickTime = Date.now();
            
            // Changer d'onglet
            this.switchTab(tabName);
        },

        /**
         * 4. Ajoutez les méthodes de feedback visuel :
         */

        handleMouseDown: function(e) {
            e.target.style.transform = 'scale(0.95)';
        },

        handleMouseUp: function(e) {
            e.target.style.transform = 'scale(1)';
        },

        
        switchTab: function(tabName) {
            if (!tabName) return;
            
            // Éviter les changements inutiles
            if (this.currentTab === tabName) {
                console.log(`📋 Onglet ${tabName} déjà actif`);
                return;
            }
            
            console.log(`📋 Changement vers ${tabName}`);
            
            // Reset de tous les onglets (style et classes)
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = '';
                btn.style.color = '';
                btn.style.borderBottomColor = '';
            });
            
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // Activer l'onglet sélectionné
            const button = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
            const panel = document.querySelector(`.tab-panel[data-tab="${tabName}"]`);
            
            if (button) {
                button.classList.add('active');
            }
            
            if (panel) {
                panel.classList.add('active');
            }
            
            // Mettre à jour l'état
            this.currentTab = tabName;
            
            // Émettre l'événement (de manière non-bloquante)
            requestAnimationFrame(() => {
                Core.events.emit('ui:tab:changed', tabName);
            });
        },

        addTabStyles: function() {
        // Éviter de dupliquer les styles
        if (document.getElementById('tab-navigation-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'tab-navigation-styles';
        style.textContent = `
            /* Styles pour la navigation des onglets */
            .tab-button {
                position: relative;
                transition: all 0.2s ease;
                cursor: pointer;
                user-select: none;
                border: none;
                background: transparent;
                padding: 12px 20px;
                border-bottom: 3px solid transparent;
                font-weight: 500;
                color: var(--text-secondary);
            }
            
            .tab-button:hover:not(.active) {
                background: rgba(37, 99, 235, 0.1) !important;
                color: var(--text-primary);
            }
            
            .tab-button.active {
                background: rgba(37, 99, 235, 0.1) !important;
                color: var(--primary-color) !important;
                border-bottom-color: var(--primary-color) !important;
                font-weight: 600;
            }
            
            .tab-button:active {
                transform: scale(0.95);
            }
            
            /* Animation pour les panneaux */
            .tab-panel {
                display: none;
                animation: fadeIn 0.2s ease;
            }
            
            .tab-panel.active {
                display: block;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .tab-button {
                    padding: 10px 15px;
                    font-size: 14px;
                }
            }
        `;
        
        document.head.appendChild(style);
        console.log('🎨 Styles de navigation ajoutés');
    },

    // =========================================
    // LOADER GLOBAL
    // =========================================
    const loader = {
        show: function(message = 'Chargement...') {
            let loaderEl = document.getElementById('app-loader');
            if (!loaderEl) {
                loaderEl = document.createElement('div');
                loaderEl.id = 'app-loader';
                loaderEl.className = 'app-loader';
                document.body.appendChild(loaderEl);
            }
            
            loaderEl.innerHTML = `
                <div class="loader-content">
                    <div class="loader-spinner"></div>
                    <p>${message}</p>
                </div>
            `;
            
            loaderEl.classList.remove('hidden');
            loaderEl.style.display = 'flex';
        },
        
        hide: function() {
            const loaderEl = document.getElementById('app-loader');
            if (loaderEl) {
                loaderEl.classList.add('hidden');
                setTimeout(() => {
                    loaderEl.style.display = 'none';
                }, 300);
            }
        }
    };
    
    // =========================================
    // API PUBLIQUE
    // =========================================
    return {
        // Configuration
        config: config,
        
        // Modules
        modal: modal,
        toast: toast,
        table: table,
        theme: theme,
        components: components,
        forms: forms,
        navigation: navigation,
        loader: loader,
        
        // Initialisation
        init: function(customConfig = {}) {
            Object.assign(config, customConfig);
            
            // Appliquer le thème sauvegardé
            const savedTheme = localStorage.getItem('app_theme');
            if (savedTheme) {
                theme.set(savedTheme);
            }
            
            // Initialiser la navigation
            navigation.initTabs();
            
            // Masquer le loader initial
            loader.hide();
            
            Core.events.emit('ui:initialized');
            console.log('✅ UIModule initialisé');
            
            return this;
        },
        
        // Méthodes utilitaires
        showMessage: function(message, type = 'info') {
            return this.toast.show(message, type);
        },
        
        confirm: function(message) {
            return new Promise((resolve) => {
                this.modal.confirm(message, 
                    () => resolve(true),
                    () => resolve(false)
                );
            });
        },
        
        prompt: function(message, defaultValue = '') {
            return new Promise((resolve) => {
                this.modal.prompt(message, defaultValue,
                    (value) => resolve(value),
                    () => resolve(null)
                );
            });
        }
    };
})();
