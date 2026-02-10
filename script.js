// Global variables
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let calendarNotes = {};

// Wait for Firebase to be initialized
window.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be ready
    const checkFirebase = setInterval(() => {
        if (window.db && window.firestoreFunctions) {
            clearInterval(checkFirebase);
            initializeApp();
        }
    }, 100);
});

function initializeApp() {
    const { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, setDoc, getDoc } = window.firestoreFunctions;
    const db = window.db;
    const tasksCollection = collection(db, 'tasks');
    const notesCollection = collection(db, 'calendarNotes');

    // Set up real-time listener for tasks
    const q = query(tasksCollection, orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
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

    // Set up real-time listener for calendar notes
    onSnapshot(notesCollection, (snapshot) => {
        calendarNotes = {};
        snapshot.forEach((doc) => {
            calendarNotes[doc.id] = doc.data().note;
        });
        renderCalendar();
    }, (error) => {
        console.error('Error listening to calendar notes:', error);
    });

    // Add task event listeners
    document.getElementById('addButton').addEventListener('click', () => addTask(tasksCollection, addDoc));
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask(tasksCollection, addDoc);
        }
    });

    // Store Firestore functions globally for use in other functions
    window.deleteTaskFromFirestore = (taskId) => deleteTask(db, taskId, deleteDoc, doc);
    window.toggleImportantInFirestore = (taskId, currentValue) => toggleImportant(db, taskId, currentValue, updateDoc, doc);
    window.saveCalendarNote = (dateKey, note) => saveNote(db, dateKey, note, setDoc, doc);

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
        await addDoc(tasksCollection, {
            text: taskText,
            important: false,
            createdAt: new Date()
        });
        taskInput.value = '';
        taskInput.focus();
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Error adding task. Please try again.');
    }
}

async function deleteTask(db, taskId, deleteDoc, doc) {
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Error deleting task. Please try again.');
    }
}

async function toggleImportant(db, taskId, currentValue, updateDoc, doc) {
    try {
        await updateDoc(doc(db, 'tasks', taskId), {
            important: !currentValue
        });
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Error updating task. Please try again.');
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    if (tasks.length === 0) {
        taskList.innerHTML = '<div class="empty-state">No tasks yet. Add one above!</div>';
        return;
    }

    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.important ? 'important' : ''}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'flag-checkbox';
        checkbox.checked = task.important;
        checkbox.title = 'Mark as important';
        checkbox.addEventListener('change', () => window.toggleImportantInFirestore(task.id, task.important));

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => window.deleteTaskFromFirestore(task.id));

        li.appendChild(checkbox);
        li.appendChild(taskText);
        li.appendChild(deleteBtn);
        taskList.appendChild(li);
    });
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

async function saveNote(db, dateKey, note, setDoc, doc) {
    try {
        if (note.trim() === '') {
            // Delete note if empty
            const { deleteDoc } = window.firestoreFunctions;
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
