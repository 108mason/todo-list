// ── Real Estate Monitor Dashboard ──

let currentUser = null;

// Wait for Firebase
window.addEventListener('DOMContentLoaded', () => {
    const check = setInterval(() => {
        if (window.db && window.auth && window.firestoreFunctions && window.authFunctions) {
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
            initDashboard();
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

// ── Dashboard Init ──

function initDashboard() {
    listenToSites();
    listenToListings();
    listenToRuns();
    loadSettings();
    setupControls();
}

// ── Firestore Real-Time Listeners ──

function listenToSites() {
    const { collection, onSnapshot, query } = window.firestoreFunctions;
    const q = query(collection(window.db, 'monitor_sites'));
    onSnapshot(q, (snapshot) => {
        const sites = [];
        snapshot.forEach(doc => sites.push({ id: doc.id, ...doc.data() }));
        renderSiteCards(sites);
    });
}

function listenToListings() {
    const { collection, onSnapshot, query, orderBy, limit } = window.firestoreFunctions;
    const q = query(collection(window.db, 'monitor_listings'), orderBy('firstSeen', 'desc'), limit(50));
    onSnapshot(q, (snapshot) => {
        const listings = [];
        snapshot.forEach(doc => listings.push({ id: doc.id, ...doc.data() }));
        renderListings(listings);
    });
}

function listenToRuns() {
    const { collection, onSnapshot, query, orderBy, limit } = window.firestoreFunctions;
    const q = query(collection(window.db, 'monitor_runs'), orderBy('timestamp', 'desc'), limit(20));
    onSnapshot(q, (snapshot) => {
        const runs = [];
        snapshot.forEach(doc => runs.push({ id: doc.id, ...doc.data() }));
        renderRuns(runs);
        // Update "Last check" in header
        if (runs.length > 0 && runs[0].timestamp) {
            const t = runs[0].timestamp.toDate ? runs[0].timestamp.toDate() : new Date(runs[0].timestamp);
            document.getElementById('lastRunTime').textContent = `Last check: ${formatTime(t)}`;
        }
    });
}

// ── Render Functions ──

function renderSiteCards(sites) {
    const container = document.getElementById('siteCards');
    if (sites.length === 0) {
        container.innerHTML = '<div class="empty-state">No sites configured. Run the scraper to populate.</div>';
        return;
    }
    container.innerHTML = sites.map(site => {
        const statusClass = site.lastStatus === 'error' ? 'status-error' : 'status-ok';
        const statusDot = site.lastStatus === 'error' ? 'dot-error' : 'dot-ok';
        const lastCheck = site.lastCheck
            ? formatTime(site.lastCheck.toDate ? site.lastCheck.toDate() : new Date(site.lastCheck))
            : 'Never';
        return `
            <div class="site-card ${statusClass}">
                <div class="site-card-header">
                    <span class="status-dot ${statusDot}"></span>
                    <h3>${escHtml(site.name)}</h3>
                </div>
                <div class="site-card-stats">
                    <div class="stat">
                        <span class="stat-value">${site.totalListings || 0}</span>
                        <span class="stat-label">Listings</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${site.newLastRun || 0}</span>
                        <span class="stat-label">New (last run)</span>
                    </div>
                </div>
                <div class="site-card-footer">Last check: ${lastCheck}</div>
            </div>
        `;
    }).join('');
}

function renderListings(listings) {
    const container = document.getElementById('listingsFeed');
    if (listings.length === 0) {
        container.innerHTML = '<p class="empty-state">No listings found yet. Run a check or wait for the next scheduled run.</p>';
        return;
    }
    container.innerHTML = listings.map(listing => {
        const time = listing.firstSeen
            ? formatTime(listing.firstSeen.toDate ? listing.firstSeen.toDate() : new Date(listing.firstSeen))
            : '';
        const isRecent = listing.firstSeen && isWithinHours(listing.firstSeen, 2);
        return `
            <div class="listing-card ${isRecent ? 'listing-new' : ''}">
                <div class="listing-header">
                    <span class="listing-source">${escHtml(listing.source)}</span>
                    ${isRecent ? '<span class="new-badge">NEW</span>' : ''}
                    <span class="listing-time">${time}</span>
                </div>
                <h3 class="listing-title">${escHtml(listing.title || 'Untitled')}</h3>
                <div class="listing-details">
                    ${listing.address ? `<span>&#128205; ${escHtml(listing.address)}</span>` : ''}
                    ${listing.rooms ? `<span>&#128719; ${escHtml(listing.rooms)}</span>` : ''}
                    ${listing.size ? `<span>&#128207; ${escHtml(listing.size)}</span>` : ''}
                    ${listing.price ? `<span>&#128176; ${escHtml(listing.price)}</span>` : ''}
                </div>
                ${listing.url ? `<a href="${escHtml(listing.url)}" target="_blank" class="listing-link">View Listing &rarr;</a>` : ''}
            </div>
        `;
    }).join('');
}

function renderRuns(runs) {
    const container = document.getElementById('runHistory');
    if (runs.length === 0) {
        container.innerHTML = '<p class="empty-state">No checks recorded yet.</p>';
        return;
    }
    container.innerHTML = `<div class="run-list">${runs.map(run => {
        const time = run.timestamp
            ? formatTime(run.timestamp.toDate ? run.timestamp.toDate() : new Date(run.timestamp))
            : 'Unknown';
        const statusIcon = run.status === 'error' ? '&#10060;' : '&#9989;';
        const triggerLabel = run.trigger === 'manual' ? 'Manual' : 'Scheduled';
        return `
            <div class="run-item">
                <span class="run-status">${statusIcon}</span>
                <span class="run-time">${time}</span>
                <span class="run-trigger">${triggerLabel}</span>
                <span class="run-stats">${run.newListingsCount || 0} new / ${run.totalListingsChecked || 0} total</span>
                ${run.duration ? `<span class="run-duration">${run.duration}s</span>` : ''}
            </div>
        `;
    }).join('')}</div>`;
}

// ── Settings ──

async function loadSettings() {
    const { doc, getDoc } = window.firestoreFunctions;
    try {
        const snap = await getDoc(doc(window.db, 'monitor_config', 'settings'));
        if (snap.exists()) {
            const data = snap.data();
            document.getElementById('githubRepo').value = data.githubRepo || '';
            document.getElementById('githubToken').value = data.githubToken || '';
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

async function saveSettings() {
    const { doc, setDoc } = window.firestoreFunctions;
    const repo = document.getElementById('githubRepo').value.trim();
    const token = document.getElementById('githubToken').value.trim();
    try {
        await setDoc(doc(window.db, 'monitor_config', 'settings'), {
            githubRepo: repo,
            githubToken: token,
        });
        showToast('Settings saved!');
    } catch (e) {
        console.error('Failed to save settings:', e);
        showToast('Failed to save settings: ' + e.message);
    }
}

// ── Controls ──

function setupControls() {
    document.getElementById('settingsBtn').addEventListener('click', () => {
        const panel = document.getElementById('settingsPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('checkNowBtn').addEventListener('click', triggerCheck);
}

async function triggerCheck() {
    const btn = document.getElementById('checkNowBtn');
    const { doc, getDoc } = window.firestoreFunctions;

    btn.disabled = true;
    btn.textContent = 'Triggering...';

    try {
        const snap = await getDoc(doc(window.db, 'monitor_config', 'settings'));
        if (!snap.exists() || !snap.data().githubToken || !snap.data().githubRepo) {
            showToast('Configure GitHub repo & token in Settings first.');
            return;
        }

        const { githubRepo, githubToken } = snap.data();
        const resp = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/check.yml/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({ ref: 'main' }),
        });

        if (resp.status === 204) {
            showToast('Check triggered! Results will appear shortly.');
        } else {
            const errText = await resp.text();
            showToast(`GitHub API error (${resp.status}): ${errText}`);
        }
    } catch (e) {
        showToast('Failed to trigger: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Check Now';
    }
}

// ── Helpers ──

function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isWithinHours(timestamp, hours) {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return (new Date() - date) < hours * 3600000;
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('toast-show');
    setTimeout(() => toast.classList.remove('toast-show'), 3000);
}
