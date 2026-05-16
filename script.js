const API_URL = '/api';

let currentPage = 'home';
let yearData = {};
let yearPanels = {};
let editingEntryId = null;
let editingYear = null;
let cachedLogoDataURL = null;

function loadLogo() {
    if (cachedLogoDataURL) return Promise.resolve(cachedLogoDataURL);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = this.naturalWidth;
            canvas.height = this.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this, 0, 0);
            cachedLogoDataURL = canvas.toDataURL('image/jpeg');
            resolve(cachedLogoDataURL);
        };
        img.onerror = () => reject(new Error('Failed to load logo'));
        img.src = 'logo/logo.jpeg';
    });
}

// LocalStorage helpers for persisting custom year panels
function saveYearPanelToStorage(year) {
    let panels = JSON.parse(localStorage.getItem('customYearPanels') || '[]');
    if (!panels.includes(year)) {
        panels.push(year);
        localStorage.setItem('customYearPanels', JSON.stringify(panels));
    }
}

function removeYearPanelFromStorage(year) {
    let panels = JSON.parse(localStorage.getItem('customYearPanels') || '[]');
    panels = panels.filter(y => y !== year);
    localStorage.setItem('customYearPanels', JSON.stringify(panels));
}

function getYearPanelsFromStorage() {
    return JSON.parse(localStorage.getItem('customYearPanels') || '[]');
}

function clearYearPanelsFromStorage() {
    localStorage.removeItem('customYearPanels');
}

function toggleHomeVisibility(year) {
    const key = 'yearVisibility_' + year;
    const current = localStorage.getItem(key) === 'true';
    localStorage.setItem(key, (!current).toString());

    const tracks = document.querySelectorAll(`.toggle-track[data-year="${year}"]`);
    tracks.forEach(t => t.classList.toggle('active', !current));

    showNotification('Year ' + year + ' is now ' + (!current ? 'visible' : 'hidden') + ' on Home page', 'success');
}

// PDF custom title settings (per-year)
function getPDFSettings(year) {
    const defaults = {
        orgName: 'शिवसृष्टी Boyz',
        subtitle: 'गणेश उत्सव कॅशबुक',
        tagline: 'Ganpati Festival Cashbook',
        headerOrgName: '',
        headerSubtitle: ''
    };
    try {
        const key = year ? 'pdfCustomSettings_' + year : 'pdfCustomSettings';
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        if (Object.keys(stored).length > 0) {
            return { ...defaults, ...stored };
        }
        // fallback to global key
        if (year) {
            const global = JSON.parse(localStorage.getItem('pdfCustomSettings') || '{}');
            if (Object.keys(global).length > 0) return { ...defaults, ...global };
        }
        return defaults;
    } catch (e) {
        return defaults;
    }
}

function savePDFSettings(year, settings) {
    const current = getPDFSettings(year);
    const updated = { ...current, ...settings };
    const key = year ? 'pdfCustomSettings_' + year : 'pdfCustomSettings';
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
}

window.checkAdminLogin = function() {
    const errorDiv = document.getElementById('loginError');

    // Quick login bypass
    if (localStorage.getItem('quickAdminLogin') === 'true') {
        localStorage.setItem('adminLoggedIn', 'true');
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        errorDiv.style.display = 'none';
        loadYearsForAdmin();
        return;
    }

    const password = document.getElementById('adminPassword').value;
    const storedPassword = localStorage.getItem('adminPassword') || 'admin123';

    if (password === storedPassword) {
        localStorage.setItem('adminLoggedIn', 'true');
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        errorDiv.style.display = 'none';
        loadYearsForAdmin();
    } else {
        errorDiv.style.display = 'block';
        document.getElementById('adminPassword').value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTodayDate();
    createParticles();

    const yearSelect = document.getElementById('yearSelect');

    if (yearSelect) {
        currentPage = 'home';
        loadYears();
        yearSelect.addEventListener('change', (e) => {
            currentYear = e.target.value;
            loadEntries();
        });
    } else {
        currentPage = 'admin';
        loadYearsForAdmin();

        const editModal = document.getElementById('editModal');
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target.id === 'editModal') closeEditModal();
            });

            document.getElementById('editForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!editingEntryId) return;
                
                const entry = {
                    name: document.getElementById('editName').value.trim(),
                    date: document.getElementById('editDate').value,
                    mode: document.getElementById('editMode').value,
                    cashIn: parseFloat(document.getElementById('editCashIn').value) || 0,
                    cashOut: parseFloat(document.getElementById('editCashOut').value) || 0
                };
                
                if (!entry.name || !entry.date || !entry.mode) {
                    showNotification('Please fill all required fields!', 'error');
                    return;
                }
                
                try {
                    const response = await fetch(`${API_URL}/entries/${editingEntryId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entry)
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        closeEditModal();
                        loadAllEntries();
                        showNotification('Entry updated successfully!', 'success');
                    } else {
                        showNotification('Error: ' + result.error, 'error');
                    }
                } catch (error) {
                    console.error('Error updating entry:', error);
                    showNotification('Failed to update entry. Make sure server is running!', 'error');
                }
            });
        }
    }

    const entryForm = document.getElementById('entryForm');
    if (entryForm) {
        entryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addEntry();
        });
    }
});

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (10 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

function setTodayDate() {
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
}

function updateDateForYear(year) {
    const dateInput = document.getElementById(`date-${year}`);
    if (dateInput && year) {
        const currentDate = dateInput.value;
        if (currentDate) {
            const monthDay = currentDate.substring(5);
            dateInput.value = year + '-' + (monthDay || '01-01');
        } else {
            dateInput.value = year + '-01-01';
        }
    }
}

// Alias for admin.html compatibility
function updateDate(year) {
    updateDateForYear(year);
}

window.createCustomYearPanel = function() {
    console.log('createCustomYearPanel called');
    const yearInput = document.getElementById('customYearInput');
    if (!yearInput) {
        console.error('yearInput not found');
        return;
    }

    const year = yearInput.value.trim();
    console.log('Year input:', year);

    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || yearNum < 2021 || yearNum > 2050) {
        showNotification('Please enter a valid year between 2021 and 2050!', 'error');
        return;
    }

    const yearStr = yearNum.toString();
    console.log('Year string:', yearStr);

    const yearTabs = document.getElementById('yearTabs');
    const yearPanelsContainer = document.getElementById('yearPanels');

    console.log('yearTabs:', yearTabs);
    console.log('yearPanelsContainer:', yearPanelsContainer);

    if (!yearTabs || !yearPanelsContainer) {
        console.error('Required elements not found');
        return;
    }

    const existingTab = yearTabs.querySelector(`button[data-year="${yearStr}"]`);
    if (existingTab) {
        switchYearTab(yearStr);
        showNotification(`Panel for ${yearStr} already exists! Switched to it.`, 'info');
        return;
    }

    console.log('Creating tab and panel for year:', yearStr);

    const tab = document.createElement('button');
    tab.className = 'year-tab';
    tab.setAttribute('data-year', yearStr);
    tab.textContent = yearStr;
    tab.onclick = () => switchYearTab(yearStr);
    yearTabs.appendChild(tab);

    const panel = createYearPanel(yearStr);
    yearPanelsContainer.appendChild(panel);

    // Save to localStorage for persistence
    saveYearPanelToStorage(yearStr);

    switchYearTab(yearStr);
    showNotification(`Panel for ${yearStr} created successfully!`, 'success');
    console.log('Panel created successfully');
}

window.deleteCustomYearPanel = async function() {
    const yearInput = document.getElementById('customYearInput');

    const activeTab = document.querySelector('.year-tab.active:not([data-year="all"])');
    const year = activeTab ? activeTab.getAttribute('data-year') : (yearInput ? yearInput.value.trim() : '');

    if (!year) {
        showNotification('Please select a year tab or enter a year to delete!', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete the panel and ALL DATA for ${year}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/entries/year/${year}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            const yearTabs = document.getElementById('yearTabs');
            const yearPanelsContainer = document.getElementById('yearPanels');

            if (!yearTabs || !yearPanelsContainer) return;

            const tab = yearTabs.querySelector(`button[data-year="${year}"]`);
            const panel = document.getElementById(`panel-${year}`);

            if (tab) tab.remove();
            if (panel) panel.remove();

            if (yearPanels[year]) {
                delete yearPanels[year];
            }

            // Remove from localStorage
            removeYearPanelFromStorage(year);

            switchYearTab('all');
            showNotification(`Panel and data for ${year} deleted successfully! (${result.deletedCount} entries removed)`, 'success');
            loadYearsForAdmin();
        }
    } catch (error) {
        console.error('Error deleting year data:', error);
        showNotification('Error deleting data. Please try again.', 'error');
    }
}

window.deleteAllPanels = async function() {
    if (!confirm('Are you sure you want to delete ALL panels and ALL DATA? This cannot be undone!')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/entries`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            const yearTabs = document.getElementById('yearTabs');
            const yearPanelsContainer = document.getElementById('yearPanels');

            if (!yearTabs || !yearPanelsContainer) return;

            const panels = yearPanelsContainer.querySelectorAll('.year-panel');
            panels.forEach(panel => {
                panel.remove();
            });

            const tabs = yearTabs.querySelectorAll('.year-tab');
            tabs.forEach(tab => {
                const year = tab.getAttribute('data-year');
                if (year !== 'all') {
                    tab.remove();
                }
            });

            yearPanels = {};
            yearData = {};

            // Clear localStorage
            clearYearPanelsFromStorage();

            switchYearTab('all');
            showNotification(`All panels and data deleted successfully! (${result.deletedCount} entries removed)`, 'success');
            loadYearsForAdmin();
        }
    } catch (error) {
        console.error('Error deleting all data:', error);
        showNotification('Error deleting data. Please try again.', 'error');
    }
}

async function loadYearsForAdmin() {
    try {
        const response = await fetch(`${API_URL}/years`);
        const result = await response.json();

        const yearTabs = document.getElementById('yearTabs');
        const yearPanelsContainer = document.getElementById('yearPanels');

        yearTabs.innerHTML = '<button class="year-tab active" data-year="all" onclick="switchYearTab(\'all\')">All Years</button>';
        yearPanelsContainer.innerHTML = '';

        // Get years from database (years with entries)
        const dbYears = result.success ? (result.data || []) : [];

        // Get years from localStorage (custom created panels)
        const localYears = getYearPanelsFromStorage();

        // Combine both, remove duplicates
        const allYears = [...new Set([...dbYears, ...localYears])];

        // Create panels for all years
        allYears.forEach(year => {
            const yearStr = year.toString();

            const tab = document.createElement('button');
            tab.className = 'year-tab';
            tab.setAttribute('data-year', yearStr);
            tab.textContent = yearStr;
            tab.onclick = () => switchYearTab(yearStr);
            yearTabs.appendChild(tab);

            const panel = createYearPanel(yearStr);
            yearPanelsContainer.appendChild(panel);
        });

        loadAllEntries();
    } catch (error) {
        console.error('Error loading years:', error);
    }
}

function createYearPanel(year) {
    const panel = document.createElement('div');
    panel.className = 'year-panel';
    panel.id = `panel-${year}`;

    const isVisible = localStorage.getItem('yearVisibility_' + year) === 'true';

    panel.innerHTML = `
        <div class="form-container" style="animation-delay: 0.2s">
            <div class="section-header">
                <div class="header-line"></div>
                <h2>Panel ${year}</h2>
                <label class="toggle-visibility" title="Show on Home Page">
                    <span class="toggle-label">Show on Home</span>
                    <span class="toggle-track ${isVisible ? 'active' : ''}" data-year="${year}" onclick="toggleHomeVisibility('${year}')">
                        <span class="toggle-thumb"></span>
                    </span>
                </label>
                <div class="header-line"></div>
            </div>
            <form id="entryForm-${year}">
                <div class="form-grid">
                    <div class="form-group floating-label">
                        <input type="text" id="name-${year}" placeholder=" " required>
                        <label for="name-${year}">Remark (Name / Purpose)</label>
                        <div class="input-focus-line"></div>
                    </div>
                    <div class="form-group floating-label">
                        <input type="date" id="date-${year}" required>
                        <label for="date-${year}">Date</label>
                        <div class="input-focus-line"></div>
                    </div>
                    <div class="form-group floating-label select-group">
                        <select id="mode-${year}" required>
                            <option value="">Select Mode</option>
                            <option value="Online">Online</option>
                            <option value="Cash">Cash</option>
                        </select>
                        <label for="mode-${year}">Mode</label>
                        <div class="input-focus-line"></div>
                    </div>
                    <div class="form-group floating-label">
                        <input type="number" id="cashIn-${year}" placeholder=" " min="0" step="0.01">
                        <label for="cashIn-${year}">Cash In (+)</label>
                        <div class="input-focus-line"></div>
                    </div>
                    <div class="form-group floating-label">
                        <input type="number" id="cashOut-${year}" placeholder=" " min="0" step="0.01">
                        <label for="cashOut-${year}">Cash Out (-)</label>
                        <div class="input-focus-line"></div>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary ripple" id="submitBtn-${year}">
                        <span class="btn-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                        </span>
                        Add Entry
                    </button>
                    <button type="button" class="btn btn-secondary ripple" onclick="resetFormForYear('${year}')">
                        <span class="btn-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                <path d="M3 3v5h5"/>
                            </svg>
                        </span>
                        Reset
                    </button>
                </div>
            </form>
        </div>

        <div class="table-container">
            <div class="table-header">
                <h2>${year} Transaction Records</h2>
                <div class="table-header-actions">
                    <button class="btn btn-pdf-view" onclick="viewPDFForYear('${year}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        View PDF
                    </button>
                    <button class="btn btn-pdf-download" onclick="downloadPDFForYear('${year}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download PDF
                    </button>
                </div>
                <div class="entry-count"><span id="entryCount-${year}">0</span> entries</div>
            </div>
            <div class="table-scroll">
                <table id="cashbookTable-${year}">
                    <thead>
                        <tr>
                            <th>Sr. No</th>
                            <th>Remark</th>
                            <th>Date</th>
                            <th>Mode</th>
                            <th>Cash In (+)</th>
                            <th>Cash Out (-)</th>
                            <th>Balance</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="tableBody-${year}">
                    </tbody>
                </table>
            </div>
            <div id="emptyState-${year}" class="empty-state">
                <div class="empty-animation">
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                        <circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="2" stroke-dasharray="10 5" class="rotate-slow"/>
                        <rect x="25" y="35" width="50" height="35" rx="4" stroke="currentColor" stroke-width="2"/>
                        <line x1="35" y1="48" x2="65" y2="48" stroke="currentColor" stroke-width="2"/>
                        <line x1="35" y1="58" x2="55" y2="58" stroke="currentColor" stroke-width="2"/>
                        <circle cx="75" cy="30" r="12" fill="var(--primary-gradient-start)" class="pulse-ring"/>
                        <path d="M71 30l3 3 6-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <p>No entries for ${year} yet!</p>
            </div>
        </div>
    `;

    const form = panel.querySelector(`#entryForm-${year}`);
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (editingEntryId && editingYear === year) {
                // Update mode
                await updateEntry(editingEntryId, editingYear);
            } else {
                // Add mode
                await addEntryForYear(year);
            }
        });
    }

    const dateInput = panel.querySelector(`#date-${year}`);
    if (dateInput) {
        dateInput.value = `${year}-01-01`;
    }

    yearPanels[year] = panel;
    return panel;
}

window.switchYearTab = function(year) {
    const tabs = document.querySelectorAll('.year-tab');
    const panels = document.querySelectorAll('.year-panel');

    tabs.forEach(tab => {
        if (tab.getAttribute('data-year') === year) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    panels.forEach(panel => {
        if (panel.id === `panel-${year}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    if (year !== 'all' && yearData[year]) {
        renderYearPanel(year, yearData[year]);
    } else if (year === 'all') {
        renderAllYearsPanel();
    }
}

async function loadYears(selectId = 'yearSelect') {
    try {
        const response = await fetch(`${API_URL}/years`);
        const result = await response.json();
        
        if (result.success) {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            select.innerHTML = '<option value="">Select Year</option>';
            
            // Get years from localStorage (panels created in admin)
            const localYears = getYearPanelsFromStorage();
            const dbYears = result.data || [];
            
            // Only show years that are in localStorage (created in admin)
            localYears.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                select.appendChild(option);
            });
            
            // Also add years from DB that might not be in localStorage
            dbYears.forEach(year => {
                if (!select.querySelector(`option[value="${year}"]`)) {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    select.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Error loading years:', error);
    }
}

async function loadEntries() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect || !yearSelect.value) {
        showNotification('Please select a year first!', 'error');
        return;
    }
    
    currentYear = yearSelect.value;
    
    try {
        const response = await fetch(`${API_URL}/entries?year=${currentYear}`);
        const result = await response.json();
        
        if (result.success) {
            const entries = result.data || [];
            // Store in yearData for PDF functions
            yearData[currentYear] = entries;
            renderHomeTable(entries);
            updateHomeSummary(entries);
        }
    } catch (error) {
        console.error('Error loading entries:', error);
        showNotification('Error loading entries. Make sure server is running!', 'error');
    }
}

async function renderHomeTable(entries) {
    const tableBody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const entryCount = document.getElementById('entryCount');
    
    if (!tableBody) return;
    
    if (entries.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (entryCount) entryCount.textContent = '0';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    if (entryCount) entryCount.textContent = entries.length.toString();
    
    let runningBalance = 0;
    const rowsHTML = entries.map((entry, index) => {
        runningBalance += entry.cash_in - entry.cash_out;
        
        return `
            <tr>
                <td style="text-align:center;font-weight:600">${index + 1}</td>
                <td>${entry.name}</td>
                <td>${formatDate(entry.date)}</td>
                <td style="text-align:center">${entry.mode}</td>
                <td style="text-align:right;color:#10b981;font-weight:600">${entry.cash_in > 0 ? formatPDFCurrency(entry.cash_in) : '-'}</td>
                <td style="text-align:right;color:#ef4444;font-weight:600">${entry.cash_out > 0 ? formatPDFCurrency(entry.cash_out) : '-'}</td>
                <td style="text-align:right;color:#8b5cf6;font-weight:600">${formatPDFCurrency(runningBalance)}</td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rowsHTML;
}

async function updateHomeSummary(entries) {
    let totalCashIn = 0;
    let totalCashOut = 0;
    
    entries.forEach(entry => {
        totalCashIn += entry.cash_in;
        totalCashOut += entry.cash_out;
    });
    
    const finalBalance = totalCashIn - totalCashOut;
    
    const totalCashInEl = document.getElementById('totalCashIn');
    const totalCashOutEl = document.getElementById('totalCashOut');
    const finalBalanceEl = document.getElementById('finalBalance');
    const finalBalanceBottomEl = document.getElementById('finalBalanceBottom');
    
    if (totalCashInEl) totalCashInEl.textContent = formatPDFCurrency(totalCashIn);
    if (totalCashOutEl) totalCashOutEl.textContent = formatPDFCurrency(totalCashOut);
    if (finalBalanceEl) finalBalanceEl.textContent = formatPDFCurrency(finalBalance);
    if (finalBalanceBottomEl) finalBalanceBottomEl.textContent = formatPDFCurrency(finalBalance);
}

async function loadAllEntries() {
    try {
        const response = await fetch(`${API_URL}/entries`);
        const result = await response.json();

        if (result.success) {
            yearData = {};

            result.data.forEach(entry => {
                const year = entry.date.split('-')[0];
                if (!yearData[year]) {
                    yearData[year] = [];
                }
                yearData[year].push(entry);
            });

            renderAllYearsPanel();

            Object.keys(yearData).forEach(year => {
                renderYearPanel(year, yearData[year]);
            });
        }
    } catch (error) {
        console.error('Error loading entries:', error);
        showNotification('Failed to load entries. Make sure server is running!', 'error');
    }
}

function renderAllYearsPanel() {
    const allEntries = [];
    Object.values(yearData).forEach(yearEntries => {
        allEntries.push(...yearEntries);
    });
    allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    yearData['all'] = allEntries;
    renderTable('all', allEntries);
    updateSummary('all', allEntries);
}

function renderYearPanel(year, entries) {
    if (!entries) return;
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    renderTable(year, entries);
    updateSummary(year, entries);
}

async function addEntryForYear(year) {
    const entry = {
        name: document.getElementById(`name-${year}`).value.trim(),
        date: document.getElementById(`date-${year}`).value,
        mode: document.getElementById(`mode-${year}`).value,
        cashIn: parseFloat(document.getElementById(`cashIn-${year}`).value) || 0,
        cashOut: parseFloat(document.getElementById(`cashOut-${year}`).value) || 0
    };

    if (!entry.name || !entry.date || !entry.mode) {
        showNotification('Please fill all required fields!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });

        const result = await response.json();

        if (result.success) {
            resetFormForYear(year);
            loadAllEntries();
            showNotification(`Entry added successfully for ${year}!`, 'success');
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding entry:', error);
        showNotification('Failed to add entry. Make sure server is running!', 'error');
    }
}

function resetFormForYear(year) {
    const nameInput = document.getElementById(`name-${year}`);
    const modeSelect = document.getElementById(`mode-${year}`);
    const cashInInput = document.getElementById(`cashIn-${year}`);
    const cashOutInput = document.getElementById(`cashOut-${year}`);
    const dateInput = document.getElementById(`date-${year}`);

    if (nameInput) nameInput.value = '';
    if (modeSelect) modeSelect.value = '';
    if (cashInInput) cashInInput.value = '';
    if (cashOutInput) cashOutInput.value = '';
    if (dateInput) dateInput.value = `${year}-01-01`;
}

async function deleteEntry(id, year) {
    try {
        const response = await fetch(`${API_URL}/entries/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadAllEntries();
            showNotification('Entry deleted successfully!', 'success');
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting entry:', error);
        showNotification('Failed to delete entry. Make sure server is running!', 'error');
    }
}

async function editEntry(id, year) {
    const entries = yearData[year] || [];
    const entry = entries.find(e => e.id == id);
    
    if (!entry) {
        showNotification('Entry not found! Make sure server is running.', 'error');
        return;
    }
    
    editingEntryId = id;
    editingYear = year;
    
    document.getElementById('editName').value = entry.name;
    document.getElementById('editDate').value = entry.date;
    document.getElementById('editMode').value = entry.mode;
    document.getElementById('editCashIn').value = entry.cash_in || '';
    document.getElementById('editCashOut').value = entry.cash_out || '';
    
    document.getElementById('editModal').classList.add('active');
}

window.closeEditModal = function() {
    document.getElementById('editModal').classList.remove('active');
    editingEntryId = null;
    editingYear = null;
    document.getElementById('editForm').reset();
};

// Password change functions
window.openChangePasswordModal = function() {
    document.getElementById('changePasswordModal').classList.add('active');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('passwordChangeError').style.display = 'none';
    document.getElementById('passwordChangeSuccess').style.display = 'none';
};

window.closeChangePasswordModal = function() {
    document.getElementById('changePasswordModal').classList.remove('active');
};

window.changePassword = function(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('passwordChangeError');
    const successDiv = document.getElementById('passwordChangeSuccess');

    // Get stored password from localStorage or use default
    const storedPassword = localStorage.getItem('adminPassword') || 'admin123';

    // Verify current password
    if (currentPassword !== storedPassword) {
        errorDiv.textContent = 'Current password is incorrect!';
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
        return;
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'New passwords do not match!';
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
        return;
    }

    // Validate new password length
    if (newPassword.length < 6) {
        errorDiv.textContent = 'New password must be at least 6 characters!';
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
        return;
    }

    // Save new password to localStorage
    localStorage.setItem('adminPassword', newPassword);

    // Update the password check in script.js (update the checkAdminLogin function reference)
    successDiv.textContent = 'Password changed successfully!';
    successDiv.style.display = 'block';
    errorDiv.style.display = 'none';

    setTimeout(() => {
        closeChangePasswordModal();
        showNotification('Password changed successfully!', 'success');
    }, 1500);
};

async function updateEntry(id, year) {
    const entry = {
        name: document.getElementById(`name-${year}`).value.trim(),
        date: document.getElementById(`date-${year}`).value,
        mode: document.getElementById(`mode-${year}`).value,
        cashIn: parseFloat(document.getElementById(`cashIn-${year}`).value) || 0,
        cashOut: parseFloat(document.getElementById(`cashOut-${year}`).value) || 0
    };
    
    if (!entry.name || !entry.date || !entry.mode) {
        showNotification('Please fill all required fields!', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/entries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
        
        const result = await response.json();
        
        if (result.success) {
            resetFormForYear(year);
            loadAllEntries();
            
            // Reset button
            const form = document.getElementById(`entryForm-${year}`);
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Add Entry';
                submitBtn.onclick = null;
            }
            
            showNotification('Entry updated successfully!', 'success');
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error updating entry:', error);
        showNotification('Failed to update entry. Make sure server is running!', 'error');
    }
}

async function clearYear(year) {
    if (!confirm(`Are you sure you want to delete all entries for ${year}?`)) {
        return;
    }

    try {
        const entries = yearData[year] || [];
        let deletedCount = 0;

        for (const entry of entries) {
            await fetch(`${API_URL}/entries/${entry.id}`, {
                method: 'DELETE'
            });
            deletedCount++;
        }

        if (deletedCount > 0) {
            loadAllEntries();
            showNotification(`All entries for ${year} cleared!`, 'success');
        } else {
            showNotification(`No entries to clear for ${year}!`, 'info');
        }
    } catch (error) {
        console.error('Error clearing entries:', error);
        showNotification('Failed to clear entries. Make sure server is running!', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span class="notification-message">${message}</span>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        z-index: 10000;
        animation: slideInRight 0.4s ease-out;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        ${type === 'success' ? 'background: linear-gradient(135deg, #10b981, #059669); color: white;' : ''}
        ${type === 'error' ? 'background: linear-gradient(135deg, #ef4444, #dc2626); color: white;' : ''}
        ${type === 'info' ? 'background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white;' : ''}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.4s ease-out';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

const styleNotif = document.createElement('style');
styleNotif.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(styleNotif);

const _tablePages = {};

function renderTable(year, entries) {
    const tbody = document.getElementById(`tableBody-${year}`);
    const emptyState = document.getElementById(`emptyState-${year}`);
    const entryCount = document.getElementById(`entryCount-${year}`);

    if (!tbody) return;

    tbody.innerHTML = '';

    if (entryCount) {
        entryCount.textContent = entries.length;
    }

    if (entries.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const isMobile = window.innerWidth <= 480;
    const perPage = isMobile ? 5 : entries.length;
    const totalPages = Math.ceil(entries.length / perPage);
    if (!_tablePages[year]) _tablePages[year] = 0;
    if (_tablePages[year] >= totalPages) _tablePages[year] = 0;
    const page = _tablePages[year];
    const start = page * perPage;
    const end = Math.min(start + perPage, entries.length);
    const pageEntries = entries.slice(start, end);

    let runningBalance = 0;
    for (let i = 0; i < start; i++) {
        runningBalance += entries[i].cash_in - entries[i].cash_out;
    }

    pageEntries.forEach((entry, idx) => {
        runningBalance += entry.cash_in - entry.cash_out;
        const index = start + idx;
        const row = document.createElement('tr');
        row.style.animationDelay = (idx * 0.05) + 's';

        const deleteBtn = year !== 'all'
            ? `<td><button class="btn btn-edit" onclick="editEntry(${entry.id}, '${year}')">Edit</button> <button class="btn btn-delete" onclick="deleteEntry(${entry.id}, '${year}')">Delete</button></td>`
            : '';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(entry.name)}</strong></td>
            <td>${formatDate(entry.date)}</td>
            <td><span class="mode-badge ${entry.mode === 'Online' ? 'mode-online' : 'mode-cash'}">${entry.mode}</span></td>
            <td class="cash-in">${entry.cash_in > 0 ? formatCurrency(entry.cash_in) : '-'}</td>
            <td class="cash-out">${entry.cash_out > 0 ? formatCurrency(entry.cash_out) : '-'}</td>
            <td class="balance">${formatCurrency(runningBalance)}</td>
            ${deleteBtn}
        `;
        tbody.appendChild(row);
    });

    // Mobile pagination controls
    const existingPagination = document.getElementById(`pagination-${year}`);
    if (existingPagination) existingPagination.remove();

    if (isMobile && totalPages > 1) {
        const pagDiv = document.createElement('div');
        pagDiv.id = `pagination-${year}`;
        pagDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0 4px;';
        pagDiv.innerHTML = `
            <button class="btn btn-secondary" onclick="changeTablePage('${year}', ${page - 1})" ${page === 0 ? 'disabled' : ''} style="padding:6px 14px;font-size:12px;border-radius:8px;">Previous</button>
            <span style="font-size:13px;color:#888;">${page + 1}/${totalPages}</span>
            <button class="btn btn-secondary" onclick="changeTablePage('${year}', ${page + 1})" ${page >= totalPages - 1 ? 'disabled' : ''} style="padding:6px 14px;font-size:12px;border-radius:8px;">Next</button>
        `;
        tbody.parentElement.after(pagDiv);
    }
}

function changeTablePage(year, page) {
    _tablePages[year] = page;
    const entries = yearData[year] || [];
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    renderTable(year, entries);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateSummary(year, entries) {
    let totalCashIn = 0;
    let totalCashOut = 0;

    entries.forEach(entry => {
        totalCashIn += entry.cash_in;
        totalCashOut += entry.cash_out;
    });

    const finalBalance = totalCashIn - totalCashOut;

    animateValue(`totalCashIn-${year}`, totalCashIn, formatCurrency);
    animateValue(`totalCashOut-${year}`, totalCashOut, formatCurrency);
    animateValue(`finalBalance-${year}`, finalBalance, formatCurrency);

    if (year === 'all') {
        const finalBalanceBottom = document.getElementById('finalBalanceBottom-all');
        if (finalBalanceBottom) {
            finalBalanceBottom.textContent = formatCurrency(finalBalance);
        }
    }
}

function animateValue(elementId, targetValue, formatter) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = formatter(targetValue);
    element.style.animation = 'none';
    element.offsetHeight;
    element.style.animation = 'count-up 0.5s ease-out';
}

function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPDFCurrency(amount) {
    const formatted = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return 'Rs. ' + formatted;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function viewPDF() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect || !yearSelect.value) {
        showNotification('Please select a year first!', 'error');
        return;
    }
    
    const year = yearSelect.value;
    
    // Load entries if not already loaded
    if (!yearData[year] || yearData[year].length === 0) {
        try {
            const response = await fetch(`${API_URL}/entries?year=${year}`);
            const result = await response.json();
            if (result.success) {
                yearData[year] = result.data || [];
            }
        } catch (error) {
            showNotification('Error loading entries. Make sure server is running!', 'error');
            return;
        }
    }
    
    await viewPDFForYear(year);
}

async function downloadPDF() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect || !yearSelect.value) {
        showNotification('Please select a year first!', 'error');
        return;
    }
    
    const year = yearSelect.value;
    
    // Load entries if not already loaded
    if (!yearData[year] || yearData[year].length === 0) {
        try {
            const response = await fetch(`${API_URL}/entries?year=${year}`);
            const result = await response.json();
            if (result.success) {
                yearData[year] = result.data || [];
            }
        } catch (error) {
            showNotification('Error loading entries. Make sure server is running!', 'error');
            return;
        }
    }
    
    await downloadPDFForYear(year);
}

window.downloadPDFForYear = async function(year) {
    let entries, yearLabel;

    if (year === 'all') {
        entries = [];
        Object.values(yearData).forEach(yearEntries => {
            entries.push(...yearEntries);
        });
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        yearLabel = 'All';
    } else {
        entries = yearData[year] || [];
        yearLabel = year;
    }

    if (entries.length === 0) {
        showNotification(`No entries found for ${yearLabel}!`, 'info');
        return;
    }

    const htmlContent = await generatePDFForYear(entries, yearLabel);
    
    // Use html2canvas + jsPDF for download
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '210mm';
    document.body.appendChild(tempDiv);
    
    try {
        // Wait for logo image to load
        const logoImg = tempDiv.querySelector('img.logo');
        if (logoImg) {
            await new Promise((resolve) => {
                if (logoImg.complete) {
                    resolve();
                } else {
                    logoImg.onload = resolve;
                    logoImg.onerror = resolve;
                    setTimeout(resolve, 2000); // Timeout after 2 seconds
                }
            });
        }
        
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            allowTaint: true
        });
        
        document.body.removeChild(tempDiv);
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;
        
        doc.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
        while (heightLeft > 0) {
            position = height - imgHeight + 10;
            doc.addPage();
            doc.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= doc.internal.pageSize.getHeight();
        }
        
        doc.save(`Ganpati_Cashbook_Shivsrushti_${yearLabel}.pdf`);
        showNotification(`Cashbook for ${yearLabel} downloaded successfully!`, 'success');
    } catch (error) {
        if (tempDiv.parentNode) {
            document.body.removeChild(tempDiv);
        }
        console.error('PDF download error:', error);
        showNotification('Error generating PDF. Try "View PDF" instead.', 'error');
    }
}

window.viewPDFForYear = async function(year) {
    let entries, yearLabel;

    if (year === 'all') {
        entries = [];
        Object.values(yearData).forEach(yearEntries => {
            entries.push(...yearEntries);
        });
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        yearLabel = 'All';
    } else {
        entries = yearData[year] || [];
        yearLabel = year;
    }

    if (entries.length === 0) {
        showNotification(`No entries found for ${yearLabel}!`, 'info');
        return;
    }

    const htmlContent = await generatePDFForYear(entries, yearLabel);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for fonts to load before printing
    printWindow.document.fonts.ready.then(() => {
        setTimeout(() => {
            printWindow.print();
        }, 300);
    }).catch(() => {
        // Fallback if fonts.ready is not supported
        setTimeout(() => {
            printWindow.print();
        }, 1000);
    });
}

async function generatePDFForYear(entries, yearLabel) {
    let totalCashIn = 0;
    let totalCashOut = 0;
    let runningBalance = 0;
    
    const tableRows = entries.map((entry, index) => {
        runningBalance += entry.cash_in - entry.cash_out;
        totalCashIn += entry.cash_in;
        totalCashOut += entry.cash_out;
        
        return {
            index: index + 1,
            name: entry.name,
            date: formatDate(entry.date),
            mode: entry.mode,
            cashIn: entry.cash_in > 0 ? formatPDFCurrency(entry.cash_in) : '-',
            cashOut: entry.cash_out > 0 ? formatPDFCurrency(entry.cash_out) : '-',
            balance: formatPDFCurrency(runningBalance)
        };
    });
    
    const finalBalance = totalCashIn - totalCashOut;
    
    // Load logo as data URL
    let logoDataURL = '';
    try {
        logoDataURL = await loadLogo();
    } catch (e) {
        console.warn('Logo not loaded:', e);
    }
    
    // Return HTML content for PDF
    return createPDFHTML(tableRows, yearLabel, totalCashIn, totalCashOut, finalBalance, logoDataURL);
}

function createPDFHTML(rows, yearLabel, totalCashIn, totalCashOut, finalBalance, logoDataURL) {
    const rowsHTML = rows.map((row, idx) => `
        <tr>
            <td class="sr-no">${row.index}</td>
            <td class="remark">${row.name}</td>
            <td class="date">${row.date}</td>
            <td class="mode ${row.mode === 'Online' ? 'online' : 'cash'}">${row.mode}</td>
            <td class="cash-in-cell">${row.cashIn}</td>
            <td class="cash-out-cell">${row.cashOut}</td>
            <td class="balance-cell">${row.balance}</td>
        </tr>
    `).join('');
    
    const logoSrc = logoDataURL || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🙏</text></svg>';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@300;400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            @page { margin: 0; size: A4; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Poppins', 'Noto Sans Devanagari', sans-serif;
                background: #f5f0eb;
                color: #1a1a2e;
                font-size: 10px;
                line-height: 1.4;
            }

            /* ====== COVER PAGE ====== */
            .cover-page {
                width: 210mm;
                height: 297mm;
                background: linear-gradient(160deg, #1a0800 0%, #3d1508 25%, #5a2010 50%, #3d1508 75%, #1a0800 100%);
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                page-break-after: always;
            }
            .cover-page::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(ellipse at 30% 20%, rgba(255,140,0,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(255,215,0,0.1) 0%, transparent 50%);
                pointer-events: none;
            }
            .cover-outer-border {
                position: absolute;
                top: 8mm; left: 8mm; right: 8mm; bottom: 8mm;
                border: 5px solid #ff8c00;
                border-radius: 25px;
                box-shadow: 0 0 30px rgba(255,140,0,0.3), inset 0 0 30px rgba(255,140,0,0.1);
            }
            .cover-inner-border {
                position: absolute;
                top: 11mm; left: 11mm; right: 11mm; bottom: 11mm;
                border: 3px solid rgba(255,215,0,0.4);
                border-radius: 20px;
            }
            .cover-corner { position: absolute; width: 60px; height: 60px; border: 5px solid #ffd700; }
            .cover-corner.tl { top: 14mm; left: 14mm; border-right: none; border-bottom: none; border-radius: 15px 0 0 0; }
            .cover-corner.tr { top: 14mm; right: 14mm; border-left: none; border-bottom: none; border-radius: 0 15px 0 0; }
            .cover-corner.bl { bottom: 14mm; left: 14mm; border-right: none; border-top: none; border-radius: 0 0 0 15px; }
            .cover-corner.br { bottom: 14mm; right: 14mm; border-left: none; border-top: none; border-radius: 0 0 15px 0; }
            .cover-content {
                position: relative;
                z-index: 10;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 30px;
                margin-top: -40px;
            }
            .cover-om-top {
                font-size: 32px;
                color: #ffd700;
                margin-bottom: 35px;
                text-shadow: 0 0 40px rgba(255,215,0,0.8), 0 0 80px rgba(255,215,0,0.4);
                font-weight: bold;
            }
            .cover-logo-wrap {
                width: 280px;
                height: 280px;
                position: relative;
                margin-bottom: 25px;
            }
            .cover-logo-glow {
                position: absolute;
                top: -30px; left: -30px; right: -30px; bottom: -30px;
                background: radial-gradient(circle, rgba(255,140,0,0.7) 0%, rgba(255,140,0,0.3) 40%, transparent 70%);
                border-radius: 50%;
            }
            .cover-logo-ring {
                position: absolute;
                top: -15px; left: -15px; right: -15px; bottom: -15px;
                border: 6px solid rgba(255,215,0,0.7);
                border-radius: 50%;
            }
            .cover-logo-ring2 {
                position: absolute;
                top: -25px; left: -25px; right: -25px; bottom: -25px;
                border: 4px solid rgba(255,215,0,0.3);
                border-radius: 50%;
            }
            .cover-logo {
                width: 100%;
                height: 100%;
                object-fit: contain;
                border-radius: 50%;
                border: 8px solid #ffd700;
                background: rgba(255,255,255,0.98);
                padding: 12px;
                box-shadow: 0 0 100px rgba(255,140,0,1), 0 0 200px rgba(255,140,0,0.4), 0 20px 60px rgba(0,0,0,0.8);
                position: relative;
                z-index: 2;
            }
            .cover-mandal-name {
                font-size: 36px;
                font-weight: 900;
                color: #ffd700;
                text-align: center;
                letter-spacing: 2px;
                text-shadow: 0 0 30px rgba(255,215,0,0.6), 0 3px 10px rgba(0,0,0,0.7);
                line-height: 1.4;
                border-left: 6px solid #dc2626;
                border-right: 6px solid #dc2626;
                padding: 10px 35px;
                margin-top: 10px;
            }
            .cover-divider {
                width: 280px;
                height: 4px;
                background: linear-gradient(90deg, transparent, #ffd700, #ff8c00, #ffd700, transparent);
                margin: 18px auto;
                border-radius: 3px;
                box-shadow: 0 0 15px rgba(255,215,0,0.4);
            }
            .cover-subtitle {
                font-size: 24px;
                font-weight: 700;
                color: #ff8c00;
                text-align: center;
                letter-spacing: 4px;
                margin-bottom: 8px;
                text-shadow: 0 0 20px rgba(255,140,0,0.5);
            }
            .cover-tagline {
                font-size: 15px;
                color: #d4b896;
                text-align: center;
                letter-spacing: 1.5px;
                font-weight: 500;
            }
            .cover-year-box {
                margin-top: 30px;
                padding: 15px 50px;
                border: 3px solid #ffd700;
                border-radius: 35px;
                background: linear-gradient(135deg, rgba(255,140,0,0.15), rgba(255,215,0,0.1));
                text-align: center;
                box-shadow: 0 0 30px rgba(255,215,0,0.2);
            }
            .cover-year-label {
                font-size: 14px;
                color: #d4b896;
                display: block;
                margin-bottom: 5px;
                letter-spacing: 1px;
            }
            .cover-year-val {
                font-size: 30px;
                font-weight: 800;
                color: #ffd700;
                text-shadow: 0 0 25px rgba(255,215,0,0.5);
            }
            .cover-footer {
                position: absolute;
                bottom: 15mm;
                left: 0; right: 0;
                text-align: center;
                z-index: 10;
            }
            .cover-footer-om {
                font-size: 20px;
                color: #ffd700;
                margin-bottom: 8px;
                letter-spacing: 3px;
            }
            .cover-footer p {
                font-size: 10px;
                color: #8b7355;
                letter-spacing: 1.5px;
                line-height: 1.6;
            }

            /* ====== INNER PAGES ====== */
            .inner-page {
                width: 210mm;
                min-height: 297mm;
                background: #fefcf9;
                page-break-after: always;
                position: relative;
            }
            .page-header-bar {
                background: linear-gradient(135deg, #b8860b 0%, #d4a017 40%, #b8860b 100%);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px 15px;
                min-height: 85px;
            }
            .page-header-bar::after {
                content: '';
                position: absolute;
                bottom: 0; left: 0; right: 0;
                height: 5px;
                background: linear-gradient(90deg, #b8860b, #d4a017, #b8860b);
            }
            .header-logo-box {
                position: absolute;
                left: 15px;
                top: 50%;
                transform: translateY(-50%);
                width: 72px;
                height: 72px;
                border-radius: 50%;
                border: 3px solid #ffffff;
                background: #ffffff;
                padding: 3px;
                box-shadow: 0 0 20px rgba(255,255,255,0.3), 0 4px 15px rgba(0,0,0,0.4);
                z-index: 5;
            }
            .header-logo-box img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                border-radius: 50%;
                display: block;
            }
            .header-info {
                text-align: center;
            }
            .header-info h1 {
                font-size: 18px;
                font-weight: 900;
                color: #ffffff;
                letter-spacing: 1px;
                text-shadow: 0 2px 6px rgba(0,0,0,0.2);
                margin: 0;
                line-height: 1.3;
            }
            .header-info p {
                font-size: 11px;
                color: #ffffff;
                margin: 4px 0 0;
                font-weight: 600;
            }

            .page-body {
                padding: 18px 15px 15px;
            }

            /* Summary */
            .summary-section {
                margin-bottom: 16px;
            }
            .summary-title {
                font-size: 11px;
                font-weight: 800;
                color: #5a2010;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 10px;
            }
            .summary-title::after {
                content: '';
                display: block;
                width: 70px;
                height: 3px;
                background: linear-gradient(90deg, #ff8c00, #ffd700);
                margin: 5px auto 0;
                border-radius: 2px;
            }
            .summary-row {
                display: flex;
                gap: 10px;
            }
            .sum-card {
                flex: 1;
                padding: 12px 10px;
                border-radius: 10px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            .sum-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 4px;
            }
            .sum-card.green {
                background: linear-gradient(135deg, #f0fdf4, #dcfce7);
                border: 2px solid #86efac;
            }
            .sum-card.green::before { background: linear-gradient(90deg, #22c55e, #16a34a); }
            .sum-card.red {
                background: linear-gradient(135deg, #fef2f2, #fee2e2);
                border: 2px solid #fca5a5;
            }
            .sum-card.red::before { background: linear-gradient(90deg, #ef4444, #dc2626); }
            .sum-card.purple {
                background: linear-gradient(135deg, #faf5ff, #f3e8ff);
                border: 2px solid #d8b4fe;
            }
            .sum-card.purple::before { background: linear-gradient(90deg, #a855f7, #9333ea); }
            .sum-card h4 {
                font-size: 8px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #888;
                margin: 0 0 6px;
            }
            .sum-card .val {
                font-size: 16px;
                font-weight: 900;
            }
            .sum-card.green .val { color: #16a34a; }
            .sum-card.red .val { color: #dc2626; }
            .sum-card.purple .val { color: #9333ea; }

            /* Table */
            .table-section { margin-top: 12px; }
            .table-heading {
                font-size: 11px;
                font-weight: 800;
                color: #5a2010;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 10px;
                padding-left: 14px;
                position: relative;
            }
            .table-heading::before {
                content: '';
                position: absolute;
                left: 0; top: 50%;
                transform: translateY(-50%);
                width: 8px; height: 8px;
                background: #ff8c00;
                border-radius: 50%;
            }
            .table-heading::after {
                content: '';
                display: block;
                width: 50px; height: 3px;
                background: linear-gradient(90deg, #ff8c00, #ffd700);
                margin-top: 5px;
                border-radius: 2px;
            }
            .data-table {
                width: 100%;
                border-collapse: collapse;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 3px 15px rgba(0,0,0,0.1);
                border: 2px solid #cccccc;
            }
            .data-table thead {
                background: #ffffff;
            }
            .data-table th {
                color: #444444;
                padding: 12px 10px;
                font-size: 13px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border: 1px solid #cccccc;
                text-align: left;
            }
            .data-table th:last-child { border-right: none; }
            .data-table th.right-align { text-align: right; }
            .data-table td {
                padding: 10px;
                font-size: 13px;
                border: 1px solid #cccccc;
            }
            .data-table tbody tr:nth-child(odd) { background: #ffffff; }
            .data-table tbody tr:nth-child(even) { background: #fafafa; }
            .data-table .sr-no { text-align: center; font-weight: 800; color: #444444; width: 7%; }
            .data-table .remark { font-weight: 700; color: #444444; width: 30%; }
            .data-table .date { color: #444444; font-weight: 600; width: 14%; }
            .data-table .mode { text-align: center; font-weight: 700; width: 9%; color: #444444; }
            .data-table .cash-in-cell { text-align: right; font-weight: 800; color: #444444; width: 13%; }
            .data-table .cash-out-cell { text-align: right; font-weight: 800; color: #444444; width: 13%; }
            .data-table .balance-cell { text-align: right; font-weight: 900; color: #444444; width: 14%; }

            /* Footer */
            .page-footer {
                margin-top: 15px;
                text-align: center;
            }
            .page-footer .org {
                font-size: 16px;
                font-weight: 800;
                color: #1e293b;
                margin-bottom: 8px;
            }
            .page-footer .dev {
                font-size: 13px;
                color: #475569;
                font-weight: 600;
            }
            .page-footer .dt {
                font-size: 11px;
                color: #64748b;
                margin-top: 5px;
            }
        </style>
    </head>
    <body>
        <!-- COVER PAGE -->
        <div class="cover-page">
            <div class="cover-outer-border"></div>
            <div class="cover-inner-border"></div>
            <div class="cover-corner tl"></div>
            <div class="cover-corner tr"></div>
            <div class="cover-corner bl"></div>
            <div class="cover-corner br"></div>
            <div class="cover-content">
                <div class="cover-om-top">|| हर हर महादेव 🔱 ||</div>
                <div class="cover-logo-wrap">
                    <div class="cover-logo-glow"></div>
                    <div class="cover-logo-ring"></div>
                    <div class="cover-logo-ring2"></div>
                    <img src="${logoSrc}" alt="Logo" class="cover-logo" onerror="this.style.display='none'">
                </div>
                <div class="cover-mandal-name">${getPDFSettings(yearLabel).orgName}</div>
                <div class="cover-divider"></div>
                <div class="cover-subtitle">${getPDFSettings(yearLabel).subtitle}</div>
                <div class="cover-tagline">${getPDFSettings(yearLabel).tagline}</div>
                <div class="cover-year-box">
                    <span class="cover-year-label">वर्ष / Year</span>
                    <span class="cover-year-val">${yearLabel}</span>
                </div>
            </div>
            <div class="cover-footer">
                <div class="cover-footer-om">ॐ गण गणपतये नमः</div>
                <p>Developed by | Dhananjay Ranate</p>
            </div>
        </div>

        <!-- INNER PAGE -->
        <div class="inner-page">
            <div class="page-header-bar">
                <div class="header-logo-box">
                    <img src="${logoSrc}" alt="Logo" onerror="this.style.display='none'">
                </div>
                <div class="header-info">
                    <h1>${(getPDFSettings(yearLabel).headerOrgName || getPDFSettings(yearLabel).orgName)} 🚩</h1>
                    <p>${(getPDFSettings(yearLabel).headerSubtitle || getPDFSettings(yearLabel).subtitle)} — वर्ष: ${yearLabel}</p>
                </div>
            </div>

            <div class="page-body">
                <div class="summary-section">
                    <div class="summary-title">Financial Summary</div>
                    <div class="summary-row">
                        <div class="sum-card green">
                            <h4>Total Cash In (+)</h4>
                            <div class="val">${formatPDFCurrency(totalCashIn)}</div>
                        </div>
                        <div class="sum-card red">
                            <h4>Total Cash Out (-)</h4>
                            <div class="val">${formatPDFCurrency(totalCashOut)}</div>
                        </div>
                        <div class="sum-card purple">
                            <h4>Final Balance</h4>
                            <div class="val">${formatPDFCurrency(finalBalance)}</div>
                        </div>
                    </div>
                </div>

                <div class="table-section">
                    <div class="table-heading">Transaction Records</div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="sr-no">#</th>
                                <th class="remark">Remark</th>
                                <th class="date">Date</th>
                                <th class="mode">Mode</th>
                                <th class="right-align">Cash In (+)</th>
                                <th class="right-align">Cash Out (-)</th>
                                <th class="right-align">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                    <div style="height:1.5px;background:linear-gradient(90deg,#ff8c00,#ffd700,#ff8c00);margin:12px 0 8px 0;border-radius:2px;"></div>
                </div>

                <div class="page-footer">
                    <div class="org">|| हर हर महादेव 🔱 ||</div>
                    <div class="org">${getPDFSettings(yearLabel).orgName} 🚩</div>
                    <div class="dev">Developed by | Dhananjay Ranate</div>
                    <div class="dt">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}
