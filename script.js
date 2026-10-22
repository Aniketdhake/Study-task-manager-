/* ============================================================
   StudySprint — script.js
   Vanilla JavaScript — No libraries or frameworks used
   ============================================================ */

'use strict';

/* ============================================================
   1. DATA & STATE
   All app data lives here. Tasks are saved in localStorage.
   ============================================================ */

const STORAGE_KEY = 'studysprint_tasks';

// These are the text labels and emoji icons for each category
const CATEGORY_META = {
  lecture:      { label: 'Lecture',      icon: '📚' },
  assignment:   { label: 'Assignment',   icon: '📝' },
  practical:    { label: 'Practical',    icon: '🔬' },
  exam:         { label: 'Exam',         icon: '📖' },
  personal:     { label: 'Personal',     icon: '🌟' },
  presentation: { label: 'Presentation', icon: '🎤' },
};

const PRIORITY_META = {
  high:   { label: 'High',   icon: '🔴' },
  medium: { label: 'Medium', icon: '🟡' },
  low:    { label: 'Low',    icon: '🟢' },
};

// App state — the single source of truth
const state = {
  tasks: [],             // array of task objects
  activeFilter: 'all',   // 'all' | 'pending' | 'completed'
  activeCat: null,        // string category filter or null
  sort: 'newest',         // 'newest' | 'oldest' | 'due' | 'priority'
  taskToDeleteId: null,   // holds the id of task pending deletion
};

/* ============================================================
   2. LOAD & SAVE (localStorage)
   ============================================================ */

/** Load tasks from localStorage or return empty array */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Could not load tasks:', e);
    return [];
  }
}

/** Save current tasks to localStorage */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (e) {
    console.warn('Could not save tasks:', e);
  }
}

/* ============================================================
   3. DOM REFERENCES
   Grab all elements once, then reuse them.
   ============================================================ */
const els = {
  // Sidebar & nav
  sidebar:        document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  hamburgerBtn:   document.getElementById('hamburgerBtn'),
  navLinks:       document.querySelectorAll('.nav-link[data-filter]'),
  catLinks:       document.querySelectorAll('.cat-link'),

  // Topbar
  pageTitle:    document.getElementById('pageTitle'),
  pageSubtitle: document.getElementById('pageSubtitle'),
  currentDate:  document.getElementById('currentDate'),
  openModalBtn: document.getElementById('openModalBtn'),

  // Stats
  statTotal:       document.getElementById('statTotal'),
  statPending:     document.getElementById('statPending'),
  statCompleted:   document.getElementById('statCompleted'),
  statProgress:    document.getElementById('statProgress'),
  progressBarFill: document.getElementById('progressBarFill'),
  badgeAll:        document.getElementById('badge-all'),
  badgePending:    document.getElementById('badge-pending'),
  badgeCompleted:  document.getElementById('badge-completed'),

  // Filter & Sort
  filterTabs: document.querySelectorAll('.filter-tab'),
  sortSelect: document.getElementById('sortSelect'),

  // Task area
  taskGrid:    document.getElementById('taskGrid'),
  emptyState:  document.getElementById('emptyState'),
  emptyDesc:   document.getElementById('emptyDesc'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),

  // Modal
  modalOverlay:    document.getElementById('modalOverlay'),
  closeModalBtn:   document.getElementById('closeModalBtn'),
  cancelModalBtn:  document.getElementById('cancelModalBtn'),
  taskForm:        document.getElementById('taskForm'),
  taskTitle:       document.getElementById('taskTitle'),
  taskCategory:    document.getElementById('taskCategory'),
  taskDueDate:     document.getElementById('taskDueDate'),
  taskPriority:    document.getElementById('taskPriority'),
  taskNotes:       document.getElementById('taskNotes'),
  charCounter:     document.getElementById('charCounter'),
  titleError:      document.getElementById('titleError'),
  categoryError:   document.getElementById('categoryError'),
  dueDateError:    document.getElementById('dueDateError'),
  submitBtn:       document.getElementById('submitBtn'),

  // Toast
  toast: document.getElementById('toast'),

  // Delete confirm dialog
  deleteOverlay:    document.getElementById('deleteOverlay'),
  closeDeleteBtn:   document.getElementById('closeDeleteBtn'),
  cancelDeleteBtn:  document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
};

/* ============================================================
   4. UTILITY FUNCTIONS
   Small helpers used throughout the app
   ============================================================ */

/** Generate a unique ID using timestamp + random number */
function generateId() {
  return `task_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/** Format a date string like "2024-10-15" → "Oct 15, 2024" */
function formatDate(dateStr) {
  if (!dateStr) return 'No date';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Check if a date string is in the past */
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/** Check if a date string is within the next 3 days */
function isDueSoon(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (due - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
}

/** Return today's date string in "YYYY-MM-DD" format (for the date input min) */
function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Display the current date in the top bar */
function renderCurrentDate() {
  const now = new Date();
  els.currentDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ============================================================
   5. TOAST NOTIFICATIONS
   Show a small pop-up message at the bottom right of the screen
   ============================================================ */

let toastTimer = null;

/**
 * Show a toast message.
 * @param {string} message - Text to display
 * @param {'success'|'error'|'warning'|'info'} type - Color theme
 */
function showToast(message, type = 'success') {
  const t = els.toast;
  // Reset classes
  t.className = `toast ${type}`;
  t.textContent = message;

  // Trigger animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('show'));
  });

  // Auto-hide after 3 seconds
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, 3000);
}

/* ============================================================
   6. DASHBOARD STATS
   Count tasks and update all the number displays
   ============================================================ */

function updateStats() {
  const total     = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const progress  = total === 0 ? 0 : Math.round((completed / total) * 100);

  els.statTotal.textContent     = total;
  els.statPending.textContent   = pending;
  els.statCompleted.textContent = completed;
  els.statProgress.textContent  = progress + '%';
  els.progressBarFill.style.width = progress + '%';

  // Sidebar badges
  els.badgeAll.textContent       = total;
  els.badgePending.textContent   = pending;
  els.badgeCompleted.textContent = completed;
}

/* ============================================================
   7. GET FILTERED & SORTED TASKS
   Applies the active filter, category, and sort order
   ============================================================ */

function getFilteredTasks() {
  let tasks = [...state.tasks];

  // --- Filter by completion status ---
  if (state.activeFilter === 'pending') {
    tasks = tasks.filter(t => !t.completed);
  } else if (state.activeFilter === 'completed') {
    tasks = tasks.filter(t => t.completed);
  }

  // --- Filter by category (from sidebar) ---
  if (state.activeCat) {
    tasks = tasks.filter(t => t.category === state.activeCat);
  }

  // --- Sort ---
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  tasks.sort((a, b) => {
    switch (state.sort) {
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'due':
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      case 'priority':
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'newest':
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return tasks;
}

/* ============================================================
   8. RENDER TASKS
   Build the HTML for each task card and inject into the DOM
   ============================================================ */

function renderTasks() {
  const tasks = getFilteredTasks();
  const grid  = els.taskGrid;

  grid.innerHTML = '';  // Clear existing cards

  if (tasks.length === 0) {
    // Show empty state
    els.emptyState.style.display = 'flex';
    grid.style.display = 'none';
    updateEmptyMessage();
  } else {
    els.emptyState.style.display = 'none';
    grid.style.display = 'grid';
    tasks.forEach(task => {
      const card = createTaskCard(task);
      grid.appendChild(card);
    });
  }
}

/** Returns the right empty-state description based on the current filter */
function updateEmptyMessage() {
  const msgs = {
    all:       'You haven\'t added any tasks yet. Hit <strong>Add Task</strong> to get started!',
    pending:   'Great job! You have no pending tasks right now. 🎉',
    completed: 'No completed tasks yet. Finish something to see it here!',
  };
  els.emptyDesc.innerHTML = msgs[state.activeFilter] || msgs.all;
}

/**
 * Create a task card DOM element.
 * @param {Object} task - Task object
 * @returns {HTMLElement}
 */
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card priority-${task.priority}${task.completed ? ' completed' : ''}`;
  card.dataset.id = task.id;

  const catMeta  = CATEGORY_META[task.category] || { label: task.category, icon: '📌' };
  const overdueClass = (!task.completed && isOverdue(task.dueDate)) ? 'overdue' : '';
  const dueSoonClass = (!task.completed && !isOverdue(task.dueDate) && isDueSoon(task.dueDate)) ? 'due-soon' : '';
  const dueDateClass = overdueClass || dueSoonClass;
  const dueDateLabel = overdueClass ? '⚠️ Overdue — ' : (dueSoonClass ? '⏰ Due soon — ' : '📅 ');

  const notesHTML = task.notes
    ? `<p class="task-notes">${escapeHTML(task.notes)}</p>`
    : '';

  const actionBtn = task.completed
    ? `<button class="action-btn btn-undo" data-action="undo" data-id="${task.id}">↩ Mark Pending</button>`
    : `<button class="action-btn btn-complete" data-action="complete" data-id="${task.id}">✓ Mark Done</button>`;

  card.innerHTML = `
    <div class="card-top">
      <span class="category-badge cat-${task.category}">${catMeta.icon} ${catMeta.label}</span>
      <span class="priority-pill pill-${task.priority}">${PRIORITY_META[task.priority].icon} ${PRIORITY_META[task.priority].label}</span>
    </div>

    <h3 class="task-title">${escapeHTML(task.title)}</h3>

    ${notesHTML}

    <div class="card-meta">
      <span class="due-date ${dueDateClass}">
        ${dueDateLabel}${formatDate(task.dueDate)}
      </span>
    </div>

    <div class="card-actions">
      ${actionBtn}
      <button class="action-btn btn-delete-card" data-action="delete" data-id="${task.id}" title="Delete task">🗑️</button>
    </div>
  `;

  return card;
}

/** Safely escape HTML to prevent XSS injection */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

/* ============================================================
   9. TASK ACTIONS
   Add, Complete, Undo, Delete
   ============================================================ */

/** Add a new task to the tasks array */
function addTask(taskData) {
  const newTask = {
    id:        generateId(),
    title:     taskData.title.trim(),
    category:  taskData.category,
    dueDate:   taskData.dueDate,
    priority:  taskData.priority,
    notes:     taskData.notes.trim(),
    completed: false,
    createdAt: Date.now(),
  };

  // Add to the beginning of the array so newest appear first
  state.tasks.unshift(newTask);
  saveTasks();
  updateStats();
  renderTasks();
  showToast(`Task "${newTask.title.substring(0, 30)}..." added! 🎉`, 'success');
}

/** Toggle a task between completed and pending */
function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();
  updateStats();
  renderTasks();

  const msg = task.completed
    ? `✅ "${task.title.substring(0, 25)}..." marked as done!`
    : `⏳ "${task.title.substring(0, 25)}..." moved back to pending.`;
  showToast(msg, task.completed ? 'success' : 'warning');
}

/** Remove a task by ID */
function deleteTask(id) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const task = state.tasks[index];
  state.tasks.splice(index, 1);
  saveTasks();
  updateStats();
  renderTasks();
  showToast(`🗑️ "${task.title.substring(0, 25)}..." deleted.`, 'error');
}

/* ============================================================
   10. FORM VALIDATION
   Check each field and show/hide error messages
   ============================================================ */

/** Validate the Add Task form. Returns true if valid. */
function validateForm() {
  let isValid = true;

  // --- Title ---
  const title = els.taskTitle.value.trim();
  if (!title) {
    showFieldError(els.taskTitle, els.titleError, 'Please enter a task title.');
    isValid = false;
  } else if (title.length < 3) {
    showFieldError(els.taskTitle, els.titleError, 'Title must be at least 3 characters.');
    isValid = false;
  } else {
    clearFieldError(els.taskTitle, els.titleError);
  }

  // --- Category ---
  const category = els.taskCategory.value;
  if (!category) {
    showFieldError(els.taskCategory, els.categoryError, 'Please select a category.');
    isValid = false;
  } else {
    clearFieldError(els.taskCategory, els.categoryError);
  }

  // --- Due Date ---
  const dueDate = els.taskDueDate.value;
  if (!dueDate) {
    showFieldError(els.taskDueDate, els.dueDateError, 'Please pick a due date.');
    isValid = false;
  } else {
    clearFieldError(els.taskDueDate, els.dueDateError);
  }

  return isValid;
}

function showFieldError(inputEl, errorEl, message) {
  inputEl.classList.add('error');
  errorEl.textContent = message;
}

function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove('error');
  errorEl.textContent = '';
}

/** Clear all form errors (call when reopening modal) */
function clearAllErrors() {
  [
    [els.taskTitle,    els.titleError],
    [els.taskCategory, els.categoryError],
    [els.taskDueDate,  els.dueDateError],
  ].forEach(([inp, err]) => clearFieldError(inp, err));
}

/* ============================================================
   11. MODAL OPEN / CLOSE
   ============================================================ */

function openModal() {
  els.modalOverlay.classList.add('open');
  clearAllErrors();
  els.taskForm.reset();
  els.charCounter.textContent = '0/100';
  // Set the min date to today (can't add tasks due in the past by accident)
  els.taskDueDate.min = todayString();
  // Focus the title input after animation
  setTimeout(() => els.taskTitle.focus(), 50);
}

function closeModal() {
  els.modalOverlay.classList.remove('open');
}

/* ============================================================
   12. DELETE CONFIRM DIALOG
   ============================================================ */

function openDeleteDialog(id) {
  state.taskToDeleteId = id;
  els.deleteOverlay.classList.add('open');
}

function closeDeleteDialog() {
  state.taskToDeleteId = null;
  els.deleteOverlay.classList.remove('open');
}

/* ============================================================
   13. FILTER & SORT LOGIC
   ============================================================ */

/** Set the active status filter ('all' | 'pending' | 'completed') */
function setFilter(filter) {
  state.activeFilter = filter;
  state.activeCat    = null; // reset category filter when changing status filter

  // Update sidebar nav links
  els.navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.filter === filter);
  });
  // Update category links (remove active)
  els.catLinks.forEach(link => link.classList.remove('active'));
  // Update filter tabs
  els.filterTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });

  // Update page title & subtitle
  const titles = {
    all:       ['All Tasks', 'Manage everything in one place'],
    pending:   ['Pending Tasks', 'Tasks you still need to complete'],
    completed: ['Completed Tasks', 'Tasks you\'ve finished — great work! 🎉'],
  };
  const [title, sub] = titles[filter] || titles.all;
  els.pageTitle.textContent    = title;
  els.pageSubtitle.textContent = sub;

  renderTasks();
}

/** Set the active category filter from sidebar */
function setCategoryFilter(cat) {
  state.activeCat    = cat;
  state.activeFilter = 'all';  // reset status filter

  // Clear nav link active states
  els.navLinks.forEach(link => link.classList.remove('active'));
  // Clear filter tab active states
  els.filterTabs.forEach(tab => tab.classList.remove('active'));
  // Set active category link
  els.catLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.cat === cat);
  });

  const catMeta = CATEGORY_META[cat] || { label: cat, icon: '📌' };
  els.pageTitle.textContent    = `${catMeta.icon} ${catMeta.label}`;
  els.pageSubtitle.textContent = `Showing all ${catMeta.label.toLowerCase()} tasks`;

  renderTasks();
}

/* ============================================================
   14. SIDEBAR TOGGLE (Mobile)
   ============================================================ */

function toggleSidebar() {
  const isOpen = els.sidebar.classList.toggle('open');
  els.sidebarOverlay.classList.toggle('open', isOpen);
  els.hamburgerBtn.classList.toggle('open', isOpen);
}

function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.sidebarOverlay.classList.remove('open');
  els.hamburgerBtn.classList.remove('open');
}

/* ============================================================
   15. EVENT LISTENERS
   Wire up all the UI interactions here
   ============================================================ */

function initEventListeners() {

  // ---- Open / Close Modal ----
  els.openModalBtn.addEventListener('click', openModal);
  els.emptyAddBtn.addEventListener('click', openModal);
  els.closeModalBtn.addEventListener('click', closeModal);
  els.cancelModalBtn.addEventListener('click', closeModal);

  // Close modal by clicking the dark overlay behind it
  els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteDialog();
    }
  });

  // ---- Form Submit ----
  els.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();  // Stop the page from refreshing!

    if (!validateForm()) return;  // Stop if invalid

    addTask({
      title:    els.taskTitle.value,
      category: els.taskCategory.value,
      dueDate:  els.taskDueDate.value,
      priority: els.taskPriority.value,
      notes:    els.taskNotes.value,
    });

    closeModal();
  });

  // ---- Character counter for title input ----
  els.taskTitle.addEventListener('input', () => {
    const len = els.taskTitle.value.length;
    els.charCounter.textContent = `${len}/100`;
    // Clear error as the user types
    if (els.taskTitle.value.trim().length >= 3) {
      clearFieldError(els.taskTitle, els.titleError);
    }
  });

  // ---- Clear category error on change ----
  els.taskCategory.addEventListener('change', () => {
    if (els.taskCategory.value) clearFieldError(els.taskCategory, els.categoryError);
  });
  els.taskDueDate.addEventListener('change', () => {
    if (els.taskDueDate.value) clearFieldError(els.taskDueDate, els.dueDateError);
  });

  // ---- Task Card Actions (Complete / Undo / Delete) ----
  // Using event delegation: one listener on the grid handles all card buttons
  els.taskGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id     = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'complete' || action === 'undo') {
      toggleTask(id);
    } else if (action === 'delete') {
      openDeleteDialog(id);
    }
  });

  // ---- Delete Confirm Dialog ----
  els.confirmDeleteBtn.addEventListener('click', () => {
    if (state.taskToDeleteId) {
      deleteTask(state.taskToDeleteId);
    }
    closeDeleteDialog();
  });
  els.cancelDeleteBtn.addEventListener('click', closeDeleteDialog);
  els.closeDeleteBtn.addEventListener('click', closeDeleteDialog);
  els.deleteOverlay.addEventListener('click', (e) => {
    if (e.target === els.deleteOverlay) closeDeleteDialog();
  });

  // ---- Filter Tabs ----
  els.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });

  // ---- Sidebar Nav Links ----
  els.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setFilter(link.dataset.filter);
      closeSidebar();
    });
  });

  // ---- Sidebar Category Links ----
  els.catLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setCategoryFilter(link.dataset.cat);
      closeSidebar();
    });
  });

  // ---- Sort Select ----
  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    renderTasks();
  });

  // ---- Hamburger (mobile sidebar toggle) ----
  els.hamburgerBtn.addEventListener('click', toggleSidebar);
  els.sidebarOverlay.addEventListener('click', closeSidebar);
}

/* ============================================================
   16. APP INITIALIZATION
   Called once when the page loads
   ============================================================ */

function init() {
  // 1. Load saved tasks from localStorage
  state.tasks = loadTasks();

  // 2. Show today's date in the top bar
  renderCurrentDate();

  // 3. Update dashboard number cards
  updateStats();

  // 4. Render the task list
  renderTasks();

  // 5. Attach all click / change / submit listeners
  initEventListeners();

  console.log('✅ StudySprint initialized. Tasks loaded:', state.tasks.length);
}

// Run the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
