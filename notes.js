// Voice Notes - notes.js
let currentUser = null;
let notesUnsubscribe = null;
let recognition = null;
let isRecording = false;
let finalTranscript = '';

// Wait for Firebase to be initialized
window.addEventListener('DOMContentLoaded', () => {
    const checkFirebase = setInterval(() => {
        if (window.db && window.auth && window.firestoreFunctions && window.authFunctions) {
            clearInterval(checkFirebase);
            initializeAuth();
        }
    }, 100);
});

function initializeAuth() {
    const { onAuthStateChanged } = window.authFunctions;
    const auth = window.auth;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            showApp();
            document.getElementById('userEmail').textContent = user.email;
            initializeNotes();
        } else {
            currentUser = null;
            showAuth();
        }
    });

    setupAuthListeners();
}

function setupAuthListeners() {
    const { signInWithEmailAndPassword, signOut } = window.authFunctions;
    const auth = window.auth;

    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showAuthError('Please enter email and password');
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            showAuthError(getAuthErrorMessage(error.code));
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    });

    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('loginBtn').click();
        }
    });
}

function showAuth() {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
}

function showAuthError(message) {
    document.getElementById('authError').textContent = message;
}

function getAuthErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email': return 'Invalid email address';
        case 'auth/user-disabled': return 'This account has been disabled';
        case 'auth/user-not-found': return 'No account found with this email';
        case 'auth/wrong-password': return 'Incorrect password';
        case 'auth/network-request-failed': return 'Network error. Please check your connection';
        default: return 'Authentication error. Please try again';
    }
}

// ─── Toast ───────────────────────────────────────────────

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('toast-show');
    setTimeout(() => toast.classList.remove('toast-show'), 2500);
}

// ─── Notes Feature ───────────────────────────────────────

function initializeNotes() {
    setupSpeechRecognition();
    setupNoteListeners();
    loadSavedNotes();
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        document.getElementById('browserSupport').textContent =
            'Speech recognition not supported. Use Chrome or Edge.';
        document.getElementById('micBtn').disabled = true;
        document.getElementById('micBtn').style.opacity = '0.3';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interim += transcript;
            }
        }

        // Show interim results in the live area
        const liveTranscript = document.getElementById('liveTranscript');
        const interimText = document.getElementById('interimText');
        if (interim || finalTranscript) {
            liveTranscript.style.display = 'block';
            interimText.textContent = finalTranscript + interim;
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            document.getElementById('browserSupport').textContent =
                'Microphone blocked. Allow access in browser settings.';
        }
        stopRecording(false);
    };

    recognition.onend = () => {
        if (isRecording) {
            try {
                recognition.start();
            } catch (e) {
                // Already started
            }
        }
    };
}

function startRecording() {
    if (!recognition) return;

    finalTranscript = '';

    isRecording = true;
    recognition.start();

    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('recording');
    document.getElementById('micRing').classList.add('active');
    document.getElementById('browserSupport').textContent = 'Listening...';
    document.getElementById('liveTranscript').style.display = 'block';
    document.getElementById('interimText').textContent = '';
}

function stopRecording(autoSave = true) {
    if (!recognition) return;

    isRecording = false;
    recognition.stop();

    const micBtn = document.getElementById('micBtn');
    micBtn.classList.remove('recording');
    document.getElementById('micRing').classList.remove('active');
    document.getElementById('browserSupport').textContent = 'Tap to record a note';
    document.getElementById('liveTranscript').style.display = 'none';

    // Auto-save the voice note immediately
    if (autoSave && finalTranscript.trim()) {
        saveVoiceNote(finalTranscript.trim());
        finalTranscript = '';
    }
}

function setupNoteListeners() {
    // Mic button toggle
    document.getElementById('micBtn').addEventListener('click', () => {
        if (isRecording) {
            stopRecording(true);
        } else {
            startRecording();
        }
    });

    // Save typed note button
    document.getElementById('saveNoteBtn').addEventListener('click', saveTypedNote);

    // Enter key in textarea (Ctrl+Enter to save)
    document.getElementById('noteTextarea').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            saveTypedNote();
        }
    });
}

async function saveVoiceNote(text) {
    const { collection, addDoc } = window.firestoreFunctions;
    const db = window.db;

    try {
        await addDoc(collection(db, 'voiceNotes'), {
            text: text,
            userId: currentUser.uid,
            createdAt: new Date(),
            source: 'voice'
        });
        showToast('Note saved');
    } catch (error) {
        console.error('Error saving note:', error);
        showToast('Failed to save note');
    }
}

async function saveTypedNote() {
    const textarea = document.getElementById('noteTextarea');
    const text = textarea.value.trim();

    if (!text) return;

    const { collection, addDoc } = window.firestoreFunctions;
    const db = window.db;

    try {
        await addDoc(collection(db, 'voiceNotes'), {
            text: text,
            userId: currentUser.uid,
            createdAt: new Date(),
            source: 'typed'
        });
        textarea.value = '';
        showToast('Note saved');
    } catch (error) {
        console.error('Error saving note:', error);
        showToast('Failed to save note');
    }
}

function loadSavedNotes() {
    const { collection, onSnapshot, query, where } = window.firestoreFunctions;
    const db = window.db;

    if (notesUnsubscribe) {
        notesUnsubscribe();
    }

    // Using only where (no orderBy) to avoid needing a Firestore composite index
    const notesQuery = query(
        collection(db, 'voiceNotes'),
        where('userId', '==', currentUser.uid)
    );

    notesUnsubscribe = onSnapshot(notesQuery, (snapshot) => {
        const notes = [];
        snapshot.forEach((doc) => {
            notes.push({ id: doc.id, ...doc.data() });
        });
        // Sort client-side: newest first
        notes.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });
        renderNotes(notes);
    }, (error) => {
        console.error('Error loading notes:', error);
    });
}

function renderNotes(notes) {
    const notesList = document.getElementById('notesList');
    const noteCount = document.getElementById('noteCount');
    notesList.innerHTML = '';

    if (notes.length === 0) {
        noteCount.textContent = '';
        notesList.innerHTML = `
            <div class="empty-state-notes">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#38444D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <p>No notes yet</p>
                <span>Tap the mic to record your first note</span>
            </div>`;
        return;
    }

    noteCount.textContent = notes.length + (notes.length === 1 ? ' note' : ' notes');

    notes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';

        const date = note.createdAt?.toDate
            ? note.createdAt.toDate()
            : new Date(note.createdAt);

        const timeStr = formatTime(date);
        const dateStr = formatDate(date);
        const sourceIcon = note.source === 'voice'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

        card.innerHTML = `
            <div class="note-card-top">
                <div class="note-meta">
                    <span class="note-source">${sourceIcon}</span>
                    <span class="note-date">${dateStr}</span>
                    <span class="note-time">${timeStr}</span>
                </div>
                <div class="note-card-actions">
                    <button class="note-icon-btn note-task-btn" title="Add as task">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                    <button class="note-icon-btn note-edit-btn" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="note-icon-btn note-delete-btn" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
            <p class="note-body">${escapeHtml(note.text)}</p>
        `;

        card.querySelector('.note-task-btn').addEventListener('click', () => addNoteAsTask(note));
        card.querySelector('.note-edit-btn').addEventListener('click', () => editNote(note));
        card.querySelector('.note-delete-btn').addEventListener('click', () => deleteNote(note.id));

        notesList.appendChild(card);
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const dayMs = 86400000;

    if (diff < dayMs && now.getDate() === date.getDate()) {
        return 'Today';
    }
    const yesterday = new Date(now - dayMs);
    if (yesterday.getDate() === date.getDate() && yesterday.getMonth() === date.getMonth()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function addNoteAsTask(note) {
    const taskType = prompt('Add to which task list?\n\nType "life" or "work":', 'life');
    if (!taskType) return;

    const type = taskType.trim().toLowerCase();
    if (type !== 'life' && type !== 'work') {
        alert('Please enter "life" or "work"');
        return;
    }

    const collectionName = type === 'life' ? 'lifeTasks' : 'workTasks';
    const { collection, addDoc } = window.firestoreFunctions;
    const db = window.db;

    try {
        await addDoc(collection(db, collectionName), {
            text: note.text,
            important: false,
            createdAt: new Date(),
            dueDate: null
        });
        showToast('Added as ' + type + ' task');
    } catch (error) {
        console.error('Error adding task:', error);
        showToast('Failed to add task');
    }
}

async function editNote(note) {
    const newText = prompt('Edit note:', note.text);
    if (newText === null || newText.trim() === '') return;

    const { doc, updateDoc } = window.firestoreFunctions;
    const db = window.db;

    try {
        await updateDoc(doc(db, 'voiceNotes', note.id), {
            text: newText.trim()
        });
        showToast('Note updated');
    } catch (error) {
        console.error('Error editing note:', error);
        showToast('Failed to update note');
    }
}

async function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return;

    const { doc, deleteDoc } = window.firestoreFunctions;
    const db = window.db;

    try {
        await deleteDoc(doc(db, 'voiceNotes', noteId));
        showToast('Note deleted');
    } catch (error) {
        console.error('Error deleting note:', error);
        showToast('Failed to delete note');
    }
}
