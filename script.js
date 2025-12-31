// ===================== CONFIG =====================
const API_BASE_URL = window.location.origin.includes('http')
  ? window.location.origin + '/api'
  : 'http://127.0.0.1:8000/api';

// ===================== STATE =====================
let appState = {
  isLoggedIn: false,
  role: null,
  userId: null,
  activeStudentId: null,
  allStudents: [],
  chatMessages: {},
  groups: []
};

// ===================== HELPERS =====================
async function fetchAPI(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (appState.isLoggedIn && appState.role && appState.userId) {
    headers['X-User-Role'] = appState.role;
    headers['X-User-Id'] = appState.userId;
  }
  if (options.headers) Object.assign(headers, options.headers);
  const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  return res;
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (viewId === 'login-view' || viewId === 'register-view')
    document.body.classList.add('login-mode');
  else document.body.classList.remove('login-mode');
}

function renderMetric(container, label, value, cls = '') {
  const div = document.createElement('div');
  div.className = 'col-md-3 col-sm-6';
  div.innerHTML = `
    <div class="card metric-card border-0 shadow-sm ${cls}">
      <div class="card-body">
        <p class="small text-muted fw-bold">${label}</p>
        <p class="h3 fw-bold">${value}</p>
      </div>
    </div>`;
  container.appendChild(div);
}

// ===================== AUTH =====================
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const msg = document.getElementById('login-message');

  msg.textContent = 'Checking credentials...';
  msg.className = 'text-primary fw-medium min-h-20';

  try {
    const res = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'Login failed');

    appState.isLoggedIn = true;
    appState.role = data.role;
    appState.userId = data.user_id;
    appState.activeStudentId =
      ['Student', 'Parent'].includes(data.role) ? data.user_id : null;

    initializeDashboard();
  } catch (e) {
    msg.textContent = e.message;
    msg.className = 'text-danger fw-bold min-h-20';
  }
}

async function handleLogout() {
  appState = {
    isLoggedIn: false,
    role: null,
    userId: null,
    activeStudentId: null,
    allStudents: [],
    chatMessages: {},
    groups: []
  };
  switchView('login-view');
  document.body.classList.add('login-mode');
}

// ===================== REGISTRATION =====================
async function handleRegister(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const msg = document.getElementById('register-message');

  // Disable button
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating Account...";
  msg.textContent = "";

  // Get values safely
  const nameVal = document.getElementById('reg-name').value.trim();
  const emailVal = document.getElementById('reg-email').value.trim();
  const passwordVal = document.getElementById('reg-password').value;
  const roleVal = document.getElementById('reg-role').value;

  // Handle optional fields
  const gradeEl = document.getElementById('reg-grade');
  const gradeVal = gradeEl ? (parseInt(gradeEl.value) || 9) : 9;

  const subjectEl = document.getElementById('reg-subject');
  const subjectVal = subjectEl ? subjectEl.value : "General";

  const inviteCodeEl = document.getElementById('reg-invite');
  const inviteCodeVal = inviteCodeEl ? inviteCodeEl.value.trim() : null;

  try {
    const payload = {
      name: nameVal,
      email: emailVal,
      username: emailVal, // Explicitly match backend expectation
      password: passwordVal,
      role: roleVal,
      grade: gradeVal,
      preferred_subject: subjectVal,
      invite_code: inviteCodeVal
    };

    const res = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      // Improved Error Handling
      let errorText = "Registration failed";
      if (typeof data.detail === 'string') {
        errorText = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorText = data.detail.map(err => err.msg).join(", ");
      } else if (typeof data.detail === 'object') {
        errorText = JSON.stringify(data.detail);
      }
      throw new Error(errorText);
    }

    // Success
    msg.textContent = 'Account created! Redirecting to login...';
    msg.className = 'text-success fw-bold min-h-20';

    setTimeout(() => {
      showLogin();
      document.getElementById('register-form').reset();
      msg.textContent = '';
    }, 2000);

  } catch (err) {
    console.error("Registration Error:", err);
    msg.textContent = "❌ " + err.message;
    msg.className = 'text-danger fw-bold min-h-20';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign Up";
  }
}

function handleRoleChange() {
  const role = document.getElementById('reg-role').value;
  const gradeField = document.getElementById('reg-grade').parentElement.parentElement;
  const subjectField = document.getElementById('reg-subject').parentElement.parentElement;
  const inviteField = document.getElementById('reg-invite').parentElement;

  if (role === 'Student') {
    gradeField.style.display = 'flex'; // Fix display type
    subjectField.style.display = 'flex';
    inviteField.style.display = 'none';
    document.getElementById('reg-grade').required = true;
  } else if (role === 'Teacher') {
    gradeField.style.display = 'none';
    subjectField.style.display = 'none';
    inviteField.style.display = 'block';
    document.getElementById('reg-grade').required = false;
    document.getElementById('reg-invite').required = true;
  } else {
    // Parent
    gradeField.style.display = 'none';
    subjectField.style.display = 'none';
    inviteField.style.display = 'none';
    document.getElementById('reg-grade').required = false;
  }
}

function checkPasswordStrength(password) {
  const msg = document.getElementById('password-strength-msg');
  if (!msg) return;

  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (hasLength && hasLetter && hasNumber && hasSpecial) {
    msg.textContent = 'Strong Password ✅';
    msg.className = 'small mb-3 ms-1 fw-bold text-success';
  } else {
    msg.textContent = 'Weak Password (Req: 8+ chars, Letter, Number, Special)';
    msg.className = 'small mb-3 ms-1 fw-bold text-danger';
  }
}

// ===================== NAVIGATION HELPERS =====================
function showRegister(e) {
  if (e) e.preventDefault();
  switchView('register-view');
}

function showLogin(e) {
  if (e) e.preventDefault();
  switchView('login-view');
}

// ===================== DASHBOARD INIT =====================
async function initializeDashboard() {
  document.getElementById('auth-status').innerHTML =
    `<b>Role:</b> ${appState.role} | <b>User:</b> ${appState.userId}`;

  // Fix: Only fetch "All Students" if Teacher/Admin
  if (['Admin', 'Teacher'].includes(appState.role)) {
    await fetchStudents();
  }

  if (['Teacher'].includes(appState.role)) {
    renderTeacherControls();
    renderTeacherDashboard();
  } else if (appState.role === 'Admin') {
    renderTeacherControls();
    renderAdminDashboard();
  } else if (appState.role === 'Parent') {
    renderParentDashboard();
  } else {
    loadStudentDashboard(appState.activeStudentId);
  }

  loadLiveClasses();
}

// ===================== ADMIN =====================
async function renderAdminDashboard() {
  switchView('admin-view');
  const table = document.getElementById('audit-log-table');
  table.innerHTML = '<tr><td colspan="4">Loading logs...</td></tr>';

  const res = await fetchAPI('/admin/audit-logs');
  if (!res.ok) {
    table.innerHTML = '<tr><td colspan="4" class="text-danger">Failed to load logs</td></tr>';
    return;
  }

  const logs = await res.json();
  table.innerHTML = logs.map(l => `
    <tr>
        <td>${new Date(l.timestamp).toLocaleString()}</td>
        <td>${l.user_id}</td>
        <td><span class="badge bg-secondary">${l.event_type}</span></td>
        <td class="small text-muted">${l.details}</td>
    </tr>
  `).join('');
}

// ===================== PARENT =====================
async function renderParentDashboard() {
  switchView('parent-view');
  const metrics = document.getElementById('parent-metrics');
  const table = document.getElementById('parent-history-table');

  metrics.innerHTML = 'Loading...';

  const res = await fetchAPI('/parent/child-data');
  if (!res.ok) {
    metrics.innerHTML = '<div class="alert alert-danger">Could not load child data. Ensure a student is linked.</div>';
    return;
  }

  const data = await res.json();

  document.getElementById('parent-child-name').textContent = data.student_name;

  metrics.innerHTML = '';
  renderMetric(metrics, 'Avg Score', data.summary.avg_score + '%', 'border-primary');
  renderMetric(metrics, 'Activities', data.summary.total_activities);
  renderMetric(metrics, 'Math', data.summary.math_score + '%');
  renderMetric(metrics, 'Science', data.summary.science_score + '%');

  table.innerHTML = data.history.map(h => `
    <tr>
        <td>${h.date}</td>
        <td>${h.topic}</td>
        <td><span class="badge ${h.score >= 80 ? 'bg-success' : 'bg-warning'}">${h.score}%</span></td>
    </tr>
  `).join('');
}

// ===================== LOCALIZATION =====================
const I18N = {
  en: {
    welcome: "Welcome to Noble Nexus",
    signin: "Sign in to the Noble Nexus Portal",
    role_student: "Student",
    role_parent: "Parent",
    role_teacher: "Teacher",
  },
  es: {
    welcome: "Bienvenido a Noble Nexus",
    signin: "Inicie sesión en el Portal Noble Nexus",
    role_student: "Estudiante",
    role_parent: "Padre",
    role_teacher: "Maestro",
  },
  fr: {
    welcome: "Bienvenue à Noble Nexus",
    signin: "Connectez-vous au portail Noble Nexus",
    role_student: "Élève",
    role_parent: "Parent",
    role_teacher: "Professeur",
  }
};

function switchLanguage(lang) {
  const texts = I18N[lang] || I18N.en;
  const welcomeHeader = document.querySelector('#login-view h2');
  if (welcomeHeader) welcomeHeader.textContent = texts.welcome;
  const signinText = document.querySelector('#login-view p.text-muted');
  if (signinText) signinText.textContent = texts.signin;
  localStorage.setItem('app_lang', lang);
}

const savedLang = localStorage.getItem('app_lang');
if (savedLang) {
  document.getElementById('lang-toggle').value = savedLang;
  switchLanguage(savedLang);
}

// ===================== STUDENTS =====================
async function fetchStudents() {
  const res = await fetchAPI('/students/all');
  appState.allStudents = res.ok ? await res.json() : [];
}

async function loadStudentDashboard(studentId) {
  if (!studentId) return;
  appState.activeStudentId = studentId;
  switchView('student-view');

  const res = await fetchAPI(`/students/${studentId}/data`);
  const data = await res.json();
  const summary = data.summary;

  document.getElementById('student-name-header').textContent = "Welcome back!";

  const metrics = document.getElementById('student-metrics');
  metrics.innerHTML = '';
  renderMetric(metrics, 'Avg Score', summary.avg_score + '%');
  renderMetric(metrics, 'Activities', summary.total_activities);
  renderMetric(metrics, 'Math', summary.math_score + '%');
  renderMetric(metrics, 'Science', summary.science_score + '%');
  renderMetric(metrics, 'English', summary.english_language_score + '%');

  if (summary.recommendation) {
    const box = document.getElementById('recommendation-box');
    box.style.display = 'block';

    // Check structure of recommendation response
    let tips = "Keep up the good work!";
    if (summary.recommendation.personalized_tips && summary.recommendation.personalized_tips.length > 0) {
      tips = summary.recommendation.personalized_tips[0];
    }

    box.innerHTML = `<b>💡 AI Recommendation:</b> ${tips}`;
  }
}

// ===================== TEACHER =====================
function renderTeacherControls() {
  const c = document.getElementById('user-controls');
  const isAdmin = appState.role === 'Admin';

  c.innerHTML = `
    <div class="mb-3 border-bottom pb-3">
        <label class="small text-muted fw-bold mb-1">Language / Location</label>
        <select id="lang-toggle" class="form-select form-select-sm" onchange="switchLanguage(this.value)">
            <option value="en">🇺🇸 English</option>
            <option value="es">🇪🇸 Spanish</option>
            <option value="fr">🇫🇷 French</option>
        </select>
    </div>
    
    <label class="small text-muted fw-bold mb-1">Navigation</label>
    <select class="form-select mb-3" onchange="switchView(this.value)">
      ${isAdmin ? '<option value="admin-view">🛡️ Admin Dashboard</option>' : ''}
      <option value="teacher-view">🏫 Teacher Dashboard</option>
      <option value="groups-view">👥 Groups</option>
      <option value="student-view">🎓 Student View (Preview)</option>
    </select>
    <button class="btn btn-danger w-100" onclick="handleLogout()">Logout</button>
  `;
}

async function renderTeacherDashboard() {
  switchView('teacher-view');
  const metrics = document.getElementById('teacher-metrics');
  const table = document.getElementById('roster-table');
  metrics.innerHTML = 'Loading...';
  table.innerHTML = '';

  const res = await fetchAPI('/teacher/overview');
  const data = await res.json();

  // Also fetch all student details for lock status
  const resAll = await fetchAPI('/students/all');
  const allStudents = await resAll.json();
  const lockMap = {};
  allStudents.forEach(s => lockMap[s.id] = s.locked_until);

  metrics.innerHTML = '';
  renderMetric(metrics, 'Students', data.total_students);
  renderMetric(metrics, 'Attendance', data.class_attendance_avg + '%');
  renderMetric(metrics, 'Avg Score', data.class_score_avg + '%');

  table.innerHTML = data.roster.map(s => {
    const isLocked = lockMap[s.ID] && new Date(lockMap[s.ID]) > new Date();

    return `
    <tr class="${isLocked ? 'table-danger' : ''}">
      <td>${s.ID}</td>
      <td>
        ${s.Name} 
        ${isLocked ? '<span class="badge bg-danger">🔒 LOCKED</span>' : ''}
      </td>
      <td>${s.Grade}</td>
      <td>${s['Avg Score']}%</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="loadStudentDashboard('${s.ID}')">View</button>
        <button class="btn btn-sm btn-warning" onclick="openEditStudentModal('${s.ID}')">Edit</button>
        ${isLocked ? `<button class="btn btn-sm btn-success" onclick="handleUnlockUser('${s.ID}')">🔓 Unlock</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="handleDeleteStudent('${s.ID}','${s.Name}')">Delete</button>
      </td>
    </tr>
  `}).join('');
}

// ===================== EDIT STUDENT =====================
async function openEditStudentModal(studentId) {
  const s = appState.allStudents.find(x => x.id === studentId);
  if (!s) return alert('Student not found');

  document.getElementById('edit-id').value = s.id;
  document.getElementById('edit-name').value = s.name;
  document.getElementById('edit-grade').value = s.grade;
  document.getElementById('edit-subject').value = s.preferred_subject;
  document.getElementById('edit-lang').value = s.home_language;
  document.getElementById('edit-attendance').value = s.attendance_rate;

  // Handle Role UI (Admin Only)
  const roleSelect = document.getElementById('edit-role');
  const roleContainer = document.getElementById('edit-role-container');
  if (s.role) roleSelect.value = s.role;

  if (appState.role === 'Admin') {
    roleContainer.style.display = 'block';
  } else {
    roleContainer.style.display = 'none';
  }

  document.getElementById('edit-id-display').textContent = s.id;
  new bootstrap.Modal(document.getElementById('editStudentModal')).show();
}

async function submitEditStudentForm() {
  const id = document.getElementById('edit-id').value;
  const payload = {
    name: document.getElementById('edit-name').value,
    grade: +document.getElementById('edit-grade').value,
    preferred_subject: document.getElementById('edit-subject').value,
    home_language: document.getElementById('edit-lang').value,
    attendance_rate: +document.getElementById('edit-attendance').value
  };

  const res = await fetchAPI(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  if (appState.role === 'Admin') {
    const newRole = document.getElementById('edit-role').value;
    await fetchAPI(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole })
    });
  }

  if (res.ok) {
    bootstrap.Modal.getInstance(document.getElementById('editStudentModal')).hide();
    initializeDashboard();
  } else alert('Update failed');
}

// ===================== UNLOCK USER =====================
async function handleUnlockUser(userId) {
  if (!confirm(`Are you sure you want to manually unlock user ${userId}?`)) return;

  try {
    const res = await fetchAPI(`/admin/users/${userId}/unlock`, { method: 'POST' });
    if (res.ok) {
      alert('✅ User unlocked successfully.');
      initializeDashboard();
    } else {
      const data = await res.json();
      alert('❌ Error: ' + (data.detail || 'Unlock failed'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ===================== CHAT =====================
function appendChatMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = role === 'user' ? 'chat-message user-message' : 'chat-message assistant-message';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  appendChatMessage('user', message);
  input.value = '';

  try {
    const res = await fetchAPI(`/ai/chat/${appState.activeStudentId}`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    if (!res.ok) throw new Error('AI unavailable');
    const data = await res.json();
    appendChatMessage('assistant', data.reply);
  } catch (err) {
    appendChatMessage('assistant', '⚠️ AI Tutor is currently unavailable. Please try again later.');
  }
}

// ===================== EVENTS =====================
// Attach events safely (check if element exists first)
const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.addEventListener('submit', handleLogin);

const registerForm = document.getElementById('register-form');
if (registerForm) registerForm.addEventListener('submit', handleRegister);

const editForm = document.getElementById('edit-student-form');
if (editForm) editForm.addEventListener('submit', e => {
  e.preventDefault();
  submitEditStudentForm();
});

const chatForm = document.getElementById('chat-form');
if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);