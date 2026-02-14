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

const EN_FACEBOOK = [
    {
        name: 'Berlin Housing',
        url: 'https://www.facebook.com/groups/316886635183491/',
        description: 'Apartments, rooms, sublets.'
    },
    {
        name: 'Housing in Berlin',
        url: 'https://www.facebook.com/groups/berlin.housing.and.roommates',
        description: 'All types of housing.'
    },
    {
        name: 'Flats in Berlin',
        url: 'https://www.facebook.com/groups/flatsinberlin',
        description: 'Apartments and rooms.'
    },
    {
        name: 'Berlin Housing, Rooms, Apartments, Sublets',
        url: 'https://www.facebook.com/groups/156793591673300/',
        description: 'All types.'
    },
    {
        name: 'Find Housing for Rent in Berlin',
        url: 'https://www.facebook.com/groups/houseberlin/',
        description: 'General rentals.'
    },
    {
        name: 'Co-Housing in Berlin',
        url: 'https://www.facebook.com/search/groups?q=Co-Housing%20in%20Berlin',
        description: 'Shared living projects and WG flats.'
    },
    {
        name: 'International Women in Berlin Housing',
        url: 'https://www.facebook.com/search/groups?q=International%20Women%20in%20Berlin%20Housing',
        description: 'Women-only listings.'
    },
    {
        name: 'Berlin Student Flat Exchange',
        url: 'https://www.facebook.com/search/groups?q=Berlin%20Student%20Flat%20Exchange',
        description: 'Student-focused.'
    },
    {
        name: 'Berlin Apartments & Rooms for Rent',
        url: 'https://www.facebook.com/groups/183048595060764/',
        description: 'Rooms and apartments.'
    }
];
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
