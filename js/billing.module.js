/**
 * BILLING.MODULE.JS - Module de Facturation
 * Gère les calculs, factures et rapports financiers
 * @module BillingModule
 */

window.BillingModule = (function() {
    'use strict';
    
    // =========================================
    // CONFIGURATION
    // =========================================
    const config = {
        currency: '€',
        vatRate: 0.20, // TVA 20%
        invoicePrefix: 'FAC',
        container: 'billing-container',
        dateFormat: 'DD/MM/YYYY',
        company: {
            name: 'CNRS - IMM FR 3479',
            address: '31, Chemin Joseph-Aiguier',
            city: '13402 MARSEILLE CEDEX 20',
            phone: '04 91 16 40 23',
            email: 'microscopy@imm.cnrs.fr',
            siret: '180 089 013 00132'
        }
    };
    
    // =========================================
    // ÉTAT PRIVÉ
    // =========================================
    let invoices = [];
    let currentInvoice = null;
    let invoiceCounter = 1;
    
    // =========================================
    // CALCULS
    // =========================================
    const Calculator = {
        /**
         * Calcule le coût pour une équipe
         */
        calculateTeamCost: function(team) {
            let subtotal = 0;
            const details = {
                microscopes: [],
                services: [],
                total: 0,
                vat: 0,
                totalWithVat: 0
            };
            
            // Récupérer la configuration
            const microscopes = Core.state.get('config.microscopes', []);
            const microscopeTarifs = Core.state.get('config.tarifs.microscopes', {});
            const serviceTarifs = Core.state.get('config.tarifs.services', {});
            
            // Calcul des sessions microscope
            team.microscopeSessions?.forEach((sessions, index) => {
                if (sessions > 0) {
                    const microscopeName = microscopes[index];
                    const tarif = microscopeTarifs[microscopeName]?.[team.clientType] || 0;
                    const cost = sessions * tarif;
                    
                    details.microscopes.push({
                        name: microscopeName,
                        sessions: sessions,
                        unitPrice: tarif,
                        total: cost
                    });
                    
                    subtotal += cost;
                }
            });
            
            // Calcul des manipulations
            team.manipulations?.forEach(manip => {
                if (manip.samples > 0) {
                    const tarif = serviceTarifs[manip.name]?.[team.clientType] || 0;
                    const cost = manip.samples * tarif;
                    
                    details.services.push({
                        name: manip.name,
                        quantity: manip.samples,
                        unitPrice: tarif,
                        total: cost,
                        date: manip.date,
                        session: manip.session
                    });
                    
                    subtotal += cost;
                }
            });
            
            // Calcul TVA (uniquement pour les privés)
            details.total = subtotal;
            details.vat = team.clientType === 'prive' ? subtotal * config.vatRate : 0;
            details.totalWithVat = subtotal + details.vat;
            
            return details;
        },
        
        /**
         * Calcule le total pour plusieurs équipes
         */
        calculateTotal: function(teams) {
            const result = {
                subtotal: 0,
                vat: 0,
                total: 0,
                byType: {
                    interne: { count: 0, amount: 0 },
                    externe: { count: 0, amount: 0 },
                    prive: { count: 0, amount: 0 }
                },
                byLaboratory: {},
                byMicroscope: {},
                byService: {}
            };
            
            teams.forEach(team => {
                const cost = this.calculateTeamCost(team);
                
                result.subtotal += cost.total;
                result.vat += cost.vat;
                result.total += cost.totalWithVat;
                
                // Par type de client
                result.byType[team.clientType].count++;
                result.byType[team.clientType].amount += cost.totalWithVat;
                
                // Par laboratoire
                const lab = team.laboratory || 'Non spécifié';
                if (!result.byLaboratory[lab]) {
                    result.byLaboratory[lab] = { count: 0, amount: 0 };
                }
                result.byLaboratory[lab].count++;
                result.byLaboratory[lab].amount += cost.totalWithVat;
                
                // Par microscope
                cost.microscopes.forEach(micro => {
                    if (!result.byMicroscope[micro.name]) {
                        result.byMicroscope[micro.name] = { sessions: 0, amount: 0 };
                    }
                    result.byMicroscope[micro.name].sessions += micro.sessions;
                    result.byMicroscope[micro.name].amount += micro.total;
                });
                
                // Par service
                cost.services.forEach(service => {
                    if (!result.byService[service.name]) {
                        result.byService[service.name] = { quantity: 0, amount: 0 };
                    }
                    result.byService[service.name].quantity += service.quantity;
                    result.byService[service.name].amount += service.total;
                });
            });
            
            return result;
        },
        
        /**
         * Calcule les statistiques mensuelles
         */
        calculateMonthlyStats: function(teams, year, month) {
            const filteredTeams = teams.filter(team => {
                // Filtrer par date si disponible
                if (team.date) {
                    const teamDate = new Date(team.date);
                    return teamDate.getFullYear() === year && teamDate.getMonth() === month - 1;
                }
                return false;
            });
            
            return this.calculateTotal(filteredTeams);
        },
        
        /**
         * Prévisions basées sur l'historique
         */
        calculateProjections: function(teams) {
            // Calculer la moyenne mensuelle
            const monthlyTotals = {};
            const now = new Date();
            
            teams.forEach(team => {
                const date = team.date ? new Date(team.date) : now;
                const key = `${date.getFullYear()}-${date.getMonth()}`;
                
                if (!monthlyTotals[key]) {
                    monthlyTotals[key] = 0;
                }
                
                const cost = this.calculateTeamCost(team);
                monthlyTotals[key] += cost.totalWithVat;
            });
            
            const months = Object.keys(monthlyTotals);
            if (months.length === 0) return { monthly: 0, quarterly: 0, yearly: 0 };
            
            const average = Object.values(monthlyTotals).reduce((a, b) => a + b, 0) / months.length;
            
            return {
                monthly: average,
                quarterly: average * 3,
                yearly: average * 12
            };
        }
    };
    
    // =========================================
    // GÉNÉRATION DE FACTURES
    // =========================================
    const InvoiceGenerator = {
        /**
         * Génère un numéro de facture
         */
        generateInvoiceNumber: function() {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const counter = String(invoiceCounter++).padStart(4, '0');
            
            return `${config.invoicePrefix}-${year}${month}-${counter}`;
        },
        
        /**
         * Crée une facture pour une équipe
         */
        createInvoice: function(team, period) {
            const invoice = {
                number: this.generateInvoiceNumber(),
                date: new Date().toISOString(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 jours
                
                // Émetteur
                issuer: config.company,
                
                // Client
                client: {
                    name: team.name,
                    laboratory: team.laboratory,
                    type: team.clientType,
                    project: team.projectName || ''
                },
                
                // Période
                period: period || {
                    start: Core.state.get('projectInfo.startDate'),
                    end: Core.state.get('projectInfo.endDate')
                },
                
                // Détails
                details: Calculator.calculateTeamCost(team),
                
                // Statut
                status: 'draft', // draft, sent, paid, cancelled
                
                // Métadonnées
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            invoices.push(invoice);
            Core.state.set('invoices', invoices);
            
            return invoice;
        },
        
        /**
         * Génère le HTML d'une facture
         */
        generateInvoiceHTML: function(invoice) {
            const formatDate = (dateStr) => {
                if (!dateStr) return 'N/A';
                return new Date(dateStr).toLocaleDateString('fr-FR');
            };
            
            const formatCurrency = (amount) => {
                return amount.toFixed(2) + ' ' + config.currency;
            };
            
            let html = `
                <div class="invoice-document">
                    <div class="invoice-header">
                        <div class="invoice-logo">
                            <h1>${config.company.name}</h1>
                            <p>${config.company.address}<br>${config.company.city}</p>
                            <p>Tél: ${config.company.phone}<br>Email: ${config.company.email}</p>
                            <p>SIRET: ${config.company.siret}</p>
                        </div>
                        
                        <div class="invoice-info">
                            <h2>FACTURE</h2>
                            <p><strong>N°:</strong> ${invoice.number}</p>
                            <p><strong>Date:</strong> ${formatDate(invoice.date)}</p>
                            <p><strong>Échéance:</strong> ${formatDate(invoice.dueDate)}</p>
                        </div>
                    </div>
                    
                    <div class="invoice-client">
                        <h3>Client</h3>
                        <p><strong>${invoice.client.name}</strong></p>
                        <p>Laboratoire: ${invoice.client.laboratory}</p>
                        ${invoice.client.project ? `<p>Projet: ${invoice.client.project}</p>` : ''}
                        <p>Type: ${invoice.client.type}</p>
                    </div>
                    
                    <div class="invoice-period">
                        <p><strong>Période de facturation:</strong> 
                           ${formatDate(invoice.period.start)} - ${formatDate(invoice.period.end)}</p>
                    </div>
                    
                    <table class="invoice-items">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Quantité</th>
                                <th>Prix unitaire</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            // Lignes microscopes
            if (invoice.details.microscopes.length > 0) {
                html += '<tr class="section-header"><td colspan="4"><strong>Sessions Microscope</strong></td></tr>';
                invoice.details.microscopes.forEach(item => {
                    html += `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.sessions} session(s)</td>
                            <td>${formatCurrency(item.unitPrice)}</td>
                            <td>${formatCurrency(item.total)}</td>
                        </tr>
                    `;
                });
            }
            
            // Lignes services
            if (invoice.details.services.length > 0) {
                html += '<tr class="section-header"><td colspan="4"><strong>Manipulations</strong></td></tr>';
                invoice.details.services.forEach(item => {
                    html += `
                        <tr>
                            <td>${item.name}${item.date ? ` (${formatDate(item.date)})` : ''}</td>
                            <td>${item.quantity} échantillon(s)</td>
                            <td>${formatCurrency(item.unitPrice)}</td>
                            <td>${formatCurrency(item.total)}</td>
                        </tr>
                    `;
                });
            }
            
            html += `
                        </tbody>
                        <tfoot>
                            <tr class="subtotal">
                                <td colspan="3">Sous-total HT</td>
                                <td>${formatCurrency(invoice.details.total)}</td>
                            </tr>
            `;
            
            if (invoice.details.vat > 0) {
                html += `
                            <tr class="vat">
                                <td colspan="3">TVA (${(config.vatRate * 100).toFixed(0)}%)</td>
                                <td>${formatCurrency(invoice.details.vat)}</td>
                            </tr>
                `;
            }
            
            html += `
                            <tr class="total">
                                <td colspan="3"><strong>TOTAL TTC</strong></td>
                                <td><strong>${formatCurrency(invoice.details.totalWithVat)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div class="invoice-footer">
                        <p class="payment-info">
                            Paiement à réception de facture par virement bancaire ou mandat administratif.
                        </p>
                        <p class="legal-info">
                            ${invoice.details.vat === 0 ? 'Exonération de TVA - Article 261-4-4° du CGI' : ''}
                        </p>
                    </div>
                </div>
            `;
            
            return html;
        },
        
        /**
         * Exporte une facture en PDF (placeholder)
         */
        exportToPDF: function(invoice) {
            // Nécessite une librairie comme jsPDF
            console.log('Export PDF à implémenter avec jsPDF');
            
            // Pour l'instant, ouvrir dans une nouvelle fenêtre pour impression
            const html = this.generateInvoiceHTML(invoice);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Facture ${invoice.number}</title>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        .invoice-document { max-width: 800px; margin: 0 auto; padding: 20px; }
                        .invoice-header { display: flex; justify-content: space-between; margin-bottom: 40px; }
                        .invoice-items { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        .invoice-items th, .invoice-items td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                        .invoice-items th { background: #f5f5f5; }
                        .section-header td { background: #f9f9f9; font-weight: bold; }
                        .subtotal td, .vat td, .total td { border-top: 2px solid #333; }
                        .total td { font-size: 1.2em; }
                        @media print {
                            body { margin: 0; }
                            .invoice-document { padding: 0; }
                        }
                    </style>
                </head>
                <body onload="window.print()">
                    ${html}
                </body>
                </html>
            `);
        }
    };
    
    // =========================================
    // RAPPORTS
    // =========================================
    const Reports = {
        /**
         * Génère un rapport mensuel
         */
        generateMonthlyReport: function(year, month) {
            const teams = Core.state.get('teams', []);
            const stats = Calculator.calculateMonthlyStats(teams, year, month);
            const monthName = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            
            return {
                title: `Rapport Mensuel - ${monthName}`,
                period: { year, month },
                stats: stats,
                generated: new Date().toISOString()
            };
        },
        
        /**
         * Génère un rapport détaillé
         */
        generateDetailedReport: function() {
            const teams = Core.state.get('teams', []);
            const projectInfo = Core.state.get('projectInfo', {});
            const stats = Calculator.calculateTotal(teams);
            const projections = Calculator.calculateProjections(teams);
            
            return {
                title: `Rapport Détaillé - ${projectInfo.title || 'Sans titre'}`,
                period: {
                    start: projectInfo.startDate,
                    end: projectInfo.endDate
                },
                summary: {
                    totalTeams: teams.length,
                    totalRevenue: stats.total,
                    averagePerTeam: teams.length > 0 ? stats.total / teams.length : 0
                },
                breakdown: {
                    byType: stats.byType,
                    byLaboratory: stats.byLaboratory,
                    byMicroscope: stats.byMicroscope,
                    byService: stats.byService
                },
                projections: projections,
                generated: new Date().toISOString()
            };
        },
        
        /**
         * Exporte un rapport en CSV
         */
        exportReportCSV: function(report) {
            const lines = [];
            
            // En-tête
            lines.push(`"${report.title}"`);
            lines.push(`"Généré le",${new Date(report.generated).toLocaleDateString('fr-FR')}`);
            lines.push('');
            
            // Résumé
            lines.push('"RÉSUMÉ"');
            lines.push(`"Nombre d'équipes",${report.summary.totalTeams}`);
            lines.push(`"Revenu total",${report.summary.totalRevenue.toFixed(2)}€`);
            lines.push(`"Moyenne par équipe",${report.summary.averagePerTeam.toFixed(2)}€`);
            lines.push('');
            
            // Par type
            lines.push('"PAR TYPE DE CLIENT"');
            lines.push('"Type","Nombre","Montant"');
            Object.entries(report.breakdown.byType).forEach(([type, data]) => {
                lines.push(`"${type}",${data.count},${data.amount.toFixed(2)}€`);
            });
            lines.push('');
            
            // Par laboratoire
            lines.push('"PAR LABORATOIRE"');
            lines.push('"Laboratoire","Nombre","Montant"');
            Object.entries(report.breakdown.byLaboratory).forEach(([lab, data]) => {
                lines.push(`"${lab}",${data.count},${data.amount.toFixed(2)}€`);
            });
            
            // Télécharger
            const csv = lines.join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `rapport_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
        }
    };
    
    // =========================================
    // INTERFACE
    // =========================================
    const UI = {
        /**
         * Affiche le tableau de bord
         */
        renderDashboard: function() {
            const container = document.getElementById(config.container);
            if (!container) return;
            
            const teams = Core.state.get('teams', []);
            const stats = Calculator.calculateTotal(teams);
            const projections = Calculator.calculateProjections(teams);
            
            container.innerHTML = `
                <div class="billing-dashboard">
                    <h2>💰 Tableau de Bord Facturation</h2>
                    
                    <div class="billing-stats">
                        <div class="stat-card">
                            <div class="stat-value">${stats.total.toFixed(2)}€</div>
                            <div class="stat-label">Revenu Total</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.vat.toFixed(2)}€</div>
                            <div class="stat-label">TVA Collectée</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${projections.monthly.toFixed(2)}€</div>
                            <div class="stat-label">Moyenne Mensuelle</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${projections.yearly.toFixed(2)}€</div>
                            <div class="stat-label">Projection Annuelle</div>
                        </div>
                    </div>
                    
                    <div class="billing-actions">
                        <button class="btn btn-primary" onclick="BillingModule.showInvoiceForm()">
                            📄 Nouvelle Facture
                        </button>
                        <button class="btn btn-secondary" onclick="BillingModule.showInvoicesList()">
                            📋 Liste des Factures
                        </button>
                        <button class="btn btn-secondary" onclick="BillingModule.generateReport()">
                            📊 Générer Rapport
                        </button>
                        <button class="btn btn-warning" onclick="BillingModule.exportAllInvoices()">
                            💾 Exporter Tout
                        </button>
                    </div>
                    
                    <div class="billing-charts">
                        ${this.renderRevenueChart(stats)}
                        ${this.renderBreakdownChart(stats)}
                    </div>
                    
                    <div id="billing-content"></div>
                </div>
            `;
        },
        
        /**
         * Graphique des revenus
         */
        renderRevenueChart: function(stats) {
            // Version simplifiée sans librairie de graphiques
            const maxAmount = Math.max(
                stats.byType.interne.amount,
                stats.byType.externe.amount,
                stats.byType.prive.amount
            );
            
            return `
                <div class="revenue-chart">
                    <h3>Revenus par Type de Client</h3>
                    <div class="chart-bars">
                        ${Object.entries(stats.byType).map(([type, data]) => `
                            <div class="chart-bar">
                                <div class="bar-fill" style="height: ${(data.amount / maxAmount * 100) || 0}%; background: var(--${type === 'interne' ? 'primary' : type === 'externe' ? 'secondary' : 'warning'}-color);">
                                    <span class="bar-value">${data.amount.toFixed(0)}€</span>
                                </div>
                                <div class="bar-label">${type}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },
        
        /**
         * Graphique de répartition
         */
        renderBreakdownChart: function(stats) {
            const topLabs = Object.entries(stats.byLaboratory)
                .sort((a, b) => b[1].amount - a[1].amount)
                .slice(0, 5);
            
            return `
                <div class="breakdown-chart">
                    <h3>Top 5 Laboratoires</h3>
                    <div class="chart-list">
                        ${topLabs.map(([lab, data]) => `
                            <div class="chart-item">
                                <span class="item-label">${lab}</span>
                                <div class="item-bar">
                                    <div class="bar-progress" style="width: ${(data.amount / stats.total * 100)}%"></div>
                                </div>
                                <span class="item-value">${data.amount.toFixed(0)}€</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },
        
        /**
         * Formulaire de facture
         */
        showInvoiceForm: function() {
            const teams = Core.state.get('teams', []);
            
            if (teams.length === 0) {
                UIModule.toast.warning('Aucune équipe disponible pour facturation');
                return;
            }
            
            const formHTML = `
                <div class="invoice-form">
                    <h3>Créer une Facture</h3>
                    
                    <div class="form-group">
                        <label>Équipe à facturer</label>
                        <select id="invoice-team">
                            <option value="">-- Sélectionner une équipe --</option>
                            ${teams.map(team => `
                                <option value="${team.name}">${team.name} (${team.laboratory})</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Période de facturation</label>
                        <div class="date-range">
                            <input type="date" id="invoice-start">
                            <span>→</span>
                            <input type="date" id="invoice-end">
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick="BillingModule.createInvoiceForTeam()">
                            Générer Facture
                        </button>
                        <button class="btn btn-secondary" onclick="BillingModule.render()">
                            Annuler
                        </button>
                    </div>
                </div>
            `;
            
            UIModule.modal.show({
                title: 'Nouvelle Facture',
                content: formHTML,
                size: 'medium'
            });
        },
        
        /**
         * Liste des factures
         */
        renderInvoicesList: function() {
            const content = document.getElementById('billing-content');
            if (!content) return;
            
            if (invoices.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <h3>Aucune facture</h3>
                        <p>Créez votre première facture</p>
                    </div>
                `;
                return;
            }
            
            content.innerHTML = `
                <div class="invoices-list">
                    <h3>Liste des Factures (${invoices.length})</h3>
                    <table class="invoices-table">
                        <thead>
                            <tr>
                                <th>Numéro</th>
                                <th>Date</th>
                                <th>Client</th>
                                <th>Montant</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoices.map(invoice => `
                                <tr>
                                    <td><strong>${invoice.number}</strong></td>
                                    <td>${new Date(invoice.date).toLocaleDateString('fr-FR')}</td>
                                    <td>${invoice.client.name}</td>
                                    <td><strong>${invoice.details.totalWithVat.toFixed(2)}€</strong></td>
                                    <td>
                                        <span class="badge badge-${invoice.status === 'paid' ? 'success' : invoice.status === 'sent' ? 'warning' : 'info'}">
                                            ${invoice.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn-icon" onclick="BillingModule.viewInvoice('${invoice.number}')" title="Voir">👁️</button>
                                        <button class="btn-icon" onclick="BillingModule.printInvoice('${invoice.number}')" title="Imprimer">🖨️</button>
                                        <button class="btn-icon" onclick="BillingModule.deleteInvoice('${invoice.number}')" title="Supprimer">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    };
    
    // =========================================
    // API PUBLIQUE
    // =========================================
    return {
        // Configuration
        config: config,
        
        /**
         * Initialise le module
         */
        init: function(customConfig = {}) {
            Object.assign(config, customConfig);
            
            // Charger les factures sauvegardées
            invoices = Core.state.get('invoices', []);
            
            // Récupérer le compteur
            if (invoices.length > 0) {
                const lastInvoice = invoices[invoices.length - 1];
                const match = lastInvoice.number.match(/(\d{4})$/);
                if (match) {
                    invoiceCounter = parseInt(match[1]) + 1;
                }
            }
            
            // S'abonner aux événements
            Core.events.on('team:updated', () => this.updateCalculations());
            Core.events.on('config:updated', () => this.updateCalculations());
            
            console.log('✅ BillingModule initialisé');
            return this;
        },
        
        /**
         * Affiche le module
         */
        render: function() {
            UI.renderDashboard();
        },
        
        /**
         * Crée une facture pour une équipe
         */
        createInvoiceForTeam: function() {
            const teamName = document.getElementById('invoice-team')?.value;
            const startDate = document.getElementById('invoice-start')?.value;
            const endDate = document.getElementById('invoice-end')?.value;
            
            if (!teamName) {
                UIModule.toast.error('Veuillez sélectionner une équipe');
                return;
            }
            
            const teams = Core.state.get('teams', []);
            const team = teams.find(t => t.name === teamName);
            
            if (!team) {
                UIModule.toast.error('Équipe non trouvée');
                return;
            }
            
            const invoice = InvoiceGenerator.createInvoice(team, { start: startDate, end: endDate });
            
            UIModule.modal.hide();
            this.viewInvoice(invoice.number);
            UIModule.toast.success(`Facture ${invoice.number} créée`);
        },
        
        /**
         * Affiche une facture
         */
        viewInvoice: function(invoiceNumber) {
            const invoice = invoices.find(i => i.number === invoiceNumber);
            if (!invoice) {
                UIModule.toast.error('Facture non trouvée');
                return;
            }
            
            const html = InvoiceGenerator.generateInvoiceHTML(invoice);
            
            UIModule.modal.show({
                title: `Facture ${invoice.number}`,
                content: html,
                size: 'large',
                footer: `
                    <button class="btn btn-primary" onclick="BillingModule.printInvoice('${invoice.number}')">
                        🖨️ Imprimer
                    </button>
                    <button class="btn btn-secondary" onclick="BillingModule.exportInvoicePDF('${invoice.number}')">
                        📄 Export PDF
                    </button>
                    <button class="btn btn-success" onclick="BillingModule.markInvoiceAsPaid('${invoice.number}')">
                        ✅ Marquer Payée
                    </button>
                `
            });
        },
        
        /**
         * Imprime une facture
         */
        printInvoice: function(invoiceNumber) {
            const invoice = invoices.find(i => i.number === invoiceNumber);
            if (!invoice) return;
            
            InvoiceGenerator.exportToPDF(invoice);
        },
        
        /**
         * Exporte une facture en PDF
         */
        exportInvoicePDF: function(invoiceNumber) {
            const invoice = invoices.find(i => i.number === invoiceNumber);
            if (!invoice) return;
            
            // Pour l'instant, utilise l'impression
            this.printInvoice(invoiceNumber);
            UIModule.toast.info('Utilisez Ctrl+P puis "Enregistrer en PDF"');
        },
        
        /**
         * Marque une facture comme payée
         */
        markInvoiceAsPaid: function(invoiceNumber) {
            const invoice = invoices.find(i => i.number === invoiceNumber);
            if (!invoice) return;
            
            invoice.status = 'paid';
            invoice.paidDate = new Date().toISOString();
            invoice.updatedAt = new Date().toISOString();
            
            Core.state.set('invoices', invoices);
            UIModule.toast.success('Facture marquée comme payée');
            
            // Rafraîchir l'affichage
            UI.renderInvoicesList();
        },
        
        /**
         * Supprime une facture
         */
        deleteInvoice: async function(invoiceNumber) {
            const confirmed = await UIModule.confirm(
                `Voulez-vous vraiment supprimer la facture ${invoiceNumber} ?`
            );
            
            if (!confirmed) return;
            
            invoices = invoices.filter(i => i.number !== invoiceNumber);
            Core.state.set('invoices', invoices);
            
            UIModule.toast.success('Facture supprimée');
            UI.renderInvoicesList();
        },
        
        /**
         * Affiche la liste des factures
         */
        showInvoicesList: function() {
            UI.renderInvoicesList();
        },
        
        /**
         * Affiche le formulaire de facture
         */
        showInvoiceForm: function() {
            UI.showInvoiceForm();
        },
        
        /**
         * Génère un rapport
         */
        generateReport: function() {
            const report = Reports.generateDetailedReport();
            
            const reportHTML = `
                <div class="billing-report">
                    <h3>${report.title}</h3>
                    <p>Généré le ${new Date(report.generated).toLocaleDateString('fr-FR')}</p>
                    
                    <div class="report-summary">
                        <h4>Résumé</h4>
                        <ul>
                            <li>Nombre d'équipes: <strong>${report.summary.totalTeams}</strong></li>
                            <li>Revenu total: <strong>${report.summary.totalRevenue.toFixed(2)}€</strong></li>
                            <li>Moyenne par équipe: <strong>${report.summary.averagePerTeam.toFixed(2)}€</strong></li>
                        </ul>
                    </div>
                    
                    <div class="report-breakdown">
                        <h4>Répartition par Type</h4>
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Nombre</th>
                                    <th>Montant</th>
                                    <th>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(report.breakdown.byType).map(([type, data]) => `
                                    <tr>
                                        <td>${type}</td>
                                        <td>${data.count}</td>
                                        <td>${data.amount.toFixed(2)}€</td>
                                        <td>${report.summary.totalRevenue > 0 ? 
                                            ((data.amount / report.summary.totalRevenue) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="report-projections">
                        <h4>Projections</h4>
                        <ul>
                            <li>Moyenne mensuelle: <strong>${report.projections.monthly.toFixed(2)}€</strong></li>
                            <li>Projection trimestrielle: <strong>${report.projections.quarterly.toFixed(2)}€</strong></li>
                            <li>Projection annuelle: <strong>${report.projections.yearly.toFixed(2)}€</strong></li>
                        </ul>
                    </div>
                    
                    <div class="report-actions">
                        <button class="btn btn-primary" onclick="BillingModule.exportReportCSV()">
                            📊 Exporter CSV
                        </button>
                        <button class="btn btn-secondary" onclick="BillingModule.printReport()">
                            🖨️ Imprimer
                        </button>
                    </div>
                </div>
            `;
            
            UIModule.modal.show({
                title: '📊 Rapport Détaillé',
                content: reportHTML,
                size: 'large'
            });
            
            // Sauvegarder le rapport pour export
            this.currentReport = report;
        },
        
        /**
         * Exporte le rapport en CSV
         */
        exportReportCSV: function() {
            if (this.currentReport) {
                Reports.exportReportCSV(this.currentReport);
                UIModule.toast.success('Rapport exporté en CSV');
            } else {
                UIModule.toast.error('Aucun rapport à exporter');
            }
        },
        
        /**
         * Imprime le rapport
         */
        printReport: function() {
            window.print();
        },
        
        /**
         * Exporte toutes les factures
         */
        exportAllInvoices: function() {
            if (invoices.length === 0) {
                UIModule.toast.warning('Aucune facture à exporter');
                return;
            }
            
            const data = {
                exportDate: new Date().toISOString(),
                invoices: invoices,
                summary: {
                    count: invoices.length,
                    total: invoices.reduce((sum, inv) => sum + inv.details.totalWithVat, 0),
                    paid: invoices.filter(i => i.status === 'paid').length,
                    pending: invoices.filter(i => i.status !== 'paid').length
                }
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `factures_export_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            
            UIModule.toast.success(`${invoices.length} facture(s) exportée(s)`);
        },
        
        /**
         * Met à jour les calculs
         */
        updateCalculations: function() {
            // Rafraîchir l'affichage si visible
            const container = document.getElementById(config.container);
            if (container && container.innerHTML) {
                this.render();
            }
        },
        
        /**
         * Calcule le coût pour une équipe
         */
        calculateTeamCost: function(team) {
            return Calculator.calculateTeamCost(team);
        },
        
        /**
         * Calcule le total
         */
        calculateTotal: function(teams) {
            return Calculator.calculateTotal(teams || Core.state.get('teams', []));
        },
        
        /**
         * Obtient les statistiques
         */
        getStatistics: function() {
            const teams = Core.state.get('teams', []);
            const stats = Calculator.calculateTotal(teams);
            const projections = Calculator.calculateProjections(teams);
            
            return {
                revenue: stats.total,
                vat: stats.vat,
                subtotal: stats.subtotal,
                invoicesCount: invoices.length,
                paidInvoices: invoices.filter(i => i.status === 'paid').length,
                pendingAmount: invoices
                    .filter(i => i.status !== 'paid')
                    .reduce((sum, inv) => sum + inv.details.totalWithVat, 0),
                projections: projections,
                breakdown: stats
            };
        },
        
        /**
         * Génère une facture globale
         */
        generateGlobalInvoice: function() {
            const teams = Core.state.get('teams', []);
            const projectInfo = Core.state.get('projectInfo', {});
            
            if (teams.length === 0) {
                UIModule.toast.warning('Aucune équipe à facturer');
                return;
            }
            
            // Créer une facture consolidée
            const globalInvoice = {
                number: InvoiceGenerator.generateInvoiceNumber(),
                date: new Date().toISOString(),
                type: 'global',
                period: {
                    start: projectInfo.startDate,
                    end: projectInfo.endDate
                },
                teams: teams.map(team => ({
                    ...team,
                    cost: Calculator.calculateTeamCost(team)
                })),
                totals: Calculator.calculateTotal(teams),
                status: 'draft'
            };
            
            invoices.push(globalInvoice);
            Core.state.set('invoices', invoices);
            
            UIModule.toast.success('Facture globale générée');
            this.viewInvoice(globalInvoice.number);
        },
        
        /**
         * Recherche de factures
         */
        searchInvoices: function(query) {
            if (!query) return invoices;
            
            const lowerQuery = query.toLowerCase();
            return invoices.filter(invoice => 
                invoice.number.toLowerCase().includes(lowerQuery) ||
                invoice.client.name.toLowerCase().includes(lowerQuery) ||
                invoice.client.laboratory?.toLowerCase().includes(lowerQuery)
            );
        },
        
        /**
         * Filtre les factures par statut
         */
        filterByStatus: function(status) {
            if (!status || status === 'all') return invoices;
            return invoices.filter(i => i.status === status);
        },
        
        /**
         * Obtient le résumé financier
         */
        getFinancialSummary: function() {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            // Factures du mois
            const monthlyInvoices = invoices.filter(i => {
                const invoiceDate = new Date(i.date);
                return invoiceDate.getMonth() === currentMonth && 
                       invoiceDate.getFullYear() === currentYear;
            });
            
            // Calculs
            const monthlyRevenue = monthlyInvoices.reduce((sum, i) => 
                sum + i.details.totalWithVat, 0);
            
            const yearlyRevenue = invoices.filter(i => 
                new Date(i.date).getFullYear() === currentYear
            ).reduce((sum, i) => sum + i.details.totalWithVat, 0);
            
            const pendingPayments = invoices.filter(i => 
                i.status !== 'paid' && i.status !== 'cancelled'
            ).reduce((sum, i) => sum + i.details.totalWithVat, 0);
            
            return {
                monthly: monthlyRevenue,
                yearly: yearlyRevenue,
                pending: pendingPayments,
                invoicesThisMonth: monthlyInvoices.length,
                totalInvoices: invoices.length
            };
        }
    };
})();
