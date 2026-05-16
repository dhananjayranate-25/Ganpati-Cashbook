const API_URL = 'http://localhost:3002/api';

let currentPage = 'home';
let yearData = {};
let yearPanels = {};

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

function deleteAllPanels() {

async function createCustomYearPanel() {
    const yearInput = document.getElementById('customYearInput');
    if (!yearInput) return;

    const year = yearInput.value.trim();

    if (!year || year < 2021 || year > 2050) {
        showNotification('Please enter a valid year between 2021 and 2050!', 'error');
        return;
    }

    const yearStr = year.toString();

    const yearTabs = document.getElementById('yearTabs');
    const yearPanelsContainer = document.getElementById('yearPanels');

    if (!yearTabs || !yearPanelsContainer) return;

    const existingTab = yearTabs.querySelector(`button[data-year="${yearStr}"]`);
    if (existingTab) {
        switchYearTab(yearStr);
        showNotification(`Panel for ${yearStr} already exists! Switched to it.`, 'info');
        return;
    }

    const tab = document.createElement('button');
    tab.className = 'year-tab';
    tab.setAttribute('data-year', yearStr);
    tab.textContent = yearStr;
    tab.onclick = () => switchYearTab(yearStr);
    yearTabs.appendChild(tab);

    const panel = createYearPanel(yearStr);
    yearPanelsContainer.appendChild(panel);

    switchYearTab(yearStr);
    showNotification(`Panel for ${yearStr} created successfully!`, 'success');
}

async function deleteCustomYearPanel() {
    const yearInput = document.getElementById('customYearInput');
    if (!yearInput) return;

    const year = yearInput.value.trim();

    if (!year) {
        showNotification('Please enter a year to delete!', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete the panel for ${year}?`)) {
        return;
    }

    const yearTabs = document.getElementById('yearTabs');
    const yearPanelsContainer = document.getElementById('yearPanels');

    if (!yearTabs || !yearPanelsContainer) return;

    const tab = yearTabs.querySelector(`button[data-year="${year}"]`);
    const panel = document.getElementById(`panel-${year}`);

    if (!tab && !panel) {
        showNotification(`No panel found for ${year}!`, 'info');
        return;
    }

    if (tab) tab.remove();
    if (panel) panel.remove();

    if (yearPanels[year]) {
        delete yearPanels[year];
    }

    switchYearTab('all');
    showNotification(`Panel for ${year} deleted successfully!`, 'success');
}
    if (!confirm('Are you sure you want to delete ALL custom panels? This will NOT delete data, only remove panels from view.')) {
        return;
    }

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
    switchYearTab('all');
    showNotification('All panels deleted successfully! Data is still safe in database.', 'success');
}

async function loadYearsForAdmin() {
    try {
        const response = await fetch(`${API_URL}/years`);
        const result = await response.json();

        if (result.success) {
            const yearTabs = document.getElementById('yearTabs');
            const yearPanelsContainer = document.getElementById('yearPanels');

            yearTabs.innerHTML = '<button class="year-tab active" data-year="all" onclick="switchYearTab(\'all\')">All Years</button>';
            yearPanelsContainer.innerHTML = '';

            const startYear = 2021;
            const endYear = 2030;

            for (let year = endYear; year >= startYear; year--) {
                const yearStr = year.toString();

                const tab = document.createElement('button');
                tab.className = 'year-tab';
                tab.setAttribute('data-year', yearStr);
                tab.textContent = yearStr;
                tab.onclick = () => switchYearTab(yearStr);
                yearTabs.appendChild(tab);

                const panel = createYearPanel(yearStr);
                yearPanelsContainer.appendChild(panel);
            }

            loadAllEntries();
        }
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
                <h2>Add Entry for ${year}</h2>
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
                        Add Entry for ${year}
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

            const startYear = 2021;
            const endYear = 2030;

            for (let year = endYear; year >= startYear; year--) {
                const option = document.createElement('option');
                option.value = year.toString();
                option.textContent = year.toString();
                select.appendChild(option);
            }

            result.data.forEach(year => {
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

function viewPDFForYear(year) {
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

    const doc = generatePDFForYear(entries, yearLabel);
    const pdfBlob = doc.output('blob');
    const pdfURL = URL.createObjectURL(pdfBlob);
    window.open(pdfURL, '_blank');
}

function downloadPDFForYear(year) {
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

    const doc = generatePDFForYear(entries, yearLabel);
    doc.save(`Ganpati_Cashbook_Shivsrushti_${yearLabel}.pdf`);
    showNotification(`Cashbook for ${yearLabel} downloaded successfully!`, 'success');
}

function generatePDFForYear(entries, yearLabel) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;

    let totalCashIn = 0;
    let totalCashOut = 0;
    let runningBalance = 0;

    const tableData = entries.map((entry, index) => {
        runningBalance += entry.cash_in - entry.cash_out;
        totalCashIn += entry.cash_in;
        totalCashOut += entry.cash_out;

        return [
            index + 1,
            entry.name,
            formatDate(entry.date),
            entry.mode,
            entry.cash_in > 0 ? formatPDFCurrency(entry.cash_in) : '-',
            entry.cash_out > 0 ? formatPDFCurrency(entry.cash_out) : '-',
            formatPDFCurrency(runningBalance)
        ];
    });

    const finalBalance = totalCashIn - totalCashOut;

    return generatePDFDocument(doc, tableData, yearLabel, totalCashIn, totalCashOut, finalBalance, pageWidth, pageHeight, margin, contentWidth);
}

function generatePDFDocument(doc, tableData, yearLabel, totalCashIn, totalCashOut, finalBalance, pageWidth, pageHeight, margin, contentWidth) {
    const C = {
        orange: [230, 81, 0],
        orangeDark: [200, 60, 0],
        orangeLight: [255, 145, 0],
        navy: [20, 25, 60],
        navyMid: [30, 40, 85],
        white: [255, 255, 255],
        bgWarm: [253, 249, 245],
        bgRow: [255, 252, 248],
        textDark: [30, 30, 30],
        textMid: [80, 80, 80],
        textLight: [140, 140, 140],
        green: [16, 185, 129],
        greenDark: [5, 150, 105],
        greenBg: [209, 250, 229],
        red: [220, 50, 50],
        redDark: [185, 28, 28],
        redBg: [254, 226, 226],
        purple: [120, 70, 210],
        gold: [200, 150, 30],
        line: [220, 210, 200],
        lineLight: [235, 228, 220]
    };

    function addCoverHeader(doc) {
        doc.setFillColor(C.navy[0], C.navy[1], C.navy[2]);
        doc.rect(0, 0, pageWidth, 30, 'F');

        doc.setFillColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.rect(0, 30, pageWidth, 2, 'F');

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.text('GANPATI FESTIVAL CASHBOOK', pageWidth / 2, 11, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(C.white[0], C.white[1], C.white[2]);
        doc.text('Shivsrushti Hindu Tarun Mitra Mandal', pageWidth / 2, 18, { align: 'center' });

        doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 30, 21, pageWidth / 2 + 30, 21);

        doc.setFontSize(7);
        doc.setTextColor(180, 180, 200);
        doc.text('Year: ' + yearLabel, pageWidth / 2, 26, { align: 'center' });
    }

    function addPageHeader(doc) {
        doc.setFillColor(C.white[0], C.white[1], C.white[2]);
        doc.rect(0, 0, pageWidth, 10, 'F');

        doc.setFillColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.rect(0, 10, pageWidth, 1.5, 'F');

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.text('GANPATI FESTIVAL CASHBOOK', pageWidth / 2, 5, { align: 'center' });

        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        doc.text('Shivsrushti Hindu Tarun Mitra Mandal - Year: ' + yearLabel, pageWidth / 2, 8.5, { align: 'center' });
    }

    function addPageFooter(doc, pageNum, totalPages) {
        const fy = pageHeight - 6;
        doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, fy - 2.5, pageWidth - margin, fy - 2.5);

        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        doc.text('Shivsrushti Hindu Tarun Mitra Mandal - Ganpati Cashbook', margin, fy);
        doc.text('Page ' + pageNum + ' of ' + totalPages, pageWidth - margin, fy, { align: 'right' });
    }

    function drawSummarySection(doc, yPos) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
        doc.text('SUMMARY - Year: ' + yearLabel, margin, yPos);
        yPos += 2;

        doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.setLineWidth(0.6);
        doc.line(margin, yPos, margin + 25, yPos);
        yPos += 3;

        const boxH = 16;
        doc.setFillColor(C.bgWarm[0], C.bgWarm[1], C.bgWarm[2]);
        doc.roundedRect(margin, yPos, contentWidth, boxH, 2, 2, 'F');

        doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, margin, yPos + boxH);
        doc.line(pageWidth - margin, yPos, pageWidth - margin, yPos + boxH);

        const colW = contentWidth / 3;
        doc.line(margin + colW, yPos + 2, margin + colW, yPos + boxH - 2);
        doc.line(margin + colW * 2, yPos + 2, margin + colW * 2, yPos + boxH - 2);

        const drawSumItem = (x, label, value, color) => {
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
            doc.text(label, x, yPos + 6);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(value, x, yPos + 12);
        };

        drawSumItem(margin + 5, 'Total Cash In (+)', formatPDFCurrency(totalCashIn), C.green);
        drawSumItem(margin + colW + 5, 'Total Cash Out (-)', formatPDFCurrency(totalCashOut), C.red);
        drawSumItem(margin + colW * 2 + 5, 'Final Balance', formatPDFCurrency(finalBalance), C.purple);

        return yPos + boxH + 5;
    }

    function drawSignatures(doc) {
        const sy = pageHeight - 30;

        doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
        doc.setLineWidth(0.4);

        const sw = 40;

        doc.line(margin + 8, sy, margin + 8 + sw, sy);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        doc.text('Prepared By', margin + 8 + sw / 2, sy + 5, { align: 'center' });

        doc.line(pageWidth / 2 - sw / 2, sy, pageWidth / 2 + sw / 2, sy);
        doc.text('Verified By', pageWidth / 2, sy + 5, { align: 'center' });

        doc.line(pageWidth - margin - 8 - sw, sy, pageWidth - margin - 8, sy);
        doc.text('Approved By', pageWidth - margin - 8 - sw / 2, sy + 5, { align: 'center' });
    }

    function drawNotesPage(doc) {
        doc.addPage();
        addPageHeader(doc);

        let yPos = 22;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
        doc.text('NOTES', margin, yPos);
        yPos += 2;

        doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
        doc.setLineWidth(0.6);
        doc.line(margin, yPos, margin + 16, yPos);
        yPos += 6;

        const notes = [
            'Update balance after every entry',
            'Maintain separate tracking for Cash and Online',
            'Verify entries weekly',
            'Generate final report after festival',
            'Keep all bills/receipts for record'
        ];

        notes.forEach((note, i) => {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(C.orange[0], C.orange[1], C.orange[2]);
            doc.text((i + 1) + '.', margin + 5, yPos);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(C.textMid[0], C.textMid[1], C.textMid[2]);
            doc.text(note, margin + 12, yPos);

            yPos += 8;
        });

        yPos += 10;

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(C.textLight[0], C.textLight[1], C.textLight[2]);
        doc.text('All amounts are in Indian Rupees (\u20b9)', margin, yPos);
        yPos += 6;
        doc.text('This is a computer-generated report from Ganpati Festival Cashbook', margin, yPos);
        yPos += 6;
        doc.text('Shivsrushti Hindu Tarun Mitra Mandal \u2013 Ganeshotsav', margin, yPos);

        drawSignatures(doc);
    }

    addCoverHeader(doc);

    let yPos = 35;
    yPos = drawSummarySection(doc, yPos);

    yPos += 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
    doc.text('TRANSACTION RECORDS - Year: ' + yearLabel, margin, yPos);

    doc.setDrawColor(C.orange[0], C.orange[1], C.orange[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos + 1.5, margin + 65, yPos + 1.5);
    yPos += 5;

    doc.autoTable({
        startY: yPos,
        head: [['#', 'Remark', 'Date', 'Mode', 'Cash In (+)', 'Cash Out (-)', 'Balance']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: C.navy,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
            valign: 'middle',
            cellPadding: 3
        },
        bodyStyles: {
            fontSize: 7,
            cellPadding: 2.5,
            valign: 'middle',
            textColor: C.textMid,
            lineColor: C.lineLight,
            lineWidth: 0.15
        },
        alternateRowStyles: {
            fillColor: C.bgRow
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10, fontStyle: 'bold', textColor: C.textLight },
            1: { cellWidth: 54, fontStyle: 'bold', textColor: C.textDark },
            2: { cellWidth: 28, halign: 'center', fontSize: 7 },
            3: { cellWidth: 14, halign: 'center', fontSize: 7 },
            4: { halign: 'right', cellWidth: 28, textColor: C.green, fontStyle: 'bold', fontSize: 7 },
            5: { halign: 'right', cellWidth: 28, textColor: C.red, fontStyle: 'bold', fontSize: 7 },
            6: { halign: 'right', cellWidth: 32, textColor: C.purple, fontStyle: 'bold', fontSize: 7 }
        },
        margin: { left: margin, right: margin },
        styles: {
            overflow: 'linebreak'
        },
        didDrawPage: function(data) {
            addPageHeader(doc);
            const totalPagesTemp = doc.internal.getNumberOfPages();
            addPageFooter(doc, totalPagesTemp, '___');
        }
    });

    drawNotesPage(doc);

    let totalPages = doc.internal.getNumberOfPages();

    for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        addPageHeader(doc);
        addPageFooter(doc, i, totalPages);
    }

    doc.setPage(1);
    addPageFooter(doc, 1, totalPages);

    return doc;
}


async function deleteCustomYearPanel() {
    const yearInput = document.getElementById('customYearInput');
    if (!yearInput) return;

    const year = yearInput.value.trim();

    if (!year) {
        showNotification('Please enter a year to delete!', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete the panel for ${year}?`)) {
        return;
    }

    const yearTabs = document.getElementById('yearTabs');
    const yearPanelsContainer = document.getElementById('yearPanels');

    if (!yearTabs || !yearPanelsContainer) return;

    const tab = yearTabs.querySelector(`button[data-year="${year}"]`);
    const panel = document.getElementById(`panel-${year}`);

    if (!tab && !panel) {
        showNotification(`No panel found for ${year}!`, 'info');
        return;
    }

    if (tab) tab.remove();
    if (panel) panel.remove();

    if (yearPanels[year]) {
        delete yearPanels[year];
    }

    switchYearTab('all');
    showNotification(`Panel for ${year} deleted successfully!`, 'success');
}

async function deleteAllPanels() {
    if (!confirm('Are you sure you want to delete ALL custom panels? This will NOT delete data, only remove panels from view.')) {
        return;
    }

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
    switchYearTab('all');
    showNotification('All panels deleted successfully! Data is still safe in database.', 'success');
}

async function deleteAllPanels() {
    if (!confirm('Are you sure you want to delete ALL panels? This will NOT delete data, only remove panels from view.')) {
        return;
    }

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
    switchYearTab('all');
    showNotification('All panels deleted successfully! Data is still safe in database.', 'success');
}

async function createCustomYearPanel() {
    const yearInput = document.getElementById('customYearInput');
    if (!yearInput) return;

    const year = yearInput.value.trim();

    if (!year || year < 2021 || year > 2050) {
        showNotification('Please enter a valid year between 2021 and 2050!', 'error');
        return;
    }

    const yearStr = year.toString();

    const yearTabs = document.getElementById('yearTabs');
    const yearPanelsContainer = document.getElementById('yearPanels');

    if (!yearTabs || !yearPanelsContainer) return;

    const existingTab = yearTabs.querySelector(`button[data-year="${yearStr}"]`);
    if (existingTab) {
        switchYearTab(yearStr);
        showNotification(`Panel for ${yearStr} already exists! Switched to it.`, 'info');
        return;
    }

    const tab = document.createElement('button');
    tab.className = 'year-tab';
    tab.setAttribute('data-year', yearStr);
    tab.textContent = yearStr;
    tab.onclick = () => switchYearTab(yearStr);
    yearTabs.appendChild(tab);

    const panel = createYearPanel(yearStr);
    yearPanelsContainer.appendChild(panel);

    switchYearTab(yearStr);
    showNotification(`Panel for ${yearStr} created successfully!`, 'success');
}

async function deleteCustomYearPanel() {
    const yearInput = document.getElementById('customYearInput');
    if (!yearInput) return;

    const year = yearInput.value.trim();

    if (!year) {
        showNotification('Please enter a year to delete!', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete the panel for ${year}?`)) {
        return;
    }

    const yearTabs = document.getElementById('yearTabs');
    const yearPanelsContainer = document.getElementById('yearPanels');

    if (!yearTabs || !yearPanelsContainer) return;

    const tab = yearTabs.querySelector(`button[data-year="${year}"]`);
    const panel = document.getElementById(`panel-${year}`);

    if (!tab && !panel) {
        showNotification(`No panel found for ${year}!`, 'info');
        return;
    }

    if (tab) tab.remove();
    if (panel) panel.remove();

    if (yearPanels[year]) {
        delete yearPanels[year];
    }

    switchYearTab('all');
    showNotification(`Panel for ${year} deleted successfully!`, 'success');
}
