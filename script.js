// Global variables
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let calendarNotes = {};
let currentUser = null;
let currentTaskType = 'life'; // 'life' or 'work'
let tasksUnsubscribe = null; // To unsubscribe from previous listener

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

    // Set up authentication state listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            showApp();
            document.getElementById('userEmail').textContent = user.email;
            initializeApp();
        } else {
            // User is signed out
            currentUser = null;
            showAuth();
        }
    });

    // Set up auth UI event listeners
    setupAuthListeners();
}

function setupAuthListeners() {
    const { signInWithEmailAndPassword, signOut } = window.authFunctions;
    const auth = window.auth;

    // Login
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showAuthError('Please enter email and password');
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Success handled by onAuthStateChanged
        } catch (error) {
            showAuthError(getAuthErrorMessage(error.code));
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await signOut(auth);
            // Success handled by onAuthStateChanged
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        }
    });

    // Enter key support
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
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'Email already in use';
        case 'auth/weak-password':
            return 'Password is too weak';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection';
        default:
            return 'Authentication error. Please try again';
    }
}

function initializeApp() {
    const { collection, setDoc, getDoc } = window.firestoreFunctions;
    const db = window.db;
    const notesCollection = collection(db, 'calendarNotes');

    // Set up real-time listener for calendar notes
    const { onSnapshot } = window.firestoreFunctions;
    onSnapshot(notesCollection, (snapshot) => {
        calendarNotes = {};
        snapshot.forEach((doc) => {
            calendarNotes[doc.id] = doc.data().note;
        });
        renderCalendar();
    }, (error) => {
        console.error('Error listening to calendar notes:', error);
    });

    // Store Firestore functions globally for use in other functions
    window.saveCalendarNote = (dateKey, note) => saveNote(db, dateKey, note, setDoc, getDoc);

    // Initialize calendar
    renderCalendar();

    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    // Modal handlers
    const modal = document.getElementById('noteModal');
    const closeBtn = document.getElementsByClassName('close')[0];
    const saveBtn = document.getElementById('saveNote');

    closeBtn.onclick = () => {
        modal.classList.remove('show');
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.classList.remove('show');
        }
    };

    saveBtn.onclick = () => {
        const note = document.getElementById('noteText').value;
        if (selectedDate) {
            window.saveCalendarNote(selectedDate, note);
            modal.classList.remove('show');
        }
    };

    // Task toggle buttons
    document.getElementById('lifeBtn').addEventListener('click', () => switchTaskType('life'));
    document.getElementById('workBtn').addEventListener('click', () => switchTaskType('work'));

    // Load initial task view (Life)
    loadTaskView();
}

function switchTaskType(type) {
    console.log('Switching to:', type);
    currentTaskType = type;

    // Update button states
    document.getElementById('lifeBtn').classList.toggle('active', type === 'life');
    document.getElementById('workBtn').classList.toggle('active', type === 'work');

    // Update title
    const title = type === 'life' ? 'Life Tasks' : 'Work Tasks';
    document.querySelector('.task-section h1').textContent = title;

    // Clear current tasks display
    document.getElementById('taskList').innerHTML = '<div class="empty-state">Loading tasks...</div>';

    // Reload tasks
    loadTaskView();
}

function loadTaskView() {
    const { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } = window.firestoreFunctions;
    const db = window.db;

    // Unsubscribe from previous listener if exists
    if (tasksUnsubscribe) {
        tasksUnsubscribe();
    }

    // Determine collection name based on current type
    const collectionName = currentTaskType === 'life' ? 'lifeTasks' : 'workTasks';
    const tasksCollection = collection(db, collectionName);

    // Set up real-time listener for current task type
    const q = query(tasksCollection, orderBy('createdAt', 'desc'));
    tasksUnsubscribe = onSnapshot(q, (snapshot) => {
        const tasks = [];
        snapshot.forEach((doc) => {
            tasks.push({
                id: doc.id,
                ...doc.data()
            });
        });
        renderTasks(tasks);
    }, (error) => {
        console.error('Error listening to tasks:', error);
        alert('Error loading tasks. Please refresh the page.');
    });

    // Update task event listeners
    const addButton = document.getElementById('addButton');
    const taskInput = document.getElementById('taskInput');

    // Remove old listeners by cloning elements
    const newAddButton = addButton.cloneNode(true);
    addButton.parentNode.replaceChild(newAddButton, addButton);

    const newTaskInput = taskInput.cloneNode(true);
    taskInput.parentNode.replaceChild(newTaskInput, taskInput);

    // Add new listeners
    document.getElementById('addButton').addEventListener('click', () => addTask(tasksCollection, addDoc));
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask(tasksCollection, addDoc);
        }
    });

    // Store current collection functions globally
    window.deleteTaskFromFirestore = (taskId) => deleteTask(db, collectionName, taskId, deleteDoc, doc);
    window.toggleImportantInFirestore = (taskId, currentValue) => toggleImportant(db, collectionName, taskId, currentValue, updateDoc, doc);
    window.editTaskInFirestore = (taskId, currentText, currentDate) => editTask(db, collectionName, taskId, currentText, currentDate, updateDoc, doc);
}

// Task functions
async function addTask(tasksCollection, addDoc) {
    const taskInput = document.getElementById('taskInput');
    const taskText = taskInput.value.trim();

    if (taskText === '') {
        alert('Please enter a task!');
        return;
    }

    try {
        // Parse date from task text (format: DD.MM.YYYY)
        const dateRegex = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;
        const dateMatch = taskText.match(dateRegex);

        let taskDate = null;
        let taskTextWithoutDate = taskText;

        if (dateMatch) {
            const day = dateMatch[1];
            const month = dateMatch[2];
            const year = dateMatch[3];
            taskDate = `${year}-${month}-${day}`; // Store as YYYY-MM-DD

            // Remove date from task text
            taskTextWithoutDate = taskText.replace(dateRegex, '').trim();

            // Update calendar note with this task
            await updateCalendarWithTask(taskDate, taskTextWithoutDate);
        }

        await addDoc(tasksCollection, {
            text: taskText,
            important: false,
            createdAt: new Date(),
            dueDate: taskDate
        });
        taskInput.value = '';
        taskInput.focus();
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Error adding task. Please try again.');
    }
}

async function updateCalendarWithTask(dateKey, taskText) {
    const { setDoc, getDoc, doc } = window.firestoreFunctions;
    const db = window.db;

    try {
        const noteDocRef = doc(db, 'calendarNotes', dateKey);
        const noteDoc = await getDoc(noteDocRef);

        let existingNote = '';
        if (noteDoc.exists()) {
            existingNote = noteDoc.data().note || '';
        }

        // Append task to existing note (one per line)
        const updatedNote = existingNote
            ? `${existingNote}\n• ${taskText}`
            : `• ${taskText}`;

        await setDoc(noteDocRef, {
            note: updatedNote,
            updatedAt: new Date()
        });
    } catch (error) {
        console.error('Error updating calendar:', error);
    }
}

async function deleteTask(db, collectionName, taskId, deleteDoc, doc) {
    try {
        await deleteDoc(doc(db, collectionName, taskId));
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Error deleting task. Please try again.');
    }
}

async function toggleImportant(db, collectionName, taskId, currentValue, updateDoc, doc) {
    try {
        await updateDoc(doc(db, collectionName, taskId), {
            important: !currentValue
        });
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Error updating task. Please try again.');
    }
}

async function editTask(db, collectionName, taskId, currentText, currentDate, updateDoc, doc) {
    // Prompt for new task text
    const newText = prompt('Edit task:', currentText);
    if (newText === null || newText.trim() === '') {
        return; // User cancelled or entered empty text
    }

    // Prompt for new date (format: DD.MM.YYYY or leave empty)
    const currentDateFormatted = currentDate ? formatDateForDisplay(currentDate) : '';
    const newDateInput = prompt('Edit date (DD.MM.YYYY) or leave empty:', currentDateFormatted);
    if (newDateInput === null) {
        return; // User cancelled
    }

    // Parse the new date
    let newDate = null;
    if (newDateInput.trim() !== '') {
        const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
        const dateMatch = newDateInput.trim().match(dateRegex);
        if (dateMatch) {
            const day = dateMatch[1];
            const month = dateMatch[2];
            const year = dateMatch[3];
            newDate = `${year}-${month}-${day}`; // Store as YYYY-MM-DD
        } else {
            alert('Invalid date format. Please use DD.MM.YYYY');
            return;
        }
    }

    try {
        // Update the task in Firestore
        await updateDoc(doc(db, collectionName, taskId), {
            text: newText.trim(),
            dueDate: newDate
        });

        // If date was added or changed, update calendar
        if (newDate) {
            const taskTextWithoutDate = newText.replace(/\b(\d{2})\.(\d{2})\.(\d{4})\b/, '').trim();
            await updateCalendarWithTask(newDate, taskTextWithoutDate);
        }
    } catch (error) {
        console.error('Error editing task:', error);
        alert('Error editing task. Please try again.');
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    if (tasks.length === 0) {
        taskList.innerHTML = '<div class="empty-state">No tasks yet. Add one above!</div>';
        return;
    }

    // Sort tasks: dated tasks first (by due date ascending), then undated tasks (by creation date descending)
    const sortedTasks = [...tasks].sort((a, b) => {
        // If both have dates, sort by due date (earliest first)
        if (a.dueDate && b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
        }
        // If only a has a date, it comes first
        if (a.dueDate && !b.dueDate) {
            return -1;
        }
        // If only b has a date, it comes first
        if (!a.dueDate && b.dueDate) {
            return 1;
        }
        // If neither has a date, sort by creation date (newest first)
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
    });

    sortedTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.important ? 'important' : ''}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'flag-checkbox';
        checkbox.checked = task.important;
        checkbox.title = 'Mark as important';
        checkbox.addEventListener('change', () => window.toggleImportantInFirestore(task.id, task.important));

        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;

        // Add date badge if task has a due date
        if (task.dueDate) {
            const dateBadge = document.createElement('span');
            dateBadge.className = 'task-date-badge';
            dateBadge.innerHTML = `📅 ${formatDateForDisplay(task.dueDate)}`;
            taskContent.appendChild(dateBadge);
        }

        taskContent.appendChild(taskText);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'task-buttons';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => window.editTaskInFirestore(task.id, task.text, task.dueDate));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => window.deleteTaskFromFirestore(task.id));

        btnContainer.appendChild(editBtn);
        btnContainer.appendChild(deleteBtn);

        li.appendChild(checkbox);
        li.appendChild(taskContent);
        li.appendChild(btnContainer);
        taskList.appendChild(li);
    });
}

function formatDateForDisplay(dateString) {
    // Convert YYYY-MM-DD to DD.MM.YYYY
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateString;
}

// Calendar functions
function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Update month/year display
    document.getElementById('currentMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Clear grid
    calendarGrid.innerHTML = '';

    // Add day headers
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });

    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Today's date for highlighting
    const today = new Date();
    const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
    const todayDate = today.getDate();

    // Add previous month's days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.innerHTML = `<div class="day-number">${daysInPrevMonth - i}</div>`;
        calendarGrid.appendChild(day);
    }

    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';

        if (isCurrentMonth && day === todayDate) {
            dayDiv.classList.add('today');
        }

        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const note = calendarNotes[dateKey] || '';

        dayDiv.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-note">${note}</div>
        `;

        dayDiv.addEventListener('click', () => openNoteModal(dateKey, note));
        calendarGrid.appendChild(dayDiv);
    }

    // Add next month's days to fill grid
    const totalCells = calendarGrid.children.length - 7; // Subtract header row
    const remainingCells = 42 - totalCells - 7; // 6 rows * 7 days - header
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<div class="day-number">${day}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
}

function openNoteModal(dateKey, note) {
    selectedDate = dateKey;
    const modal = document.getElementById('noteModal');
    document.getElementById('modalDate').textContent = formatDate(dateKey);
    document.getElementById('noteText').value = note;
    modal.classList.add('show');
    document.getElementById('noteText').focus();
}

function formatDate(dateKey) {
    const date = new Date(dateKey + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

async function saveNote(db, dateKey, note, setDoc, getDoc) {
    const { deleteDoc, doc } = window.firestoreFunctions;
    try {
        if (note.trim() === '') {
            // Delete note if empty
            await deleteDoc(doc(db, 'calendarNotes', dateKey));
        } else {
            // Save or update note
            await setDoc(doc(db, 'calendarNotes', dateKey), {
                note: note,
                updatedAt: new Date()
            });
        }
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note. Please try again.');
    }
}
