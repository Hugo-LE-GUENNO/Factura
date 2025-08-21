/**
 * TEAMS.MODULE.JS - Module Gestion des Équipes
 * Gère toutes les opérations liées aux équipes
 * @module TeamsModule
 */

window.TeamsModule = (function() {
    'use strict';
    
    // =========================================
    // ÉTAT PRIVÉ
    // =========================================
    let teams = [];
    let currentFilter = '';
    let currentSort = { field: 'name', direction: 'asc' };
    let editingTeam = null;
    
    // Configuration par défaut
    const config = {
        container: 'teams-container',
        formContainer: 'form-modal',
        laboratories: ['BIP', 'LCB', 'IGS', 'LISM'],
        defaultClientType: 'interne'
    };
    
    // =========================================
    // FONCTIONS PRIVÉES
    // =========================================
    
    /**
     * Extrait le nom de l'équipe (sans le laboratoire)
     */
    function extractTeamName(fullName) {
        if (!fullName || typeof fullName !== 'string') return fullName;
        const match = fullName.match(/^[A-Z]+[\s\-\/](.+)$/);
        return match ? match[1].trim() : fullName;
    }
    
    /**
     * Extrait le laboratoire du nom complet
     */
    function extractLaboratory(teamName) {
        if (!teamName || typeof teamName !== 'string') return '';
        const match = teamName.match(/^([A-Z]+)[\s\-\/]/);
        return match ? match[1] : '';
    }
    
    /**
     * Détermine le type de client
     */
    function determineClientType(teamName, laboratory) {
        const lab = laboratory || extractLaboratory(teamName);
        if (!lab) return 'externe';
        
        const internalLabs = Core.state.get('config.internalLaboratories', config.laboratories);
        return internalLabs.some(l => l.toUpperCase() === lab.toUpperCase()) ? 'interne' : 'externe';
    }
    
    /**
     * Calcule le coût total pour une équipe
     */
    function calculateTeamCost(team) {
        let total = 0;
        
        // Coût des sessions microscope
        const microscopes = Core.state.get('config.microscopes', []);
        const microscopeTarifs = Core.state.get('config.tarifs.microscopes', {});
        
        team.microscopeSessions?.forEach((sessions, index) => {
            const microscopeName = microscopes[index];
            const tarifs = microscopeTarifs[microscopeName];
            if (tarifs && sessions > 0) {
                total += sessions * (tarifs[team.clientType] || 0);
            }
        });
        
        // Coût des manipulations
        const serviceTarifs = Core.state.get('config.tarifs.services', {});
        team.manipulations?.forEach(manip => {
            const tarifs = serviceTarifs[manip.name];
            if (tarifs && manip.samples > 0) {
                total += manip.samples * (tarifs[team.clientType] || 0);
            }
        });
        
        return total;
    }
    
    /**
     * Valide les données d'une équipe
     */
    function validateTeam(teamData) {
        const errors = [];
        
        if (!teamData.name || teamData.name.trim().length < 2) {
            errors.push('Le nom de l\'équipe est requis (min. 2 caractères)');
        }
        
        if (!['interne', 'externe', 'prive'].includes(teamData.clientType)) {
            errors.push('Type de client invalide');
        }
        
        if (!teamData.laboratory || teamData.laboratory.trim().length < 2) {
            errors.push('Le laboratoire est requis');
        }
        
        // Vérifier les sessions
        if (teamData.microscopeSessions) {
            const hasNegative = teamData.microscopeSessions.some(s => s < 0);
            if (hasNegative) {
                errors.push('Les sessions ne peuvent pas être négatives');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Filtre les équipes
     */
    function filterTeams(query) {
        if (!query) return teams;
        
        const lowerQuery = query.toLowerCase();
        return teams.filter(team => {
            const teamName = extractTeamName(team.name);
            return team.name.toLowerCase().includes(lowerQuery) ||
                   teamName.toLowerCase().includes(lowerQuery) ||
                   team.laboratory?.toLowerCase().includes(lowerQuery) ||
                   team.clientType.toLowerCase().includes(lowerQuery) ||
                   team.projectName?.toLowerCase().includes(lowerQuery);
        });
    }
    
    /**
     * Trie les équipes
     */
    function sortTeams(teamsArray, field, direction) {
        return teamsArray.sort((a, b) => {
            let valueA, valueB;
            
            switch(field) {
                case 'name':
                    valueA = extractTeamName(a.name).toLowerCase();
                    valueB = extractTeamName(b.name).toLowerCase();
                    break;
                case 'laboratory':
                    valueA = (a.laboratory || extractLaboratory(a.name)).toLowerCase();
                    valueB = (b.laboratory || extractLaboratory(b.name)).toLowerCase();
                    break;
                case 'amount':
                    valueA = calculateTeamCost(a);
                    valueB = calculateTeamCost(b);
                    break;
                case 'sessions':
                    valueA = a.microscopeSessions?.reduce((sum, s) => sum + s, 0) || 0;
                    valueB = b.microscopeSessions?.reduce((sum, s) => sum + s, 0) || 0;
                    break;
                default:
                    valueA = a[field];
                    valueB = b[field];
            }
            
            if (valueA < valueB) return direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // =========================================
    // GESTION DU FORMULAIRE
    // =========================================
    const form = {
        show: function(team = null) {
            editingTeam = team;
            const isEdit = !!team;
            
            const microscopes = Core.state.get('config.microscopes', []);
            const manipulations = Core.state.get('config.manipulations', []);
            
            // Créer le formulaire
            const formHTML = `
                <h2>${isEdit ? 'Modifier' : 'Ajouter'} une équipe</h2>
                
                <div class="form-group">
                    <label>Type de client *</label>
                    <div class="radio-group">
                        <label class="radio-label">
                            <input type="radio" name="clientType" value="interne" ${!team || team.clientType === 'interne' ? 'checked' : ''}>
                            <span>Interne</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="clientType" value="externe" ${team?.clientType === 'externe' ? 'checked' : ''}>
                            <span>Externe</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="clientType" value="prive" ${team?.clientType === 'prive' ? 'checked' : ''}>
                            <span>Privé</span>
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="teamName">Nom de l'équipe *</label>
                    <input type="text" id="teamName" name="name" value="${team?.name || ''}" required>
                </div>
                
                <div class="form-group">
                    <label for="laboratory">Laboratoire *</label>
                    <input type="text" id="laboratory" name="laboratory" value="${team?.laboratory || ''}" 
                           placeholder="Ex: BIP, LCB, IGS..." required>
                </div>
                
                <div class="form-group">
                    <label for="projectName">Nom du projet</label>
                    <input type="text" id="projectName" name="projectName" value="${team?.projectName || ''}">
                </div>
                
                <h3>Sessions Microscope</h3>
                <div class="microscopes-grid">
                    ${microscopes.map((micro, i) => `
                        <div class="microscope-item">
                            <label>${micro}</label>
                            <input type="number" name="micro_${i}" min="0" 
                                   value="${team?.microscopeSessions?.[i] || 0}">
                        </div>
                    `).join('')}
                </div>
                
                <h3>Manipulations</h3>
                <div class="manipulations-list">
                    ${manipulations.map((manip, i) => {
                        const existing = team?.manipulations?.find(m => m.name === manip.name);
                        return `
                            <div class="manipulation-card">
                                <div class="manipulation-header">
                                    <input type="checkbox" id="manip_${i}" name="manip_${i}" 
                                           ${existing ? 'checked' : ''}>
                                    <span>${manip.icon || '🔬'}</span>
                                    <label for="manip_${i}">${manip.name}</label>
                                </div>
                                <div class="manipulation-fields" style="${existing ? '' : 'display:none'}">
                                    <input type="number" name="samples_${i}" placeholder="Échantillons" 
                                           min="0" value="${existing?.samples || ''}">
                                    <input type="date" name="date_${i}" value="${existing?.date || ''}">
                                    <input type="text" name="session_${i}" placeholder="N° séance" 
                                           value="${existing?.session || ''}">
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="TeamsModule.saveTeam()">
                        ${isEdit ? 'Mettre à jour' : 'Ajouter'}
                    </button>
                    <button class="btn btn-secondary" onclick="TeamsModule.cancelEdit()">
                        Annuler
                    </button>
                </div>
            `;
            
            // Afficher dans la modale
            UIModule.modal.show({
                content: formHTML,
                size: 'large',
                closable: false
            });
            
            // Attacher les événements
            this.attachFormEvents();
        },
        
        attachFormEvents: function() {
            // Gérer les checkboxes des manipulations
            document.querySelectorAll('.manipulation-card input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', function() {
                    const fields = this.closest('.manipulation-card').querySelector('.manipulation-fields');
                    if (fields) {
                        fields.style.display = this.checked ? 'grid' : 'none';
                    }
                });
            });
            
            // Auto-détection du type de client
            const labInput = document.getElementById('laboratory');
            if (labInput) {
                labInput.addEventListener('change', function() {
                    const clientType = determineClientType('', this.value);
                    const radio = document.querySelector(`input[name="clientType"][value="${clientType}"]`);
                    if (radio && !document.querySelector('input[name="clientType"][value="prive"]').checked) {
                        radio.checked = true;
                    }
                });
            }
        },
        
        getData: function() {
            const formEl = document.querySelector('.modal-content');
            if (!formEl) return null;
            
            const microscopes = Core.state.get('config.microscopes', []);
            const manipulations = Core.state.get('config.manipulations', []);
            
            const data = {
                name: formEl.querySelector('#teamName').value.trim(),
                laboratory: formEl.querySelector('#laboratory').value.trim(),
                clientType: formEl.querySelector('input[name="clientType"]:checked').value,
                projectName: formEl.querySelector('#projectName').value.trim(),
                microscopeSessions: [],
                manipulations: []
            };
            
            // Sessions microscope
            microscopes.forEach((_, i) => {
                const input = formEl.querySelector(`input[name="micro_${i}"]`);
                data.microscopeSessions.push(parseInt(input?.value) || 0);
            });
            
            // Manipulations
            manipulations.forEach((manip, i) => {
                const checkbox = formEl.querySelector(`#manip_${i}`);
                if (checkbox?.checked) {
                    data.manipulations.push({
                        name: manip.name,
                        samples: parseInt(formEl.querySelector(`input[name="samples_${i}"]`)?.value) || 0,
                        date: formEl.querySelector(`input[name="date_${i}"]`)?.value || '',
                        session: formEl.querySelector(`input[name="session_${i}"]`)?.value || ''
                    });
                }
            });
            
            return data;
        }
    };
    
    // =========================================
    // API PUBLIQUE
    // =========================================
    const TeamsAPI = {
        // Configuration
        config: config,
        
        /**
         * Initialise le module
         */
        init: function(customConfig = {}) {
            Object.assign(config, customConfig);
            
            // Charger les équipes depuis le Core
            this.loadTeams();
            
            // S'abonner aux changements
            Core.state.subscribe('teams', (newTeams) => {
                teams = newTeams || [];
                this.render();
            });
            
            // Écouter les événements
            Core.events.on('config:updated', () => {
                this.render();
            });
            
            console.log('✅ TeamsModule initialisé');
            return this;
        },
        
        /**
         * Charge les équipes
         */
        loadTeams: function() {
            teams = Core.state.get('teams', []);
            
            // Migration/validation des données
            teams = teams.map(team => ({
                ...team,
                laboratory: team.laboratory || extractLaboratory(team.name),
                microscopeSessions: team.microscopeSessions || [],
                manipulations: team.manipulations || []
            }));
            
            Core.state.set('teams', teams);
            return teams;
        },
        
        /**
         * Obtient toutes les équipes
         */
        getAll: function() {
            return [...teams];
        },
        
        /**
         * Obtient une équipe par nom
         */
        get: function(teamName) {
            return teams.find(t => t.name === teamName);
        },
        
        /**
         * Ajoute une équipe
         */
        add: function(teamData) {
            // Validation
            const validation = validateTeam(teamData);
            if (!validation.isValid) {
                UIModule.toast.error(validation.errors.join('<br>'));
                return false;
            }
            
            // Vérifier les doublons
            if (teams.some(t => t.name.toLowerCase() === teamData.name.toLowerCase())) {
                UIModule.toast.error(`L'équipe "${teamData.name}" existe déjà`);
                return false;
            }
            
            // Ajouter
            teams.push(teamData);
            Core.state.set('teams', teams);
            
            // Événement
            Core.events.emit('team:added', teamData);
            UIModule.toast.success(`Équipe "${teamData.name}" ajoutée`);
            
            this.render();
            return true;
        },
        
        /**
         * Met à jour une équipe
         */
        update: function(teamName, teamData) {
            const index = teams.findIndex(t => t.name === teamName);
            if (index === -1) {
                UIModule.toast.error('Équipe non trouvée');
                return false;
            }
            
            // Validation
            const validation = validateTeam(teamData);
            if (!validation.isValid) {
                UIModule.toast.error(validation.errors.join('<br>'));
                return false;
            }
            
            // Vérifier les doublons (si le nom a changé)
            if (teamData.name !== teamName && 
                teams.some(t => t.name.toLowerCase() === teamData.name.toLowerCase())) {
                UIModule.toast.error(`L'équipe "${teamData.name}" existe déjà`);
                return false;
            }
            
            // Mettre à jour
            teams[index] = teamData;
            Core.state.set('teams', teams);
            
            // Événement
            Core.events.emit('team:updated', { old: teamName, new: teamData });
            UIModule.toast.success(`Équipe "${teamData.name}" mise à jour`);
            
            this.render();
            return true;
        },
        
        /**
         * Supprime une équipe
         */
        remove: async function(teamName) {
            const team = this.get(teamName);
            if (!team) {
                UIModule.toast.error('Équipe non trouvée');
                return false;
            }
            
            const confirmed = await UIModule.confirm(
                `Voulez-vous vraiment supprimer l'équipe "${teamName}" ?`
            );
            
            if (!confirmed) return false;
            
            teams = teams.filter(t => t.name !== teamName);
            Core.state.set('teams', teams);
            
            // Événement
            Core.events.emit('team:removed', team);
            UIModule.toast.success(`Équipe "${teamName}" supprimée`);
            
            this.render();
            return true;
        },
        
        /**
         * Recherche des équipes
         */
        search: function(query) {
            currentFilter = query;
            this.render();
            return filterTeams(query);
        },
        
        /**
         * Trie les équipes
         */
        sort: function(field, direction = null) {
            if (direction === null) {
                direction = (currentSort.field === field && currentSort.direction === 'asc') ? 'desc' : 'asc';
            }
            
            currentSort = { field, direction };
            this.render();
        },
        
        /**
         * Import CSV
         */
        importCSV: function(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    try {
                        const content = e.target.result;
                        const lines = content.split(/[\r\n]+/).filter(l => l.trim());
                        let imported = 0;
                        
                        lines.forEach((line, index) => {
                            // Ignorer l'en-tête
                            if (index === 0 && line.toLowerCase().includes('equipe')) return;
                            
                            const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
                            if (parts[0]) {
                                const teamName = parts[0];
                                const laboratory = parts[1] || extractLaboratory(teamName);
                                
                                // Vérifier si l'équipe n'existe pas déjà
                                if (!teams.some(t => t.name === teamName)) {
                                    this.add({
                                        name: teamName,
                                        laboratory: laboratory,
                                        clientType: determineClientType(teamName, laboratory),
                                        projectName: parts[2] || '',
                                        microscopeSessions: [],
                                        manipulations: []
                                    });
                                    imported++;
                                }
                            }
                        });
                        
                        UIModule.toast.success(`${imported} équipe(s) importée(s)`);
                        resolve(imported);
                        
                    } catch (error) {
                        UIModule.toast.error('Erreur lors de l\'import');
                        reject(error);
                    }
                };
                
                reader.onerror = reject;
                reader.readAsText(file);
            });
        },
        
        /**
         * Export CSV
         */
        exportCSV: function() {
            const headers = ['Équipe', 'Laboratoire', 'Type', 'Projet', 'Sessions', 'Montant'];
            const rows = [headers];
            
            const teamsToExport = filterTeams(currentFilter);
            const sortedTeams = sortTeams(teamsToExport, currentSort.field, currentSort.direction);
            
            sortedTeams.forEach(team => {
                const totalSessions = team.microscopeSessions.reduce((sum, s) => sum + s, 0);
                const totalCost = calculateTeamCost(team);
                
                rows.push([
                    team.name,
                    team.laboratory || '',
                    team.clientType,
                    team.projectName || '',
                    totalSessions,
                    totalCost.toFixed(2)
                ]);
            });
            
            const csv = Core.utils.toCSV(rows.map(row => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                return obj;
            }));
            
            // Télécharger
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `equipes_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
            
            UIModule.toast.success('Export CSV généré');
        },
        
        /**
         * Calcule les statistiques
         */
        getStatistics: function() {
            const totalTeams = teams.length;
            const totalSessions = teams.reduce((sum, team) => 
                sum + (team.microscopeSessions?.reduce((s, v) => s + v, 0) || 0), 0);
            const totalAmount = teams.reduce((sum, team) => 
                sum + calculateTeamCost(team), 0);
            
            const byType = teams.reduce((acc, team) => {
                acc[team.clientType] = (acc[team.clientType] || 0) + 1;
                return acc;
            }, {});
            
            const byLaboratory = teams.reduce((acc, team) => {
                const lab = team.laboratory || extractLaboratory(team.name);
                acc[lab] = (acc[lab] || 0) + 1;
                return acc;
            }, {});
            
            return {
                totalTeams,
                totalSessions,
                totalAmount,
                byType,
                byLaboratory,
                averageAmount: totalTeams > 0 ? totalAmount / totalTeams : 0
            };
        },
        
        /**
         * Affiche le formulaire d'ajout/édition
         */
        showForm: function(teamName = null) {
            const team = teamName ? this.get(teamName) : null;
            form.show(team);
        },
        
        /**
         * Sauvegarde l'équipe du formulaire
         */
        saveTeam: function() {
            const teamData = form.getData();
            if (!teamData) return;
            
            let success;
            if (editingTeam) {
                success = this.update(editingTeam.name, teamData);
            } else {
                success = this.add(teamData);
            }
            
            if (success) {
                UIModule.modal.hide();
                editingTeam = null;
            }
        },
        
        /**
         * Annule l'édition
         */
        cancelEdit: function() {
            UIModule.modal.hide();
            editingTeam = null;
        },
        
        /**
         * Affiche la liste des équipes
         */
        render: function() {
            const container = document.getElementById(config.container);
            if (!container) return;
            
            // Obtenir les équipes filtrées et triées
            let displayTeams = filterTeams(currentFilter);
            displayTeams = sortTeams(displayTeams, currentSort.field, currentSort.direction);
            
            // Créer le HTML
            let html = `
                <div class="teams-header">
                    <div class="teams-title">
                        <h2>Équipes (${displayTeams.length})</h2>
                    </div>
                    <div class="teams-actions">
                        <input type="text" class="search-input" placeholder="Rechercher..." 
                               value="${currentFilter}" onkeyup="TeamsModule.search(this.value)">
                        <button class="btn btn-primary" onclick="TeamsModule.showForm()">
                            ➕ Ajouter une équipe
                        </button>
                        <button class="btn btn-secondary" onclick="TeamsModule.importFile()">
                            📥 Importer CSV
                        </button>
                        <button class="btn btn-secondary" onclick="TeamsModule.exportCSV()">
                            📤 Exporter CSV
                        </button>
                    </div>
                </div>
            `;
            
            if (displayTeams.length === 0) {
                html += `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <h3>Aucune équipe trouvée</h3>
                        <p>${teams.length === 0 ? 'Commencez par ajouter une équipe' : 'Aucun résultat pour votre recherche'}</p>
                    </div>
                `;
            } else {
                // Table
                html += `
                    <table class="teams-table">
                        <thead>
                            <tr>
                                <th onclick="TeamsModule.sort('name')" class="sortable">
                                    Équipe ${currentSort.field === 'name' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th onclick="TeamsModule.sort('laboratory')" class="sortable">
                                    Laboratoire ${currentSort.field === 'laboratory' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th onclick="TeamsModule.sort('clientType')" class="sortable">
                                    Type ${currentSort.field === 'clientType' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th>Projet</th>
                                <th onclick="TeamsModule.sort('sessions')" class="sortable">
                                    Sessions ${currentSort.field === 'sessions' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th onclick="TeamsModule.sort('amount')" class="sortable">
                                    Montant ${currentSort.field === 'amount' ? (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                displayTeams.forEach(team => {
                    const totalSessions = team.microscopeSessions?.reduce((sum, s) => sum + s, 0) || 0;
                    const totalCost = calculateTeamCost(team);
                    const displayName = extractTeamName(team.name);
                    
                    html += `
                        <tr>
                            <td><strong>${displayName}</strong></td>
                            <td><span class="badge badge-info">${team.laboratory || 'N/A'}</span></td>
                            <td><span class="badge badge-${team.clientType}">${team.clientType}</span></td>
                            <td>${team.projectName || '<em>-</em>'}</td>
                            <td>${totalSessions}</td>
                            <td><strong>${totalCost.toFixed(2)}€</strong></td>
                            <td>
                                <button class="btn-icon" onclick="TeamsModule.showForm('${team.name}')" title="Modifier">✏️</button>
                                <button class="btn-icon" onclick="TeamsModule.remove('${team.name}')" title="Supprimer">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                
                // Statistiques
                const stats = this.getStatistics();
                html += `
                    <div class="teams-stats">
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalTeams}</div>
                            <div class="stat-label">Équipes</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalSessions}</div>
                            <div class="stat-label">Sessions</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalAmount.toFixed(2)}€</div>
                            <div class="stat-label">Total</div>
                        </div>
                    </div>
                `;
            }
            
            container.innerHTML = html;
            
            // Émettre l'événement
            Core.events.emit('teams:rendered', displayTeams);
        },
        
        /**
         * Import d'un fichier
         */
        importFile: function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importCSV(file);
                }
            };
            input.click();
        }
    };
    
    // Retourner l'API publique
    return TeamsAPI;
    
})();
