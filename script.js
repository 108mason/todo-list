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
    const { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } = window.firestoreFunctions;
    const db = window.db;
    const tasksCollection = collection(db, 'tasks');

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
}

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
