// ── Berlin Housing Directory ──

const DEFAULT_WBS = [
    { name: 'Degewo', url: 'https://www.degewo.de/wohnen', description: 'One of Berlin\'s largest, with many WBS apartments.' },
    { name: 'HOWOGE', url: 'https://www.howoge.de/wohnungsangebote', description: 'Manages a large portfolio of social housing.' },
    { name: 'GESOBAU', url: 'https://www.gesobau.de/wohnungssuche', description: 'Major provider in many districts.' },
    { name: 'Stadt und Land', url: 'https://www.stadtundland.de', description: 'Significant stock of subsidized housing.' },
    { name: 'WOGEHEG', url: 'https://www.wogeheg.de', description: 'Active in several Berlin boroughs.' },
    { name: 'Berlinovo', url: 'https://www.berlinovo.de/en', description: 'Offers various subsidized housing options.' }
];

const DEFAULT_EN_FACEBOOK = [
    { name: 'Berlin Housing', url: 'https://www.facebook.com/groups/316886635183491/', description: 'Apartments, rooms, sublets.' },
    { name: 'Housing in Berlin', url: 'https://www.facebook.com/groups/berlin.housing.and.roommates', description: 'All types of housing.' },
    { name: 'Flats in Berlin', url: 'https://www.facebook.com/groups/flatsinberlin', description: 'Apartments and rooms.' },
    { name: 'Berlin Housing, Rooms, Apartments, Sublets', url: 'https://www.facebook.com/groups/156793591673300/', description: 'All types.' },
    { name: 'Find Housing for Rent in Berlin', url: 'https://www.facebook.com/groups/houseberlin/', description: 'General rentals.' },
    { name: 'Co-Housing in Berlin', url: 'https://www.facebook.com/search/groups?q=Co-Housing%20in%20Berlin', description: 'Shared living projects and WG flats.' },
    { name: 'International Women in Berlin Housing', url: 'https://www.facebook.com/search/groups?q=International%20Women%20in%20Berlin%20Housing', description: 'Women-only listings.' },
    { name: 'Berlin Student Flat Exchange', url: 'https://www.facebook.com/search/groups?q=Berlin%20Student%20Flat%20Exchange', description: 'Student-focused.' },
    { name: 'Berlin Apartments & Rooms for Rent', url: 'https://www.facebook.com/groups/183048595060764/', description: 'Rooms and apartments.' }
];

const DEFAULT_DE_FACEBOOK = [
    { name: 'WG & Wohnung Berlin', url: 'https://www.facebook.com/groups/wg.wohnung.berlin', description: 'WG rooms and apartments. Highly active.' },
    { name: 'wg.wohnung.Berlin', url: 'https://www.facebook.com/groups/wg.wohnung.berlin/', description: 'WG rooms and apartments. Frequently mentioned in guides.' },
    { name: 'Wohnungen in Berlin', url: 'https://www.facebook.com/groups/wohnenberlin/', description: 'Large, general-purpose housing group.' },
    { name: 'WG-Zimmer & Wohnungen Berlin', url: 'https://www.facebook.com/groups/1705212493049107/', description: 'Focused on WG rooms. Active listings.' },
    { name: 'Berliner WG-Zimmer', url: 'https://www.facebook.com/groups/251856141592447/', description: 'WG rooms only. Specialized for shared flats.' },
    { name: 'Flatmate.Berlin', url: 'https://www.facebook.com/groups/flatmate.berlin', description: 'Finding flatmates. Shared living focused.' },
    { name: 'Berlin.startup.flats & flatshares', url: 'https://www.facebook.com/groups/berlin.startup.flats', description: 'Young professionals. Sublets and flatshares.' },
    { name: 'Zimmer / WG / Wohnung in Berlin', url: 'https://www.facebook.com/groups/easy.wg/', description: 'All types. Regular postings.' },
    { name: 'Wohnung Berlin - privat & provisionsfrei', url: 'https://www.facebook.com/groups/158572641291/', description: 'No-commission private listings.' },
    { name: 'Wohnungen mieten in Berlin', url: 'https://www.facebook.com/groups/1678546859106556/', description: 'Apartments for rent. General listings.' }
];

let wbsData, enFbData, deFbData;
let currentUser = null;
let editingCard = null; // { column, index }

// ── Persistence ──

function loadData() {
    const saved = localStorage.getItem('keshava_monitor');
    if (saved) {
        const data = JSON.parse(saved);
        wbsData = data.wbs || [...DEFAULT_WBS];
        enFbData = data.enFb || [...DEFAULT_EN_FACEBOOK];
        deFbData = data.deFb || [...DEFAULT_DE_FACEBOOK];
    } else {
        wbsData = [...DEFAULT_WBS];
        enFbData = [...DEFAULT_EN_FACEBOOK];
        deFbData = [...DEFAULT_DE_FACEBOOK];
    }
}

function saveData() {
    localStorage.setItem('keshava_monitor', JSON.stringify({
        wbs: wbsData, enFb: enFbData, deFb: deFbData
    }));
}

function getColumnData(col) {
    if (col === 'wbs') return wbsData;
    if (col === 'enFb') return enFbData;
    if (col === 'deFb') return deFbData;
}

// ── HTML escape ──

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

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
            loadData();
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

    // Edit modal listeners
    document.getElementById('editModalClose').addEventListener('click', closeEditModal);
    document.getElementById('editSaveBtn').addEventListener('click', saveEdit);
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeEditModal();
    });
}

// ── Render ──

function renderAllColumns() {
    renderColumn('wbsCards', wbsData, 'wbs');
    renderColumn('enFbCards', enFbData, 'enFb');
    renderColumn('deFbCards', deFbData, 'deFb');
}

function renderColumn(containerId, items, columnKey) {
    const container = document.getElementById(containerId);
    if (items.length === 0) {
        container.innerHTML = '<p class="dir-empty">No links yet</p>';
        return;
    }
    container.innerHTML = items.map((item, index) => `
        <div class="dir-card">
            <div class="dir-card-actions">
                <button class="dir-action-btn dir-edit-btn" onclick="openEditModal('${columnKey}', ${index})" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="dir-action-btn dir-delete-btn" onclick="deleteCard('${columnKey}', ${index})" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
            <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" class="dir-card-link">
                <div class="dir-card-body">
                    <h3 class="dir-card-name">${esc(item.name)}</h3>
                    <p class="dir-card-desc">${esc(item.description)}</p>
                    <span class="dir-card-url">${esc(item.url.replace('https://www.', '').replace('https://', ''))}</span>
                </div>
                <div class="dir-card-arrow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                </div>
            </a>
        </div>
    `).join('');
}

// ── Edit / Delete ──

function openEditModal(columnKey, index) {
    const data = getColumnData(columnKey);
    const item = data[index];
    editingCard = { column: columnKey, index };

    document.getElementById('editName').value = item.name;
    document.getElementById('editUrl').value = item.url;
    document.getElementById('editDesc').value = item.description;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    editingCard = null;
}

function saveEdit() {
    if (!editingCard) return;

    const name = document.getElementById('editName').value.trim();
    const url = document.getElementById('editUrl').value.trim();
    const description = document.getElementById('editDesc').value.trim();

    if (!name || !url) return;

    const data = getColumnData(editingCard.column);
    data[editingCard.index] = { name, url, description };

    saveData();
    renderAllColumns();
    closeEditModal();
}

function deleteCard(columnKey, index) {
    if (!confirm('Delete this link?')) return;

    const data = getColumnData(columnKey);
    data.splice(index, 1);

    saveData();
    renderAllColumns();
}
