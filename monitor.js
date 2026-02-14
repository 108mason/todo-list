// ── Berlin Housing Directory ──

const WBS_COMPANIES = [
    {
        name: 'Degewo',
        url: 'https://www.degewo.de/wohnen',
        description: 'One of Berlin\'s largest, with many WBS apartments.'
    },
    {
        name: 'HOWOGE',
        url: 'https://www.howoge.de/wohnungsangebote',
        description: 'Manages a large portfolio of social housing.'
    },
    {
        name: 'GESOBAU',
        url: 'https://www.gesobau.de/wohnungssuche',
        description: 'Major provider in many districts.'
    },
    {
        name: 'Stadt und Land',
        url: 'https://www.stadtundland.de',
        description: 'Significant stock of subsidized housing.'
    },
    {
        name: 'WOGEHEG',
        url: 'https://www.wogeheg.de',
        description: 'Active in several Berlin boroughs.'
    },
    {
        name: 'Berlinovo',
        url: 'https://www.berlinovo.de/en',
        description: 'Offers various subsidized housing options.'
    }
];

const EN_FACEBOOK = [];
const DE_FACEBOOK = [];

let currentUser = null;

// Wait for Firebase
window.addEventListener('DOMContentLoaded', () => {
    const check = setInterval(() => {
        if (window.auth && window.authFunctions) {
            clearInterval(check);
            initAuth();
        }
    }, 100);
});

// ── Authentication ──

function initAuth() {
    const { onAuthStateChanged } = window.authFunctions;
    onAuthStateChanged(window.auth, (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('authContainer').style.display = 'none';
            document.getElementById('appContainer').style.display = 'block';
            document.getElementById('userEmail').textContent = user.email;
            renderAllColumns();
        } else {
            currentUser = null;
            document.getElementById('authContainer').style.display = '';
            document.getElementById('appContainer').style.display = 'none';
        }
    });

    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('authError');
        errorEl.textContent = '';
        try {
            await window.authFunctions.signInWithEmailAndPassword(window.auth, email, password);
        } catch (e) {
            errorEl.textContent = e.message;
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.authFunctions.signOut(window.auth);
    });
}

// ── Render ──

function renderAllColumns() {
    renderColumn('wbsCards', WBS_COMPANIES);
    renderColumn('enFbCards', EN_FACEBOOK);
    renderColumn('deFbCards', DE_FACEBOOK);
}

function renderColumn(containerId, items) {
    const container = document.getElementById(containerId);
    if (items.length === 0) {
        container.innerHTML = '<p class="dir-empty">No links yet</p>';
        return;
    }
    container.innerHTML = items.map(item => `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="dir-card">
            <div class="dir-card-body">
                <h3 class="dir-card-name">${item.name}</h3>
                <p class="dir-card-desc">${item.description}</p>
                <span class="dir-card-url">${item.url.replace('https://www.', '').replace('https://', '')}</span>
            </div>
            <div class="dir-card-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
            </div>
        </a>
    `).join('');
}
