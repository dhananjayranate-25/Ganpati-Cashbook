const API_URL = 'http://localhost:3002/api';

let currentPage = 'home';
let yearData = {};
let yearPanels = {};
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

function createCustomYearPanel() {
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

async function deleteCustomYearPanel() {
    const yearInput = document.getElementById('customYearInput');
    if (!yearInput) return;

    const year = yearInput.value.trim();

    if (!year) {
        showNotification('Please enter a year to delete!', 'error');
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

async function deleteAllPanels() {
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

    panel.innerHTML = `
        <div class="form-container" style="animation-delay: 0.2s">
            <div class="section-header">
                <div class="header-line"></div>
                <h2>Panel ${year}</h2>
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
                    <button type="submit" class="btn btn-primary ripple">
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

        <div class="actions-bar" style="margin-bottom: 20px;">
            <button class="btn btn-pdf ripple" onclick="viewPDFForYear('${year}')">
                <span class="btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </span>
                View ${year} PDF
            </button>
            <button class="btn btn-download ripple" onclick="downloadPDFForYear('${year}')">
                <span class="btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                </span>
                Download ${year} PDF
            </button>
            <button class="btn btn-clear ripple" onclick="clearYear('${year}')">
                <span class="btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </span>
                Clear ${year} Data
            </button>
        </div>

        <div class="summary-cards">
            <div class="card card-cash-in">
                <div class="card-shimmer"></div>
                <div class="card-glass">
                    <div class="card-header">
                        <div class="card-icon-wrapper icon-green">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                        </div>
                        <h3>Total Cash In</h3>
                    </div>
                    <p class="amount animate-count" id="totalCashIn-${year}">₹0.00</p>
                </div>
            </div>
            <div class="card card-cash-out">
                <div class="card-shimmer"></div>
                <div class="card-glass">
                    <div class="card-header">
                        <div class="card-icon-wrapper icon-red">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                        </div>
                        <h3>Total Cash Out</h3>
                    </div>
                    <p class="amount animate-count" id="totalCashOut-${year}">₹0.00</p>
                </div>
            </div>
            <div class="card card-balance">
                <div class="card-shimmer"></div>
                <div class="card-glass">
                    <div class="card-header">
                        <div class="card-icon-wrapper icon-purple">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                        </div>
                        <h3>Final Balance</h3>
                    </div>
                    <p class="amount animate-count" id="finalBalance-${year}">₹0.00</p>
                </div>
            </div>
        </div>

        <div class="table-container">
            <div class="table-header">
                <h2>${year} Transaction Records</h2>
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
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            addEntryForYear(year);
        });
    }

    const dateInput = panel.querySelector(`#date-${year}`);
    if (dateInput) {
        dateInput.value = `${year}-01-01`;
    }

    yearPanels[year] = panel;
    return panel;
}

function switchYearTab(year) {
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

    let runningBalance = 0;

    entries.forEach((entry, index) => {
        runningBalance += entry.cash_in - entry.cash_out;

        const row = document.createElement('tr');
        row.style.animationDelay = (index * 0.05) + 's';

        const deleteBtn = year !== 'all'
            ? `<td><button class="btn-delete" onclick="deleteEntry(${entry.id}, '${year}')">Delete</button></td>`
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

async function downloadPDFForYear(year) {
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
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
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
        heightLeft -= doc.internal.pageSize.getHeight();
        
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= doc.internal.pageSize.getHeight();
        }
        
        doc.save(`Ganpati_Cashbook_Shivsrushti_${yearLabel}.pdf`);
        showNotification(`Cashbook for ${yearLabel} downloaded successfully!`, 'success');
    } catch (error) {
        document.body.removeChild(tempDiv);
        console.error('PDF download error:', error);
        showNotification('Error generating PDF. Try "View PDF" instead.', 'error');
    }
}

async function viewPDFForYear(year) {
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
    
    // Return HTML content for PDF
    return createPDFHTML(tableRows, yearLabel, totalCashIn, totalCashOut, finalBalance);
}

function createPDFHTML(rows, yearLabel, totalCashIn, totalCashOut, finalBalance) {
    const rowsHTML = rows.map((row, idx) => `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8f9fa'}">
            <td style="width:5%;border:1px solid #dee2e6;padding:8px;text-align:center">${row.index}</td>
            <td style="width:30%;border:1px solid #dee2e6;padding:8px">${row.name}</td>
            <td style="width:15%;border:1px solid #dee2e6;padding:8px">${row.date}</td>
            <td style="width:10%;border:1px solid #dee2e6;padding:8px;text-align:center">${row.mode}</td>
            <td style="width:15%;border:1px solid #dee2e6;padding:8px;text-align:right;color:#10b981;font-weight:600">${row.cashIn}</td>
            <td style="width:15%;border:1px solid #dee2e6;padding:8px;text-align:right;color:#ef4444;font-weight:600">${row.cashOut}</td>
            <td style="width:15%;border:1px solid #dee2e6;padding:8px;text-align:right;color:#8b5cf6;font-weight:600">${row.balance}</td>
        </tr>
    `).join('');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            @page { margin: 15mm; }
            body {
                font-family: 'Noto Sans Devanagari', 'Poppins', sans-serif;
                margin: 0;
                padding: 0;
                background: white;
                color: #1a1a3e;
                font-size: 12px;
            }
            .header {
                background: linear-gradient(135deg, #1a1a3e 0%, #2d2d5e 100%);
                color: #f97316;
                padding: 25px 20px;
                text-align: center;
                margin-bottom: 25px;
                border-radius: 8px;
                border: 2px solid #f97316;
                box-shadow: 0 4px 15px rgba(249, 115, 22, 0.2);
            }
            .header h1 {
                margin: 0;
                font-size: 26px;
                font-weight: 700;
                letter-spacing: 1px;
            }
            .header p {
                margin: 8px 0 0;
                color: #ffffff;
                font-size: 14px;
                opacity: 0.9;
            }
            .summary {
                display: flex;
                justify-content: space-between;
                margin-bottom: 25px;
                gap: 15px;
            }
            .summary-box {
                flex: 1;
                padding: 15px;
                background: white;
                border: 2px solid #dee2e6;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }
            .summary-box h3 {
                margin: 0 0 8px;
                font-size: 10px;
                color: #6c757d;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .summary-box .value {
                font-size: 16px;
                font-weight: 700;
            }
            .green { color: #10b981; }
            .red { color: #ef4444; }
            .purple { color: #8b5cf6; }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 11px;
                border: 2px solid #dee2e6;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            }
            thead tr {
                background: linear-gradient(135deg, #1a1a3e 0%, #2d2d5e 100%);
            }
            th {
                color: white;
                padding: 12px 10px;
                text-align: left;
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border: 1px solid #1a1a3e;
            }
            th:nth-child(5), th:nth-child(6), th:nth-child(7) {
                text-align: right;
            }
            td {
                padding: 8px 10px;
            }
            .footer {
                margin-top: 40px;
                padding: 20px;
                border-top: 3px solid #f97316;
                text-align: center;
                font-size: 11px;
                color: #666;
                background: #fdf9f5;
                border-radius: 0 0 8px 8px;
            }
            .footer p { margin: 5px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>गणेश उत्सव कॅशबुक</h1>
            <p>Shivsrushti Hindu Tarun Mitra Mandal - वर्ष: ${yearLabel}</p>
        </div>
        
        <div class="summary">
            <div class="summary-box">
                <h3>Total Cash In (+)</h3>
                <div class="value green">${formatPDFCurrency(totalCashIn)}</div>
            </div>
            <div class="summary-box">
                <h3>Total Cash Out (-)</h3>
                <div class="value red">${formatPDFCurrency(totalCashOut)}</div>
            </div>
            <div class="summary-box">
                <h3>Final Balance</h3>
                <div class="value purple">${formatPDFCurrency(finalBalance)}</div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th style="width:5%">#</th>
                    <th style="width:30%">Remark</th>
                    <th style="width:15%">Date</th>
                    <th style="width:10%">Mode</th>
                    <th style="width:15%;text-align:right">Cash In (+)</th>
                    <th style="width:15%;text-align:right">Cash Out (-)</th>
                    <th style="width:15%;text-align:right">Balance</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
        
        <div class="footer">
            <p><strong>Shivsrushti Hindu Tarun Mitra Mandal - Ganpati Cashbook</strong></p>
            <p>All amounts are in Indian Rupees (₹)</p>
            <p style="font-size:10px;margin-top:10px">Generated on ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
    </body>
    </html>
    `;
}
