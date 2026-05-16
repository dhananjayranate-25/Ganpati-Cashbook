const API_URL = 'http://localhost:3002/api';

document.addEventListener('DOMContentLoaded', () => {
    createParticles();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            login();
        });
    }

    setupEntryForms();
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

function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    // Get stored password from localStorage or use default
    const storedPassword = localStorage.getItem('adminPassword') || 'admin123';

    if (username === 'admin' && password === storedPassword) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainScreen').style.display = 'block';
        document.getElementById('loggedUser').textContent = username;
        showNotification('Login successful!', 'success');
    } else {
        showNotification('Invalid username or password!', 'error');
    }
}

function logout() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showNotification('Logged out successfully!', 'info');
}

function setupEntryForms() {
    const form1 = document.getElementById('entryForm1');
    const form2 = document.getElementById('entryForm2');

    if (form1) {
        form1.addEventListener('submit', (e) => {
            e.preventDefault();
            addEntry(1);
        });
    }

    if (form2) {
        form2.addEventListener('submit', (e) => {
            e.preventDefault();
            addEntry(2);
        });
    }

    const year1 = document.getElementById('year1');
    const year2 = document.getElementById('year2');

    if (year1) {
        year1.addEventListener('change', () => updateDate(1));
        updateDate(1);
    }

    if (year2) {
        year2.addEventListener('change', () => updateDate(2));
        updateDate(2);
    }
}

function updateDate(panelNum) {
    const yearInput = document.getElementById(`year${panelNum}`);
    const dateInput = document.getElementById(`date${panelNum}`);

    if (yearInput && dateInput && yearInput.value) {
        const year = yearInput.value;
        const currentDate = dateInput.value;
        if (currentDate) {
            const monthDay = currentDate.substring(5);
            dateInput.value = year + '-' + (monthDay || '01-01');
        } else {
            dateInput.value = year + '-01-01';
        }
    }
}

async function addEntry(panelNum) {
    const entry = {
        name: document.getElementById(`name${panelNum}`).value.trim(),
        date: document.getElementById(`date${panelNum}`).value,
        mode: document.getElementById(`mode${panelNum}`).value,
        cashIn: parseFloat(document.getElementById(`cashIn${panelNum}`).value) || 0,
        cashOut: parseFloat(document.getElementById(`cashOut${panelNum}`).value) || 0
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
            resetForm(panelNum);
            showNotification(`Entry added successfully to Panel ${panelNum}!`, 'success');
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding entry:', error);
        showNotification('Failed to add entry. Make sure server is running!', 'error');
    }
}

function resetForm(panelNum) {
    const nameInput = document.getElementById(`name${panelNum}`);
    const modeSelect = document.getElementById(`mode${panelNum}`);
    const cashInInput = document.getElementById(`cashIn${panelNum}`);
    const cashOutInput = document.getElementById(`cashOut${panelNum}`);
    const yearInput = document.getElementById(`year${panelNum}`);
    const dateInput = document.getElementById(`date${panelNum}`);

    if (nameInput) nameInput.value = '';
    if (modeSelect) modeSelect.value = '';
    if (cashInInput) cashInInput.value = '';
    if (cashOutInput) cashOutInput.value = '';
    if (yearInput && dateInput) {
        dateInput.value = `${yearInput.value}-01-01`;
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
