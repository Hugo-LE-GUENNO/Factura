/**
 * MODULE DE CONFIGURATION
 * Gère toute la logique de configuration de l'application
 * Peut être modifié indépendamment sans casser le reste
 */

// Namespace pour éviter les conflits
window.ConfigModule = (function() {
    'use strict';
    
    // =========================================
    // ÉTAT PRIVÉ DU MODULE
    // =========================================
    let listeners = [];
    let configState = null;
    
    // Configuration par défaut (fallback)
    const DEFAULT_CONFIG = {
        microscopes: ['Tecnai 200 KV', 'Confocal Olympus FV1000'],
        manipulations: [
            { name: 'Negative staining', icon: '💧' },
            { name: 'Préparation classique', icon: '🧪' }
        ],
        internalLaboratories: ['BIP', 'LCB', 'IGS', 'LISM'],
        tarifs: {
            microscopes: {
                'Tecnai 200 KV': { interne: 60, externe: 120, prive: 180 },
                'Confocal Olympus FV1000': { interne: 45, externe: 90, prive: 135 }
            },
            services: {
                'Negative staining': { interne: 30, externe: 60, prive: 90 },
                'Préparation classique': { interne: 50, externe: 100, prive: 150 }
            }
        },
        predefinedTeams: []
    };
    
    // =========================================
    // MÉTHODES PRIVÉES
    // =========================================
    
    /**
     * Notifie tous les listeners d'un changement
     */
    function notifyListeners(changeType, data) {
        listeners.forEach(listener => {
            if (listener.type === changeType || listener.type === 'all') {
                listener.callback(data);
            }
        });
    }
    
    /**
     * Valide une configuration
     */
    function validateConfig(config) {
        const errors = [];
        
        if (!config.microscopes || !Array.isArray(config.microscopes)) {
            errors.push('Liste des microscopes invalide');
        }
        
        if (!config.manipulations || !Array.isArray(config.manipulations)) {
            errors.push('Liste des manipulations invalide');
        }
        
        if (!config.tarifs || typeof config.tarifs !== 'object') {
            errors.push('Grille tarifaire invalide');
        }
        
        // Vérifier la cohérence des tarifs
        config.microscopes?.forEach(micro => {
            if (!config.tarifs.microscopes[micro]) {
                errors.push(`Tarifs manquants pour ${micro}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Merge deux configurations
     */
    function mergeConfig(base, override) {
        return {
            ...base,
            ...override,
            tarifs: {
                microscopes: { ...base.tarifs.microscopes, ...override.tarifs?.microscopes },
                services: { ...base.tarifs.services, ...override.tarifs?.services }
            }
        };
    }
    
    // =========================================
    // API PUBLIQUE DU MODULE
    // =========================================
    
    const ConfigAPI = {
        
        /**
         * Initialise le module avec une configuration
         */
        init: function(initialConfig) {
            configState = mergeConfig(DEFAULT_CONFIG, initialConfig || {});
            this.attachToDOM();
            notifyListeners('init', configState);
            console.log('✅ Module Configuration initialisé');
            return this;
        },
        
        /**
         * Obtient la configuration actuelle
         */
        getConfig: function() {
            return JSON.parse(JSON.stringify(configState));
        },
        
        /**
         * Met à jour la configuration
         */
        updateConfig: function(updates) {
            const validation = validateConfig({ ...configState, ...updates });
            if (!validation.isValid) {
                console.error('Configuration invalide:', validation.errors);
                return false;
            }
            
            configState = mergeConfig(configState, updates);
            this.save();
            notifyListeners('update', configState);
            return true;
        },
        
        /**
         * Ajoute un listener pour les changements
         */
        onChange: function(type, callback) {
            listeners.push({ type, callback });
            return () => {
                listeners = listeners.filter(l => l.callback !== callback);
            };
        },
        
        /**
         * Sauvegarde la configuration
         */
        save: function() {
            try {
                localStorage.setItem('billing_config', JSON.stringify(configState));
                console.log('💾 Configuration sauvegardée');
                return true;
            } catch (e) {
                console.error('Erreur sauvegarde config:', e);
                return false;
            }
        },
        
        /**
         * Charge la configuration
         */
        load: function() {
            try {
                const saved = localStorage.getItem('billing_config');
                if (saved) {
                    configState = JSON.parse(saved);
                    notifyListeners('load', configState);
                }
                return configState;
            } catch (e) {
                console.error('Erreur chargement config:', e);
                return DEFAULT_CONFIG;
            }
        },
        
        /**
         * Réinitialise aux valeurs par défaut
         */
        reset: function() {
            if (confirm('Réinitialiser toute la configuration ?')) {
                configState = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                this.save();
                notifyListeners('reset', configState);
                this.renderConfigUI();
            }
        },
        
        // =========================================
        // MÉTHODES SPÉCIFIQUES MICROSCOPES
        // =========================================
        
        microscopes: {
            add: function(name, tarifs) {
                if (!name || configState.microscopes.includes(name)) {
                    return false;
                }
                
                configState.microscopes.push(name);
                if (tarifs) {
                    configState.tarifs.microscopes[name] = tarifs;
                } else {
                    configState.tarifs.microscopes[name] = { interne: 0, externe: 0, prive: 0 };
                }
                
                ConfigAPI.save();
                notifyListeners('microscope:add', { name, tarifs });
                return true;
            },
            
            remove: function(name) {
                const index = configState.microscopes.indexOf(name);
                if (index === -1) return false;
                
                configState.microscopes.splice(index, 1);
                delete configState.tarifs.microscopes[name];
                
                ConfigAPI.save();
                notifyListeners('microscope:remove', name);
                return true;
            },
            
            update: function(oldName, newName) {
                const index = configState.microscopes.indexOf(oldName);
                if (index === -1) return false;
                
                configState.microscopes[index] = newName;
                if (oldName !== newName) {
                    configState.tarifs.microscopes[newName] = configState.tarifs.microscopes[oldName];
                    delete configState.tarifs.microscopes[oldName];
                }
                
                ConfigAPI.save();
                notifyListeners('microscope:update', { oldName, newName });
                return true;
            },
            
            updateTarif: function(name, clientType, value) {
                if (!configState.tarifs.microscopes[name]) {
                    configState.tarifs.microscopes[name] = { interne: 0, externe: 0, prive: 0 };
                }
                configState.tarifs.microscopes[name][clientType] = parseFloat(value) || 0;
                ConfigAPI.save();
                notifyListeners('tarif:update', { name, clientType, value });
            }
        },
        
        // =========================================
        // MÉTHODES SPÉCIFIQUES SERVICES
        // =========================================
        
        services: {
            add: function(name, icon, tarifs) {
                if (!name || configState.manipulations.find(m => m.name === name)) {
                    return false;
                }
                
                configState.manipulations.push({ name, icon: icon || '🔬' });
                if (tarifs) {
                    configState.tarifs.services[name] = tarifs;
                } else {
                    configState.tarifs.services[name] = { interne: 0, externe: 0, prive: 0 };
                }
                
                ConfigAPI.save();
                notifyListeners('service:add', { name, icon, tarifs });
                return true;
            },
            
            remove: function(name) {
                const index = configState.manipulations.findIndex(m => m.name === name);
                if (index === -1) return false;
                
                configState.manipulations.splice(index, 1);
                delete configState.tarifs.services[name];
                
                ConfigAPI.save();
                notifyListeners('service:remove', name);
                return true;
            },
            
            update: function(oldName, newName, newIcon) {
                const service = configState.manipulations.find(m => m.name === oldName);
                if (!service) return false;
                
                service.name = newName;
                if (newIcon) service.icon = newIcon;
                
                if (oldName !== newName) {
                    configState.tarifs.services[newName] = configState.tarifs.services[oldName];
                    delete configState.tarifs.services[oldName];
                }
                
                ConfigAPI.save();
                notifyListeners('service:update', { oldName, newName, newIcon });
                return true;
            },
            
            updateTarif: function(name, clientType, value) {
                if (!configState.tarifs.services[name]) {
                    configState.tarifs.services[name] = { interne: 0, externe: 0, prive: 0 };
                }
                configState.tarifs.services[name][clientType] = parseFloat(value) || 0;
                ConfigAPI.save();
                notifyListeners('tarif:update', { name, clientType, value });
            }
        },
        
        // =========================================
        // MÉTHODES SPÉCIFIQUES LABORATOIRES
        // =========================================
        
        laboratories: {
            add: function(code) {
                if (!code || configState.internalLaboratories.includes(code)) {
                    return false;
                }
                
                configState.internalLaboratories.push(code.toUpperCase());
                ConfigAPI.save();
                notifyListeners('laboratory:add', code);
                return true;
            },
            
            remove: function(code) {
                const index = configState.internalLaboratories.indexOf(code);
                if (index === -1) return false;
                
                configState.internalLaboratories.splice(index, 1);
                ConfigAPI.save();
                notifyListeners('laboratory:remove', code);
                return true;
            },
            
            isInternal: function(code) {
                return configState.internalLaboratories.includes(code.toUpperCase());
            }
        },
        
        // =========================================
        // INTERFACE UTILISATEUR
        // =========================================
        
        /**
         * Attache le module au DOM existant
         */
        attachToDOM: function() {
            // S'attacher aux éléments existants si disponibles
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal) {
                this.enhanceSettingsModal(settingsModal);
            }
        },
        
        /**
         * Améliore la modal de configuration existante
         */
        enhanceSettingsModal: function(modal) {
            // Ajouter des boutons d'action rapide
            const quickActions = document.createElement('div');
            quickActions.className = 'config-quick-actions';
            quickActions.style.cssText = `
                display: flex;
                gap: 10px;
                padding: 15px;
                background: rgba(37, 99, 235, 0.1);
                border-radius: 10px;
                margin-bottom: 20px;
            `;
            
            quickActions.innerHTML = `
                <button class="btn btn-primary" onclick="ConfigModule.importConfig()">
                    📥 Importer Config
                </button>
                <button class="btn btn-success" onclick="ConfigModule.exportConfig()">
                    📤 Exporter Config
                </button>
                <button class="btn btn-warning" onclick="ConfigModule.duplicateConfig()">
                    📋 Dupliquer Config
                </button>
                <button class="btn btn-danger" onclick="ConfigModule.reset()">
                    🔄 Réinitialiser
                </button>
            `;
            
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent && !modal.querySelector('.config-quick-actions')) {
                modalContent.insertBefore(quickActions, modalContent.firstChild.nextSibling);
            }
        },
        
        /**
         * Génère l'interface de configuration
         */
        renderConfigUI: function() {
            const container = document.getElementById('config-container');
            if (!container) {
                console.warn('Container config-container non trouvé');
                return;
            }
            
            // HTML complet de l'interface de configuration
            container.innerHTML = `
                <div class="config-interface">
                    <!-- Actions rapides -->
                    <div class="config-quick-actions" style="display: flex; gap: 10px; margin-bottom: 20px; padding: 15px; background: rgba(37, 99, 235, 0.1); border-radius: 10px;">
                        <button class="btn btn-primary btn-sm" onclick="ConfigModule.exportConfig()">
                            📤 Exporter Config
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="ConfigModule.importConfig()">
                            📥 Importer Config
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="ConfigModule.reset()">
                            🔄 Réinitialiser
                        </button>
                    </div>

                    <!-- Onglets de configuration -->
                    <div class="config-tabs">
                        <div class="config-tabs-header" style="display: flex; border-bottom: 2px solid #e5e7eb; margin-bottom: 20px;">
                            <button class="config-tab-btn active" onclick="ConfigModule.showConfigTab('microscopes')" data-tab="microscopes">
                                🔬 Microscopes
                            </button>
                            <button class="config-tab-btn" onclick="ConfigModule.showConfigTab('services')" data-tab="services">
                                🧪 Services
                            </button>
                            <button class="config-tab-btn" onclick="ConfigModule.showConfigTab('tarifs')" data-tab="tarifs">
                                💰 Tarifs
                            </button>
                            <button class="config-tab-btn" onclick="ConfigModule.showConfigTab('laboratories')" data-tab="laboratories">
                                🏛️ Laboratoires
                            </button>
                        </div>

                        <!-- Contenu des onglets -->
                        <div id="config-tab-microscopes" class="config-tab-content active">
                            ${this.generateMicroscopesSection()}
                        </div>

                        <div id="config-tab-services" class="config-tab-content" style="display: none;">
                            ${this.generateServicesSection()}
                        </div>

                        <div id="config-tab-tarifs" class="config-tab-content" style="display: none;">
                            ${this.generateTarifsSection()}
                        </div>

                        <div id="config-tab-laboratories" class="config-tab-content" style="display: none;">
                            ${this.generateLaboratoriesSection()}
                        </div>
                    </div>
                </div>

                <style>
                    .config-interface { font-family: inherit; }
                    .config-tab-btn {
                        padding: 10px 15px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        border-bottom: 3px solid transparent;
                        transition: all 0.3s;
                    }
                    .config-tab-btn.active {
                        border-bottom-color: #2563eb;
                        color: #2563eb;
                    }
                    .config-tab-btn:hover {
                        background: rgba(37, 99, 235, 0.1);
                    }
                    .config-section {
                        margin-bottom: 30px;
                        padding: 20px;
                        border: 1px solid #e5e7eb;
                        border-radius: 10px;
                    }
                    .config-list {
                        display: grid;
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    .config-item {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 10px;
                        background: #f9fafb;
                        border-radius: 5px;
                    }
                    .config-item input {
                        flex: 1;
                        padding: 5px 10px;
                        border: 1px solid #d1d5db;
                        border-radius: 5px;
                    }
                    .config-item button {
                        padding: 5px 10px;
                        border: none;
                        background: #ef4444;
                        color: white;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    .tarifs-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                    }
                    .tarifs-table th,
                    .tarifs-table td {
                        padding: 10px;
                        text-align: left;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .tarifs-table th {
                        background: #f3f4f6;
                        font-weight: 600;
                    }
                    .tarifs-table input {
                        width: 80px;
                        padding: 5px;
                        border: 1px solid #d1d5db;
                        border-radius: 3px;
                        text-align: center;
                    }
                </style>
            `;
            
            this.attachEventListeners();
            console.log('✅ Interface de configuration rendue');
        },
        
        generateMicroscopesSection: function() {
            return `
                <div class="config-section" data-section="microscopes">
                    <h3>🔬 Microscopes</h3>
                    <div class="config-list">
                        ${configState.microscopes.map((m, i) => `
                            <div class="config-item" data-index="${i}">
                                <input type="text" value="${m}" data-field="name">
                                <button onclick="ConfigModule.microscopes.remove('${m}')">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="ConfigModule.showAddDialog('microscope')">
                        ➕ Ajouter Microscope
                    </button>
                </div>
            `;
        },
        
        generateServicesSection: function() {
            return `
                <div class="config-section" data-section="services">
                    <h3>🧪 Services/Manipulations</h3>
                    <div class="config-list">
                        ${configState.manipulations.map((s, i) => `
                            <div class="config-item" data-index="${i}">
                                <span>${s.icon}</span>
                                <input type="text" value="${s.name}" data-field="name">
                                <button onclick="ConfigModule.services.remove('${s.name}')">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="ConfigModule.showAddDialog('service')">
                        ➕ Ajouter Service
                    </button>
                </div>
            `;
        },
        
        generateLaboratoriesSection: function() {
            return `
                <div class="config-section" data-section="laboratories">
                    <h3>🏛️ Laboratoires Internes</h3>
                    <div class="config-list">
                        ${configState.internalLaboratories.map((l, i) => `
                            <div class="config-item" data-index="${i}">
                                <input type="text" value="${l}" data-field="code">
                                <button onclick="ConfigModule.laboratories.remove('${l}')">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="ConfigModule.showAddDialog('laboratory')">
                        ➕ Ajouter Laboratoire
                    </button>
                </div>
            `;
        },
        
        generateTarifsSection: function() {
            return `
                <div class="config-section" data-section="tarifs">
                    <h3>💰 Grille Tarifaire</h3>
                    <table class="tarifs-table">
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Interne</th>
                                <th>Externe</th>
                                <th>Privé</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.generateTarifsRows()}
                        </tbody>
                    </table>
                </div>
            `;
        },
        
        generateTarifsRows: function() {
            let rows = '';
            
            // Microscopes
            configState.microscopes.forEach(m => {
                const tarifs = configState.tarifs.microscopes[m] || { interne: 0, externe: 0, prive: 0 };
                rows += `
                    <tr>
                        <td>🔬 ${m}</td>
                        <td><input type="number" value="${tarifs.interne}" 
                            onchange="ConfigModule.microscopes.updateTarif('${m}', 'interne', this.value)"></td>
                        <td><input type="number" value="${tarifs.externe}"
                            onchange="ConfigModule.microscopes.updateTarif('${m}', 'externe', this.value)"></td>
                        <td><input type="number" value="${tarifs.prive}"
                            onchange="ConfigModule.microscopes.updateTarif('${m}', 'prive', this.value)"></td>
                    </tr>
                `;
            });
            
            // Services
            configState.manipulations.forEach(s => {
                const tarifs = configState.tarifs.services[s.name] || { interne: 0, externe: 0, prive: 0 };
                rows += `
                    <tr>
                        <td>${s.icon} ${s.name}</td>
                        <td><input type="number" value="${tarifs.interne}"
                            onchange="ConfigModule.services.updateTarif('${s.name}', 'interne', this.value)"></td>
                        <td><input type="number" value="${tarifs.externe}"
                            onchange="ConfigModule.services.updateTarif('${s.name}', 'externe', this.value)"></td>
                        <td><input type="number" value="${tarifs.prive}"
                            onchange="ConfigModule.services.updateTarif('${s.name}', 'prive', this.value)"></td>
                    </tr>
                `;
            });
            
            return rows;
        },
        
        /**
         * Attache les event listeners
         */
        attachEventListeners: function() {
            // Auto-save sur modification
            document.querySelectorAll('.config-section input').forEach(input => {
                input.addEventListener('change', () => {
                    this.save();
                });
            });
        },
        
        // =========================================
        // DIALOGUES ET INTERACTIONS
        // =========================================
        
        showAddDialog: function(type) {
            const dialogs = {
                microscope: {
                    title: 'Ajouter un Microscope',
                    fields: [
                        { label: 'Nom', type: 'text', id: 'name', required: true }
                    ],
                    action: (data) => this.microscopes.add(data.name)
                },
                service: {
                    title: 'Ajouter un Service',
                    fields: [
                        { label: 'Nom', type: 'text', id: 'name', required: true },
                        { label: 'Icône', type: 'text', id: 'icon', default: '🔬' }
                    ],
                    action: (data) => this.services.add(data.name, data.icon)
                },
                laboratory: {
                    title: 'Ajouter un Laboratoire Interne',
                    fields: [
                        { label: 'Code', type: 'text', id: 'code', required: true }
                    ],
                    action: (data) => this.laboratories.add(data.code)
                }
            };
            
            const dialog = dialogs[type];
            if (!dialog) return;
            
            // Créer et afficher le dialogue
            this.createDialog(dialog);
        },
        
        createDialog: function(config) {
            // Utiliser la modal existante ou créer une nouvelle
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            
            const fields = config.fields.map(f => `
                <div class="form-group">
                    <label>${f.label}</label>
                    <input type="${f.type}" id="dialog_${f.id}" 
                           ${f.required ? 'required' : ''}
                           value="${f.default || ''}">
                </div>
            `).join('');
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    <h3>${config.title}</h3>
                    ${fields}
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="ConfigModule.submitDialog(this, '${config.title}')">
                            ✅ Ajouter
                        </button>
                        <button class="btn" onclick="this.closest('.modal').remove()">
                            ❌ Annuler
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Stocker l'action dans le DOM
            modal.dataset.action = config.action.toString();
        },
        
        submitDialog: function(button, title) {
            const modal = button.closest('.modal');
            const inputs = modal.querySelectorAll('input');
            const data = {};
            
            inputs.forEach(input => {
                const id = input.id.replace('dialog_', '');
                data[id] = input.value;
            });
            
            // Exécuter l'action appropriée
            if (title.includes('Microscope')) {
                this.microscopes.add(data.name);
            } else if (title.includes('Service')) {
                this.services.add(data.name, data.icon);
            } else if (title.includes('Laboratoire')) {
                this.laboratories.add(data.code);
            }
            
            modal.remove();
            this.renderConfigUI();
            
            if (window.showToast) {
                showToast('Élément ajouté avec succès', 'success');
            }
        },
        
        // =========================================
        // IMPORT/EXPORT
        // =========================================
        
        exportConfig: function() {
            const dataStr = JSON.stringify(configState, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `config_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        },
        showConfigTab: function(tabName) {
            // Masquer tous les onglets
            document.querySelectorAll('.config-tab-content').forEach(tab => {
                tab.style.display = 'none';
            });
            document.querySelectorAll('.config-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Afficher l'onglet sélectionné
            const tab = document.getElementById(`config-tab-${tabName}`);
            const btn = document.querySelector(`[data-tab="${tabName}"]`);
            
            if (tab) tab.style.display = 'block';
            if (btn) btn.classList.add('active');
        },

        generateMicroscopesSection: function() {
            const microscopes = configState.microscopes || [];
            return `
                <div class="config-section">
                    <h3>🔬 Gestion des Microscopes</h3>
                    <div class="config-list">
                        ${microscopes.map((m, i) => `
                            <div class="config-item">
                                <span>🔬</span>
                                <input type="text" value="${m}" onchange="ConfigModule.updateMicroscope(${i}, this.value)">
                                <button onclick="ConfigModule.removeMicroscope('${m}')" title="Supprimer">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="ConfigModule.addMicroscope()">
                        ➕ Ajouter un Microscope
                    </button>
                </div>
            `;
        },

        generateServicesSection: function() {
            const services = configState.manipulations || [];
            return `
                <div class="config-section">
                    <h3>🧪 Gestion des Services</h3>
                    <div class="config-list">
                        ${services.map((s, i) => `
                            <div class="config-item">
                                <span>${s.icon || '🔬'}</span>
                                <input type="text" value="${s.name}" onchange="ConfigModule.updateService(${i}, this.value)">
                                <button onclick="ConfigModule.removeService('${s.name}')" title="Supprimer">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="ConfigModule.addService()">
                        ➕ Ajouter un Service
                    </button>
                </div>
            `;
        },

        generateLaboratoriesSection: function() {
            const labs = configState.internalLaboratories || [];
            return `
                <div class="config-section">
                    <h3>🏛️ Laboratoires Internes</h3>
                    <p><small>Ces laboratoires seront automatiquement classés comme "internes"</small></p>
                    <div class="config-list">
                        ${labs.map((lab, i) => `
                            <div class="config-item">
                                <span>🏛️</span>
                                <input type="text" value="${lab}" onchange="ConfigModule.updateLaboratory(${i}, this.value)">
                                <button onclick="ConfigModule.removeLaboratory('${lab}')" title="Supprimer">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="ConfigModule.addLaboratory()">
                        ➕ Ajouter un Laboratoire
                    </button>
                </div>
            `;
        },

        generateTarifsSection: function() {
            return `
                <div class="config-section">
                    <h3>💰 Grille Tarifaire</h3>
                    <p><small>Tarifs en euros par session/échantillon</small></p>
                    <table class="tarifs-table">
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Interne (€)</th>
                                <th>Externe (€)</th>
                                <th>Privé (€)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.generateTarifsRows()}
                        </tbody>
                    </table>
                </div>
            `;
        },

        /**
         * 4. Ajoutez ces méthodes utilitaires :
         */

        addMicroscope: function() {
            const name = prompt('Nom du nouveau microscope :');
            if (name && !configState.microscopes.includes(name)) {
                configState.microscopes.push(name);
                configState.tarifs.microscopes[name] = { interne: 0, externe: 0, prive: 0 };
                this.save();
                this.renderConfigUI();
                UIModule.toast.success(`Microscope "${name}" ajouté`);
            }
        },

        removeMicroscope: function(name) {
            if (confirm(`Supprimer le microscope "${name}" ?`)) {
                const index = configState.microscopes.indexOf(name);
                if (index > -1) {
                    configState.microscopes.splice(index, 1);
                    delete configState.tarifs.microscopes[name];
                    this.save();
                    this.renderConfigUI();
                    UIModule.toast.success(`Microscope "${name}" supprimé`);
                }
            }
        },

        addService: function() {
            const name = prompt('Nom du nouveau service :');
            if (name && !configState.manipulations.find(m => m.name === name)) {
                const icon = prompt('Icône (optionnel) :', '🔬');
                configState.manipulations.push({ name, icon: icon || '🔬' });
                configState.tarifs.services[name] = { interne: 0, externe: 0, prive: 0 };
                this.save();
                this.renderConfigUI();
                UIModule.toast.success(`Service "${name}" ajouté`);
            }
        },

        removeService: function(name) {
            if (confirm(`Supprimer le service "${name}" ?`)) {
                const index = configState.manipulations.findIndex(m => m.name === name);
                if (index > -1) {
                    configState.manipulations.splice(index, 1);
                    delete configState.tarifs.services[name];
                    this.save();
                    this.renderConfigUI();
                    UIModule.toast.success(`Service "${name}" supprimé`);
                }
            }
        },

        addLaboratory: function() {
            const code = prompt('Code du laboratoire :');
            if (code && !configState.internalLaboratories.includes(code.toUpperCase())) {
                configState.internalLaboratories.push(code.toUpperCase());
                this.save();
                this.renderConfigUI();
                UIModule.toast.success(`Laboratoire "${code}" ajouté`);
            }
        },

        removeLaboratory: function(code) {
            if (confirm(`Supprimer le laboratoire "${code}" ?`)) {
                const index = configState.internalLaboratories.indexOf(code);
                if (index > -1) {
                    configState.internalLaboratories.splice(index, 1);
                    this.save();
                    this.renderConfigUI();
                    UIModule.toast.success(`Laboratoire "${code}" supprimé`);
                }
            }
        },
        
        importConfig: function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        const validation = validateConfig(imported);
                        
                        if (!validation.isValid) {
                            alert('Configuration invalide: ' + validation.errors.join(', '));
                            return;
                        }
                        
                        configState = imported;
                        this.save();
                        this.renderConfigUI();
                        notifyListeners('import', configState);
                        
                        if (window.showToast) {
                            showToast('Configuration importée avec succès', 'success');
                        }
                    } catch (error) {
                        alert('Erreur lors de l\'import: ' + error.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        },
        
        duplicateConfig: function() {
            const name = prompt('Nom de la configuration dupliquée:');
            if (!name) return;
            
            const configs = JSON.parse(localStorage.getItem('billing_configs') || '{}');
            configs[name] = JSON.parse(JSON.stringify(configState));
            localStorage.setItem('billing_configs', JSON.stringify(configs));
            
            if (window.showToast) {
                showToast(`Configuration "${name}" sauvegardée`, 'success');
            }
        }
    };
    
    // Retourner l'API publique
    return ConfigAPI;
    
})();

// =========================================
// AUTO-INITIALISATION
// =========================================
(function() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initConfig);
    } else {
        setTimeout(initConfig, 100);
    }
    
    function initConfig() {
        // Charger la configuration sauvegardée ou utiliser celle de l'app
        const savedConfig = localStorage.getItem('billing_config');
        const appConfig = window.appState?.config;
        
        const config = savedConfig ? JSON.parse(savedConfig) : appConfig;
        
        // Initialiser le module
        ConfigModule.init(config);
        
        // Synchroniser avec l'état de l'application existante
        if (window.appState) {
            ConfigModule.onChange('all', (newConfig) => {
                window.appState.config = newConfig;
                if (window.saveToLocalStorage) {
                    window.saveToLocalStorage();
                }
            });
        }
        
        console.log('✅ Module Configuration chargé et synchronisé');
    }
})();
