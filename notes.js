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
            alert('Error signing out. Please try again.');
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
            'Speech recognition is not supported in this browser. Please use Chrome or Edge.';
        document.getElementById('micBtn').disabled = true;
        document.getElementById('micBtn').style.opacity = '0.4';
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

        // Update the textarea with final transcript
        document.getElementById('noteTextarea').value = finalTranscript.trim();

        // Show interim results in the live area
        const liveTranscript = document.getElementById('liveTranscript');
        const interimText = document.getElementById('interimText');
        if (interim) {
            liveTranscript.style.display = 'block';
            interimText.textContent = interim;
        } else {
            liveTranscript.style.display = 'none';
            interimText.textContent = '';
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            document.getElementById('browserSupport').textContent =
                'Microphone access denied. Please allow microphone access in your browser settings.';
        }
        stopRecording();
    };

    recognition.onend = () => {
        // If we're still supposed to be recording (didn't manually stop), restart
        if (isRecording) {
            try {
                recognition.start();
            } catch (e) {
                // Already started, ignore
            }
        }
    };
}

function startRecording() {
    if (!recognition) return;

    finalTranscript = document.getElementById('noteTextarea').value;
    if (finalTranscript) finalTranscript += ' ';

    isRecording = true;
    recognition.start();

    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('recording');
    micBtn.title = 'Stop recording';
    document.getElementById('browserSupport').textContent = 'Listening...';
}

function stopRecording() {
    if (!recognition) return;

    isRecording = false;
    recognition.stop();

    const micBtn = document.getElementById('micBtn');
    micBtn.classList.remove('recording');
    micBtn.title = 'Start recording';
    document.getElementById('browserSupport').textContent = 'Click the microphone to start recording';
    document.getElementById('liveTranscript').style.display = 'none';
}

function setupNoteListeners() {
    // Mic button toggle
    document.getElementById('micBtn').addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Save note button
    document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
}

async function saveNote() {
    const textarea = document.getElementById('noteTextarea');
    const text = textarea.value.trim();

    if (!text) {
        alert('Please record or type a note first!');
        return;
    }

    const { collection, addDoc } = window.firestoreFunctions;
    const db = window.db;

    try {
        await addDoc(collection(db, 'voiceNotes'), {
            text: text,
            userId: currentUser.uid,
            createdAt: new Date()
        });

        // Clear the textarea
        textarea.value = '';
        finalTranscript = '';
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note. Please try again.');
    }
}

function loadSavedNotes() {
    const { collection, onSnapshot, query, orderBy, where } = window.firestoreFunctions;
    const db = window.db;

    if (notesUnsubscribe) {
        notesUnsubscribe();
    }

    const notesQuery = query(
        collection(db, 'voiceNotes'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
    );

    notesUnsubscribe = onSnapshot(notesQuery, (snapshot) => {
        const notes = [];
        snapshot.forEach((doc) => {
            notes.push({ id: doc.id, ...doc.data() });
        });
        renderNotes(notes);
    }, (error) => {
        console.error('Error loading notes:', error);
    });
}

function renderNotes(notes) {
    const notesList = document.getElementById('notesList');
    notesList.innerHTML = '';

    if (notes.length === 0) {
        notesList.innerHTML = '<p class="empty-state">No notes yet. Record or type one above!</p>';
        return;
    }

    notes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';

        const timestamp = note.createdAt?.toDate
            ? note.createdAt.toDate().toLocaleString()
            : new Date(note.createdAt).toLocaleString();

        card.innerHTML = `
            <div class="note-card-header">
                <span class="note-timestamp">${timestamp}</span>
            </div>
            <p class="note-text">${escapeHtml(note.text)}</p>
            <div class="note-card-actions">
                <button class="note-action-btn note-task-btn" title="Add as task">Add as Task</button>
                <button class="note-action-btn note-edit-btn" title="Edit note">Edit</button>
                <button class="note-action-btn note-delete-btn" title="Delete note">Delete</button>
            </div>
        `;

        // Add as Task
        card.querySelector('.note-task-btn').addEventListener('click', () => addNoteAsTask(note));

        // Edit
        card.querySelector('.note-edit-btn').addEventListener('click', () => editNote(note));

        // Delete
        card.querySelector('.note-delete-btn').addEventListener('click', () => deleteNote(note.id));

        notesList.appendChild(card);
    });
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
        alert('Note added as a ' + type + ' task!');
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Error adding task. Please try again.');
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
    } catch (error) {
        console.error('Error editing note:', error);
        alert('Error editing note. Please try again.');
    }
}

async function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return;

    const { doc, deleteDoc } = window.firestoreFunctions;
    const db = window.db;

    try {
        await deleteDoc(doc(db, 'voiceNotes', noteId));
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note. Please try again.');
    }
}
