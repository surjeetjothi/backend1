// --- CONFIGURATION ---
// Automatically detects if running on localhost or production server
// On server: uses explicit Render Backend URL (since Frontend is on Vercel, Backend is on Render)
// On localhost: uses explicit 'http://127.0.0.1:8000/api'
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:')
    ? 'http://127.0.0.1:8000/api'
    : 'https://backend1-bzh1.onrender.com/api'; // Point to Render Backend explicitly

// Check if running from file:// which breaks OAuth
if (window.location.protocol === 'file:') {
    console.warn("Google Sign-In requires running on a server (http://127.0.0.1:8000) to work.");
}

// --- MSAL CONFIGURATION (MICROSOFT) ---
// --- MSAL CONFIGURATION (MICROSOFT) ---
const msalConfig = {
    auth: {
        clientId: "8b6e2b20-90f6-423d-9530-390fcaa4651f", // PLACEHOLDER: User must replace this!
        authority: "https://login.microsoftonline.com/common",
        redirectUri: "http://localhost:8000"
        // Dynamic: works on Localhost AND Render
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    }
};

let msalInstance;
try {
    msalInstance = new msal.PublicClientApplication(msalConfig);
} catch (e) {
    console.warn("MSAL Initialization failed (likely due to placeholder ID). Microsoft Login will fall back to simulation.");
}

// --- STATE MANAGEMENT ---
let appState = {
    isLoggedIn: false,
    role: null,
    userId: null,
    activeStudentId: null,
    allStudents: [],
    chatMessages: {},
    groups: [],
    groups: [],
    currentCourseId: null,
    activeSchoolId: null, // For Super Admin context switching
    name: null,
    roles: [],
    permissions: []
};

function hasPermission(code) {
    return appState.isSuperAdmin || appState.permissions.includes(code) || appState.permissions.includes('*');
}

function restoreAuthState() {
    const stored = localStorage.getItem('classbridge_session');
    if (stored) {
        const session = JSON.parse(stored);
        appState.isLoggedIn = true;
        appState.role = session.role;
        appState.userId = session.user_id;
        appState.name = session.name;
        appState.schoolId = session.school_id;
        appState.schoolName = session.school_name;
        appState.isSuperAdmin = session.is_super_admin;
        appState.roles = session.roles || [];
        appState.permissions = session.permissions || [];
        return true;
    }
    return false;
}

// --- LOCALIZATION & ACCESSIBILITY (FR-17, FR-16) ---
const translations = {
    en: {
        login_welcome: "Welcome to Noble Nexus",
        login_subtitle: "Sign in to the Noble Nexus Portal",
        label_username: "Username / Student ID",
        label_password: "Password",
        link_forgot_password: "Forgot Password?",
        btn_signin: "Sign In",
        btn_signin_microsoft: "Sign in with Microsoft",
        text_or: "OR",
        text_new_user: "New User?",
        link_signup: "Sign Up",
        link_help: "Need help? Contact support",
        // Dynamic Messages
        msg_enter_credentials: "Please enter both username and password.",
        msg_checking: "Checking credentials...",
        msg_welcome: "Welcome, {user_id}",
        msg_login_failed: "Login failed",
        msg_network_error: "Network Error: {error}. Is the backend running?",
        msg_google_verify: "Verifying Google Token...",
        msg_microsoft_conn: "Connecting to Microsoft...",
        msg_microsoft_verify: "Verifying Microsoft Token...",
    },
    es: {
        login_welcome: "Bienvenido a Noble Nexus",
        login_subtitle: "Inicia sesión en el portal Noble Nexus",
        label_username: "Usuario / ID de Estudiante",
        label_password: "Contraseña",
        link_forgot_password: "¿Olvidaste tu contraseña?",
        btn_signin: "Iniciar Sesión",
        btn_signin_microsoft: "Entrar con Microsoft",
        text_or: "O",
        text_new_user: "¿Nuevo usuario?",
        link_signup: "Regístrate",
        link_help: "¿Necesitas ayuda? Contacta soporte",
        // Dynamic Messages
        msg_enter_credentials: "Por favor ingrese usuario y contraseña.",
        msg_checking: "Verificando credenciales...",
        msg_welcome: "Bienvenido, {user_id}",
        msg_login_failed: "Inicio de sesión fallido",
        msg_network_error: "Error de red: {error}. ¿Está el servidor activo?",
        msg_google_verify: "Verificando token de Google...",
        msg_microsoft_conn: "Conectando con Microsoft...",
        msg_microsoft_verify: "Verificando token de Microsoft...",
    }
};

let currentLanguage = localStorage.getItem('appLanguage') || 'en';

function t(key, params = {}) {
    let text = translations[currentLanguage][key] || key;
    for (const [placeholder, value] of Object.entries(params)) {
        text = text.replace(`{${placeholder}}`, value);
    }
    return text;
}

function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);
    updateTranslations();
    document.documentElement.lang = lang; // Accessibility: Update HTML lang attribute
}

function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            el.textContent = translations[currentLanguage][key];
        }
    });

    // Update Dropdown Value if called programmatically
    const toggle = document.getElementById('lang-toggle');
    if (toggle) toggle.value = currentLanguage;
}

// Initialize Language on Load
// Initialize Language & Auth on Load
document.addEventListener('DOMContentLoaded', () => {
    updateTranslations();

    if (restoreAuthState()) {
        if (appState.role === 'Student') {
            renderStudentControls();
            document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
            // Routing will handle the rest via handleHashRouting inside render
        } else if (appState.role === 'Parent') {
            renderParentControls();
        } else {
            renderTeacherControls();
        }
    } else {
        // Check hash for direct link if public (e.g. login?)
        // If hash exists but not logged in, maybe show login?
        // switchView('landing-view'); // Default
    }
});





// --- DOM ELEMENTS & MODALS ---
const elements = {
    loginView: document.getElementById('login-view'),
    teacherView: document.getElementById('teacher-view'),
    groupsView: document.getElementById('groups-view'),
    studentView: document.getElementById('student-view'),

    loginForm: document.getElementById('login-form'),
    authStatus: document.getElementById('auth-status'),
    userControls: document.getElementById('user-controls'),
    teacherMetrics: document.getElementById('teacher-metrics'),
    rosterTable: document.getElementById('roster-table'),
    classPerformanceChart: document.getElementById('class-performance-chart'),
    studentNameHeader: document.getElementById('student-name-header'),
    studentMetrics: document.getElementById('student-metrics'),
    historyTable: document.getElementById('history-table'),
    studentProgressChart: document.getElementById('student-progress-chart'),
    chatMessagesContainer: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    recommendationBox: document.getElementById('recommendation-box'),
    loginMessage: document.getElementById('login-message'),

    // Modals (Bootstrap Instances)
    addStudentModal: new bootstrap.Modal(document.getElementById('addStudentModal')),
    editStudentModal: new bootstrap.Modal(document.getElementById('editStudentModal')),
    addActivityModal: new bootstrap.Modal(document.getElementById('addActivityModal')),
    scheduleClassModal: new bootstrap.Modal(document.getElementById('scheduleClassModal')),
    createGroupModal: new bootstrap.Modal(document.getElementById('createGroupModal')),
    manageMembersModal: new bootstrap.Modal(document.getElementById('manageMembersModal')),
    aboutPortalModal: new bootstrap.Modal(document.getElementById('aboutPortalModal')),
    deleteConfirmationModal: new bootstrap.Modal(document.getElementById('deleteConfirmationModal')),
    forgotPasswordModal: new bootstrap.Modal(document.getElementById('forgotPasswordModal')),
    resetPasswordModal: new bootstrap.Modal(document.getElementById('resetPasswordModal')),

    // Modal DOM Elements (for values)
    addStudentForm: document.getElementById('add-student-form'),
    addStudentMessage: document.getElementById('add-student-message'),
    addActivityForm: document.getElementById('add-activity-form'),
    addActivityMessage: document.getElementById('add-activity-message'),
    activityStudentSelect: document.getElementById('activity-student-select'),
    editStudentForm: document.getElementById('edit-student-form'),
    editStudentMessage: document.getElementById('edit-student-message'),
    scheduleClassForm: document.getElementById('schedule-class-form'),
    scheduleMessage: document.getElementById('schedule-message'),

    // Live Class
    meetLinkInput: document.getElementById('meet-link-input'),
    startClassBtn: document.getElementById('start-class-btn'),
    endClassBtn: document.getElementById('end-class-btn'),
    studentLiveBanner: document.getElementById('student-live-banner'),
    studentJoinLink: document.getElementById('student-join-link'),
    liveClassesList: document.getElementById('live-classes-list'),
};

// --- HELPER FUNCTIONS ---



function openProfileView() {
    switchView('profile-view');
    loadProfileDetails();
}

function loadProfileDetails() {
    // Basic info from header (which matches current session)
    const name = document.getElementById('header-user-name').textContent;
    const role = appState.role || 'User';
    const userId = appState.userId || '--';
    const imgSrc = document.getElementById('header-user-img').src;

    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-role').textContent = role;
    document.getElementById('profile-id').textContent = userId;
    document.getElementById('profile-img-large').src = imgSrc;

    // Simulate Email since backend doesn't store it yet
    document.getElementById('profile-email').textContent = `${userId.toLowerCase().replace(/\s/g, '')}@noblenexus.edu`;
}

function renderMetric(container, label, value, colorClass = 'widget-purple') {
    let icon = 'menu_book'; // Default icon
    if (label.includes('Student')) icon = 'menu_book';
    if (label.includes('Teacher')) icon = 'person_outline';
    if (label.includes('Staff')) icon = 'people';
    if (label.includes('Awards')) icon = 'emoji_events';

    let subText = '';
    if (label.includes('Teachers')) subText = '! 3% from last month';
    if (label.includes('Staff')) subText = '→ No change';
    if (label.includes('Awards')) subText = '↑ 15% from last month';

    const col = document.createElement('div');
    col.className = 'col-lg-3 col-md-6';
    col.innerHTML = `
            <div class="metric-widget ${colorClass}">
                 <div class="d-flex justify-content-between w-100 mb-3">
                     <span class="text-white fw-medium">${label}</span>
                     <span class="material-icons text-white">${icon}</span>
                 </div>
                 <div class="d-flex flex-column align-items-start">
                     <h3 class="fw-bold text-white mb-1" style="font-size: 28px;">${value}</h3>
                     <span class="text-white small opacity-75">${subText}</span>
                 </div>
            </div>
        `;
    container.appendChild(col);
}

function getEventBadgeClass(eventType) {
    if (eventType.includes("Success")) return "bg-success";
    if (eventType.includes("Failed") || eventType.includes("Unauthorized")) return "bg-danger";
    if (eventType.includes("Logout")) return "bg-secondary";
    if (eventType.includes("Password")) return "bg-warning text-dark";
    return "bg-info text-dark";
}

async function fetchAPI(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };

    // Inject RBAC Headers if logged in
    if (appState.isLoggedIn && appState.role && appState.userId) {
        headers['X-User-Role'] = appState.role;
        headers['X-User-Id'] = appState.userId;

        // Context Switching for Super Admin
        if (appState.activeSchoolId) {
            headers['X-School-Id'] = appState.activeSchoolId;
        }
    }

    // Merge user-supplied headers if any
    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    // Allow custom timeout, default to 30s (increased for AI)
    const timeout = options.timeout || 30000;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    // Remove custom 'timeout' prop before passing to fetch (it's not standard)
    const { timeout: _, ...fetchOptions } = options;

    const finalOptions = { ...fetchOptions, headers: headers, signal: controller.signal };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, finalOptions);
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        console.error("Fetch API Error:", error);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000}s. Server is busy.`);
        }
        throw new Error("Network connection failed. Is the server running?");
    }
}

// --- EDIT STUDENT LOGIC ---

function openEditStudentModal(studentId) {
    const student = appState.allStudents.find(s => (s.id || s.ID) === studentId);
    if (!student) {
        alert("Student data not found!");
        return;
    }

    const safeVal = (v, def) => (v !== undefined && v !== null ? v : def);

    document.getElementById('edit-id').value = student.id || student.ID;
    document.getElementById('edit-id-display').textContent = student.id || student.ID;
    document.getElementById('edit-name').value = student.name || student.Name || '';
    document.getElementById('edit-password').value = ''; // Clear previous password input

    document.getElementById('edit-grade').value = safeVal(student.grade, safeVal(student.Grade, 9));
    document.getElementById('edit-subject').value = student.preferred_subject || student.Subject || 'General';
    document.getElementById('edit-lang').value = student.home_language || student['Home Language'] || 'English';
    document.getElementById('edit-attendance').value = safeVal(student.attendance_rate, safeVal(student['Attendance %'], 0));

    fetchDetailedStudentForEdit(studentId);
}

async function fetchDetailedStudentForEdit(studentId) {
    try {
        const response = await fetchAPI(`/students/${studentId}/data`);
        if (response.ok) {
            const data = await response.json();

            // Update Number Inputs
            document.getElementById('edit-math-score').value = data.summary.math_score;
            document.getElementById('edit-science-score').value = data.summary.science_score;
            document.getElementById('edit-english-score').value = data.summary.english_language_score;

            // Update Range Sliders
            document.getElementById('rng-math').value = data.summary.math_score;
            document.getElementById('rng-science').value = data.summary.science_score;
            document.getElementById('rng-english').value = data.summary.english_language_score;

            // Update Labels
            document.getElementById('lbl-math').textContent = data.summary.math_score + '%';
            document.getElementById('lbl-science').textContent = data.summary.science_score + '%';
            document.getElementById('lbl-english').textContent = data.summary.english_language_score + '%';

            // Reset Tabs to first one
            const firstTabEl = document.querySelector('#editStudentTabs button[data-bs-target="#edit-profile"]');
            const tab = new bootstrap.Tab(firstTabEl);
            tab.show();

            elements.editStudentModal.show();
        } else {
            alert("Failed to fetch student details for editing.");
        }
    } catch (error) {
        console.error(error);
        alert("Error fetching student details.");
    }
}

// EXPOSED FUNCTION for direct onclick
async function submitEditStudentForm() {
    console.log("Manual submit trigger");
    const msgEl = document.getElementById('edit-student-message'); // Direct fetch to be safe
    msgEl.textContent = 'Saving...';
    msgEl.className = 'text-primary fw-medium d-block p-2';
    msgEl.classList.remove('d-none');

    const studentId = document.getElementById('edit-id').value;
    const updateData = {
        name: document.getElementById('edit-name').value,
        grade: parseInt(document.getElementById('edit-grade').value) || 0,
        preferred_subject: document.getElementById('edit-subject').value,
        home_language: document.getElementById('edit-lang').value,
        attendance_rate: parseFloat(document.getElementById('edit-attendance').value) || 0.0,
        math_score: parseFloat(document.getElementById('edit-math-score').value) || 0.0,
        science_score: parseFloat(document.getElementById('edit-science-score').value) || 0.0,
        english_language_score: parseFloat(document.getElementById('edit-english-score').value) || 0.0,
    };

    // Include password only if entered
    const newPass = document.getElementById('edit-password').value.trim();
    if (newPass) {
        updateData.password = newPass;
    }

    try {
        const response = await fetchAPI(`/students/${studentId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            msgEl.textContent = "Saved successfully!";
            msgEl.className = 'text-success fw-bold d-block p-2';
            alert("Success: Student Updated!");

            setTimeout(() => {
                const modalEl = document.getElementById('editStudentModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                msgEl.textContent = '';
            }, 1000);

            await initializeDashboard();
        } else {
            const data = await response.json();
            console.error("Save failed:", data);
            msgEl.textContent = "Error: " + (data.detail || "Unknown error");
            msgEl.className = 'text-danger fw-bold d-block p-2';

            if (response.status === 403) {
                alert("Permission Denied: You do not have permission to edit students.");
            } else {
                alert("Update Failed: " + (data.detail || "Check console"));
            }
        }
    } catch (error) {
        console.error(error);
        msgEl.textContent = "Network Error";
        alert("Network Error: " + error.message);
    }
}

// --- ROLE & PERMISSION MANAGEMENT ---
async function loadRoles() {
    const tableBody = document.getElementById('roles-table-body');
    // Ensure tab is active if calling directly
    // Reset contents
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const response = await fetchAPI('/admin/roles');
        if (response.ok) {
            const roles = await response.json();
            renderRolesTable(roles);

            // Render Create Button if Permitted
            const createContainer = document.getElementById('role-create-action');
            if (createContainer && hasPermission('role_management')) {
                createContainer.innerHTML = `<button class="btn btn-primary rounded-pill shadow-sm" onclick="openRoleModal()">
                        <span class="material-icons align-middle me-1">add</span> Create Role
                    </button>`;
            } else if (createContainer) {
                createContainer.innerHTML = '';
            }
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load roles.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Network Error</td></tr>';
    }
}

function renderRolesTable(roles) {
    const tableBody = document.getElementById('roles-table-body');
    tableBody.innerHTML = '';

    roles.forEach(role => {
        // Filter Root_Super_Admin visibility
        if (role.name === 'Super Admin' && !appState.isSuperAdmin) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge bg-light text-dark border">${role.code}</span></td>
            <td class="fw-medium">${role.name}</td>
            <td>
                <span class="badge ${role.status === 'Active' ? 'bg-success' : 'bg-secondary'} rounded-pill">
                    ${role.status}
                </span>
            </td>
            <td class="small text-muted">${role.description}</td>
            <td>
                ${(hasPermission('role_management') && !role.is_system) ?
                `<button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="openRoleModal(${role.id})">
                        <span class="material-icons" style="font-size: 18px;">edit</span>
                    </button>` : ''}
                
                ${(hasPermission('role_management') && !role.is_system) ?
                `<button class="btn btn-sm btn-link text-danger p-0" onclick="deleteRole(${role.id}, '${role.name}')">
                        <span class="material-icons" style="font-size: 18px;">delete</span>
                    </button>` : ''}
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function openRoleModal(roleId = null) {
    const modalTitle = document.getElementById('role-form-title');
    const form = document.getElementById('role-form');

    // Clear Form
    form.reset();
    document.getElementById('role-id').value = '';
    document.getElementById('role-perms-container').innerHTML = '<div class="spinner-border spinner-border-sm"></div> Loading permissions...';

    if (roleId) {
        modalTitle.textContent = 'Edit Role';
        document.getElementById('role-id').value = roleId;
        // Fetch details
        fetchAPI(`/admin/roles/${roleId}`).then(res => res.json()).then(data => {
            document.getElementById('role-name').value = data.name;
            document.getElementById('role-desc').value = data.description;
            // Status radio
            if (document.querySelector(`input[name="roleStatus"][value="${data.status}"]`)) {
                document.querySelector(`input[name="roleStatus"][value="${data.status}"]`).checked = true;
            }
            loadPermissionsForModal(data.permissions.map(p => p.code));
        });
    } else {
        modalTitle.textContent = 'Create Role';
        loadPermissionsForModal([]);
    }

    switchView('role-form-view');
}

async function loadPermissionsForModal(selectedCodes = []) {
    const container = document.getElementById('role-perms-container');
    try {
        const response = await fetchAPI('/admin/permissions');
        const groupedPerms = await response.json();

        container.innerHTML = '';

        for (const [group, perms] of Object.entries(groupedPerms)) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'mb-3';
            groupDiv.innerHTML = `<h6 class="fw-bold small text-uppercase text-muted border-bottom pb-1 mb-2">${group}</h6>`;

            const row = document.createElement('div');
            row.className = 'row g-2';

            perms.forEach(p => {
                const isChecked = selectedCodes.includes(p.code);
                const col = document.createElement('div');
                col.className = 'col-md-6';
                col.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input perm-check" type="checkbox" value="${p.code}" id="perm-${p.id}" ${isChecked ? 'checked' : ''}>
                        <label class="form-check-label small" for="perm-${p.id}" title="${p.description}">
                            ${p.description} <span class="text-muted" style="font-size: 10px;">(${p.code})</span>
                        </label>
                    </div>
                `;
                row.appendChild(col);
            });

            groupDiv.appendChild(row);
            container.appendChild(groupDiv);
        }
    } catch (e) {
        container.textContent = "Error loading permissions.";
    }
}

async function handleSaveRole() {
    const roleId = document.getElementById('role-id').value;
    const name = document.getElementById('role-name').value;
    const desc = document.getElementById('role-desc').value;
    const status = document.querySelector('input[name="roleStatus"]:checked').value;

    // Get checked perms
    const selectedPerms = Array.from(document.querySelectorAll('.perm-check:checked')).map(el => el.value);

    const endpoint = roleId ? `/admin/roles/${roleId}` : '/admin/roles';
    const method = roleId ? 'PUT' : 'POST';

    try {
        const response = await fetchAPI(endpoint, {
            method: method,
            body: JSON.stringify({
                name: name,
                description: desc,
                status: status,
                permissions: selectedPerms
            })
        });

        if (response.ok) {
            switchView('roles-view');
            loadRoles();
        } else {
            alert("Failed to save role.");
        }
    } catch (e) {
        alert("Network error.");
    }
}

async function deleteRole(id, name) {
    if (!confirm(`Are you sure you want to delete role: ${name}?`)) return;

    try {
        const response = await fetchAPI(`/admin/roles/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadRoles();
        } else {
            const d = await response.json();
            alert(d.detail || "Failed to delete.");
        }
    } catch (e) {
        alert("Network error.");
    }
}

// --- PERMISSION MANAGEMENT ---
async function loadPermissionsList() {
    const tableBody = document.getElementById('perms-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';

    try {
        const response = await fetchAPI('/admin/permissions/list');
        if (response.ok) {
            const perms = await response.json();
            renderPermissionsTable(perms);
        } else {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load permissions.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Network Error</td></tr>';
    }
}

function renderPermissionsTable(perms) {
    const tableBody = document.getElementById('perms-table-body');
    tableBody.innerHTML = '';

    perms.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge bg-light text-dark border">${p.display_code}</span></td>
            <td class="fw-medium font-monospace text-primary small">${p.code}</td>
            <td class="small text-muted">${p.description}</td>
            <td>
                ${(hasPermission('permission_management')) ?
                `<button class="btn btn-sm btn-link text-primary p-0" onclick="openPermissionEditModal(${p.id}, '${p.code}', '${p.description.replace(/'/g, "\\'")}')">
                        <span class="material-icons" style="font-size: 18px;">edit</span>
                    </button>` : ''}
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function openPermissionEditModal(id, code, desc) {
    document.getElementById('perm-edit-id').value = id;
    document.getElementById('perm-edit-code').value = `P-${String(id).padStart(4, '0')}`;
    document.getElementById('perm-edit-title').value = code;
    document.getElementById('perm-edit-desc').value = desc;

    new bootstrap.Modal(document.getElementById('permEditModal')).show();
}

async function handleUpdatePermission() {
    const id = document.getElementById('perm-edit-id').value;
    const desc = document.getElementById('perm-edit-desc').value;

    try {
        const response = await fetchAPI(`/admin/permissions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ description: desc })
        });

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('permEditModal')).hide();
            loadPermissionsList();
        } else {
            alert("Failed to update permission.");
        }
    } catch (e) {
        alert("Network error.");
    }
}
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    // Handle Sidebar Visibility
    const body = document.body;
    if (viewId === 'login-view' || viewId === 'register-view' || viewId === 'two-factor-view' || viewId === 'landing-view') {
        body.classList.add('login-mode');
    } else {
        body.classList.remove('login-mode');
    }
}

async function loadSchoolsForRegistration() {
    try {
        const select = document.getElementById('reg-school');
        if (!select) return;

        select.innerHTML = '<option value="">Loading schools...</option>';

        const response = await fetch(`${API_BASE_URL}/admin/schools`);
        if (response.ok) {
            const schools = await response.json();
            select.innerHTML = '';

            schools.forEach(school => {
                const opt = document.createElement('option');
                opt.value = school.id;
                opt.textContent = school.name;
                select.appendChild(opt);
            });

            if (schools.length === 0) {
                const opt = document.createElement('option');
                opt.value = 1;
                opt.textContent = "Independent / Default School";
                select.appendChild(opt);
            }
        } else {
            select.innerHTML = '<option value="1">Default School</option>';
        }
    } catch (e) {
        console.error("Error loading schools", e);
        const select = document.getElementById('reg-school');
        if (select) select.innerHTML = '<option value="1">Default School</option>';
    }
}

function showRegister(e) {
    if (e && e.preventDefault) e.preventDefault();
    switchView('register-view');
    loadSchoolsForRegistration();
}

function showLogin(e) {
    if (e) e.preventDefault();
    switchView('login-view');
}

// --- AUTHENTICATION ---

async function handleRegister(e) {
    e.preventDefault();
    const msg = document.getElementById('register-message');
    msg.textContent = 'Creating account...';
    msg.className = 'text-primary fw-bold';

    let inviteInput = document.getElementById('reg-invite').value.trim();
    // Fix: Extract token if user pasted full URL
    if (inviteInput.includes("invite=")) {
        inviteInput = inviteInput.split("invite=")[1].split("&")[0];
    }

    const password = document.getElementById('reg-password').value;
    if (!checkPasswordStrength(password)) {
        msg.className = 'text-danger fw-bold';
        msg.textContent = 'Please fix password issues before submitting.';
        return;
    }

    const data = {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: password,
        grade: parseInt(document.getElementById('reg-grade').value) || 9,
        preferred_subject: document.getElementById('reg-subject').value || "General",
        role: document.getElementById('reg-role').value, // FR-3
        invitation_token: inviteInput, // FR-4
        school_id: parseInt(document.getElementById('reg-school').value) || 1
    };

    try {
        const response = await fetchAPI('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            msg.className = 'text-success fw-bold';
            msg.textContent = 'Success! Redirecting to login...';
            setTimeout(() => {
                showLogin();
                document.getElementById('register-form').reset();
                document.getElementById('password-strength-msg').textContent = '';
                msg.textContent = '';
                // Pre-fill login
                document.getElementById('username').value = data.email;
            }, 1500);
        } else {
            msg.className = 'text-danger fw-bold';
            msg.textContent = result.detail || 'Registration failed.';
        }
    } catch (error) {
        msg.className = 'text-danger fw-bold';
        msg.textContent = 'Network error during registration.';
    }
}

// FR-12: Client-side Password Validation
function checkPasswordStrength(password) {
    const msgEl = document.getElementById('password-strength-msg');

    if (password.length === 0) {
        msgEl.textContent = '';
        return false;
    }

    let isValid = true;
    let feedback = [];

    if (password.length < 8) {
        feedback.push("Min 8 chars");
        isValid = false;
    }
    if (!/\d/.test(password)) {
        feedback.push("1 number");
        isValid = false;
    }
    if (!/[a-zA-Z]/.test(password)) {
        feedback.push("1 letter");
        isValid = false;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
        feedback.push("1 special char");
        isValid = false;
    }

    if (isValid) {
        msgEl.textContent = "✅ Strong password";
        msgEl.className = "small mb-3 ms-1 fw-bold text-success";
        return true;
    } else {
        msgEl.textContent = "⚠️ Weak: " + feedback.join(", ");
        msgEl.className = "small mb-3 ms-1 fw-bold text-danger";
        return false;
    }
}

// FR-3 & FR-4: Role Handling and Invitation Logic
function handleRoleChange() {
    const role = document.getElementById('reg-role').value;
    const studentFields = document.querySelector('#register-form .row'); // Grade/Subject fields

    if (role === 'Student') {
        studentFields.style.display = 'flex';
        document.getElementById('reg-grade').required = true;
    } else {
        studentFields.style.display = 'none';
        document.getElementById('reg-grade').required = false;
    }
}

async function generateInvite() {
    const role = document.getElementById('invite-role').value;
    const resultDiv = document.getElementById('invite-result');

    resultDiv.classList.remove('d-none');
    resultDiv.textContent = 'Generating...';

    try {
        const response = await fetchAPI('/invitations/generate', {
            method: 'POST',
            body: JSON.stringify({ role: role, expiry_hours: 48 })
        });

        if (response.ok) {
            const data = await response.json();
            const link = window.location.origin + "/?invite=" + data.token;
            resultDiv.innerHTML = `
                <strong>Token:</strong> ${data.token}<br>
                <div class="input-group input-group-sm mt-1">
                    <input type="text" class="form-control" value="${link}" readonly>
                    <button class="btn btn-outline-secondary" onclick="navigator.clipboard.writeText('${link}')">Copy</button>
                </div>
                <small class="text-danger">Expires: ${new Date(data.expires_at).toLocaleString()}</small>
            `;
        } else {
            resultDiv.textContent = 'Error generating invite.';
        }
    } catch (e) {
        console.error(e);
        resultDiv.textContent = 'Network error.';
    }
}

// Check for Invite Token in URL
document.getElementById('register-form').addEventListener('submit', handleRegister);
document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);
document.getElementById('reset-password-form').addEventListener('submit', handleResetPasswordSubmit); // New Listener

function openForgotPassword(e) {
    if (e) e.preventDefault();
    document.getElementById('forgot-password-form').reset();
    document.getElementById('reset-message').textContent = '';
    elements.forgotPasswordModal.show();
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const msg = document.getElementById('reset-message');

    msg.textContent = 'Sending request...';
    msg.className = 'text-center fw-medium small mb-2 text-primary';

    try {
        const response = await fetchAPI('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        // DEV MODE: Show Link
        if (data.dev_link) {
            msg.innerHTML = `
                <div class="alert alert-success small p-2 mt-2">
                    ${data.message}<br>
                    <a href="${data.dev_link}" class="btn btn-sm btn-success mt-2 fw-bold w-100">
                        <span class="material-icons align-middle" style="font-size: 16px;">email</span> Open Simulated Email
                    </a>
                </div>`;
            msg.className = 'text-center small mb-2';
        } else {
            msg.textContent = data.message;
            msg.className = 'text-center fw-medium small mb-2 text-success';
        }

    } catch (err) {
        msg.textContent = 'Network error.';
        msg.className = 'text-center fw-medium small mb-2 text-danger';
    }
}

// Reset Password Logic
window.addEventListener('DOMContentLoaded', () => {
    // Check for Invite
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (inviteToken) {
        showRegister(new Event('click'));
        document.getElementById('reg-invite').value = inviteToken;
        const msg = document.getElementById('register-message');
        msg.textContent = "Invitation code applied! Please complete registration.";
        msg.className = "text-primary fw-medium";
    }

    // Check for Reset Token
    const resetToken = urlParams.get('reset_token');
    if (resetToken) {
        document.getElementById('reset-token').value = resetToken;
        new bootstrap.Modal(document.getElementById('resetPasswordModal')).show();
        // Clean URL visual
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    const token = document.getElementById('reset-token').value;
    const newPass = document.getElementById('new-reset-pass').value;
    const confirmPass = document.getElementById('confirm-reset-pass').value;
    const msg = document.getElementById('new-reset-message');

    if (newPass !== confirmPass) {
        msg.textContent = 'Passwords do not match.';
        msg.className = 'text-danger fw-bold text-center mb-3';
        return;
    }

    if (!checkPasswordStrength(newPass)) {
        msg.textContent = 'Password is too weak.';
        msg.className = 'text-danger fw-bold text-center mb-3';
        return;
    }

    try {
        const response = await fetchAPI('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token: token, new_password: newPass })
        });

        const data = await response.json();

        if (response.ok) {
            msg.textContent = "Success! Redirecting to login...";
            msg.className = "text-success fw-bold text-center mb-3";
            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal')).hide();
                showLogin();
            }, 2000);
        } else {
            msg.textContent = data.detail || "Reset failed.";
            msg.className = "text-danger fw-bold text-center mb-3";
        }
    } catch (e) {
        msg.textContent = "Network error.";
        msg.className = "text-danger fw-bold text-center mb-3";
    }
}

// FR-Role-Selection
function selectLoginRole(role) {
    // 1. Update State
    document.getElementById('selected-role').value = role;

    // 2. Update UI (New Elements)
    const labelEl = document.getElementById('login-role-label');
    if (labelEl) labelEl.textContent = role;

    const iconEl = document.getElementById('login-role-icon');
    const iconMap = {
        'Student': 'school',
        'Teacher': 'favorite',
        'Parent': 'home',
        'Admin': 'badge',
        'Principal': 'account_balance'
    };
    if (iconEl && iconMap[role]) {
        iconEl.textContent = iconMap[role];
    }

    // 3. Update Title & Labels
    const titleMap = {
        'Student': 'Student Login',
        'Teacher': 'Teacher Portal',
        'Parent': 'Parent Access',
        'Principal': 'Principal Login',
        'Admin': 'Super Admin'
    };
    const titleEl = document.getElementById('login-title');
    if (titleEl) titleEl.textContent = titleMap[role] || 'Login';

    const lbl = document.querySelector('label[for="username"]');
    const input = document.getElementById('username');

    if (lbl && input) {
        if (role === 'Student') {
            lbl.textContent = 'Student ID';
            input.placeholder = 'Student ID';
        } else if (role === 'Parent') {
            lbl.textContent = 'Email / ID';
            input.placeholder = 'Email / ID';
        } else {
            lbl.textContent = 'Staff ID / Username';
            input.placeholder = 'Staff ID';
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const msgEl = elements.loginMessage;

    if (!username || !password) {
        msgEl.textContent = t('msg_enter_credentials');
        msgEl.className = 'text-danger fw-bold';
        return;
    }

    msgEl.className = 'text-primary fw-medium';

    // FR-Role-Selection: Capture selected role
    const selectedRole = document.getElementById('selected-role').value;

    try {
        const response = await fetchAPI('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password, role: selectedRole })
        });

        if (response.ok) {
            const data = await response.json();

            // CHECK 2FA REQUIREMENT
            if (data.requires_2fa) {
                appState.tempUserId = data.user_id; // Store ID for 2nd step
                msgEl.textContent = ""; // Clear message

                // Show relevant demo code
                const demoContainer = document.getElementById('demo-codes-container');
                const demoText = document.getElementById('demo-codes-text');
                const demoMap = {
                    'teacher': '928471, 582931',
                    'admin': '736102',
                };

                if (demoMap[data.user_id]) {
                    demoText.textContent = demoMap[data.user_id];
                    demoContainer.classList.remove('d-none');
                } else {
                    // Fallback for auto-generated codes
                    demoText.textContent = "123456 (Default)";
                    demoContainer.classList.remove('d-none');
                }

                switchView('two-factor-view');
                return;
            }

            // CHECK ROLE MATCH
            // The user MUST have logged in through the correct portal tab.
            // CHECK ROLE MATCH
            const selectedRole = document.getElementById('selected-role').value;

            let allowLogin = false;
            if (data.role === selectedRole) {
                allowLogin = true;
            } else if (data.role === 'Admin' && selectedRole === 'Teacher') {
                // Allow Admin to access Teacher portal
                allowLogin = true;
            }

            if (!allowLogin) {
                msgEl.textContent = `Access Denied: This account belongs to the ${data.role} portal.`;
                msgEl.className = 'text-danger fw-bold';

                // Reset backend session immediately since we are denying access
                appState.isLoggedIn = false;
                console.warn(`Role Mismatch: Selected ${selectedRole}, Actual ${data.role}`);
                return;
            }



            // SUCCESSFUL LOGIN
            appState.isLoggedIn = true;
            document.body.classList.remove('login-mode');
            appState.role = data.role;
            appState.userId = data.user_id;
            appState.schoolId = data.school_id;
            appState.schoolName = data.school_name;
            appState.isSuperAdmin = data.is_super_admin;
            appState.name = data.name;
            appState.roles = data.roles || [];
            appState.permissions = data.permissions || [];

            // Fix for Parent: Use Related Student ID as Active Student
            if ((appState.role === 'Parent' || appState.role === 'Parent_Guardian') && data.related_student_id) {
                appState.activeStudentId = data.related_student_id;
            } else if (appState.role === 'Student') {
                appState.activeStudentId = data.user_id;
            } else {
                appState.activeStudentId = null;
            }

            // Persist Session
            localStorage.setItem('classbridge_session', JSON.stringify({
                user_id: data.user_id,
                name: data.name,
                role: data.role,
                school_id: data.school_id,
                school_name: data.school_name,
                is_super_admin: data.is_super_admin,
                roles: data.roles || [],
                permissions: data.permissions || []
            }));

            msgEl.textContent = t('msg_welcome', { user_id: data.user_id });
            if (appState.schoolName && appState.schoolName !== 'Independent') {
                msgEl.textContent += ` (${appState.schoolName})`;
            }
            msgEl.className = 'text-success fw-bold';

            setTimeout(() => {
                msgEl.textContent = '';
                initializeDashboard();
            }, 500);

        } else {
            // ERROR HANDLING
            const err = await response.json().catch(() => ({ detail: t('msg_login_failed') }));
            msgEl.textContent = err.detail || t('msg_login_failed');
            msgEl.className = 'text-danger fw-bold';
        }
    } catch (error) {
        msgEl.textContent = t('msg_network_error', { error: error.message });
        msgEl.className = 'text-danger fw-bold';
        console.error("Login Error:", error);
    }
}

async function handle2FASubmit(e) {
    e.preventDefault();
    const code = document.getElementById('2fa-code').value.trim();
    const msgEl = document.getElementById('2fa-message');

    if (!code) {
        msgEl.textContent = "Please enter the code.";
        return;
    }

    msgEl.textContent = "Verifying...";
    msgEl.className = "text-primary fw-medium";

    if (!appState.tempUserId) {
        console.error("Missing tempUserId");
        msgEl.textContent = "Session expired. Please login again.";
        msgEl.className = "text-danger fw-bold";
        return;
    }

    try {
        const payload = {
            user_id: appState.tempUserId,
            code: code
        };
        console.log("Sending 2FA payload:", payload);

        const response = await fetchAPI('/auth/verify-2fa', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();

            // Success!
            appState.isLoggedIn = true;
            document.body.classList.remove('login-mode');
            appState.role = data.role;
            appState.userId = data.user_id; // confirmed ID
            appState.schoolId = data.school_id;
            appState.schoolName = data.school_name;
            appState.isSuperAdmin = data.is_super_admin;

            // Fix for Parent: Use Related Student ID as Active Student
            if ((appState.role === 'Parent' || appState.role === 'Parent_Guardian') && data.related_student_id) {
                appState.activeStudentId = data.related_student_id;
            } else if (appState.role === 'Student') {
                appState.activeStudentId = data.user_id;
            } else {
                appState.activeStudentId = null;
            }

            // Clear temp state
            appState.tempUserId = null;
            document.getElementById('two-factor-form').reset();

            // Switch to Dashboard
            const msgEl2FA = document.getElementById('2fa-message');
            if (msgEl2FA) {
                msgEl2FA.textContent = `Success! Welcome, ${data.user_id}`;
                msgEl2FA.className = 'text-success fw-bold';
            }
            initializeDashboard();
        } else {
            const rawText = await response.text();
            console.error("2FA Failed Response:", response.status, rawText);
            let errorDetail = "Verification failed.";
            try {
                const err = JSON.parse(rawText);
                errorDetail = err.detail || errorDetail;
            } catch (jsonErr) { }

            msgEl.textContent = errorDetail;
            msgEl.className = "text-danger fw-bold";
        }
    } catch (e) {
        console.error("2FA Network Error:", e);
        msgEl.textContent = "Network error: " + e.message;
        msgEl.className = "text-danger fw-bold";
    }
}



// --- SOCIAL LOGIN (FR-2 REAL GOOGLE + SIMULATED MICROSOFT) ---

// CALLBACK FOR REAL GOOGLE SIGN-IN
async function handleCredentialResponse(response) {
    elements.loginMessage.textContent = t('msg_google_verify');
    console.log("Encoded JWT ID token: " + response.credential);

    try {
        // Send JWT to backend for verification
        const apiRes = await fetch(`${API_BASE_URL}/auth/google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });

        if (apiRes.ok) {
            const data = await apiRes.json();
            appState.isLoggedIn = true;
            document.body.classList.remove('login-mode');
            appState.role = data.role;
            appState.userId = data.user_id;
            appState.schoolId = data.school_id;
            appState.schoolName = data.school_name;
            appState.isSuperAdmin = data.is_super_admin;
            // Fix for Parent: Use Related Student ID as Active Student
            if ((appState.role === 'Parent' || appState.role === 'Parent_Guardian') && data.related_student_id) {
                appState.activeStudentId = data.related_student_id;
            } else if (appState.role === 'Student') {
                appState.activeStudentId = data.user_id;
            } else {
                appState.activeStudentId = null;
            }

            elements.loginMessage.textContent = t('msg_welcome', { user_id: data.user_id });
            elements.loginMessage.className = 'text-success fw-bold';
            setTimeout(() => {
                elements.loginMessage.textContent = '';
                initializeDashboard();
            }, 1000);
        } else {
            // SAFE ERROR HANDLING
            const rawText = await apiRes.text();
            let errorMsg = "Google Login failed.";
            try {
                const error = JSON.parse(rawText);
                errorMsg = error.detail || errorMsg;
            } catch (e) {
                if (rawText.trim().length > 0) errorMsg = "Server Error: " + rawText.substring(0, 100);
            }
            console.error("Google Login Failed:", apiRes.status, errorMsg);
            elements.loginMessage.textContent = `Error (${apiRes.status}): ${errorMsg}`;
            elements.loginMessage.className = 'text-danger fw-bold';
        }
    } catch (e) {
        console.error(e);
        elements.loginMessage.textContent = "Verification Error.";
        elements.loginMessage.className = 'text-danger fw-bold';
    }
}

async function handleSocialLogin(provider) {
    if (provider === 'Google') {
        return;
    }

    if (provider === 'Microsoft') {
        // Check if we are in "Simulated Mode" (ID is missing)
        if (msalConfig.auth.clientId === "YOUR_MICROSOFT_CLIENT_ID") {
            console.log("Microsoft Client ID missing. Using SIMULATED Login.");
            console.log("⚠️ Running in SIMULATED MODE: No real Microsoft Client ID provided.");
            // We intentionally fall through to the simulation logic below
        } else {
            // REAL Microsoft Login
            try {
                elements.loginMessage.textContent = t('msg_microsoft_conn');
                elements.loginMessage.className = 'text-primary fw-bold';

                const loginRequest = {
                    scopes: ["User.Read"]
                };

                const loginResponse = await msalInstance.loginPopup(loginRequest);

                elements.loginMessage.textContent = t('msg_microsoft_verify');

                // Send access token to backend
                const response = await fetch(`${API_BASE_URL}/auth/microsoft-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: loginResponse.accessToken })
                });

                if (response.ok) {
                    const data = await response.json();
                    appState.isLoggedIn = true;
                    document.body.classList.remove('login-mode');
                    appState.role = data.role;
                    appState.userId = data.user_id;
                    appState.schoolId = data.school_id;
                    appState.schoolName = data.school_name;
                    appState.isSuperAdmin = data.is_super_admin;
                    // Fix for Parent: Use Related Student ID as Active Student
                    if ((appState.role === 'Parent' || appState.role === 'Parent_Guardian') && data.related_student_id) {
                        appState.activeStudentId = data.related_student_id;
                    } else if (appState.role === 'Student') {
                        appState.activeStudentId = data.user_id;
                    } else {
                        appState.activeStudentId = null;
                    }
                    elements.loginMessage.textContent = t('msg_welcome', { user_id: data.user_id });
                    if (appState.schoolName && appState.schoolName !== 'Independent') {
                        elements.loginMessage.textContent += ` (${appState.schoolName})`;
                    }
                    elements.loginMessage.className = 'text-success fw-bold';
                    setTimeout(() => {
                        elements.loginMessage.textContent = '';
                        initializeDashboard();
                    }, 1000);
                } else {
                    const errorData = await response.json();
                    elements.loginMessage.textContent = errorData.detail || "Microsoft login failed.";
                    elements.loginMessage.className = 'text-danger fw-bold';
                }

            } catch (error) {
                console.error(error);
                elements.loginMessage.textContent = "Microsoft Login cancelled or failed.";
                elements.loginMessage.className = 'text-danger fw-bold';
            }
            return;
        }
    }

    // Fallback for other providers (simulated)
    elements.loginMessage.textContent = `Connecting to ${provider}...`;
    elements.loginMessage.className = 'text-primary fw-bold';

    // Simulating a token from the provider
    const simulatedToken = `token_${provider.toLowerCase()}_${Date.now()}`;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/social-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: provider, token: simulatedToken })
        });

        if (response.ok) {
            const data = await response.json();
            appState.isLoggedIn = true;
            document.body.classList.remove('login-mode');
            appState.role = data.role;
            appState.userId = data.user_id;
            appState.schoolId = data.school_id;
            appState.schoolName = data.school_name;
            appState.isSuperAdmin = data.is_super_admin;
            appState.activeStudentId = (data.role === 'Parent' || data.role === 'Student') ? data.user_id : null;
            elements.loginMessage.textContent = `Success! Welcome, ${data.user_id}`;
            if (appState.schoolName && appState.schoolName !== 'Independent') {
                elements.loginMessage.textContent += ` (${appState.schoolName})`;
            }
            elements.loginMessage.className = 'text-success fw-bold';
            setTimeout(() => {
                elements.loginMessage.textContent = '';
                initializeDashboard();
            }, 1000);
        } else {
            // SAFE ERROR HANDLING
            const rawText = await response.text();
            let errorMsg = `${provider} login failed.`;
            try {
                const errorData = JSON.parse(rawText);
                errorMsg = errorData.detail || errorMsg;
            } catch (e) {
                if (rawText.trim().length > 0) errorMsg = "Server Error: " + rawText.substring(0, 100);
            }
            elements.loginMessage.textContent = errorMsg;
            elements.loginMessage.className = 'text-danger fw-bold';
        }
    } catch (error) {
        elements.loginMessage.textContent = `Social Login Network Error: ${error.message}`;
        elements.loginMessage.className = 'text-danger fw-bold';
        console.error(error);
    }
}

async function initializeDashboard() {
    elements.loginView.classList.remove('active');

    // Update Top Header
    const userNameEl = document.getElementById('header-user-name');
    if (userNameEl) userNameEl.textContent = appState.name || appState.userId;
    const userRoleEl = document.getElementById('header-user-role');
    if (userRoleEl) {
        userRoleEl.textContent = appState.role;
        if (appState.schoolName && appState.schoolName !== 'Independent') {
            userRoleEl.textContent += ` • ${appState.schoolName}`;
        }
    }
    const userImgEl = document.getElementById('header-user-img');
    if (userImgEl) userImgEl.src = `https://ui-avatars.com/api/?name=${appState.userId}&background=random`;

    elements.authStatus.innerHTML = `
            <strong>Role:</strong> ${appState.role} <span class="mx-2">|</span> <strong>User:</strong> ${appState.userId}
        `;
    if (appState.schoolName) {
        elements.authStatus.innerHTML += ` <span class="mx-2">|</span> <strong>School:</strong> ${appState.schoolName}`;
    }
    elements.loginMessage.textContent = '';

    if (appState.isSuperAdmin) {
        await loadSuperAdminDashboard();
        return;
    }

    await fetchStudents();

    if (appState.role === 'Teacher' || appState.role === 'Admin' || appState.role === 'Principal') {
        renderTeacherControls();
        renderTeacherDashboard();
    } else if (appState.role === 'Parent') {
        renderParentControls();
        switchView('parent-dashboard-view');

        if (appState.activeStudentId) {
            loadParentChildData(); // Helper to load child data
        }
    } else if (appState.role === 'Student') {
        renderStudentControls();
        switchView('student-view');

        if (appState.activeStudentId) {
            loadStudentDashboard(appState.activeStudentId);
        } else if (appState.allStudents && appState.allStudents.length > 0) {
            // Fallback: Auto-select first available student
            appState.activeStudentId = appState.allStudents[0].id || appState.allStudents[0].student_id;
            loadStudentDashboard(appState.activeStudentId);
        } else {
            document.getElementById('student-metrics').innerHTML = `
                <div class="alert alert-warning">
                    No linked student profile found. Please contact support or try logging in again.
                </div>`;
        }
    }

    loadLiveClasses();
    checkClassStatus();
}


// --- SUPER ADMIN FUNCTIONS ---

async function loadSuperAdminDashboard() {
    switchView('super-admin-view');
    const container = document.getElementById('super-admin-content');
    if (!container) return;

    container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-primary" role="status"></div><p>Loading schools...</p></div>';

    try {
        const response = await fetchAPI('/admin/schools', {}, true); // Requires Auth
        if (response.ok) {
            const schools = await response.json();
            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3 class="fw-bold text-primary">Registered Institutions</h3>
                    <button class="btn btn-primary-custom" onclick="showCreateSchoolModal()">
                        <span class="material-icons align-middle fs-5 me-1">add_circle</span> Add Institution
                    </button>
                </div>
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0 align-middle">
                            <thead class="bg-light">
                                <tr>
                                    <th class="py-3 ps-4">ID</th>
                                    <th class="py-3">Name</th>
                                    <th class="py-3">Address</th>
                                    <th class="py-3">Contact</th>
                                    <th class="py-3">Created</th>
                                    <th class="py-3 text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            if (schools.length === 0) {
                html += `<tr><td colspan="6" class="text-center py-4 text-muted">No schools registered yet.</td></tr>`;
            } else {
                schools.forEach(s => {
                    const safeName = s.name.replace(/"/g, '&quot;');
                    const safeAddr = (s.address || '').replace(/"/g, '&quot;');
                    const safeEmail = (s.contact_email || '').replace(/"/g, '&quot;');

                    html += `<tr>
                        <td class="ps-4 fw-bold">#${s.id}</td>
                        <td>
                            <a href="#" class="text-primary fw-bold text-decoration-none" 
                               onclick="openSchoolDashboard(${s.id}, '${safeName}'); return false;">
                                ${s.name}
                            </a>
                        </td>
                        <td>${s.address}</td>
                        <td>${s.contact_email}</td>
                        <td class="text-muted"><small>${new Date(s.created_at).toLocaleDateString()}</small></td>
                        <td class="text-end pe-4">
                            <div class="d-flex justify-content-end gap-2">
                                <button class="btn btn-sm btn-outline-warning" 
                                    onclick="openEditSchoolModal(${s.id}, '${safeName}', '${safeAddr}', '${safeEmail}')"
                                    title="Edit School">
                                    <span class="material-icons" style="font-size: 16px;">edit</span>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" 
                                    onclick="handleDeleteSchool(${s.id}, '${safeName}')"
                                    title="Delete School">
                                    <span class="material-icons" style="font-size: 16px;">delete</span>
                                </button>
                            </div>
                        </td>
                    </tr>`;
                });
            }

            html += `</tbody></table></div></div>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-danger">Failed to load schools.</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="text-danger">Error loading schools: ' + e.message + '</p>';
    }
}

function showCreateSchoolModal() {
    // Append to body if not exists
    if (!document.getElementById('createSchoolModal')) {
        const modalHtml = `
          <div class="modal fade" id="createSchoolModal" tabindex="-1">
            <div class="modal-dialog">
              <div class="modal-content rounded-4 border-0 shadow">
                <div class="modal-header border-0 pb-0">
                  <h5 class="modal-title fw-bold text-primary">Create New Institution</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                  <form id="create-school-form">
                    <div class="form-floating mb-3">
                        <input type="text" id="new-school-name" class="form-control bg-light border-0" placeholder="Institution Name" required>
                        <label>Institution Name</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input type="text" id="new-school-address" class="form-control bg-light border-0" placeholder="Address" required>
                        <label>Address</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input type="email" id="new-school-email" class="form-control bg-light border-0" placeholder="Email" required>
                        <label>Contact Email</label>
                    </div>
                    <button type="submit" class="btn btn-primary-custom w-100 py-3 rounded-pill fw-bold">Create Institution</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('create-school-form').addEventListener('submit', handleCreateSchool);
    }

    const modal = new bootstrap.Modal(document.getElementById('createSchoolModal'));
    modal.show();
}

async function handleCreateSchool(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('new-school-name').value;
    const address = document.getElementById('new-school-address').value;
    const email = document.getElementById('new-school-email').value;

    try {
        const res = await fetchAPI('/admin/schools', {
            method: 'POST',
            body: JSON.stringify({ name, address, contact_email: email })
        });

        if (res.ok) {
            alert("Institution Created Successfully!");
            const modalEl = document.getElementById('createSchoolModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            // Clear form
            document.getElementById('create-school-form').reset();
            loadSuperAdminDashboard();
        } else {
            const err = await res.json();
            alert("Error: " + (err.detail || "Failed"));
        }
    } catch (e) { console.error(e); alert("Network Error"); }
}

// --- SCHOOL CONTEXT SWITCHING ---

async function openSchoolDashboard(schoolId, schoolName) {
    console.log(`Switching to School: ${schoolName} (${schoolId})`);

    // Set Context
    appState.activeSchoolId = schoolId;
    appState.schoolName = schoolName;

    // Update Header
    elements.authStatus.innerHTML = `
            <strong>Role:</strong> ${appState.role} <span class="mx-2">|</span> <strong>User:</strong> ${appState.userId} <span class="mx-2">|</span> <strong>School:</strong> ${schoolName}
        `;

    // Show Loading/Switch View
    switchView('teacher-view');

    // Fetch Data for this School (headers will include X-School-Id)
    await fetchStudents();

    // Render Dashboard
    renderTeacherControls();
    renderTeacherDashboard();

    // Toast Feedback
    const msg = document.createElement('div');
    msg.className = 'alert alert-info fixed-top m-3 text-center fw-bold shadow';
    msg.style.zIndex = '9999';
    msg.textContent = `Viewing Dashboard for ${schoolName}`;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
}

async function handleLogout() {
    if (appState.isLoggedIn && appState.userId) {
        try {
            await fetchAPI('/auth/logout', {
                method: 'POST',
                body: JSON.stringify({ user_id: appState.userId })
            });
        } catch (e) {
            console.error("Logout log failed", e);
        }
    }
    Object.assign(appState, { isLoggedIn: false, role: null, userId: null, activeStudentId: null, chatMessages: {}, activeSchoolId: null, schoolName: null });
    elements.authStatus.innerHTML = 'Login to continue...';
    elements.userControls.innerHTML = '<p class="text-muted small">Navigation controls will appear here.</p>';
    document.getElementById('invite-section').classList.add('d-none'); // Hide invite section
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';

    document.body.classList.add('login-mode');
    switchView('login-view');
    elements.loginMessage.textContent = 'Successfully logged out.';
    elements.loginMessage.className = 'text-success fw-bold';

    // Hide AI Chat
    const chatToggle = document.getElementById('ai-chat-toggle');
    if (chatToggle) chatToggle.style.display = 'none';
    const sidebar = document.getElementById('ai-sidebar');
    if (sidebar) sidebar.classList.remove('active');
}

async function fetchStudents() {
    try {
        const response = await fetchAPI('/students/all');
        if (response.ok) {
            appState.allStudents = await response.json();
        } else {
            appState.allStudents = [];
        }
    } catch (error) {
        console.error("Error fetching students:", error);
    }
}

function populateStudentSelect(selectElement) {
    selectElement.innerHTML = '';
    if (appState.allStudents.length === 0) {
        selectElement.innerHTML = '<option value="">No students available</option>';
        return;
    }

    const options = appState.allStudents.map(s => {
        const id = s.id || s.ID || s.student_id;
        const name = s.name || s.Name || s.student_name || "Unknown";
        return `<option value="${id}">${name} (${id})</option>`;
    }).join('');
    selectElement.innerHTML = options;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('activity-date').value = today;
}

// --- CONTROLS RENDERING ---

// --- FUNCTION: Fetch and Show Logs in Modal ---

async function launchMoodleSSO() {
    console.log("Launching Moodle SSO Flow...");
    // Simulate Moodle (SP) redirecting to Noble Nexus (IdP)
    const clientId = "moodle_client_sim";
    const redirectUri = "https://moodle.org/demo_dashboard"; // Destination after auth
    const state = "security_token_" + Date.now();

    // Check if user set a custom URL
    const customUrl = localStorage.getItem('moodle_url');
    // If we had a real Moodle, we'd redirect there. 
    // Since we are simulating the Full Flow:
    // We open our Authorize Endpoint which acts as the IdP login check.

    const authUrl = `/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    // Open in new window/tab to simulate "going to Moodle"
    window.open(authUrl, 'MoodleAuth', 'width=600,height=700');
}

/* --- DYNAMIC SIDEBAR LOGIC --- */
function getSidebarConfig(role) {
    if (role === 'Student') {
        return [
            { label: 'Dashboard', icon: 'dashboard', view: 'student-view' },
            {
                label: 'My Courses', icon: 'menu_book', id: 'cat-courses',
                children: [
                    { label: 'Course List', view: 'student-academics-view', route: '/student/courses' },
                    { label: 'Assignments', view: 'student-exams-view', route: '/student/assignments' }
                ]
            },
            {
                label: 'Exams', icon: 'event', id: 'cat-exams',
                children: [
                    { label: 'Upcoming Exams', view: 'upcoming-exams-view', route: '/student/exams/upcoming' },
                    { label: 'Results', view: 'student-performance-view', route: '/student/exams/results' }
                ]
            },
            {
                label: 'Profile', icon: 'person', id: 'cat-profile',
                children: [
                    { label: 'View Profile', onClick: () => openProfileView(), route: '/student/profile' },
                    { label: 'Settings', onClick: () => alert('Settings Coming Soon'), route: '/student/settings' }
                ]
            },
            { label: 'Communication', icon: 'forum', view: 'student-communication-view' },
            { label: 'Moodle LMS', icon: 'cast_for_education', view: 'moodle-view' },
            { label: 'AI Assistant', icon: 'smart_toy', onClick: () => toggleSidebarChat() }
        ];
    }

    // Default to Teacher/Admin structure
    const items = [
        { label: 'Dashboard', icon: 'dashboard', view: 'teacher-view', onClick: () => handleTeacherViewToggle('teacher-view') },
        {
            label: 'Classes', icon: 'class', id: 'cat-classes',
            children: [
                { label: 'Create Class', view: 'create-class-view', route: '/teacher/classes/create' },
                { label: 'Manage Classes', view: 'teacher-class-management-view', route: '/teacher/classes/manage', onClick: () => handleTeacherViewToggle('teacher-class-management-view') },
                // Add Academics here if relevant or keep separate
            ]
        },
        {
            label: 'Students', icon: 'school', id: 'cat-students',
            children: [
                {
                    label: 'Add Student', view: 'add-user-view', route: '/teacher/students/add', onClick: () => {
                        switchView('add-user-view');
                        setTimeout(() => {
                            const roleSelect = document.getElementById('new-user-role-view');
                            if (roleSelect) { roleSelect.value = 'Student'; roleSelect.onchange(); }
                        }, 100);
                    }
                },
                { label: 'Student List', view: 'student-info-view', route: '/teacher/students/list', onClick: () => handleTeacherViewToggle('student-info-view') }
            ]
        },
        {
            label: 'Reports', icon: 'bar_chart', id: 'cat-reports',
            children: [
                { label: 'Attendance Report', view: 'attendance-report-view', route: '/teacher/reports/attendance' },
                { label: 'Performance Report', view: 'performance-report-view', route: '/teacher/reports/performance' }
            ]
        }
    ];

    // Append standard items (keeping some flat for now to match old functionality if not strictly in submenus)
    items.push({ label: 'Content & Assign.', icon: 'source', view: 'teacher-content-view', onClick: () => handleTeacherViewToggle('teacher-content-view') });
    items.push({ label: 'Assessment', icon: 'assignment_turned_in', view: 'teacher-assessment-view', onClick: () => handleTeacherViewToggle('teacher-assessment-view') });
    items.push({ label: 'Communication', icon: 'people', view: 'teacher-communication-view', onClick: () => handleTeacherViewToggle('teacher-communication-view') });
    items.push({ label: 'Resource Library', icon: 'library_books', view: 'resources-view', onClick: () => handleTeacherViewToggle('resources-view') });

    // Permissions
    if (hasPermission('reports.view')) {
        // Maybe add to Reports children?
        // For now push to bottom
    }

    if (hasPermission('role_management')) {
        items.push({ label: 'Roles & Perms', icon: 'security', view: 'roles-view', onClick: () => handleTeacherViewToggle('roles-view') });
    }

    if (appState.isSuperAdmin || ['Tenant_Admin', 'Principal', 'Admin'].includes(appState.role)) {
        items.push({ label: 'Staff & Faculty', icon: 'people_alt', view: 'staff-view', onClick: () => handleTeacherViewToggle('staff-view') });
    }

    if (appState.isSuperAdmin) {
        items.push({ label: 'System Settings', icon: 'settings', view: 'settings-view', onClick: () => handleTeacherViewToggle('settings-view') });
    }

    return items;
}

function renderSidebarFromConfig(config) {
    elements.userControls.innerHTML = '';
    const navMenu = document.createElement('div');
    navMenu.className = 'nav-menu';

    config.forEach(item => {
        // Check permission if specific item has one (simplified)
        if (item.permission && typeof item.permission === 'function' && !item.permission()) return;

        // Main Item Wrapper
        const itemWrapper = document.createElement('div');

        // Main Link
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-item';
        a.innerHTML = `<span class="material-icons">${item.icon}</span> <span class="flex-grow-1">${item.label}</span>`;

        if (item.children) {
            // It's a Request: Expandable
            a.innerHTML += `<span class="material-icons arrow-icon">expand_more</span>`;
            a.onclick = (e) => {
                e.preventDefault();
                // Close others
                document.querySelectorAll('.nav-submenu.open').forEach(el => {
                    if (el !== subMenu) {
                        el.classList.remove('open');
                        el.previousElementSibling.classList.remove('expanded');
                    }
                });

                a.classList.toggle('expanded');
                subMenu.classList.toggle('open');
            };

            // Submenu Container
            const subMenu = document.createElement('div');
            subMenu.className = 'nav-submenu';


            item.children.forEach(child => {
                // Permission check for child
                if (child.permission && !hasPermission(child.permission)) return;

                const subLink = document.createElement('a');
                subLink.href = child.route ? '#' + child.route : '#';
                subLink.className = 'nav-submenu-item';
                subLink.textContent = child.label;
                subLink.onclick = (e) => {
                    e.preventDefault();
                    if (child.route) {
                        const currentHash = location.hash;
                        const newHash = '#' + child.route;
                        if (currentHash !== newHash) {
                            history.pushState(null, null, newHash);
                        }
                    }

                    // Active State
                    document.querySelectorAll('.nav-submenu-item, .nav-item').forEach(el => el.classList.remove('active'));
                    subLink.classList.add('active');
                    a.classList.add('active'); // Keep parent active

                    // Action
                    if (child.onClick) {
                        child.onClick();
                    } else if (child.view) {
                        switchView(child.view);
                        // Update Title
                        const titleEl = document.getElementById('page-title');
                        if (titleEl) titleEl.textContent = child.label;
                    }
                };
                subMenu.appendChild(subLink);
            });

            itemWrapper.appendChild(a);
            itemWrapper.appendChild(subMenu);
        } else {
            // Standard Link
            a.onclick = (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item, .nav-submenu-item').forEach(el => el.classList.remove('active'));
                a.classList.add('active');

                if (item.onClick) {
                    item.onClick();
                } else if (item.view) {
                    if (item.view === 'teacher-view') {
                        // Special case for dashboard to reset things
                        if (typeof handleTeacherViewToggle === 'function') handleTeacherViewToggle('teacher-view');
                        else switchView(item.view);
                    } else {
                        switchView(item.view);
                    }
                    const titleEl = document.getElementById('page-title');
                    if (titleEl) titleEl.textContent = item.label;
                }
            };
            itemWrapper.appendChild(a);
        }

        navMenu.appendChild(itemWrapper);
    });

    elements.userControls.appendChild(navMenu);

    // Check initial hash routing if we are just rendering
    handleHashRouting();
}

/* --- ROUTER --- */
function handleHashRouting() {
    const hash = location.hash.replace('#', '');
    if (!hash) return;

    // Find config item matching route
    const findItem = (items) => {
        for (const item of items) {
            if (item.route === hash || (item.route && hash.startsWith(item.route))) return item;
            if (item.children) {
                const found = findItem(item.children);
                if (found) return found;
            }
        }
        return null;
    };

    const role = appState.role || 'Teacher'; // Default
    const config = getSidebarConfig(role);
    const item = findItem(config);

    if (item) {
        if (item.view) switchView(item.view);
        if (item.onClick) item.onClick();

        // Highlight Sidebar
        setTimeout(() => {
            document.querySelectorAll('.nav-submenu-item, .nav-item').forEach(el => el.classList.remove('active'));
            // Find link by href
            const link = document.querySelector(`a[href="#${hash}"]`);
            if (link) {
                link.classList.add('active');
                // Open parent if submenu
                const parent = link.closest('.nav-submenu');
                if (parent) {
                    parent.classList.add('open');
                    if (parent.previousElementSibling) parent.previousElementSibling.classList.add('expanded', 'active');
                }
            }
        }, 100);
    }
}

// Listen for PopState (Back/Forward)
window.addEventListener('popstate', handleHashRouting);





function renderTeacherControls() {
    elements.userControls.innerHTML = '';
    // Show Invite Generator
    const inviteSection = document.getElementById('invite-section');
    if (inviteSection) inviteSection.classList.remove('d-none');

    const config = getSidebarConfig('Teacher'); // Helper handles Admin/Principal too
    renderSidebarFromConfig(config);
}

function renderStudentControls() {
    elements.userControls.innerHTML = '';
    const inviteSection = document.getElementById('invite-section');
    if (inviteSection) inviteSection.classList.add('d-none');

    const config = getSidebarConfig('Student');
    renderSidebarFromConfig(config);
}

function renderParentControls() {
    elements.userControls.innerHTML = '';
    const inviteSection = document.getElementById('invite-section');
    if (inviteSection) inviteSection.classList.add('d-none');

    const navList = document.createElement('div');
    navList.className = 'nav-menu';

    const createNavItem = (label, icon, onClick, active = false) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = `nav-item ${active ? 'active' : ''}`;
        a.innerHTML = `<span class="material-icons">${icon}</span> <span>${label}</span>`;
        a.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            a.classList.add('active');
            onClick();
        };
        return a;
    };

    // 1. Dashboard
    navList.appendChild(createNavItem('Dashboard', 'dashboard', () => {
        switchView('parent-dashboard-view');
        document.getElementById('page-title').textContent = 'Parent Dashboard';
    }, true));

    // 2. Academic Progress
    navList.appendChild(createNavItem('Academic Progress', 'auto_stories', () => {
        switchView('parent-academic-view');
        document.getElementById('page-title').textContent = 'Academic Progress';
    }));

    // 3. Attendance
    navList.appendChild(createNavItem('Attendance', 'calendar_today', () => {
        switchView('parent-attendance-view');
        document.getElementById('page-title').textContent = 'Attendance Records';
    }));

    // 4. Fees & Payments
    navList.appendChild(createNavItem('Fees & Payments', 'payments', () => {
        switchView('parent-fees-view');
        document.getElementById('page-title').textContent = 'Fees & Payments';
    }));

    // 5. Communication
    navList.appendChild(createNavItem('Communication', 'forum', () => {
        switchView('parent-communication-view');
        document.getElementById('page-title').textContent = 'Communication';
    }));





    // Assistant
    navList.appendChild(createNavItem('Education Assistant', 'smart_toy', () => {
        toggleSidebarChat();
    }));

    elements.userControls.appendChild(navList);
}

function handleTeacherViewToggle(view) {
    const selectorDiv = document.getElementById('top-header-student-selector');
    if (selectorDiv) {
        selectorDiv.classList.add('d-none');
        selectorDiv.classList.remove('d-flex');
    }

    if (view === 'teacher-view') {
        switchView('teacher-view');
        renderTeacherDashboard();
    } else if (view === 'groups-view') {
        switchView('groups-view');
        loadGroups();
    } else if (view === 'reports-view') {
        switchView('reports-view');
        loadReportsData();
    } else if (view === 'settings-view') {
        switchView('settings-view');
    } else if (view === 'roles-view') {
        switchView('roles-view');
        loadRoles();
    } else if (view === 'compliance-view') {
        switchView('compliance-view');
    } else if (view === 'academics-view') {
        switchView('academics-view');
        renderAcademicsDashboard();
    } else if (view === 'finance-view') {
        switchView('finance-view');
    } else if (view === 'moodle-view') {
        switchView('moodle-view');

    } else if (view === 'staff-view') {
        switchView('staff-view');
    } else if (view === 'student-info-view') {
        switchView('student-info-view');
        if (!appState.allStudents || appState.allStudents.length === 0) {
            fetchAPI('/teacher/overview').then(res => res.json()).then(data => {
                appState.allStudents = data.roster || [];
            });
        }
    } else if (view === 'resources-view') {
        switchView('resources-view');
    } else if (view === 'teacher-class-management-view') {
        switchView('teacher-class-management-view');
    } else if (view === 'teacher-content-view') {
        switchView('teacher-content-view');
    } else if (view === 'teacher-assessment-view') {
        switchView('teacher-assessment-view');
    } else if (view === 'teacher-communication-view') {
        switchView('teacher-communication-view');
    } else if (view === 'communication-view') {
        switchView('communication-view');
        renderCommunicationDashboard();
    } else if (view === 'grade-helper-view') {
        switchView('grade-helper-view');
    } else {
        switchView('student-view');
        // Show Top Header Selector
        if (selectorDiv) {
            selectorDiv.classList.remove('d-none');
            selectorDiv.classList.add('d-flex');
        }

        if (!appState.allStudents || appState.allStudents.length === 0) {
            // First try fetching overview which has better data format
            fetchAPI('/teacher/overview')
                .then(res => res.json())
                .then(data => {
                    appState.allStudents = data.roster || [];
                    renderStudentSelector(selectorDiv);
                })
                .catch(() => {
                    // Fallback
                    fetchStudents().then(() => renderStudentSelector(selectorDiv));
                });
        } else {
            renderStudentSelector(selectorDiv);
        }
    }
}

function renderStudentSelector(container) {
    if (!container) return;
    container.innerHTML = `
            <select id="student-select" class="form-select form-select-sm" style="max-width: 200px;" onchange="loadStudentDashboard(this.value)">
                <option value="">-- Choose Student --</option>
                ${appState.allStudents.map(s => {
        const safeS = s || {};
        const id = safeS.id || safeS.ID || safeS.Id || safeS.student_id;
        const name = safeS.name || safeS.Name || safeS.student_name || "Unknown";

        let grade = safeS.grade;
        if (grade === undefined) grade = safeS.Grade;
        if (grade === undefined) grade = '?';

        // Fallback for debugging if keys are completely unexpected
        const label = (name === "Unknown") ? JSON.stringify(safeS) : `${name} (G${grade})`;

        return `<option value="${id}" ${appState.activeStudentId == id ? 'selected' : ''}>${label}</option>`;
    }).join('')}
            </select>
            <button class="btn btn-sm btn-primary text-nowrap d-flex align-items-center" onclick="elements.addStudentModal.show()">
                <span class="material-icons fs-6 me-1">add</span> New Student
            </button>
        `;


    const studentSelectElement = document.getElementById('student-select');
    if (appState.activeStudentId && studentSelectElement.querySelector(`option[value="${appState.activeStudentId}"]`)) {
        studentSelectElement.value = appState.activeStudentId;
        loadStudentDashboard(appState.activeStudentId);
    } else if (appState.allStudents.length > 0) {
        appState.activeStudentId = appState.allStudents[0].id || appState.allStudents[0].ID;
        studentSelectElement.value = appState.activeStudentId;
        loadStudentDashboard(appState.activeStudentId);
    } else {
        elements.studentNameHeader.textContent = 'No students available. Add a student first.';
        elements.studentMetrics.innerHTML = '';
    }
}

async function loadReportsData() {
    const metricsContainer = document.getElementById('reports-metrics-row');
    const attendanceContainer = document.getElementById('attendance-chart');
    const academicContainer = document.getElementById('academic-chart');
    const financeContainer = document.getElementById('finance-details-content');
    const staffContainer = document.getElementById('staff-details-content');

    if (!metricsContainer) return;

    try {
        const response = await fetchAPI('/reports/summary');
        let data;

        if (response.ok) {
            data = await response.json();
            appState.reportData = data; // Store for export
        } else {
            // Fallback Dummy Data if backend not updated or fails
            data = {
                financial_summary: { revenue: 150000, expenses: 90000, net_income: 60000, outstanding_fees: 15000 },
                staff_utilization: { total_staff: 25, active_classes: 100, student_teacher_ratio: "20:1", utilization_rate: 88 },
                attendance_trends: [{ month: 'Jan', rate: 90 }, { month: 'Feb', rate: 92 }, { month: 'Mar', rate: 88 }, { month: 'Apr', rate: 94 }],
                academic_performance: { overall_avg: 78, math_avg: 82, science_avg: 75, english_avg: 77 }
            };
        }

        // Render Top Metrics
        metricsContainer.innerHTML = '';
        renderMetric(metricsContainer, 'Revenue', `$${data.financial_summary.revenue.toLocaleString()}`, 'widget-green');
        renderMetric(metricsContainer, 'Net Income', `$${data.financial_summary.net_income.toLocaleString()}`, 'widget-purple');
        renderMetric(metricsContainer, 'Total Staff', data.staff_utilization.total_staff, 'widget-blue');
        renderMetric(metricsContainer, 'Staff Util %', `${data.staff_utilization.utilization_rate}%`, 'widget-yellow');

        // Render Finance Details
        if (financeContainer) {
            financeContainer.innerHTML = `
                <div class="row align-items-center h-100">
                    <div class="col-6">
                        <ul class="list-unstyled mb-0">
                            <li class="mb-3 d-flex justify-content-between">
                                <span class="text-muted">Revenue</span>
                                <span class="fw-bold text-success">$${data.financial_summary.revenue.toLocaleString()}</span>
                            </li>
                            <li class="mb-3 d-flex justify-content-between">
                                <span class="text-muted">Expenses</span>
                                <span class="fw-bold text-danger">$${data.financial_summary.expenses.toLocaleString()}</span>
                            </li>
                            <li class="mb-3 d-flex justify-content-between">
                                <span class="text-muted">Net Income</span>
                                <span class="fw-bold text-primary">$${data.financial_summary.net_income.toLocaleString()}</span>
                            </li>
                            <li class="d-flex justify-content-between">
                                <span class="text-muted">Outstanding</span>
                                <span class="fw-bold text-warning">$${data.financial_summary.outstanding_fees.toLocaleString()}</span>
                            </li>
                        </ul>
                    </div>
                    <div class="col-6 text-center">
                        <div class="position-relative d-inline-block">
                            <span class="material-icons text-success" style="font-size: 80px;">monetization_on</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Render Staff Details
        if (staffContainer) {
            staffContainer.innerHTML = `
                <div class="row align-items-center h-100">
                     <div class="col-6">
                        <ul class="list-unstyled mb-0">
                            <li class="mb-3 d-flex justify-content-between">
                                <span class="text-muted">Total Staff</span>
                                <span class="fw-bold">${data.staff_utilization.total_staff}</span>
                            </li>
                            <li class="mb-3 d-flex justify-content-between">
                                <span class="text-muted">Active Classes</span>
                                <span class="fw-bold">${data.staff_utilization.active_classes}</span>
                            </li>
                            <li class="mb-3 d-flex justify-content-between">
                                <span class="text-muted">Student:Teacher</span>
                                <span class="fw-bold">${data.staff_utilization.student_teacher_ratio}</span>
                            </li>
                            <li class="d-flex justify-content-between">
                                <span class="text-muted">Efficiency</span>
                                <span class="badge bg-success">${data.staff_utilization.utilization_rate}%</span>
                            </li>
                        </ul>
                     </div>
                     <div class="col-6 text-center">
                        <div class="pie-chart-placeholder rounded-circle border border-3 border-warning d-flex align-items-center justify-content-center mx-auto" style="width:100px; height:100px;">
                            <span class="h4 m-0 fw-bold">${data.staff_utilization.utilization_rate}%</span>
                        </div>
                     </div>
                </div>
            `;
        }

        // 1. Attendance Chart (Line Chart Trend)
        if (attendanceContainer) {
            const attTrace = {
                x: data.attendance_trends.map(t => t.month),
                y: data.attendance_trends.map(t => t.rate),
                type: 'scatter',
                mode: 'lines+markers',
                marker: { color: '#4D44B5' },
                line: { shape: 'spline', width: 3 },
                name: 'Attendance'
            };
            const attLayout = {
                autosize: true,
                margin: { t: 20, b: 40, l: 40, r: 20 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                xaxis: { title: 'Month' },
                yaxis: { title: 'Percentage (%)', range: [0, 100] }
            };
            Plotly.newPlot('attendance-chart', [attTrace], attLayout, { displayModeBar: false });
        }

        // 2. Academic Performance (Bar Chart by Subject)
        if (academicContainer) {
            const academicData = data.academic_performance;
            const acTrace = {
                x: ['Math', 'Science', 'English', 'Overall'],
                y: [academicData.math_avg, academicData.science_avg, academicData.english_avg, academicData.overall_avg],
                type: 'bar',
                marker: { color: ['#dc3545', '#ffc107', '#0dcaf0', '#4D44B5'] },
            };
            const acLayout = {
                autosize: true,
                margin: { t: 20, b: 40, l: 40, r: 20 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                yaxis: { title: 'Average Score', range: [0, 100] }
            };
            Plotly.newPlot('academic-chart', [acTrace], acLayout, { displayModeBar: false });
        }

    } catch (e) {
        console.error("Error loading reports", e);
    }
}

// --- CLASS MATERIALS ---

async function handleAddMaterial(e) {
    e.preventDefault();
    elements.addMaterialMessage.textContent = 'Uploading material...';
    elements.addMaterialMessage.className = 'text-primary fw-medium';

    const formData = new FormData(elements.addMaterialForm);

    try {
        const response = await fetchAPI('/materials/upload', {
            method: 'POST',
            body: formData,
            // No 'Content-Type' header needed for FormData, browser sets it automatically
        });

        const data = await response.json();

        if (response.ok) {
            elements.addMaterialMessage.textContent = data.message;
            elements.addMaterialMessage.className = 'text-success fw-bold';
            elements.addMaterialForm.reset();
            elements.addMaterialModal.hide(); // Hide modal on success
            await loadClassMaterials(); // Refresh materials list
        } else {
            elements.addMaterialMessage.textContent = data.detail || 'Failed to upload material.';
            elements.addMaterialMessage.className = 'text-danger fw-bold';
        }
    } catch (error) {
        elements.addMaterialMessage.textContent = error.message;
        elements.addMaterialMessage.className = 'text-danger fw-bold';
    }
}

async function loadClassMaterials() {
    elements.materialsList.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    try {
        const response = await fetchAPI('/materials/all');
        if (response.ok) {
            const materials = await response.json();
            if (materials.length === 0) {
                elements.materialsList.innerHTML = '<p class="text-muted">No class materials uploaded yet.</p>';
                return;
            }
            elements.materialsList.innerHTML = materials.map(material => `
                        <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">${material.title}</h6>
                                <p class="mb-1 small text-muted">${material.description}</p>
                                <small class="text-muted">Uploaded: ${new Date(material.upload_date).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <a href="${material.file_url}" target="_blank" class="btn btn-sm btn-outline-primary me-2">View</a>
                                <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteMaterial('${material.id}', '${material.title}')">Delete</button>
                            </div>
                        </div>
                    `).join('');
        } else {
            elements.materialsList.innerHTML = '<p class="text-danger fw-bold">Error loading materials.</p>';
        }
    } catch (error) {
        console.error("Error loading class materials:", error);
        elements.materialsList.innerHTML = `<p class="text-danger fw-bold">Network error: ${error.message}</p>`;
    }
}

async function handleDeleteMaterial(materialId, materialTitle) {
    if (!confirm(`Are you sure you want to delete "${materialTitle}"? This action cannot be undone.`)) return;

    try {
        const response = await fetchAPI(`/materials/${materialId}`, { method: 'DELETE' });
        if (response.ok) {
            alert(`Material "${materialTitle}" deleted successfully.`);
            await loadClassMaterials();
        } else {
            const data = await response.json();
            alert(`Error: ${data.detail || 'Failed to delete material.'}`);
        }
    } catch (error) {
        alert(`Network error: ${error.message}`);
    }
}

// --- STUDENT & ACTIVITY ACTIONS ---

async function handleAddStudent(e) {
    e.preventDefault();
    elements.addStudentMessage.textContent = 'Adding student...';
    elements.addStudentMessage.className = 'text-primary fw-medium';

    const studentData = {
        id: document.getElementById('new-id').value,
        name: document.getElementById('new-name').value,
        password: document.getElementById('new-password').value,
        grade: parseInt(document.getElementById('new-grade').value),
        preferred_subject: document.getElementById('new-subject').value,
        home_language: document.getElementById('new-lang').value,
        attendance_rate: parseFloat(document.getElementById('new-attendance').value),
        math_score: parseFloat(document.getElementById('new-math-score').value),
        science_score: parseFloat(document.getElementById('new-science-score').value),
        english_language_score: parseFloat(document.getElementById('new-english-score').value),
    };

    try {
        const response = await fetchAPI('/students/add', {
            method: 'POST',
            body: JSON.stringify(studentData)
        });

        const data = await response.json();

        if (response.ok) {
            elements.addStudentMessage.textContent = 'Student added successfully!';
            elements.addStudentMessage.className = 'text-success fw-bold';
            elements.addStudentForm.reset();

            // Close modal after a short delay
            setTimeout(() => {
                elements.addStudentModal.hide();
                elements.addStudentMessage.textContent = '';

                // Refresh data and select new student
                fetchStudents().then(() => {
                    appState.activeStudentId = studentData.id;

                    // Update Selector UI
                    const selectorDiv = document.getElementById('teacher-student-selector');
                    if (selectorDiv) {
                        renderStudentSelector(selectorDiv);
                        selectorDiv.style.display = 'block';
                    }

                    // Switch to Student View and Load Data
                    handleTeacherViewToggle('student-view'); // Ensures view is active
                    loadStudentDashboard(appState.activeStudentId);
                });
            }, 1000);
        } else {
            elements.addStudentMessage.textContent = data.detail || 'Failed to add student.';
            elements.addStudentMessage.className = 'text-danger fw-bold';
        }
    } catch (error) {
        elements.addStudentMessage.textContent = error.message;
        elements.addStudentMessage.className = 'text-danger fw-bold';
    }
}



// --- EDIT STUDENT LOGIC ---

async function openEditStudentModal(studentId) {
    const modal = elements.editStudentModal;
    const form = elements.editStudentForm;

    // Clear previous
    form.reset();
    document.getElementById('edit-student-message').classList.add('d-none');
    document.getElementById('edit-id-display').textContent = 'Loading...';

    modal.show();

    try {
        // Fetch fresh data
        const response = await fetchAPI(`/students/${studentId}/data`);
        if (!response.ok) throw new Error("Failed to fetch student data");

        const data = await response.json();
        const student = appState.allStudents.find(s => s.id == studentId) || {};

        // Merge detail data with roster data if needed, but roster usually has basics
        // Actually, let's use the roster data for basics + summary for scores if available
        // Or better, fetch the raw student object if we had an endpoint. 
        // We will stick to updating what we have in the UI + scores.

        document.getElementById('edit-id').value = student.id;
        document.getElementById('edit-id-display').textContent = student.id;
        document.getElementById('edit-name').value = student.name;
        document.getElementById('edit-grade').value = student.grade;
        document.getElementById('edit-subject').value = student.preferred_subject;
        document.getElementById('edit-attendance').value = student.attendance_rate;
        document.getElementById('edit-lang').value = student.home_language || ''; // Check if home_language is in roster?

        // If home_language missing in roster object, we might need a dedicated GET /students/{id} 
        // But for now, let's assume it's in the object or we default to empty.

        // Scores - derived from summary or roster? Roster has them.
        const math = student.math_score || 0;
        const sci = student.science_score || 0;
        const eng = student.english_language_score || 0;

        document.getElementById('edit-math-score').value = math;
        document.getElementById('rng-math').value = math;
        document.getElementById('lbl-math').textContent = math + '%';

        document.getElementById('edit-science-score').value = sci;
        document.getElementById('rng-science').value = sci;
        document.getElementById('lbl-science').textContent = sci + '%';

        document.getElementById('edit-english-score').value = eng;
        document.getElementById('rng-english').value = eng;
        document.getElementById('lbl-english').textContent = eng + '%';

    } catch (e) {
        console.error(e);
        alert("Error loading student details: " + e.message);
        modal.hide();
    }
}

// Global helper for the manual button onclick in HTML
window.submitEditStudentForm = function () {
    // Trigger the submit event on the form so the listener catches it
    elements.editStudentForm.dispatchEvent(new Event('submit'));
};

async function handleEditStudentSubmit(e) {
    e.preventDefault();
    const msg = document.getElementById('edit-student-message');
    msg.classList.remove('d-none', 'text-danger', 'text-success');
    msg.textContent = 'Saving changes...';
    msg.className = 'text-center fw-medium p-2 mb-0 bg-light border-bottom text-primary';
    msg.classList.remove('d-none');

    const studentId = document.getElementById('edit-id').value;

    const updatedData = {
        name: document.getElementById('edit-name').value,
        grade: parseInt(document.getElementById('edit-grade').value),
        preferred_subject: document.getElementById('edit-subject').value,
        attendance_rate: parseFloat(document.getElementById('edit-attendance').value),
        home_language: document.getElementById('edit-lang').value,
        math_score: parseFloat(document.getElementById('edit-math-score').value),
        science_score: parseFloat(document.getElementById('edit-science-score').value),
        english_language_score: parseFloat(document.getElementById('edit-english-score').value),
        password: document.getElementById('edit-password').value || null
    };

    try {
        const response = await fetchAPI(`/students/${studentId}`, {
            method: 'PUT', // Assuming PUT is the update method
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            msg.textContent = 'Saved Successfully!';
            msg.classList.add('text-success');

            // Refresh Dashboard
            setTimeout(() => {
                elements.editStudentModal.hide();
                msg.classList.add('d-none');
                initializeDashboard(); // Reload all lists
            }, 1000);

        } else {
            const data = await response.json();
            msg.textContent = 'Error: ' + (data.detail || 'Update failed');
            msg.classList.add('text-danger');
        }
    } catch (error) {
        msg.textContent = 'Network Error: ' + error.message;
        msg.classList.add('text-danger');
    }
}


let studentToDeleteId = null;

function handleDeleteStudent(studentId, studentName) {
    studentToDeleteId = studentId;
    document.getElementById('delete-modal-text').textContent = `Are you sure you want to delete ${studentName} (${studentId})?`;
    document.getElementById('delete-error-msg').textContent = '';
    elements.deleteConfirmationModal.show();
}

document.getElementById('confirm-delete-btn').onclick = async () => {
    if (!studentToDeleteId) return;

    const btn = document.getElementById('confirm-delete-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Deleting...";
    document.getElementById('delete-error-msg').textContent = '';

    try {
        const response = await fetchAPI(`/students/${studentToDeleteId}`, { method: 'DELETE' });
        if (response.ok) {
            elements.deleteConfirmationModal.hide();
            initializeDashboard(); // Refresh list
            // Show small toast or alert
            const toast = document.createElement('div');
            toast.className = 'position-fixed bottom-0 end-0 p-3';
            toast.style.zIndex = '1100';
            toast.innerHTML = `
                        <div class="toast show align-items-center text-white bg-success border-0" role="alert">
                            <div class="d-flex">
                                <div class="toast-body">Student deleted successfully.</div>
                                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                            </div>
                        </div>`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        } else {
            const data = await response.json();
            let errorMsg = data.detail || 'Server error.';
            if (typeof errorMsg === 'object') {
                errorMsg = JSON.stringify(errorMsg);
            }
            document.getElementById('delete-error-msg').textContent = `Error: ${errorMsg}`;
        }
    } catch (error) {
        document.getElementById('delete-error-msg').textContent = `Network error: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};


function openStudentAddActivityModal() {
    // Security check
    if (!['Teacher', 'Admin', 'Tenant_Admin', 'Principal'].includes(appState.role) && !appState.isSuperAdmin) {
        alert("Only Teachers can log activities.");
        return;
    }

    const select = document.getElementById('activity-student-select');

    // Clear existing
    select.innerHTML = '';

    if (appState.role === 'Teacher' || appState.role === 'Admin') {
        // Enable for Teachers/Admins
        select.disabled = false;

        // Populate with all students
        if (appState.allStudents && appState.allStudents.length > 0) {
            appState.allStudents.forEach(s => {
                const option = document.createElement('option');
                // Handle different ID keys
                const id = s.id || s.ID || s.student_id;
                option.value = id;

                // Handle different Name/Grade keys and fallbacks
                const name = s.name || s.Name || s.student_name || "Unknown";
                let grade = s.grade;
                if (grade === undefined) grade = s.Grade;
                if (grade === undefined) grade = '?';

                option.textContent = `${name} (G${grade})`;

                // Compare with loose equality to match string vs number IDs
                if (id == appState.activeStudentId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } else {
            // Fallback if list empty
            const option = document.createElement('option');
            option.value = appState.activeStudentId;
            option.textContent = appState.activeStudentId; // Better than nothing
            option.selected = true;
            select.appendChild(option);
        }
    } else {
        // Disable for Students (Self-logging)
        select.disabled = true;
        const option = document.createElement('option');
        option.value = appState.activeStudentId;
        // Try to get name, fallback to ID
        option.textContent = appState.userName || appState.userId || 'Me';
        option.selected = true;
        select.appendChild(option);
    }


    // Set Date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('activity-date').value = today;

    // Reset other fields
    document.getElementById('activity-topic').value = '';
    document.getElementById('activity-score').value = '85.0';
    document.getElementById('activity-time').value = '30';
    document.getElementById('add-activity-message').textContent = '';

    // Show Modal
    elements.addActivityModal.show();
}

async function handleAddActivity(e) {
    e.preventDefault();
    elements.addActivityMessage.textContent = 'Logging activity...';
    elements.addActivityMessage.className = 'text-primary';

    const activityData = {
        student_id: elements.activityStudentSelect.value,
        date: document.getElementById('activity-date').value,
        topic: document.getElementById('activity-topic').value,
        difficulty: document.getElementById('activity-difficulty').value,
        score: parseFloat(document.getElementById('activity-score').value),
        time_spent_min: parseInt(document.getElementById('activity-time').value),
    };

    try {
        const response = await fetchAPI('/activities/add', {
            method: 'POST',
            body: JSON.stringify(activityData)
        });

        const data = await response.json();

        if (response.ok) {
            elements.addActivityMessage.textContent = data.message;
            elements.addActivityMessage.className = 'text-success fw-bold';
            elements.addActivityForm.reset();

            if (appState.activeStudentId === activityData.student_id) {
                await loadStudentDashboard(appState.activeStudentId);
            }
            if (appState.role === 'Teacher' && document.getElementById('view-select').value === 'teacher-view') {
                await renderTeacherDashboard();
            }
        } else {
            elements.addActivityMessage.textContent = data.detail || 'Failed to log activity.';
            elements.addActivityMessage.className = 'text-danger';
        }
    } catch (error) {
        elements.addActivityMessage.className = 'text-danger';
        elements.addActivityMessage.textContent = error.message;
    }
}

// --- DASHBOARD RENDERING ---

async function renderTeacherDashboard() {
    switchView('teacher-view');
    elements.teacherMetrics.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    elements.rosterTable.innerHTML = '';
    Plotly.purge(elements.classPerformanceChart);

    try {
        const response = await fetchAPI('/teacher/overview');
        if (!response.ok) {
            elements.teacherMetrics.innerHTML = '<p class="text-danger fw-bold">Error fetching data.</p>';
            return;
        }
        const data = await response.json();

        // Populate global state for student selector
        appState.allStudents = data.roster || [];

        // Metrics
        // Metrics
        elements.teacherMetrics.innerHTML = '';
        renderMetric(elements.teacherMetrics, "Students", data.total_students, 'widget-purple');
        renderMetric(elements.teacherMetrics, "Teachers", data.total_teachers || 0, 'widget-yellow');
        renderMetric(elements.teacherMetrics, "Staff", "29,300", 'widget-blue');
        renderMetric(elements.teacherMetrics, "Awards", "95,800", 'widget-green');

        // Roster Table
        let tableHTML = '';
        data.roster.forEach(student => {
            tableHTML += `
                    <tr>
                        <td><span class="badge bg-light text-dark border">${student.ID}</span></td>
                        <td class="fw-bold text-primary-custom">${student.Name}</td>
                        <td>${student.Grade}</td>
                        <td>
                            <div class="progress" style="height: 6px; width: 60px;">
                                <div class="progress-bar bg-success" style="width: ${student['Attendance %']}%"></div>
                            </div>
                            <small>${student['Attendance %']}%</small>
                        </td>
                        <td>${student['Initial Score']}%</td>
                        <td><span class="badge ${student['Avg Activity Score'] >= 80 ? 'bg-success' : 'bg-secondary'}">${student['Avg Activity Score']}%</span></td>
                        <td>${student.Subject}</td>
                        <td>
                            <div class="d-flex gap-2 justify-content-start">
                                <button class="btn btn-sm btn-outline-primary" onclick="loadStudentDashboard('${student.ID}'); document.getElementById('view-select').value='student-view'; document.getElementById('teacher-student-selector').style.display='block'; document.getElementById('student-select').value='${student.ID}';" title="View Dashboard">
                                    <span class="material-icons" style="font-size: 18px;">visibility</span>
                                </button>
                                <button class="btn btn-sm btn-outline-secondary" onclick="openEditStudentModal('${student.ID}')" title="Edit Profile">
                                    <span class="material-icons" style="font-size: 18px;">edit</span>
                                </button>
                                <button class="btn btn-sm btn-outline-dark" onclick="openAccessCardModal('${student.ID}')" title="Print Access Card">
                                    <span class="material-icons" style="font-size: 18px;">badge</span>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteStudent('${student.ID}', '${student.Name}')" title="Delete Student">
                                    <span class="material-icons" style="font-size: 18px;">delete</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
        });
        elements.rosterTable.innerHTML = tableHTML;
        document.getElementById('roster-header').innerHTML = '<th>ID</th><th>Name</th><th>Grade</th><th>Attendance</th><th>Initial Score</th><th>Avg Score</th><th>Subject</th><th>Actions</th>';

        // ... (Chart logic remains the same) ...
        const chartData = data.roster.map(s => ({
            x: s.Name,
            y: s['Avg Activity Score'],
            attendance: s['Attendance %']
        }));

        const plotData = [{
            x: chartData.map(d => d.x),
            y: chartData.map(d => d.y),
            marker: {
                color: chartData.map(d => d.attendance),
                colorscale: 'RdBu',
                reversescale: true,
                showscale: true,
                colorbar: { title: 'Attendance %' }
            },
            type: 'bar',
            name: 'Average Activity Score'
        }];

        Plotly.newPlot(elements.classPerformanceChart, plotData, {
            title: 'Class Average Activity Score',
            height: 350,
            margin: { t: 40, b: 60, l: 40, r: 10 },
            xaxis: { title: 'Student Name' },
            yaxis: { title: 'Score (%)', range: [0, 100] }
        });

    } catch (error) {
        console.error(error);
    }
}

// --- ACCESS CARD LOGIC ---
async function openAccessCardModal(studentId) {
    const modal = new bootstrap.Modal(document.getElementById('accessCardModal'));
    const nameEl = document.getElementById('card-student-name');
    const idEl = document.getElementById('card-student-id');
    const listEl = document.getElementById('card-codes-list');

    nameEl.textContent = "Loading...";
    idEl.textContent = studentId;
    listEl.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';

    modal.show();

    try {
        const response = await fetchAPI(`/teacher/students/${studentId}/codes`);
        if (response.ok) {
            const data = await response.json();
            nameEl.textContent = data.name;

            listEl.innerHTML = '';
            if (data.codes.length === 0) {
                listEl.innerHTML = '<span class="text-danger">No active codes.</span>';
            } else {
                data.codes.forEach(code => {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-light text-dark border p-2 fs-5 font-monospace';
                    badge.textContent = code;
                    listEl.appendChild(badge);
                });
            }
        } else {
            listEl.innerHTML = '<span class="text-danger">Failed to load codes.</span>';
        }
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<span class="text-danger">Network error.</span>';
    }
}

async function regenerateAccessCode() {
    const studentId = document.getElementById('card-student-id').textContent;
    if (!studentId || studentId === 'S000') return;

    if (!confirm(`Are you sure you want to regenerate the 2FA code for ${studentId}?\n\nThis will INVALIDATE the old code immediately. The student will need this new card to log in.`)) {
        return;
    }

    const listEl = document.getElementById('card-codes-list');
    listEl.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';

    try {
        const response = await fetchAPI(`/teacher/students/${studentId}/regenerate-code`, {
            method: 'POST'
        });

        if (response.ok) {
            const data = await response.json();

            // Refresh the display with the new code
            listEl.innerHTML = '';
            data.codes.forEach(code => {
                const badge = document.createElement('span');
                badge.className = 'badge bg-success text-white border p-2 fs-5 font-monospace'; // Green to indicate new
                badge.textContent = code;
                listEl.appendChild(badge);
            });

            alert("Success! Old code revoked. New code generated.");
        } else {
            alert("Error regenerating code.");
            // Reload original codes to be safe
            openAccessCardModal(studentId);
        }
    } catch (e) {
        console.error(e);
        alert("Network error.");
    }
}

async function loadStudentDashboard(studentId) {
    if (!studentId) return;

    appState.activeStudentId = studentId;
    switchView('student-view');

    // Restrict "Log Activity" button to Teachers/Admins only
    const logBtn = document.getElementById('student-log-activity-btn');
    if (logBtn) {
        if (['Teacher', 'Admin', 'Tenant_Admin', 'Principal'].includes(appState.role) || appState.isSuperAdmin) {
            logBtn.classList.remove('d-none');
        } else {
            logBtn.classList.add('d-none');
        }
    }

    const student = appState.allStudents.find(s => s.id == studentId) || { name: studentId, grade: '?', attendance_rate: '?' };
    if (elements.studentNameHeader) {
        elements.studentNameHeader.innerHTML = `Student Dashboard: <span class="text-primary-custom">${student.name}</span> <span class="badge bg-secondary fs-6 align-middle">Grade ${student.grade}</span>`;
    }

    if (elements.studentMetrics) {
        elements.studentMetrics.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Loading student data...</p></div>';
    }

    if (elements.recommendationBox) elements.recommendationBox.style.display = 'none';
    if (elements.chatMessagesContainer) elements.chatMessagesContainer.innerHTML = appState.chatMessages[studentId] || '';

    try {
        console.log(`Fetching data for student: ${studentId}`);
        const response = await fetchAPI(`/students/${studentId}/data`);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Failed to load data (${response.status})`);
        }

        const data = await response.json();
        console.log("Student Data Received:", data);

        const summary = data.summary;
        const history = data.history;

        if (elements.studentMetrics) {
            elements.studentMetrics.innerHTML = '';
            renderMetric(elements.studentMetrics, "Overall Activity Avg", `${summary.avg_score || 0}%`, 'border-primary');
            renderMetric(elements.studentMetrics, "Total Activities", summary.total_activities || 0, 'border-info');
            renderMetric(elements.studentMetrics, "Math Initial", `${summary.math_score || 0}%`);
            renderMetric(elements.studentMetrics, "Science Initial", `${summary.science_score || 0}%`);
            renderMetric(elements.studentMetrics, "English Initial", `${summary.english_language_score || 0}%`);
            renderMetric(elements.studentMetrics, "Attendance", `${student.attendance_rate || 0}%`, 'border-success');
        }

        if (summary.recommendation && elements.recommendationBox) {
            elements.recommendationBox.style.display = 'block';
            elements.recommendationBox.innerHTML = `<strong>💡 Recommendation:</strong> ${summary.recommendation}`;
        }

        // GAMIFICATION RENDER
        const xp = student.xp || 0;
        const level = Math.floor(xp / 100) + 1;
        const progress = xp % 100;
        const badges = student.badges || [];

        const levelEl = document.getElementById('student-level');
        const xpEl = document.getElementById('student-xp');
        const barEl = document.getElementById('student-xp-bar');
        const badgesContainer = document.getElementById('student-badges');

        if (levelEl) levelEl.textContent = level;
        if (xpEl) xpEl.textContent = xp;
        if (barEl) {
            barEl.style.width = `${progress}%`;
            barEl.setAttribute('aria-valuenow', progress);
        }

        if (badgesContainer) {
            badgesContainer.innerHTML = '';
            if (badges.length === 0) {
                badgesContainer.innerHTML = '<span class="text-white-50 small fst-italic">No badges yet. Keep studying!</span>';
            } else {
                badges.forEach(badge => {
                    let icon = 'military_tech'; // default
                    let color = 'text-warning';

                    if (badge === 'Rookie') { icon = 'star_rate'; color = 'text-light'; }
                    if (badge === 'Scholar') { icon = 'school'; color = 'text-info'; }
                    if (badge === 'High Achiever') { icon = 'emoji_events'; color = 'text-warning'; }

                    const span = document.createElement('span');
                    span.className = 'badge bg-white text-dark shadow-sm d-flex align-items-center gap-1';
                    span.innerHTML = `<span class="material-icons ${color} fs-6">${icon}</span> ${badge}`;
                    badgesContainer.appendChild(span);
                });
            }
        }

        // History Table
        let historyHTML = '';
        if (history.length > 0) {
            history.forEach(act => {
                historyHTML += `
                        <tr>
                            <td>${act.date}</td>
                            <td>${act.topic}</td>
                            <td><span class="badge ${act.difficulty === 'Hard' ? 'bg-danger' : act.difficulty === 'Medium' ? 'bg-warning text-dark' : 'bg-success'}">${act.difficulty}</span></td>
                            <td>${act.score}%</td>
                            <td>${act.time_spent_min} min</td>
                        </tr>
                    `;
            });
        } else {
            historyHTML = '<tr><td colspan="5" class="text-center text-muted">No activity history available.</td></tr>';
        }
        if (elements.historyTable) elements.historyTable.innerHTML = historyHTML;

        // Progress Chart
        if (elements.studentProgressChart) {
            const dates = history.map(h => h.date);
            const scores = history.map(h => h.score);

            const trace = {
                x: dates,
                y: scores,
                mode: 'lines+markers',
                type: 'scatter',
                name: 'Score',
                line: { color: '#4f46e5', width: 2 }
            };

            const layout = {
                title: 'Activity Score History',
                height: 350,
                margin: { t: 40, b: 60, l: 40, r: 10 },
                xaxis: { title: 'Date' },
                yaxis: { title: 'Score (%)', range: [0, 100] }
            };

            try {
                Plotly.newPlot(elements.studentProgressChart, [trace], layout, { responsive: true });
            } catch (e) {
                console.error("Plotly Error:", e);
                elements.studentProgressChart.innerHTML = '<p class="text-danger text-center pt-5">Failed to load chart.</p>';
            }
        }

        // LMS: Load Groups & Assignments
        loadStudentGroups();
        loadStudentDashboardAssignments(studentId);

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        if (elements.studentMetrics) {
            elements.studentMetrics.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger shadow-sm">
                        <h4 class="alert-heading"><span class="material-icons align-middle">error</span> Error Loading Dashboard</h4>
                        <p>${error.message}</p>
                        <hr>
                        <button class="btn btn-sm btn-outline-danger" onclick="loadStudentDashboard('${studentId}')">Retry</button>
                    </div>
                </div>`;
        }
    }
    scrollChatToBottom();
}

async function loadStudentDashboardAssignments(studentId) {
    const container = document.getElementById('student-upcoming-assignments');
    if (!container) return;

    container.innerHTML = '<p class="text-muted small">Loading assignments...</p>';

    try {
        const res = await fetchAPI(`/students/${studentId}/assignments`);
        if (res.ok) {
            const assignments = await res.json();

            if (assignments.length === 0) {
                container.innerHTML = '<p class="text-muted small">Hooray! No pending assignments.</p>';
                return;
            }

            container.innerHTML = assignments.map(a => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">${a.title}</div>
                        <div class="small text-muted">
                            <span class="badge bg-light text-dark border me-1">${a.course_name}</span>
                            Due: ${a.due_date}
                        </div>
                    </div>
                    ${a.type === 'Assignment' || a.type === 'Project' ?
                    `<button class="btn btn-sm btn-outline-success" onclick="openSubmitModal(${a.id}, '${a.title.replace(/'/g, "\\'")}')">Submit</button>` : ''}
                </div>
            `).join('');

        } else {
            container.innerHTML = '<p class="text-danger small">Failed to load assignments.</p>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-danger small">Error loading assignments.</p>';
    }
}
// --- PARENT PORTAL LOGIC ---
async function loadParentChildData() {
    const childIdInput = document.getElementById('parent-child-id');
    const childId = childIdInput.value.trim();

    if (!childId) { alert("Please enter a Student ID."); return; }

    // UI Elements
    const contentDiv = document.getElementById('parent-dashboard-content');
    const nameSpan = document.getElementById('parent-child-name');
    const metricsDiv = document.getElementById('parent-metrics');
    const feedbackP = document.getElementById('parent-feedback');
    const attendanceEl = document.getElementById('parent-attendance');
    const chartDiv = document.getElementById('parent-progress-chart');

    contentDiv.classList.remove('d-none');
    nameSpan.textContent = "Loading...";
    metricsDiv.innerHTML = '<div class="spinner-border text-primary"></div>';

    try {
        // Reuse the student data endpoint (Observer pattern)
        const response = await fetchAPI(`/students/${childId}/data`);
        if (!response.ok) throw new Error("Student not found or access denied.");

        const data = await response.json();
        const summary = data.summary;
        const student = appState.allStudents.find(s => s.id === childId) || { name: childId, attendance_rate: '?' };

        // Populate Data
        nameSpan.textContent = student.name || childId;
        attendanceEl.textContent = `${student.attendance_rate}%`;
        feedbackP.textContent = summary.recommendation || "No specific feedback generated yet.";
        feedbackP.className = summary.recommendation ? "text-dark" : "small fst-italic text-muted mb-0";

        // Metrics
        metricsDiv.innerHTML = '';
        renderMetric(metricsDiv, "Avg Score", `${summary.avg_score}%`, 'border-primary');
        renderMetric(metricsDiv, "Activities", summary.total_activities, 'border-info');
        renderMetric(metricsDiv, "Math", `${summary.math_score}%`);
        renderMetric(metricsDiv, "Science", `${summary.science_score}%`);

        // Graph
        if (chartDiv) {
            const history = data.history;
            const dates = history.map(h => h.date);
            const scores = history.map(h => h.score);

            const trace = {
                x: dates,
                y: scores,
                mode: 'lines+markers',
                type: 'scatter',
                name: 'Score',
                line: { color: '#198754', width: 2 } // Green for parents
            };

            Plotly.newPlot(chartDiv, [trace], {
                title: 'Child\'s Academic Progress',
                height: 300,
                margin: { t: 40, b: 30, l: 40, r: 10 },
                xaxis: { title: 'Date' },
                yaxis: { title: 'Score (%)', range: [0, 100] }
            }, { responsive: true });
        }

    } catch (e) {
        alert(e.message);
        contentDiv.classList.add('d-none');
    }
}


// --- CHAT LOGIC ---
function scrollChatToBottom() {
    elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
}

function appendChatMessage(sender, message) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender === 'user' ? 'user-message' : 'assistant-message'}`;
    msgDiv.textContent = message;
    elements.chatMessagesContainer.appendChild(msgDiv);

    if (appState.activeStudentId) {
        if (!appState.chatMessages[appState.activeStudentId]) appState.chatMessages[appState.activeStudentId] = '';
        appState.chatMessages[appState.activeStudentId] = elements.chatMessagesContainer.innerHTML;
    }
    scrollChatToBottom();
}

// Voice Recognition Setup
let recognition;
let isListening = false;

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chat-input').value = transcript;
        toggleVoiceInput(); // Stop listening UI
        // Auto-send after speaking (optional, but feels smoother)
        handleChatSubmit(null);
    };

    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        toggleVoiceInput();
    };
}

function toggleVoiceInput() {
    const btn = document.getElementById('mic-btn');
    if (!recognition) {
        alert("Your browser does not support voice input. Try Chrome.");
        return;
    }

    if (isListening) {
        recognition.stop();
        isListening = false;
        btn.classList.remove('btn-danger', 'animate-pulse');
        btn.classList.add('btn-outline-secondary');
        btn.innerHTML = '<span class="material-icons">mic</span>';
    } else {
        recognition.start();
        isListening = true;
        btn.classList.remove('btn-outline-secondary');
        btn.classList.add('btn-danger'); // Red to indicate recording
        btn.innerHTML = '<span class="material-icons">mic_off</span>';
        document.getElementById('chat-input').placeholder = "Listening...";
    }
}

function speakText(text) {
    // Basic text-to-speech
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }
}


async function handleChatSubmit(e) {
    if (e) e.preventDefault();
    const inputEl = document.getElementById('chat-input'); // Direct access
    const prompt = inputEl.value.trim();
    const studentId = appState.activeStudentId;

    if (!prompt || !studentId) return;

    appendChatMessage('user', prompt);
    inputEl.value = '';

    try {
        const response = await fetchAPI(`/ai/chat/${studentId}`, {
            method: 'POST',
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();
        if (response.ok) {
            appendChatMessage('assistant', data.reply);
            speakText(data.reply); // Read answer aloud
        }
        else appendChatMessage('assistant', `Error: ${data.detail || 'Service error'}`);
    } catch (error) {
        appendChatMessage('assistant', 'Network Error');
    }
}



// --- LIVE CLASSES (Simplified) ---
async function loadLiveClasses() {
    try {
        let url = '/classes/upcoming';
        if (appState.role === 'Parent' && appState.activeStudentId) {
            url += `?student_id=${appState.activeStudentId}`;
        }
        const response = await fetchAPI(url);
        if (response.ok) {
            renderLiveClasses(await response.json());
        }
    } catch (error) { }
}

function renderLiveClasses(classes) {
    if (!classes || classes.length === 0) {
        elements.liveClassesList.innerHTML = '<p class="text-muted small">No live classes scheduled.</p>';
        return;
    }

    let html = '<div class="list-group">';
    classes.forEach(cls => {
        const dateObj = new Date(cls.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        html += `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 text-primary-custom fw-bold"><span class="material-icons align-middle fs-6 me-1">videocam</span> ${cls.topic}</h6>
                        <small class="text-muted">${dateStr}</small>
                    </div>
                    <a href="${cls.meet_link}" target="_blank" class="btn btn-sm btn-outline-danger">Join</a>
                </div>
            `;
    });
    html += '</div>';
    elements.liveClassesList.innerHTML = html;
}

function checkClassStatus() {
    if (appState.role === 'Teacher') {
        document.getElementById('live-class-controls').style.display = 'block';
        elements.studentLiveBanner.classList.remove('d-flex');
        elements.studentLiveBanner.classList.add('d-none');
    } else {
        // Student: Check if live session is active via a flag in API (mocked here or relies on persistent store)
        // For now, simple check if banner should be hidden/shown logic is handled by teacher start/end
        // But in stateless frontend, we might need to poll /status. 
        // We'll leave it as event-driven for this demo or manual
        if (document.getElementById('live-class-controls')) {
            document.getElementById('live-class-controls').parentNode.removeChild(document.getElementById('live-class-controls')); // Remove teacher controls from DOM
        }
    }
}

// --- TEACHER LIVE ACTIONS ---
function startClass() {
    const link = elements.meetLinkInput.value;
    if (!link) { alert("Enter Meet Link"); return; }
    // In a real app, this would notify backend. 
    // Here we simulate visually for everyone if they were using sockets, but since it's just local:
    alert("Class Started! In a real app, students would see the banner now.");
    // We can't easily affect other connected clients without WebSockets, but we can show it locally
    if (appState.role === 'Student') showLiveBanner(link);
}

function endClass() {
    alert("Class Ended.");
}

function showLiveBanner(link) {
    elements.studentLiveBanner.classList.remove('d-none');
    elements.studentLiveBanner.classList.add('d-flex');
    elements.studentJoinLink.href = link;
}

// --- SCHEDULE CLASS LOGIC ---
async function handleScheduleClass(e) {
    e.preventDefault();
    elements.scheduleMessage.textContent = "Scheduling...";
    elements.scheduleMessage.className = "text-primary";

    // Get selected students
    const checkboxes = document.querySelectorAll('#schedule-student-list input[type="checkbox"]:checked');
    const targetStudentIds = Array.from(checkboxes).map(cb => cb.value);

    const classData = {
        teacher_id: appState.userId || 'teacher', // Ensure teacher_id is sent
        topic: document.getElementById('class-topic').value,
        date: document.getElementById('class-date').value,
        meet_link: document.getElementById('class-link').value,
        target_students: targetStudentIds
    };

    try {
        const response = await fetchAPI('/classes/schedule', {
            method: 'POST',
            body: JSON.stringify(classData)
        });

        if (response.ok) {
            elements.scheduleMessage.textContent = "Class Scheduled!";
            elements.scheduleMessage.className = "text-success fw-bold";
            setTimeout(() => {
                elements.scheduleClassModal.hide();
                elements.scheduleMessage.textContent = "";
                elements.scheduleClassForm.reset();
            }, 1000);
            loadLiveClasses();
        } else {
            const err = await response.json();
            elements.scheduleMessage.textContent = "Failed: " + (err.detail || "Unknown error");
            elements.scheduleMessage.className = "text-danger";
        }
    } catch (error) {
        elements.scheduleMessage.textContent = "Error scheduling class.";
        elements.scheduleMessage.className = "text-danger";
    }
}

function toggleStudentCheckboxes(source) {
    const checkboxes = document.querySelectorAll('#schedule-student-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

// --- GROUPS LOGIC ---

async function loadGroups() {
    const container = document.getElementById('groups-list');
    container.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';

    try {
        const response = await fetchAPI('/groups');
        if (response.ok) {
            const groups = await response.json();
            renderGroupsList(groups);
            appState.groups = groups; // Cache
        }
    } catch (e) { container.innerHTML = 'Error loading groups'; }
}

function renderGroupsList(groups) {
    const container = document.getElementById('groups-list');
    if (groups.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-secondary">No courses created yet. Click "Create Course" to start.</div></div>';
        return;
    }

    container.innerHTML = groups.map(g => `
            <div class="col-md-4">
                <div class="card h-100 shadow-sm border-0 group-card hover-up">
                    <div class="card-body text-center cursor-pointer" onclick="openCourseDetail('${g.id}')">
                        <div class="mb-3">
                            <div class="bg-primary-subtle text-primary rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 64px; height: 64px;">
                                <span class="material-icons fs-1">school</span>
                            </div>
                        </div>
                        <span class="badge bg-info text-dark rounded-pill mb-2">${g.subject || 'General'}</span>
                        <h5 class="card-title fw-bold text-dark">${g.name}</h5>
                        <p class="card-text text-muted small text-truncate">${g.description || 'No description'}</p>
                        <span class="badge bg-light text-secondary border rounded-pill px-3 py-1">
                            ${g.member_count} Students
                        </span>
                    </div>
                    <div class="card-footer bg-white border-top-0 pb-3 pt-0 px-4">
                        <div class="d-flex gap-2">
                             <button class="btn btn-sm btn-outline-primary fw-bold flex-grow-1" onclick="openCourseDetail('${g.id}')">Open Course</button>
                             ${appState.role === 'Teacher' ? `<button class="btn btn-sm btn-light text-muted" onclick="openManageMembers('${g.id}', '${g.name.replace(/'/g, "\\'")}')" title="Manage"><span class="material-icons" style="font-size: 18px;">settings</span></button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
}

document.getElementById('create-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('create-group-message');
    msg.textContent = 'Creating...';

    try {
        const res = await fetchAPI('/groups', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('group-name').value,
                description: document.getElementById('group-desc').value,
                subject: document.getElementById('group-subject').value
            })
        });
        if (res.ok) {
            msg.textContent = 'Success!';
            elements.createGroupModal.hide();
            document.getElementById('create-group-form').reset();
            msg.textContent = '';
            loadGroups();
        } else { msg.textContent = 'Failed: ' + (await res.json()).detail; }
    } catch (e) { msg.textContent = 'Error creating course.'; }
});

async function openManageMembers(groupId, groupName) {
    document.getElementById('manage-group-name').textContent = groupName; // Legacy
    if (document.getElementById('manage-group-title')) {
        document.getElementById('manage-group-title').textContent = `👥 Manage: ${groupName}`;
    }
    document.getElementById('manage-group-id').value = groupId;

    // Reset Tabs
    if (document.getElementById('tab-members-btn')) {
        new bootstrap.Tab(document.getElementById('tab-members-btn')).show();
    }

    const listContainer = document.getElementById('group-members-list');
    listContainer.innerHTML = 'Loading...';

    elements.manageMembersModal.show();

    try {
        // Get current members
        const res = await fetchAPI(`/groups/${groupId}/members`);
        const data = await res.json();
        const currentMemberIds = data.members;

        // Render all students with checks
        listContainer.innerHTML = appState.allStudents.map(s => {
            const isChecked = currentMemberIds.includes(s.id) ? 'checked' : '';
            return `
                    <div class="form-check border-bottom py-2">
                        <input class="form-check-input" type="checkbox" value="${s.id}" id="gm-${s.id}" ${isChecked}>
                        <label class="form-check-label" for="gm-${s.id}">
                            ${s.name} <small class="text-muted">(${s.id})</small>
                        </label>
                    </div>
                `;
        }).join('');

        // Load Materials implicitly (or trigger lazy load)
        loadGroupMaterials(groupId);

    } catch (e) { listContainer.innerHTML = 'Error loading members'; }
}

// --- MATERIALS LOGIC ---

function toggleMaterialInput() {
    const type = document.getElementById('mat-type').value;
    const textGroup = document.getElementById('mat-text-input-group');
    const fileGroup = document.getElementById('mat-file-input-group');
    const textInput = document.getElementById('mat-content');
    const fileInput = document.getElementById('mat-file');

    if (type === 'File') {
        textGroup.classList.add('d-none');
        fileGroup.classList.remove('d-none');
        textInput.required = false;
        fileInput.required = true;
    } else {
        textGroup.classList.remove('d-none');
        fileGroup.classList.add('d-none');
        textInput.required = true;
        fileInput.required = false;
    }
}

async function handlePostMaterial(e) {
    e.preventDefault();
    const btn = document.getElementById('post-material-btn');
    const groupId = document.getElementById('manage-group-id').value;
    const title = document.getElementById('mat-title').value;
    const type = document.getElementById('mat-type').value;

    // Disable button to prevent double submit
    btn.disabled = true;
    btn.textContent = "Posting...";

    try {
        if (type === 'File') {
            const fileInput = document.getElementById('mat-file');
            const file = fileInput.files[0];

            if (!file) {
                alert("Please select a file.");
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            if (title) formData.append('title', title);

            // Fetch with native fetch for FormData (fetchAPI helper might default to JSON)
            // But we can use fetchAPI if we handle headers correctly.
            // Let's use direct logic here to be safe with multipart
            const headers = {};
            if (appState.isLoggedIn && appState.role && appState.userId) {
                headers['X-User-Role'] = appState.role;
                headers['X-User-Id'] = appState.userId;
            }

            const response = await fetch(`${API_BASE_URL}/groups/${groupId}/upload`, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!response.ok) {
                throw new Error((await response.json()).detail || "Upload failed");
            }

        } else {
            // Standard Text/JSON Post
            const content = document.getElementById('mat-content').value;
            await fetchAPI(`/groups/${groupId}/materials`, {
                method: 'POST',
                body: JSON.stringify({ title, type, content })
            });
        }

        document.getElementById('add-material-form').reset();
        toggleMaterialInput(); // Reset UI state
        loadGroupMaterials(groupId);
    } catch (e) {
        console.error(e);
        alert('Failed to post material: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Post";
    }
}

async function loadGroupMaterials(groupId) {
    const container = document.getElementById('group-materials-list');
    if (!container) return; // For student view safety
    container.innerHTML = '<div class="text-center p-2"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

    try {
        const res = await fetchAPI(`/groups/${groupId}/materials`);
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<div class="p-3 text-muted small text-center">No materials posted yet.</div>';
            return;
        }

        container.innerHTML = data.map(m => `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 fw-bold text-primary-custom">
                           <span class="badge ${m.type === 'Quiz' ? 'bg-danger' : 'bg-success'} me-1">${m.type}</span> ${m.title}
                        </h6>
                        <small class="text-muted">${m.date}</small>
                    </div>
                    <p class="mb-1 text-muted small text-break">${m.content}</p>
                </div>
            `).join('');
    } catch (e) { container.innerHTML = 'Error loading materials'; }
}

// --- STUDENT GROUPS LOGIC ---

async function loadStudentGroups() {
    if (!appState.activeStudentId) return;
    const container = document.getElementById('student-groups-list');
    container.innerHTML = 'Loading groups...';

    try {
        const res = await fetchAPI(`/students/${appState.activeStudentId}/groups`);
        if (res.ok) {
            const groups = await res.json();
            if (groups.length === 0) {
                container.innerHTML = '<p class="text-muted small">You are not enrolled in any courses yet.</p>';
                return;
            }

            container.innerHTML = groups.map(g => `
                    <div class="col-md-4 col-sm-6">
                        <div class="card h-100 border-0 shadow-sm student-group-card" onclick="openCourseDetail('${g.id}')">
                            <div class="card-body">
                                <span class="badge bg-secondary mb-2">${g.subject || 'General'}</span>
                                <h5 class="card-title fw-bold text-primary-custom">${g.name}</h5>
                                <p class="card-text text-muted small text-truncate">${g.description || 'No description'}</p>
                            </div>
                        </div>
                    </div>
                `).join('');
        }
    } catch (e) { container.innerHTML = 'Error.'; }
}

async function openStudentGroup(groupId, name, desc) {
    document.getElementById('sg-title').textContent = name;
    document.getElementById('sg-desc').textContent = desc;

    const container = document.getElementById('student-materials-list');
    container.innerHTML = 'Loading resources...';
    new bootstrap.Modal(document.getElementById('studentGroupModal')).show();

    try {
        const res = await fetchAPI(`/groups/${groupId}/materials`);
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<div class="alert alert-light text-center">No materials posted yet by your teacher.</div>';
            return;
        }
        container.innerHTML = data.map(m => {
            let actionBtn = '';
            if (m.type === 'Quiz' || m.type === 'Video' || m.content.startsWith('http')) {
                actionBtn = `<a href="${m.content}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">Open Link 🔗</a>`;
            }
            return `
                    <div class="list-group-item py-3">
                        <div class="d-flex justify-content-between">
                            <h6 class="mb-1 fw-bold">
                               <span class="badge ${m.type === 'Quiz' ? 'bg-danger' : 'bg-success'} me-2">${m.type}</span>${m.title}
                            </h6>
                            <small class="text-muted opacity-75">${m.date}</small>
                        </div>
                        <p class="mb-1 text-secondary mt-1">${m.content}</p>
                        ${actionBtn}
                    </div>
                 `;
        }).join('');

    } catch (e) { container.innerHTML = 'Error loading content.'; }
}


async function saveGroupMembers() {
    const groupId = document.getElementById('manage-group-id').value;
    const checked = document.querySelectorAll('#group-members-list input:checked');
    const ids = Array.from(checked).map(cb => cb.value);

    try {
        await fetchAPI(`/groups/${groupId}/members`, {
            method: 'POST',
            body: JSON.stringify({ student_ids: ids })
        });
        elements.manageMembersModal.hide();
        loadGroups(); // Refresh counts
    } catch (e) { alert('Failed to save members'); }
}

async function deleteGroup() {
    const groupId = document.getElementById('manage-group-id').value;
    if (!confirm("Delete this course?")) return;

    await fetchAPI(`/groups/${groupId}`, { method: 'DELETE' });
    elements.manageMembersModal.hide();
    loadGroups();
}

// --- SCHEDULE MODAL ENHANCEMENTS ---

// Updated listener to populate Groups dropdown
document.getElementById('scheduleClassModal').addEventListener('show.bs.modal', async function () {
    const list = document.getElementById('schedule-student-list');
    const groupSelect = document.getElementById('schedule-group-filter');

    // Populate Students
    list.innerHTML = '';
    if (appState.allStudents.length === 0) {
        list.innerHTML = '<p class="text-muted small">No students found.</p>';
    } else {
        appState.allStudents.forEach(s => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                    <input class="form-check-input" type="checkbox" value="${s.id}" id="student-cb-${s.id}">
                    <label class="form-check-label" for="student-cb-${s.id}">${s.name} (${s.id})</label>
                `;
            list.appendChild(div);
        });
    }

    // Populate Groups Dropdown
    groupSelect.innerHTML = '<option value="">-- All Students --</option>';
    try {
        const res = await fetchAPI('/groups');
        if (res.ok) {
            const groups = await res.json();
            groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                groupSelect.appendChild(opt);
            });
        }
    } catch (e) { }
});

async function applyGroupFilter(groupId) {
    if (!groupId) return; // Wait for functionality or reset?

    // Uncheck all first
    document.querySelectorAll('#schedule-student-list input[type="checkbox"]').forEach(cb => cb.checked = false);

    try {
        const res = await fetchAPI(`/groups/${groupId}/members`);
        const data = await res.json();
        data.members.forEach(sid => {
            const cb = document.getElementById(`student-cb-${sid}`);
            if (cb) cb.checked = true;
        });
    } catch (e) { }
}

// --- EVENT LISTENERS ---
// Robust attachment helper to prevent script crashes if an element is missing
function attachListener(elementOrId, event, handler) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) {
        el.addEventListener(event, handler);
    } else {
        console.warn(`Element not found for event: ${event}`);
    }
}

attachListener(elements.loginForm, 'submit', handleLogin);
attachListener('two-factor-form', 'submit', handle2FASubmit);

async function handleScheduleClass(e) {
    e.preventDefault();
    const msg = document.getElementById('schedule-message');
    msg.textContent = 'Scheduling...';

    // items
    const topic = document.getElementById('class-topic').value;
    const date = document.getElementById('class-date').value;
    const link = document.getElementById('class-link').value;

    // students
    const checkedBoxes = document.querySelectorAll('#schedule-student-list input:checked');
    const target_students = Array.from(checkedBoxes).map(cb => cb.value);

    // Payload
    const payload = {
        topic: topic,
        date: date,
        meet_link: link,
        target_students: target_students
    };

    try {
        const res = await fetchAPI('/classes', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            msg.textContent = 'Class Scheduled Successfully!';
            msg.className = 'text-success fw-medium'; // color fix
            setTimeout(() => {
                elements.scheduleClassModal.hide();
                elements.scheduleClassForm.reset();
                msg.textContent = '';
                // Optional: Refresh local list if teacher view has one
            }, 1000);
        } else {
            const err = await res.json();
            msg.textContent = 'Error: ' + (err.detail || 'Failed');
            msg.className = 'text-danger fw-medium';
        }
    } catch (err) {
        console.error(err);
        msg.textContent = 'Network Error';
        msg.className = 'text-danger fw-medium';
    }
}

attachListener(elements.addStudentForm, 'submit', handleAddStudent);
attachListener(elements.addActivityForm, 'submit', handleAddActivity);
attachListener(elements.editStudentForm, 'submit', handleEditStudentSubmit);
// Chat form listener removed - handled via onClick in HTML to prevent reload issues
attachListener(elements.scheduleClassForm, 'submit', handleScheduleClass);

// Explicitly attach listener with console log for debugging
// Quiz generation is handled via onclick="handleGenerateQuiz(event)" in HTML


// Initial load for Checkboxes (populate when modal opens)
document.getElementById('scheduleClassModal').addEventListener('show.bs.modal', function () {
    const list = document.getElementById('schedule-student-list');
    list.innerHTML = '';
    if (appState.allStudents.length === 0) {
        list.innerHTML = '<p class="text-muted small">No students found.</p>';
        return;
    }
    appState.allStudents.forEach(s => {
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${s.id}" id="student-cb-${s.id}">
                <label class="form-check-label" for="student-cb-${s.id}">${s.name} (${s.id})</label>
            `;
        list.appendChild(div);
    });
});
// --- REGENERATE & EMAIL CODE LOGIC ---

async function regenerateAccessCode() {
    const studentId = document.getElementById('card-student-id').textContent;
    if (!confirm("Regenerate code for " + studentId + "? Old codes will stop working.")) return;

    try {
        const response = await fetchAPI(`/students/${studentId}/regenerate-code`, { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            // Refresh codes in modal
            const codesDiv = document.getElementById('card-codes-list');
            codesDiv.innerHTML = '';
            data.codes.forEach(code => {
                codesDiv.innerHTML += `<span class="badge bg-dark fs-5 p-2 tracking-wider font-monospace">${code}</span>`;
            });
            alert("New code generated!");
        } else {
            alert(data.detail || "Failed to regenerate.");
        }
    } catch (error) {
        console.error(error);
        alert("Failed to regenerate code.");
    }
}

// 8. AI GENERATION & QUIZZES
async function handleGenerateQuiz(e) {
    if (e) e.preventDefault();
    const btn = e.target;
    // const originalText = btn.innerHTML; // Avoid losing icon complexity
    const topic = document.getElementById('quiz-topic').value;
    const fileInput = document.getElementById('quiz-pdf');

    if (!topic) {
        alert("Please enter a topic first.");
        return;
    }

    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
    btn.disabled = true;

    const resultContainer = document.getElementById('quiz-result-container');
    resultContainer.classList.add('d-none');

    // Get count, clamp between 1 and 20
    let count = parseInt(document.getElementById('quiz-count').value) || 5;
    if (count < 1) count = 1;
    if (count > 20) count = 20;

    try {
        const formData = new FormData();
        formData.append('topic', topic);
        formData.append('difficulty', document.getElementById('quiz-difficulty').value);
        formData.append('type', document.getElementById('quiz-type').value);
        formData.append('question_count', count);
        formData.append('description', document.getElementById('quiz-description').value);

        if (fileInput && fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        // Explicitly requesting a long timeout for AI? Standard fetch has no timeout but browsers do.
        const response = await fetch(`${API_BASE_URL}/ai/generate-quiz`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            let quizContent = data.content;
            // Clean up if wrapped in strings or markdown
            if (typeof quizContent === 'string') {
                // If backend didn't clean it enough
                try {
                    quizContent = JSON.parse(quizContent);
                } catch (e) {
                    console.error("Failed to parse", quizContent);
                    throw new Error("AI returned invalid JSON format.");
                }
            }

            window.generatedQuizData = {
                title: topic,
                questions: quizContent
            };

            // Render Preview
            renderQuizPreview(quizContent);
            resultContainer.classList.remove('d-none');

            // Populate dropdwon if needed
            const select = document.getElementById('save-quiz-group-select');
            select.innerHTML = '';
            // Only show courses where I am teacher
            if (appState.role === 'Teacher' && appState.groups.length > 0) {
                appState.groups.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id;
                    opt.textContent = g.name;
                    select.appendChild(opt);
                });
            } else if (appState.currentCourseId) {
                // Should we allow generic save?
                const opt = document.createElement('option');
                opt.value = appState.currentCourseId;
                opt.textContent = "Current Course";
                select.appendChild(opt);
            }

        } else {
            alert("Error: " + (data.detail || "Failed to generate quiz."));
        }

    } catch (error) {
        console.error(error);
        alert("Failed to generate quiz: " + error.message);
    } finally {
        btn.innerHTML = '✨ Generate Quiz';
        btn.disabled = false;
    }
}

async function updateSaveValues() {
    // Populate Groups Helper
    const select = document.getElementById('save-quiz-group-select');
    if (!select) return;

    // Try to ensure we have groups
    if (!appState.groups || appState.groups.length === 0) {
        try {
            const endpoint = appState.role === 'Student' ? `/students/${appState.activeStudentId}/groups` : '/groups';
            const res = await fetchAPI(endpoint);
            if (res.ok) {
                appState.groups = await res.json();
            }
        } catch (e) {
            console.error("Failed to fetch groups for dropdown", e);
        }
    }

    select.innerHTML = '';
    if (appState.groups && appState.groups.length > 0) {
        appState.groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            if (appState.currentCourseId && g.id == appState.currentCourseId) opt.selected = true;
            select.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.textContent = "No courses found";
        select.appendChild(opt);
    }
}

function renderQuizPreview(questions, showAnswers) {
    const container = document.getElementById('quiz-preview-content');
    if (!container) return;

    container.innerHTML = questions.map((q, i) => `
        <div class="mb-3 border-bottom pb-2">
            <strong class="d-block mb-1">Q${i + 1}: ${q.question}</strong>
            <ul class="list-unstyled ps-3 mb-1">
                ${q.options.map(opt => {
        // Logic: If showAnswers is true, highlight specific one. Else normal.
        const isCorrect = opt === q.correct_answer;
        const styleClass = (showAnswers && isCorrect) ? 'text-success fw-bold' : '';
        const icon = (showAnswers && isCorrect) ? '<span class="material-icons align-middle fs-6">check</span>' : '';
        return `<li class="${styleClass}">${icon} ${opt}</li>`;
    }).join('')}
            </ul>
        </div>
    `).join('');
}

function toggleQuizAnswers() {
    const isChecked = document.getElementById('toggle-quiz-answers').checked;
    if (window.generatedQuizData && window.generatedQuizData.questions) {
        renderQuizPreview(window.generatedQuizData.questions, isChecked);
    }
}

// Global function to save the quiz
window.saveGeneratedQuiz = async function () {
    const select = document.getElementById('save-quiz-group-select');
    let groupId = select ? select.value : null;

    // Fallback: If dropdown is empty/missing but we are in a course context, use that
    if (!groupId && appState.currentCourseId) {
        groupId = appState.currentCourseId;
    }

    console.log("Saving Quiz...", { groupId, hasData: !!window.generatedQuizData });

    if (!groupId) {
        alert("Please select a course to save this quiz to. (No Course ID found)");
        return;
    }

    if (!window.generatedQuizData) {
        alert("No quiz data found to save. Please regenerate the quiz.");
        return;
    }

    const btn = document.querySelector('#quiz-save-area button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Saving...';

    try {
        const res = await fetchAPI('/quizzes/create', {
            method: 'POST',
            body: JSON.stringify({
                group_id: groupId,
                title: window.generatedQuizData.title,
                questions: window.generatedQuizData.questions
            })
        });

        if (res.ok) {
            alert("Quiz Saved to Course Successfully!");
            bootstrap.Modal.getInstance(document.getElementById('generateQuizModal')).hide();
            // Reset modal state
            document.getElementById('quiz-result-container').classList.add('d-none');
            document.getElementById('toggle-quiz-answers').checked = false;

            if (appState.currentCourseId == groupId && typeof loadCourseQuizzes === 'function') {
                loadCourseQuizzes(groupId);
            }
        } else {
            alert("Failed to save. Please try again.");
        }
    } catch (e) {
        alert("Error saving: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

async function sendAccessCardEmail() {
    const studentId = document.getElementById('card-student-id').textContent;
    const btn = document.getElementById('btn-email-card');

    // Check if ID looks like an email
    if (!studentId.includes('@')) {
        alert("Email feature only works for users registered with an Email ID (e.g. Google Login).");
        return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';
    btn.disabled = true;

    try {
        const response = await fetchAPI(`/students/${studentId}/email-code`, { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            alert(data.message);
        } else {
            alert("Error: " + data.detail);
        }
    } catch (e) {
        alert("Network error sending email.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- MOBILE UI LOGIC ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    // Toggle class on sidebar
    if (sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    } else {
        sidebar.classList.add('mobile-open');
        if (overlay) overlay.classList.add('active');
    }
}

// --- WHITEBOARD LOGIC ---
let whiteboardManager = {
    socket: null,
    canvas: null,
    ctx: null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    color: '#000000',
    width: 2,

    init: function () {
        this.canvas = document.getElementById('whiteboard-canvas');
        if (!this.canvas) return; // Guard
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        // Events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, false);
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("mousemove", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, false);


        // Controls
        const colorInput = document.getElementById('wb-color');
        if (colorInput) colorInput.addEventListener('input', (e) => this.color = e.target.value);

        const widthInput = document.getElementById('wb-width');
        if (widthInput) widthInput.addEventListener('input', (e) => this.width = e.target.value);

        // Window resize
        window.addEventListener('resize', () => this.resize());
    },

    connect: function () {
        if (this.socket) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Handle both localhost and production socket URLs
        let wsUrl = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
            ? 'ws://127.0.0.1:8000/ws/whiteboard'
            : `${protocol}//${window.location.host}/ws/whiteboard`;

        // Explicit override if needed based on API_BASE_URL logic
        if (API_BASE_URL.includes('onrender')) {
            wsUrl = 'wss://backend1-bzh1.onrender.com/ws/whiteboard';
        }

        this.socket = new WebSocket(wsUrl);

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'draw') {
                this.drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false);
            } else if (data.type === 'clear') {
                this.clearCanvas(false);
            }
        };

        this.socket.onopen = () => console.log("Whiteboard Connected");
        this.socket.onclose = () => {
            console.log("Whiteboard Disconnected");
            this.socket = null;
        };
    },

    resize: function () {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },
    startDrawing: function (e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    },

    draw: function (e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.drawLine(this.lastX, this.lastY, x, y, this.color, this.width, true);
        [this.lastX, this.lastY] = [x, y];
    },

    stopDrawing: function () {
        this.isDrawing = false;
    },

    drawLine: function (x0, y0, x1, y1, color, width, emit) {
        this.ctx.beginPath();
        this.ctx.moveTo(x0, y0);
        this.ctx.lineTo(x1, y1);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
        this.ctx.closePath();

        if (emit && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'draw',
                x0: x0, y0: y0, x1: x1, y1: y1,
                color: color,
                width: width
            }));
        }
    },

    clearCanvas: function (emit) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (emit && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'clear' }));
        }
    }
};

function openWhiteboard() {
    // Show Modal
    const modal = new bootstrap.Modal(document.getElementById('whiteboardModal'));
    modal.show();

    // Initialize after modal is shown to get correct dimensions
    const modalParams = document.getElementById('whiteboardModal');
    modalParams.addEventListener('shown.bs.modal', () => {
        whiteboardManager.init();
        whiteboardManager.connect();
    }, { once: true });
}

function clearWhiteboard() {
    whiteboardManager.clearCanvas(true);
}
// --- EXPORT FUNCTIONALITY ---
async function exportTeacherData() {
    if (!appState.isLoggedIn || (appState.role !== 'Teacher' && appState.role !== 'Admin')) {
        alert("Unauthorized access.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/teacher/export-grades-csv`, {
            method: 'GET',
            headers: {
                'X-User-Role': appState.role,
                'X-User-Id': appState.userId
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Export failed: ${response.status} - ${errorText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Use a generic name or formatted date
        const date = new Date().toISOString().split('T')[0];
        a.download = `noble_nexus_grades_${date}.csv`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error("Export error:", error);
        alert(`Failed to export grades. ${error.message}`);
    }
}

// --- LMS COURSE LOGIC (Phase 1 & 2) ---



async function openCourseDetail(groupId) {
    console.log("Opening course:", groupId);
    try {
        if (!groupId) throw new Error("Invalid Course ID");

        appState.currentCourseId = groupId;

        // 1. Force Switch View
        // Use simpler logic to avoid any potential switchView issues
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const detailView = document.getElementById('course-detail-view');
        if (detailView) detailView.classList.add('active');
        else throw new Error("Course Detail View Element Missing");

        // 2. Fetch/Find Metadata Safe Mode
        let course = null;
        if (Array.isArray(appState.groups)) {
            course = appState.groups.find(g => g && g.id == groupId);
        }

        if (!course) {
            console.log("Course not in cache, fetching...");
            try {
                const endpoint = appState.role === 'Student' ? `/students/${appState.activeStudentId}/groups` : '/groups';
                const res = await fetchAPI(endpoint);
                const groups = await res.json();
                if (Array.isArray(groups)) {
                    course = groups.find(g => g && g.id == groupId);
                }
            } catch (e) {
                console.error("Error fetching course details:", e);
                // Don't crash, just show what we have (or dont have)
            }
        }

        if (course) {
            const titleEl = document.getElementById('course-title');
            const descEl = document.getElementById('course-desc');
            const badgeEl = document.getElementById('course-subject-badge');

            if (titleEl) titleEl.textContent = course.name || 'Untitled Course';
            if (descEl) descEl.textContent = course.description || 'No description provided.';
            if (badgeEl) badgeEl.textContent = course.subject || 'General';
        } else {
            console.warn("Course metadata not found for ID:", groupId);
            // Optional: Alert user? Or just let them see empty state?
        }

        // 3. UI Controls for Teachers
        const isTeacher = appState.role === 'Teacher' || appState.role === 'Admin';
        const uploadBtn = document.getElementById('upload-material-btn');
        const manageBtn = document.getElementById('manage-members-btn');

        if (uploadBtn) {
            if (isTeacher) uploadBtn.classList.remove('d-none');
            else uploadBtn.classList.add('d-none');
        }
        if (manageBtn) {
            if (isTeacher) manageBtn.classList.remove('d-none');
            else manageBtn.classList.add('d-none');
        }
        const createAsgBtn = document.getElementById('create-assignment-btn');
        if (createAsgBtn) {
            if (isTeacher) createAsgBtn.classList.remove('d-none');
            else createAsgBtn.classList.add('d-none');
        }

        const addVideoBtn = document.getElementById('add-video-btn');
        if (addVideoBtn) {
            if (isTeacher) addVideoBtn.classList.remove('d-none');
            else addVideoBtn.classList.add('d-none');
        }

        // 4. Load Content safetly
        if (typeof loadCourseMaterials === 'function') loadCourseMaterials(groupId).catch(e => console.error(e));
        if (typeof loadCourseQuizzes === 'function') loadCourseQuizzes(groupId).catch(e => console.error(e));
        if (typeof loadCourseMembers === 'function') loadCourseMembers(groupId).catch(e => console.error(e));
        if (typeof loadCourseAssignments === 'function') loadCourseAssignments(groupId).catch(e => console.error(e));

    } catch (err) {
        console.error("Critical error in openCourseDetail:", err);
        alert("Unable to open course: " + err.message);
    }
}

// 1. MATERIALS (With Uploads)
// 1. MATERIALS (With Uploads)
// VIDEO LOGIC
function openAddVideoModal() {
    document.getElementById('add-video-form').reset();
    new bootstrap.Modal(document.getElementById('addVideoModal')).show();
}

// GENERIC FILE UPLOAD
async function handleMaterialUpload(input) {
    if (!appState.currentCourseId) return;
    const file = input.files[0];
    if (!file) return;

    if (!confirm(`Upload "${file.name}" to this course?`)) {
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    // Use filename as default title
    formData.append('title', file.name);

    try {
        // Note: fetchAPI wrapper might not handle FormData correctly if it forces JSON headers.
        // We'll use raw fetch for upload if needed, or adjust headers.
        // Let's try raw fetch to be safe with FormData boundary.
        const token = localStorage.getItem('access_token'); // If you use tokens

        // Construct URL manually since we need special headers (or lack thereof for boundary)
        const res = await fetch(`${API_BASE_URL}/groups/${appState.currentCourseId}/upload?title=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            headers: {
                'X-User-Role': appState.role || '',
                'X-User-Id': appState.userId || ''
            },
            body: formData
        });

        if (res.ok) {
            alert("File uploaded successfully!");
            loadCourseMaterials(appState.currentCourseId);
        } else {
            const err = await res.json();
            alert("Upload failed: " + (err.detail || 'Unknown error'));
        }
    } catch (e) {
        console.error(e);
        alert("Error uploading file.");
    } finally {
        input.value = ''; // Reset input
    }
}

async function handleAddVideo() {
    if (!appState.currentCourseId) return;

    const title = document.getElementById('video-title').value;
    const url = document.getElementById('video-url').value;

    if (!title || !url) {
        alert("Please enter both title and URL.");
        return;
    }

    try {
        const res = await fetchAPI(`/groups/${appState.currentCourseId}/materials`, {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                type: 'Video',
                content: url
            })
        });

        if (res.ok) {
            alert("Video added successfully!");
            bootstrap.Modal.getInstance(document.getElementById('addVideoModal')).hide();
            loadCourseMaterials(appState.currentCourseId);
        } else {
            alert("Failed to add video.");
        }
    } catch (e) {
        console.error(e);
        alert("Error adding video.");
    }
}

async function loadCourseMaterials(groupId) {
    const list = document.getElementById('materials-list');
    if (!list) { console.warn("materials-list element missing"); return; }

    list.innerHTML = '<p class="text-muted">Loading...</p>';

    try {
        const res = await fetchAPI(`/groups/${groupId}/materials`);
        if (!res.ok) {
            list.innerHTML = '<p class="text-danger small">Failed to load materials.</p>';
            return;
        }

        const materials = await res.json();

        if (!Array.isArray(materials)) {
            // Handle edge case where backend returns object
            console.error("Expected array for materials, got:", materials);
            list.innerHTML = '<p class="text-danger small">Invalid data received.</p>';
            return;
        }

        if (materials.length === 0) {
            list.innerHTML = '<p class="text-muted small">No materials uploaded yet.</p>';
            return;
        }

        list.innerHTML = materials.map(m => {
            let icon = 'description';
            let color = 'bg-light text-dark';
            // Safe content check
            const contentUrl = m.content || '';
            const type = m.type || 'Note';

            if (type === 'PDF') { icon = 'picture_as_pdf'; color = 'bg-danger text-white'; }
            if (type === 'Video') { icon = 'play_circle'; color = 'bg-primary text-white'; }
            if (type === 'Image') { icon = 'image'; color = 'bg-success text-white'; }

            let downloadLink = '';
            if (contentUrl.startsWith('/') || contentUrl.startsWith('http')) {
                // Formatting URL safely
                const fullUrl = contentUrl.startsWith('http') ? contentUrl : `${API_BASE_URL.replace('/api', '')}${contentUrl}`;
                const btnText = type === 'Video' ? 'Watch' : 'Open';
                downloadLink = `<a href="${fullUrl}" target="_blank" class="btn btn-sm btn-outline-primary">${btnText}</a>`;
            }

            return `
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body d-flex align-items-center gap-3">
                            <div class="rounded p-2 ${color}"><span class="material-icons">${icon}</span></div>
                            <div class="flex-grow-1">
                                <h6 class="mb-0 fw-bold text-truncate">${m.title || 'Untitled'}</h6>
                                <small class="text-muted">${m.date || ''}</small>
                            </div>
                            ${downloadLink}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        if (list) list.innerHTML = '<p class="text-danger small">Error loading materials</p>';
    }
}

// 2. QUIZZES (Persistent)
async function loadCourseQuizzes(groupId) {
    const list = document.getElementById('quizzes-list');
    if (!list) return;

    list.innerHTML = '<p class="text-muted">Loading...</p>';

    try {
        const res = await fetchAPI(`/groups/${groupId}/quizzes`);
        if (!res.ok) throw new Error("API Failure");

        const quizzes = await res.json();

        if (!Array.isArray(quizzes)) {
            list.innerHTML = '<p class="text-muted small">No quizzes.</p>';
            return;
        }

        if (quizzes.length === 0) {
            list.innerHTML = '<p class="text-muted small">No quizzes assigned.</p>';
            return;
        }

        list.innerHTML = quizzes.map(q => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1 fw-bold">${q.title}</h6>
                    <small class="text-muted">${q.question_count} Questions • Created ${new Date(q.created_at).toLocaleDateString()}</small>
                </div>
                <button class="btn btn-primary btn-sm fw-bold" onclick="takeQuiz('${q.id}')">
                    ${appState.role === 'Student' ? 'Start Quiz' : 'Preview Quiz'}
                </button>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<p class="text-danger small">Error loading quizzes</p>';
    }
}

// ... existing quiz logic ...

// 4. MEMBERS
async function loadCourseMembers(groupId) {
    const list = document.getElementById('course-members-list');
    if (!list) return;

    list.innerHTML = 'Loading...';
    try {
        const res = await fetchAPI(`/groups/${groupId}/members`);
        if (!res.ok) throw new Error("API Failure");
        const data = await res.json();

        // Safety check for members array
        const memberIds = Array.isArray(data.members) ? data.members : [];
        const members = appState.allStudents.filter(s => memberIds.includes(s.id));

        if (members.length === 0) list.innerHTML = '<p class="text-muted small">No students enrolled.</p>';
        else {
            list.innerHTML = members.map(m => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${m.name}</span>

                </li>
            `).join('');
        }
    } catch (e) {
        list.innerHTML = 'Error loading members.';
    }
}

// Ensure Manage Members Modal works from new view
function openManageMembersModal() {
    // Current course ID is set globally
    const course = appState.groups.find(g => g.id == appState.currentCourseId);
    if (!course) return;
    openManageMembers(course.id, course.name);
}

// --- AI LESSON PLANNER ---
async function generateLessonPlan() {
    const topic = document.getElementById('lp-topic').value;
    const grade = document.getElementById('lp-grade').value;
    const subject = document.getElementById('lp-subject').value;
    const duration = document.getElementById('lp-duration').value;
    const desc = document.getElementById('lp-description').value;
    const fileInput = document.getElementById('lp-pdf');

    if (!topic || !grade) {
        alert("Please enter a topic and grade.");
        return;
    }

    const loading = document.getElementById('lp-loading');
    const result = document.getElementById('lp-result');

    loading.classList.remove('d-none');
    result.classList.add('d-none');
    result.innerHTML = '';

    try {
        const formData = new FormData();
        formData.append('topic', topic);
        formData.append('grade', grade);
        formData.append('subject', subject);
        formData.append('duration_mins', duration);
        formData.append('description', desc);

        if (fileInput && fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        const headers = {};
        if (appState.isLoggedIn && appState.role) {
            headers['X-User-Role'] = appState.role;
        }

        const response = await fetch(`${API_BASE_URL}/ai/lesson-plan`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        const data = await response.json();

        loading.classList.add('d-none');
        result.classList.remove('d-none');

        if (response.ok) {
            // Simple markdown parsing
            let html = data.content
                .replace(/### (.*)/g, '<h5 class="fw-bold mt-3 text-info">$1</h5>')
                .replace(/## (.*)/g, '<h4 class="fw-bold mt-4 text-primary-custom border-bottom pb-2">$1</h4>')
                .replace(/\*\* (.*?) \*\*/g, '<strong>$1</strong>')
                .replace(/\* (.*)/g, '<li>$1</li>');

            result.innerHTML = html;
        } else {
            result.innerHTML = `<span class="text-danger fw-bold">Error: ${data.detail || 'Failed to generate plan.'}</span>`;
        }

    } catch (error) {
        loading.classList.add('d-none');
        result.classList.remove('d-none');
        result.innerHTML = `<span class="text-danger">Network Error: ${error.message}</span>`;
    }
}

// --- ASSIGNMENTS LOGIC ---

// 1. Open Modal
function openCreateAssignmentModal() {
    document.getElementById('create-assignment-form').reset();
    new bootstrap.Modal(document.getElementById('createAssignmentModal')).show();
}

// 2. Create Assignment
async function handleCreateAssignment() {
    if (!appState.currentCourseId) return;

    const data = {
        title: document.getElementById('asg-title').value,
        description: document.getElementById('asg-desc').value,
        type: document.getElementById('asg-type').value,
        points: parseInt(document.getElementById('asg-points').value),
        due_date: document.getElementById('asg-date').value
    };

    if (!data.title || !data.due_date) {
        alert("Please fill in Title and Due Date.");
        return;
    }

    try {
        const res = await fetchAPI(`/groups/${appState.currentCourseId}/assignments`, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("Created successfully!");
            bootstrap.Modal.getInstance(document.getElementById('createAssignmentModal')).hide();
            loadCourseAssignments(appState.currentCourseId);
        } else {
            alert("Failed to create.");
        }
    } catch (e) {
        console.error(e);
        alert("Error creating assignment.");
    }
}

// 3. Load Assignments (Called when switching to Tab)
async function loadCourseAssignments(groupId) {
    const list = document.getElementById('assignments-list');
    list.innerHTML = '<div class="spinner-border text-primary m-3"></div>';

    // Show/Hide "Create" button based on role
    const createBtn = document.getElementById('create-assignment-btn');
    if (appState.role === 'Teacher' || appState.role === 'Admin') {
        createBtn.classList.remove('d-none');
    } else {
        createBtn.classList.add('d-none');
    }

    try {
        const res = await fetchAPI(`/groups/${groupId}/assignments`);
        if (res.ok) {
            const assignments = await res.json();
            if (assignments.length === 0) {
                list.innerHTML = '<p class="text-muted text-center py-4">No assignments yet.</p>';
                return;
            }

            list.innerHTML = assignments.map(a => {
                let actionBtn = '';
                if (appState.role === 'Student') {
                    actionBtn = `<button class="btn btn-sm btn-outline-success" onclick="openSubmitModal(${a.id}, '${a.title}')">Submit</button>`;
                } else if (appState.role === 'Teacher' || appState.role === 'Admin') {
                    actionBtn = `<button class="btn btn-sm btn-outline-dark" onclick="viewSubmissions(${a.id})">View Submissions</button>`;
                }

                const icon = a.type === 'Project' ? 'engineering' : 'assignment';
                const badge = a.type === 'Project' ? 'bg-warning text-dark' : 'bg-primary-custom';

                return `
                    <div class="list-group-item p-3 d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-light p-2 rounded-circle">
                                <span class="material-icons text-muted">${icon}</span>
                            </div>
                            <div>
                                <h6 class="mb-1 fw-bold">${a.title} <span class="badge ${badge} small ms-2">${a.type}</span></h6>
                                <p class="mb-1 text-muted small">${a.description || 'No description'}</p>
                                <small class="text-secondary">Due: ${new Date(a.due_date).toLocaleDateString()} | Max Points: ${a.points}</small>
                            </div>
                        </div>
                        <div>
                            ${actionBtn}
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="text-danger">Failed to load assignments.</p>';
    }
}

// 4. Student: Open Submit Modal
function openSubmitModal(id, title) {
    document.getElementById('submit-asg-id').value = id;
    document.getElementById('submit-asg-title').textContent = title;
    document.getElementById('submit-content').value = '';
    new bootstrap.Modal(document.getElementById('submitAssignmentModal')).show();
}

// 5. Student: Submit
async function handleSubmitAssignment() {
    const id = document.getElementById('submit-asg-id').value;
    const content = document.getElementById('submit-content').value;

    if (!content) {
        alert("Please write something or provide a link.");
        return;
    }

    try {
        const res = await fetchAPI(`/assignments/${id}/submit`, {
            method: 'POST',
            body: JSON.stringify({ student_id: appState.userId, content: content })
        });

        if (res.ok) {
            alert("Submitted successfully!");
            bootstrap.Modal.getInstance(document.getElementById('submitAssignmentModal')).hide();
        } else {
            alert("Check submission failed.");
        }
    } catch (e) {
        alert("Network error.");
    }
}

// 6. Teacher: View Submissions
async function viewSubmissions(id) {
    const modal = new bootstrap.Modal(document.getElementById('viewSubmissionsModal'));
    const list = document.getElementById('submissions-list');
    list.innerHTML = '<div class="text-center p-3">Loading...</div>';
    modal.show();

    try {
        const res = await fetchAPI(`/assignments/${id}/submissions`);
        if (res.ok) {
            const subs = await res.json();
            if (subs.length === 0) {
                list.innerHTML = '<p class="text-center p-4 text-muted">No submissions yet.</p>';
                return;
            }

            list.innerHTML = subs.map(s => `
                <div class="list-group-item p-3">
                    <div class="d-flex justify-content-between mb-2">
                        <strong>${s.student_name} (${s.student_id})</strong>
                        <small class="text-muted">${new Date(s.submitted_at).toLocaleString()}</small>
                    </div>
                    <div class="bg-light p-2 rounded mb-2 font-monospace small" style="white-space: pre-wrap;">${s.content}</div>
                    
                    <div class="input-group input-group-sm">
                        <span class="input-group-text">Grade</span>
                        <input type="number" class="form-control" id="grade-${s.id}" value="${s.grade || ''}" placeholder="0-100">
                        <button class="btn btn-outline-success" onclick="saveGrade(${s.id})">Save</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        list.innerHTML = 'Error loading submissions.';
    }
}

// 7. Teacher: Save Grade
async function saveGrade(submissionId) {
    const val = document.getElementById(`grade-${submissionId}`).value;
    if (val === '') return;

    try {
        const res = await fetchAPI(`/submissions/${submissionId}/grade`, {
            method: 'POST',
            body: JSON.stringify({ grade: parseFloat(val), feedback: "Graded" })
        });
        if (res.ok) {
            alert("Grade saved.");
        }
    } catch (e) {
        alert("Error saving grade.");
    }
}

// Insert listeners into tab clicks? 
// We can use a simple global listener or onclick in HTML.
// Currently tab clicks are handled by Bootstrap logic, but we need to trigger 'loadCourseAssignments' when that tab is shown.
// Let's add an observer or simple valid binder.

document.addEventListener('shown.bs.tab', function (event) {
    if (event.target.getAttribute('data-bs-target') === '#course-assignments-tab') {
        if (appState.currentCourseId) loadCourseAssignments(appState.currentCourseId);
    }
});


// --- SCHOOL MANAGEMENT (SUPER ADMIN) ---
async function handleCreateSchool(e) {
    e.preventDefault();
    console.log("Create School Submit Triggered");
    const msgEl = document.getElementById('create-school-msg');

    if (msgEl) {
        msgEl.classList.remove('d-none');
        msgEl.className = 'mt-2 small fw-bold text-primary';
        msgEl.textContent = 'Creating school...';
    }

    const data = {
        name: document.getElementById('new-school-name').value,
        address: document.getElementById('new-school-address').value,
        contact_email: document.getElementById('new-school-email').value
    };

    try {
        const response = await fetchAPI('/admin/schools', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            if (msgEl) {
                msgEl.className = 'mt-2 small fw-bold text-success';
                msgEl.textContent = 'School created successfully!';
            }
            alert("Success: School Created!");
            document.getElementById('create-school-form').reset();

            // Close Modal
            const modalEl = document.getElementById('createSchoolModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            // Refresh
            setTimeout(() => window.location.reload(), 1000);

        } else {
            const result = await response.json();
            if (msgEl) {
                msgEl.className = 'mt-2 small fw-bold text-danger';
                msgEl.textContent = result.detail || 'Failed to create school.';
            }
            alert("Error: " + (result.detail || 'Failed to create school.'));
        }
    } catch (error) {
        console.error(error);
        if (msgEl) {
            msgEl.className = 'mt-2 small fw-bold text-danger';
            msgEl.textContent = 'Network error.';
        }
        alert("Network Error: " + error.message);
    }
}

async function handleCreateSchoolModal(e) {
    e.preventDefault();
    console.log("Create School Modal Submit Triggered");
    const msgEl = document.getElementById('create-school-msg');

    if (msgEl) {
        msgEl.classList.remove('d-none');
        msgEl.className = 'mt-2 small fw-bold text-primary';
        msgEl.textContent = 'Creating school...';
    }

    const data = {
        name: document.getElementById('new-school-name-modal').value,
        address: document.getElementById('new-school-address-modal').value,
        contact_email: document.getElementById('new-school-email-modal').value
    };

    try {
        const response = await fetchAPI('/admin/schools', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            if (msgEl) {
                msgEl.className = 'mt-2 small fw-bold text-success';
                msgEl.textContent = 'School created successfully!';
            }
            alert("Success: School Created!");
            document.getElementById('create-school-form-modal').reset();

            // Close Modal
            const modalEl = document.getElementById('createSchoolModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            // Refresh
            setTimeout(() => window.location.reload(), 1000);

        } else {
            const result = await response.json();
            if (msgEl) {
                msgEl.className = 'mt-2 small fw-bold text-danger';
                msgEl.textContent = result.detail || 'Failed to create school.';
            }
            alert("Error: " + (result.detail || 'Failed to create school.'));
        }
    } catch (error) {
        console.error(error);
        if (msgEl) {
            msgEl.className = 'mt-2 small fw-bold text-danger';
            msgEl.textContent = 'Network error.';
        }
        alert("Network Error: " + error.message);
    }
}

function openEditSchoolModal(id, name, address, email) {
    document.getElementById('edit-school-id').value = id;
    document.getElementById('edit-school-name').value = name;
    document.getElementById('edit-school-address').value = address || '';
    document.getElementById('edit-school-email').value = email || '';

    // Clear message
    const msgEl = document.getElementById('edit-school-msg');
    msgEl.classList.add('d-none');
    msgEl.textContent = '';

    // Show Modal
    const modal = new bootstrap.Modal(document.getElementById('editSchoolModal'));
    modal.show();
}

async function handleUpdateSchool(e) {
    e.preventDefault();
    const id = document.getElementById('edit-school-id').value;
    const msgEl = document.getElementById('edit-school-msg');

    msgEl.classList.remove('d-none');
    msgEl.className = 'mt-2 small fw-bold text-primary';
    msgEl.textContent = 'Updating...';

    const data = {
        name: document.getElementById('edit-school-name').value,
        address: document.getElementById('edit-school-address').value,
        contact_email: document.getElementById('edit-school-email').value
    };

    try {
        const response = await fetchAPI(`/admin/schools/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            msgEl.className = 'mt-2 small fw-bold text-success';
            msgEl.textContent = 'Updated successfully!';

            setTimeout(() => {
                window.location.reload();
            }, 800);
        } else {
            const res = await response.json();
            msgEl.className = 'mt-2 small fw-bold text-danger';
            msgEl.textContent = res.detail || 'Update failed.';
        }
    } catch (err) {
        msgEl.className = 'mt-2 small fw-bold text-danger';
        msgEl.textContent = 'Network error: ' + err.message;
    }
}

async function handleDeleteSchool(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;

    try {
        const response = await fetchAPI(`/admin/schools/${id}`, { method: 'DELETE' });
        if (response.ok) {
            alert("School deleted successfully.");
            window.location.reload();
        } else {
            const res = await response.json();
            alert("Error: " + (res.detail || "Failed to delete school."));
        }
    } catch (err) {
        alert("Network Error: " + err.message);
    }
}


// --- USER MANAGEMENT FUNCTIONS ---

function openUserManagement() {
    switchView('user-management-view');
    // Default to Users tab
    const usersTabBtn = document.getElementById('pills-users-tab');
    if (usersTabBtn) {
        const tab = new bootstrap.Tab(usersTabBtn);
        tab.show();
    }
    loadUserList();
}

async function loadUserList() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    try {
        const response = await fetchAPI('/admin/users');
        if (response.ok) {
            const users = await response.json();
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No users found.</td></tr>';
                return;
            }

            tbody.innerHTML = users.map(u => `
                <tr>
                    <td class="ps-4 fw-bold">${u.name}</td>
                    <td><span class="badge rounded-pill bg-light text-dark border">${u.role}</span></td>
                    <td>${u.id}</td>
                    <td>${u.role === 'Student' ? 'Grade ' + u.grade : (u.preferred_subject || '-')}</td>
                    <!-- <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="alert('Edit feature coming soon')"><span class="material-icons" style="font-size:16px">edit</span></button>
                    </td> -->
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load users.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Network error.</td></tr>';
    }
}

// --- USER MANAGEMENT (VIEW BASED) ---

function openAddUserModal() {
    switchView('add-user-view');
    document.getElementById('add-user-form').reset();
    document.getElementById('new-user-role').value = "Student";
    toggleUserFields();
}

function toggleUserFields() {
    const role = document.getElementById('new-user-role').value;
    const studentFields = document.getElementById('student-fields');
    const teacherFields = document.getElementById('teacher-fields');

    if (role === 'Student') {
        studentFields.style.display = 'block';
        teacherFields.style.display = 'none';
    } else if (role === 'Teacher') {
        studentFields.style.display = 'none';
        teacherFields.style.display = 'block';
    } else {
        studentFields.style.display = 'none';
        teacherFields.style.display = 'none';
    }
}

async function handleCreateUser(e) {
    e.preventDefault();
    const role = document.getElementById('new-user-role').value;

    // Validate Password
    const password = document.getElementById('new-user-password').value;
    if (password.length < 8) {
        alert("Password must be at least 8 characters long.");
        return;
    }

    const data = {
        name: document.getElementById('new-user-name').value,
        id: document.getElementById('new-user-id').value,
        role: role,
        password: password,
        grade: role === 'Student' ? parseInt(document.getElementById('new-user-grade').value) : 0,
        preferred_subject: role === 'Teacher' ? document.getElementById('new-user-subject').value : "All"
    };

    try {
        const btn = e.submitter;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';

        const response = await fetchAPI('/admin/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            if (typeof showToast === 'function') showToast("User created successfully!", "success");
            else alert("User created successfully!");

            switchView('user-management-view');
            loadUserList();

        } else {
            const err = await response.json();
            alert("Error: " + (err.detail || "Failed to create user"));
        }
    } catch (e) {
        alert("Network Error: " + e.message);
    } finally {
        const btn = e.submitter;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

async function showAuditLogs() {
    // switchView('admin-view'); // REMOVED: We use tabs now

    const container = document.getElementById('audit-logs-container');

    // Loading State
    container.innerHTML = `
        <div class="p-5 text-center">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <h5 class="text-muted">Fetching security logs...</h5>
        </div>`;

    try {
        const response = await fetchAPI('/admin/audit-logs');
        if (!response.ok) throw new Error("Failed to fetch logs");

        const logs = await response.json();

        if (logs.length === 0) {
            container.innerHTML = `<div class="p-5 text-center text-muted">No logs found.</div>`;
            return;
        }

        // Render Table with Exit Time and Duration added
        container.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead class="table-dark"> <tr>
                                <th class="py-3 ps-4">Login Time</th>
                                <th class="py-3">User ID</th>
                                <th class="py-3">Event</th>
                                <th class="py-3">Details</th>
                                <th class="py-3">Exit Time</th>
                                <th class="py-3">Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr style="background-color: #f9f9f9;">
                                    <td class="ps-4 py-3 align-middle font-monospace small">
                                        ${new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td class="fw-bold align-middle">
                                        ${log.user_id}
                                    </td>
                                    <td class="align-middle">
                                        <span class="badge rounded-pill ${getEventBadgeClass(log.event_type)} px-3">
                                            ${log.event_type}
                                        </span>
                                    </td>
                                    <td class="align-middle text-muted small">
                                        ${log.details}
                                    </td>
                                    <td class="align-middle font-monospace small text-muted">
                                        ${log.logout_time ? new Date(log.logout_time).toLocaleString() : '-'}
                                    </td>
                                    <td class="align-middle fw-bold text-dark">
                                        ${log.duration_minutes ? log.duration_minutes + ' min' : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    } catch (e) {
        console.error(e);
        container.innerHTML = `
            <div class="alert alert-danger m-4" role="alert">
                <h4 class="alert-heading">Error Loading Logs</h4>
                <p>${e.message}</p>
            </div>
        `;
    }
}

// --- BACKGROUND PATHS ANIMATION (Ported from React to Vanilla JS/GSAP) ---
// This function replicates the "BackgroundPaths" React component using strict SVG matching.
function initBackgroundPaths() {
    const heroSection = document.getElementById('teachers-hero');
    if (!heroSection) return;

    // Create container for the animation
    const animationContainer = document.createElement('div');
    animationContainer.style.position = 'absolute';
    animationContainer.style.top = '0';
    animationContainer.style.left = '0';
    animationContainer.style.width = '100%';
    animationContainer.style.height = '100%';
    animationContainer.style.pointerEvents = 'none'; // Ensure clicks pass through to content
    animationContainer.style.zIndex = '0'; // Behind content
    animationContainer.style.overflow = 'hidden';

    // We want the existing content to be ON TOP.
    // Ensure all Children of hero section have z-index > 0 or are correctly stacked.
    // The hero section in HTML has children with 'z-2', so z-0 here is perfect.

    const createFloatingPaths = (position) => {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "w-full h-full text-slate-950 dark:text-white");
        svg.setAttribute("viewBox", "0 0 696 316");
        svg.setAttribute("fill", "none");
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        // Slightly different opacity logic to match "text-slate-950" on dark bg (which is effectively white/light lines)
        // actually the code says `dark:text-white`. Our hero is dark, so we want white lines.
        svg.style.color = "white";

        // Loop 36 times
        for (let i = 0; i < 36; i++) {
            const pathId = i;
            const width = 0.5 + i * 0.03;
            // Math strictly from provided Typescript code:
            // d={`M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`}
            const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position
                } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position
                } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position
                } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`;

            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", d);
            path.setAttribute("stroke", "currentColor"); // uses the svg.style.color
            path.setAttribute("stroke-width", width);
            path.style.opacity = 0.1 + pathId * 0.03; // strokeOpacity

            // Animation Setup
            // Framer Motion: initial={{ pathLength: 0.3, opacity: 0.6 }} 
            // animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
            // duration: 20 + Math.random() * 10

            // We use CSS keyframes or GSAP. GSAP is available.
            // However, straightforward CSS animation is often more performant for 72 elements (36*2).
            // Let's use GSAP since it's loaded and easier to handle the random duration.

            // Set initial state
            // To animate pathLength in vanilla, we use stroke-dasharray and dashoffset.
            // But we don't know the total length of the path easily without `getTotalLength()`.
            // SVG 2 allows `pathLength="1"` attribute to normalize it!
            path.setAttribute("pathLength", "1");
            path.style.strokeDasharray = "0.3 1"; // pathLength 0.3, gap 0.7 (effectively 1 total)
            path.style.strokeDashoffset = "0";

            svg.appendChild(path);

            // Animate with GSAP
            // pathLength animation involves changing dasharray usually, but with pathLength=1 we can just animate dashoffset?
            // Actually framer's pathOffset shifts the dash pattern along the path.
            // pathLength grows the dash.

            const duration = 20 + Math.random() * 10;

            // We need a timeline to simulate the framer motion arrays
            const tl = gsap.timeline({ repeat: -1, ease: "linear" });

            // Animate Path Length (Grow to 1 then shrink or just loop?)
            // Framer code: animate={{ pathLength: 1, ... }} means it grows to full?
            // But repeat: infinity?
            // "pathOffset: [0, 1, 0]" -> Signs of moving flow.

            // Let's approximate the "Floating" look:
            // Just rotatting the offset is usually enough for "Flow"

            // Correction: specific values from code
            // animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
            // It suggests it pulses in length and moves.

            // Since we set pathLength="1" on the element, strokeDasharray="1 1" is full.
            // strokeDasharray="0.3 1" is 30% visible.

            // We'll animate strokeDasharray to simulate pathLength changes
            // and strokeDashoffset for pathOffset.

            // Simpler Flow: Just move the line continuously.
            gsap.to(path, {
                strokeDashoffset: -1, // Move full length
                duration: duration,
                repeat: -1,
                ease: "linear"
            });

            // Pulse Opacity
            gsap.to(path, {
                opacity: 0.6,
                duration: duration * 0.5,
                yoyo: true, // go back to initial
                repeat: -1,
                ease: "sine.inOut"
            });

            // Pulse Length (optional, mimics pathLength=1)
            // gsap.to(path, {
            //     strokeDasharray: "1 1",
            //     duration: duration * 0.8,
            //     yoyo: true,
            //     repeat: -1
            // });
        }
        return svg;
    };

    const containerDiv = document.createElement('div');
    containerDiv.className = "absolute inset-0";
    containerDiv.style.position = 'absolute';
    containerDiv.style.inset = '0';

    // Position 1
    const svg1 = createFloatingPaths(1);
    containerDiv.appendChild(svg1);

    // Position -1
    const svg2 = createFloatingPaths(-1);
    containerDiv.appendChild(svg2);

    animationContainer.appendChild(containerDiv);
    heroSection.prepend(animationContainer); // Prepend to put it behind content (z-index 0 vs content z-2)
}

// Initialize when view switches to teachers (or on load if you want)
// For now, let's call it once globally, or lazily.
// Since it's light SVG, calling on load is fine.
document.addEventListener('DOMContentLoaded', () => {
    // Wait a tiny bit for DOM
    setTimeout(initAllAnimations, 500);
    setTimeout(initGlowingEffect, 500);
    setTimeout(initScrollAnimations, 500);
});

// Also trigger if we navigate there dynamically and it wasn't present (idempotent check is good)

function initAllAnimations() {
    ['teachers-hero', 'students-hero', 'schools-hero', 'resources-hero'].forEach(targetId => {
        const heroSection = document.getElementById(targetId);
        if (!heroSection) return;
        // Avoid double init
        if (heroSection.querySelector('.bg-paths-anim-container')) return;

        // Create container for the animation
        const animationContainer = document.createElement('div');
        animationContainer.className = 'bg-paths-anim-container'; // Marker class
        animationContainer.style.position = 'absolute';
        animationContainer.style.top = '0';
        animationContainer.style.left = '0';
        animationContainer.style.width = '100%';
        animationContainer.style.height = '100%';
        animationContainer.style.pointerEvents = 'none'; // Ensure clicks pass through to content
        animationContainer.style.zIndex = '0'; // Behind content
        animationContainer.style.overflow = 'hidden';

        const createFloatingPaths = (position) => {
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("class", "w-full h-full text-slate-950 dark:text-white");
            svg.setAttribute("viewBox", "0 0 696 316");
            svg.setAttribute("fill", "none");
            svg.style.width = "100%";
            svg.style.height = "100%";
            svg.style.position = "absolute";
            svg.style.top = "0";
            svg.style.left = "0";
            svg.style.color = "white";

            for (let i = 0; i < 36; i++) {
                const pathId = i;
                const width = 0.5 + i * 0.03;
                const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position
                    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position
                    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position
                    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`;

                const path = document.createElementNS(svgNS, "path");
                path.setAttribute("d", d);
                path.setAttribute("stroke", "currentColor");
                path.setAttribute("stroke-width", width);
                path.style.opacity = 0.1 + pathId * 0.03;
                path.setAttribute("pathLength", "1");
                path.style.strokeDasharray = "0.3 1";
                path.style.strokeDashoffset = "0";

                svg.appendChild(path);

                const duration = 20 + Math.random() * 10;
                gsap.to(path, {
                    strokeDashoffset: -1,
                    duration: duration,
                    repeat: -1,
                    ease: "linear"
                });
                gsap.to(path, {
                    opacity: 0.6,
                    duration: duration * 0.5,
                    yoyo: true,
                    repeat: -1,
                    ease: "sine.inOut"
                });
            }
            return svg;
        };

        const containerDiv = document.createElement('div');
        containerDiv.className = "absolute inset-0";
        containerDiv.style.position = 'absolute';
        containerDiv.style.inset = '0';
        containerDiv.appendChild(createFloatingPaths(1));
        containerDiv.appendChild(createFloatingPaths(-1));

        animationContainer.appendChild(containerDiv);
        heroSection.prepend(animationContainer);
    });
}

// --- GLOWING EFFECT (Ported logic from Aceternity/React) ---
function initGlowingEffect() {
    const cards = document.querySelectorAll('.glowing-card');
    if (cards.length === 0) return;

    // Movement duration from component default
    const movementDuration = 2; // seconds (not used in GSAP, we use logic)

    // We need to store state for each card to handle the smooth angle transition
    const cardStates = new Map();

    const handleMove = (e) => {
        cards.forEach(card => {
            const borderEl = card.querySelector('.glowing-card-border');
            if (!borderEl) return;

            const rect = card.getBoundingClientRect();
            // Check proximity (from component default: 0? No, demo used 64. Let's use 50)
            const proximity = 50;
            const inactiveZone = 0.01; // usually relative to size

            // Mouse coordinates relative to viewport
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            // Calculate center
            const centerX = rect.left + rect.width * 0.5;
            const centerY = rect.top + rect.height * 0.5;

            // Check if mouse is near enough to activate
            // Note: The React component logic is a bit specific about "active" state.
            // If it's inside the proximity box:
            const isActive =
                mouseX > rect.left - proximity &&
                mouseX < rect.left + rect.width + proximity &&
                mouseY > rect.top - proximity &&
                mouseY < rect.top + rect.height + proximity;

            // Check inactive zone (center dead zone)
            const distanceFromCenter = Math.hypot(mouseX - centerX, mouseY - centerY);
            const minDim = Math.min(rect.width, rect.height);
            const inactiveRadius = 0.5 * minDim * inactiveZone;

            // Update Active State
            let activeVal = (isActive && distanceFromCenter > inactiveRadius) ? 1 : 0;

            // Optimization: If completely far away, maybe just 0 and skip math?
            // But we want the angle to update if we are approaching?
            // The react code updates angle only if active.

            borderEl.style.setProperty('--active', activeVal);

            if (isActive) {
                // Calculate Angle
                // (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) / Math.PI + 90;
                let targetAngle = (180 * Math.atan2(mouseY - centerY, mouseX - centerX)) / Math.PI + 90;

                // Smooth rotation logic
                // React uses `animate` from motion/react to tween `currentAngle`.
                // We'll use a simple lerp or GSAP helper if available, or just store it.
                // Since this is `mousemove`, simply setting it might be jagged if we wrap around 360/0.

                // Get previous angle state
                let state = cardStates.get(card) || { currentAngle: targetAngle };

                // Angle Diff for shortest path
                const angleDiff = ((targetAngle - state.currentAngle + 180) % 360) - 180;
                const newAngle = state.currentAngle + angleDiff;

                // We want to animate to `newAngle` smoothly.
                // Let's use GSAP quickTo for performance or simple tween
                // But since this runs on mousemove, we might fire too many tweens.
                // Better: Update state, and use requestAnimationFrame loop? 

                // Actually GSAP handles overwrite: 'auto' well.
                gsap.to(state, {
                    currentAngle: newAngle,
                    duration: movementDuration,
                    ease: "power2.out",
                    overwrite: 'auto',
                    onUpdate: () => {
                        borderEl.style.setProperty('--start', state.currentAngle);
                    }
                });

                cardStates.set(card, state);
            }
        });
    };

    // Global listener for performance rather than per-card
    document.body.addEventListener('pointermove', handleMove);
    window.addEventListener('scroll', handleMove); // Update on scroll too
}

// --- SCROLL ENTRANCE ANIMATIONS ---
function initScrollAnimations() {
    // Progressive Enhancement: Find elements, hide them, then observe
    const elements = document.querySelectorAll('.fade-in-up');

    // Safety check: Don't hide if there are no elements or IntersectionObserver is missing
    if (!('IntersectionObserver' in window)) return;

    elements.forEach(el => {
        el.classList.add('js-scroll-hidden');
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove the hidden class to trigger transition to default
                entry.target.classList.remove('js-scroll-hidden');
                entry.target.classList.add('visible'); // Keep for legacy CSS consistency if needed
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    elements.forEach(el => observer.observe(el));
}

// --- GRADE HELPER AI CHAT LOGIC ---
async function handleGradeChat(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('grade-helper-input');
    const container = document.getElementById('grade-helper-chat-messages');
    const prompt = input.value.trim();
    if (!prompt) return;

    // Add User Message
    const userDiv = document.createElement('div');
    userDiv.className = 'd-flex align-items-start gap-3 mb-3 flex-row-reverse';
    userDiv.innerHTML = `
        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0" style="width: 36px; height: 36px;">Me</div>
        <div class="bg-primary text-white p-3 rounded shadow-sm" style="max-width: 80%;">
            <p class="mb-0">${prompt}</p>
        </div>
    `;
    container.appendChild(userDiv);
    input.value = '';
    container.scrollTop = container.scrollHeight;

    // Add Loading Message
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'gh-loading';
    loadingDiv.className = 'd-flex align-items-start gap-3 mb-3';
    loadingDiv.innerHTML = `
        <div class="rounded-circle bg-info text-white d-flex align-items-center justify-content-center flex-shrink-0" style="width: 36px; height: 36px;">AI</div>
        <div class="bg-white p-3 rounded shadow-sm" style="max-width: 80%;">
            <p class="mb-0 text-muted">Thinking...</p>
        </div>
    `;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;

    try {
        const studentId = appState.userId;
        const response = await fetchAPI(`/ai/grade-helper/${studentId}`, {
            method: 'POST',
            body: JSON.stringify({ prompt: prompt })
        });

        loadingDiv.remove();

        if (response.ok) {
            const data = await response.json();
            const reply = data.reply || "No response received.";

            const aiDiv = document.createElement('div');
            aiDiv.className = 'd-flex align-items-start gap-3 mb-3';
            aiDiv.innerHTML = `
                <div class="rounded-circle bg-info text-white d-flex align-items-center justify-content-center flex-shrink-0" style="width: 36px; height: 36px;">AI</div>
                <div class="bg-white p-3 rounded shadow-sm" style="max-width: 80%;">
                    <p class="mb-0 text-dark" style="white-space: pre-wrap;">${reply}</p>
                </div>
            `;
            container.appendChild(aiDiv);
        } else {
            throw new Error("API Error");
        }

    } catch (err) {
        if (loadingDiv) loadingDiv.remove();
        console.error(err);
        const errDiv = document.createElement('div');
        errDiv.className = 'd-flex align-items-start gap-3 mb-3';
        errDiv.innerHTML = `
            <div class="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center flex-shrink-0" style="width: 36px; height: 36px;">!</div>
            <div class="bg-white p-3 rounded shadow-sm border border-danger" style="max-width: 80%;">
                <p class="mb-0 text-danger">Error: ${err.message}</p>
            </div>
        `;
        container.appendChild(errDiv);
    }
    container.scrollTop = container.scrollHeight;
}

// --- AUTH RESTORATION & NAVIGATION ---
document.addEventListener('DOMContentLoaded', async () => {
    updateTranslations();

    // Restore Session
    if (restoreAuthState() && appState.isLoggedIn) {
        // User is logged in, reload dashboard
        await initializeDashboard();

        // Restore specific view from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const targetView = urlParams.get('view');

        if (targetView && document.getElementById(targetView)) {
            // Fix Navigation: Ensure current history entry has state
            window.history.replaceState({ view: targetView }, '', window.location.href);
            // Slight delay to ensure dashboard render doesn't override
            setTimeout(() => switchView(targetView, false), 100);
        } else {
            // Default logged in view
            window.history.replaceState({ view: 'dashboard-view' }, '', window.location.href);
        }
    }
});

// --- REPORT EXPORT ---
async function exportReportCSV() {
    let data = appState.reportData;
    if (!data) {
        // Try to fetch if not in state
        try {
            const res = await fetchAPI('/reports/summary');
            if (res.ok) data = await res.json();
        } catch (e) {
            alert("Could not load data for export.");
            return;
        }
    }

    if (!data) {
        alert("No data available to export.");
        return;
    }

    // Flatten data for CSV
    // We will create a simple CSV with sections
    let csvContent = "data:text/csv;charset=utf-8,";

    // Header
    csvContent += "Metric,Value\n";

    // Financials
    csvContent += `Revenue,${data.financial_summary.revenue}\n`;
    csvContent += `Expenses,${data.financial_summary.expenses}\n`;
    csvContent += `Net Income,${data.financial_summary.net_income}\n`;
    csvContent += `Outstanding Fees,${data.financial_summary.outstanding_fees}\n`;

    // Staff
    csvContent += `Total Staff,${data.staff_utilization.total_staff}\n`;
    csvContent += `Active Classes,${data.staff_utilization.active_classes}\n`;
    csvContent += `Staff Utilization,${data.staff_utilization.utilization_rate}%\n`;

    // Academics
    csvContent += `Math Avg,${data.academic_performance.math_avg}\n`;
    csvContent += `Science Avg,${data.academic_performance.science_avg}\n`;
    csvContent += `English Avg,${data.academic_performance.english_avg}\n`;
    csvContent += `Overall Avg,${data.academic_performance.overall_avg}\n`;

    // Trends (Table format inside CSV)
    csvContent += "\nAttendance Trends (Monthly)\n";
    csvContent += "Month,Attendance Rate\n";
    data.attendance_trends.forEach(row => {
        csvContent += `${row.month},${row.rate}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "classbridge_report_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- COMMUNICATION & ENGAGEMENT LOGIC ---

// Elements (Lazy load or global)
const elements_comm = {
    announcementsList: () => document.getElementById('announcements-list'),
    messagesList: () => document.getElementById('messages-list'),
    calendarTableBody: () => document.getElementById('calendar-table-body'),
    createAnnouncementModal: () => new bootstrap.Modal(document.getElementById('createAnnouncementModal')),
    composeMessageModal: () => new bootstrap.Modal(document.getElementById('composeMessageModal')),
    addEventModal: () => new bootstrap.Modal(document.getElementById('addEventModal'))
};

function renderCommunicationDashboard() {
    // Default to Announcements tabs
    const firstTab = document.querySelector('#communication-view .list-group-item');
    if (firstTab) {
        switchCommTab('announcements', firstTab);
    }
}

function switchCommTab(tabName, btnElement) {
    // Update Sidebar Active State
    const sidebar = document.querySelector('#communication-view .list-group');
    if (sidebar) {
        sidebar.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
    }
    if (btnElement) btnElement.classList.add('active');

    const contentArea = document.getElementById('comm-content-area');
    contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';

    // Route to specific loader
    if (tabName === 'announcements') loadCommAnnouncements();
    else if (tabName === 'messaging') loadCommMessaging();
    else if (tabName === 'notifications') loadCommNotifications();
    else if (tabName === 'push') loadCommPush();
    else if (tabName === 'calendar') loadCommCalendar();
    else if (tabName === 'emergency') loadCommEmergency();
}

async function loadCommAnnouncements() {
    const container = document.getElementById('comm-content-area');

    let html = `
        <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
            <h4 class="fw-bold m-0 text-primary">Announcements</h4>
            <button class="btn btn-primary-custom" onclick="showCreateAnnouncementModal()">
                <span class="material-icons align-middle fs-5 me-1">add_circle</span> Post New
            </button>
        </div>
    `;

    try {
        const response = await fetchAPI('/communication/announcements');
        let announcements = [];
        if (response.ok) {
            announcements = await response.json();
        }

        if (announcements.length === 0) {
            html += `<div class="text-center text-muted py-5">
                <span class="material-icons fs-1 text-secondary mb-3">campaign</span>
                <p>No announcements posts yet.</p>
            </div>`;
        } else {
            html += `<div class="list-group list-group-flush">`;
            announcements.forEach(a => {
                html += `
                    <div class="list-group-item px-0 py-3">
                        <div class="d-flex justify-content-between">
                            <h5 class="fw-bold text-dark mb-1">${a.title}</h5>
                            <small class="text-muted">${new Date(a.created_at).toLocaleDateString()}</small>
                        </div>
                        <p class="mb-2 text-secondary">${a.content}</p>
                        <span class="badge bg-light text-dark border">Target: ${a.target_role}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
    } catch (e) {
        html += `<p class="text-danger">Failed to load announcements.</p>`;
    }

    container.innerHTML = `<div class="p-4 h-100 overflow-auto">${html}</div>`;
}

// Modal handling for Announcements
function showCreateAnnouncementModal() {
    const modalHtml = `
      <div class="modal fade" id="createAnnouncementModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content border-0 shadow">
            <div class="modal-header bg-primary-custom text-white">
              <h5 class="modal-title fw-bold">Post Announcement</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <form id="announcement-form">
                <div class="mb-3">
                    <label class="form-label fw-bold">Title</label>
                    <input type="text" id="ann-title" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Content</label>
                    <textarea id="ann-content" class="form-control" rows="4" required></textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Target Audience</label>
                    <select id="ann-target" class="form-select">
                        <option value="All">All Users</option>
                        <option value="Student">Students Only</option>
                        <option value="Parent">Parents Only</option>
                        <option value="Teacher">Teachers Only</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary-custom w-100 fw-bold">Post Now</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('createAnnouncementModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('announcement-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('ann-title').value;
        const content = document.getElementById('ann-content').value;
        const target = document.getElementById('ann-target').value;

        try {
            const res = await fetchAPI('/communication/announcements', {
                method: 'POST',
                body: JSON.stringify({ title, content, target_role: target })
            });
            if (res.ok) {
                const modalEl = document.getElementById('createAnnouncementModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                alert("Announcement Posted!");
                loadCommAnnouncements();
            } else {
                alert("Failed to post.");
            }
        } catch (e) { console.error(e); alert("Error posting announcement."); }
    });

    new bootstrap.Modal(document.getElementById('createAnnouncementModal')).show();
}

async function loadCommMessaging() {
    const container = document.getElementById('comm-content-area');
    container.innerHTML = `
        <div class="p-4 h-100 d-flex flex-column">
            <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Teacher-Parent Messaging</h4>
            
            <div class="alert alert-info d-flex align-items-center">
                <span class="material-icons me-2">info</span>
                Direct messaging allows private communication between staff and parents.
            </div>

            <!-- Inbox Simulation -->
            <ul class="nav nav-tabs mb-3">
                <li class="nav-item"><a class="nav-link active" href="#">Inbox</a></li>
                <li class="nav-item"><a class="nav-link" href="#">Sent</a></li>
            </ul>

            <div class="list-group list-group-flush">
                <div class="list-group-item py-3">
                    <div class="d-flex justify-content-between mb-1">
                        <strong class="text-dark">Mrs. Johnson (Parent)</strong>
                        <small class="text-muted">10:30 AM</small>
                    </div>
                    <div class="fw-bold small text-dark mb-1">Re: Sarah's Attendance</div>
                    <p class="text-muted small m-0 text-truncate">Thank you for letting me know about the absence...</p>
                </div>
                <!-- More mock messages -->
            </div>

             <div class="mt-auto pt-3">
                <button class="btn btn-primary-custom rounded-pill fw-bold px-4" onclick="alert('Compose feature coming soon!')">
                    <span class="material-icons align-middle me-1">edit</span> Compose Message
                </button>
            </div>
        </div>
    `;
}

function loadCommNotifications() {
    const container = document.getElementById('comm-content-area');
    container.innerHTML = `
        <div class="p-4 h-100">
             <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Email & SMS Notifications</h4>
             
             <div class="card border-0 bg-light p-4 mb-4 rounded-3">
                <h5 class="fw-bold mb-3">Send Bulk Notification</h5>
                <form onsubmit="event.preventDefault(); alert('Notification Sent (Simulated)');">
                    <div class="mb-3">
                        <label class="form-label fw-bold">Type</label>
                        <div class="d-flex gap-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" checked id="type-email">
                                <label class="form-check-label" for="type-email">Email</label>
                            </div>
                             <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="type-sms">
                                <label class="form-check-label" for="type-sms">SMS</label>
                            </div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold">Recipients</label>
                         <select class="form-select">
                            <option>All Parents - Grade 9</option>
                            <option>All Parents - Grade 10</option>
                            <option>All Staff</option>
                        </select>
                    </div>
                     <div class="mb-3">
                        <label class="form-label fw-bold">Message</label>
                        <textarea class="form-control" rows="3" placeholder="Enter notification text..."></textarea>
                    </div>
                    <button class="btn btn-dark fw-bold w-100">Send Notification</button>
                </form>
             </div>
        </div>
    `;
}

function loadCommPush() {
    const container = document.getElementById('comm-content-area');
    container.innerHTML = `
        <div class="p-4 h-100 text-center d-flex flex-column justify-content-center align-items-center">
             <div class="mb-3">
                <span class="material-icons text-warning" style="font-size: 64px;">notifications_active</span>
             </div>
             <h4 class="fw-bold text-dark">Mobile Push Notifications</h4>
             <p class="text-muted w-75">Send instant alerts to user's mobile devices who have the ClassBridge app installed.</p>
             
             <button class="btn btn-warning text-white fw-bold px-5 py-3 rounded-pill mt-3 shadow-sm" onclick="alert('Push Notification broadcasted to 142 devices!')">
                Broadcase General Alert
             </button>
        </div>
    `;
}

async function loadCommCalendar() {
    const container = document.getElementById('comm-content-area');

    // Fetch existing events if possible
    let eventsHtml = '';
    try {
        const res = await fetchAPI('/communication/events');
        if (res.ok) {
            const events = await res.json();
            events.forEach(e => {
                eventsHtml += `
                    <div class="list-group-item d-flex align-items-center py-3">
                         <div class="bg-light border rounded text-center p-2 me-3" style="min-width: 60px;">
                            <small class="d-block text-uppercase fw-bold text-muted">${new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>
                            <span class="h5 fw-bold text-dark m-0">${new Date(e.date).getDate()}</span>
                         </div>
                         <div>
                            <h6 class="fw-bold mb-1">${e.title}</h6>
                            <span class="badge bg-secondary-subtle text-secondary border">${e.type}</span>
                         </div>
                    </div>
                 `;
            });
        }
    } catch (e) { }

    if (!eventsHtml) {
        eventsHtml = '<div class="text-center text-muted py-4">No events scheduled.</div>';
    }

    container.innerHTML = `
        <div class="p-4 h-100">
             <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                <h4 class="fw-bold m-0 text-primary">School Event Calendar</h4>
                 <button class="btn btn-sm btn-outline-primary" onclick="showAddEventModal()">
                    <span class="material-icons align-middle fs-6">add</span> Add Event
                </button>
            </div>
             
             <!-- Calendar List -->
             <div class="list-group list-group-flush">
                ${eventsHtml}
             </div>
        </div>
    `;
}

function showAddEventModal() {
    const modalHtml = `
      <div class="modal fade" id="addEventModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content border-0 shadow">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title fw-bold">Add Event</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <form id="event-form">
                <div class="mb-3">
                    <label class="form-label fw-bold">Title</label>
                    <input type="text" id="evt-title" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Date</label>
                    <input type="date" id="evt-date" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Type</label>
                    <select id="evt-type" class="form-select">
                        <option>Academic</option>
                        <option>Social</option>
                        <option>Meeting</option>
                        <option>Holiday</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary w-100 fw-bold">Add Event</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('addEventModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('evt-title').value;
        const date = document.getElementById('evt-date').value;
        const type = document.getElementById('evt-type').value;

        try {
            const res = await fetchAPI('/communication/events', {
                method: 'POST',
                body: JSON.stringify({ title, date, type })
            });

            if (res.ok) {
                const modalEl = document.getElementById('addEventModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                alert("Event Added!");
                loadCommCalendar();
            } else {
                alert("Failed to add event.");
            }
        } catch (e) { console.error(e); alert("Error."); }
    });

    new bootstrap.Modal(document.getElementById('addEventModal')).show();
}

function loadCommEmergency() {
    const container = document.getElementById('comm-content-area');
    container.innerHTML = `
        <div class="p-4 h-100 d-flex flex-column justify-content-center align-items-center bg-danger-subtle rounded-3">
             <div class="bg-white p-5 rounded-circle shadow-lg mb-4 d-flex align-items-center justify-content-center" style="width: 120px; height: 120px;">
                <span class="material-icons text-danger" style="font-size: 64px;">warning</span>
             </div>
             
             <h2 class="fw-bold text-danger mb-3">EMERGENCY ALERT SYSTEM</h2>
             <p class="text-center text-dark mb-4" style="max-width: 500px;">
                Proceed with caution. This will trigger a high-priority alert to ALL students, parents, and staff via Email, SMS, and App Notifications.
                It will also display a banner on all login screens.
             </p>
             
             <button class="btn btn-danger btn-lg fw-bold px-5 py-3 rounded-pill shadow" onclick="triggerEmergencyAlert()">
                TRIGGER SCHOOL LOCKDOWN / ALERT
             </button>
             <button class="btn btn-outline-danger mt-3" onclick="alert('Weather Alert Triggered')">
                Trigger Weather Warning
             </button>
        </div>
    `;
}

function triggerEmergencyAlert() {
    if (confirm("ARE YOU SURE? This will send an SOS to the entire school database.")) {
        alert("🚨 EMERGENCY PROTOCOLS ACTIVATED. Alerts sent.");
    }
}

// --- ACADEMIC MANAGEMENT LOGIC ---

function renderAcademicsDashboard() {
    // Default to Planning tab
    const firstTab = document.querySelector('#academics-view .list-group-item');
    if (firstTab) {
        switchAcademicTab('planning', firstTab);
    }
}

function switchAcademicTab(tabName, btnElement) {
    // Update Sidebar Active State
    const sidebar = document.querySelector('#academics-view .list-group');
    if (sidebar) {
        sidebar.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
    }
    if (btnElement) btnElement.classList.add('active');

    const contentArea = document.getElementById('academic-content-area');
    contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';

    // Route to specific loader
    if (tabName === 'planning') loadSubjectPlanning();
    else if (tabName === 'classes') loadClassSchedules();
    else if (tabName === 'attendance') loadAttendanceTracking();
    else if (tabName === 'assignments') loadAssignmentsView();
    else if (tabName === 'exams') loadExamsView();
    else if (tabName === 'reports') loadReportCardsView();
}

function loadSubjectPlanning() {
    const container = document.getElementById('academic-content-area');
    container.innerHTML = `
        <div class="p-4 h-100">
            <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Subject Planning & Lesson Plans</h4>
            
            <div class="row g-4">
                 <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h5 class="fw-bold mb-3">Create Lesson Plan (AI)</h5>
                            <p class="text-muted small">Generate comprehensive lesson plans instantly using our specialized AI.</p>
                            <button class="btn btn-primary-custom w-100" onclick="showLessonPlanner()">Open AI Planner</button>
                        </div>
                    </div>
                </div>
                 <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h5 class="fw-bold mb-3">Saved Plans</h5>
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item">Algebra - Intro to Functions <small class="text-muted float-end">Oct 20</small></li>
                                <li class="list-group-item">Biology - Cell Structure <small class="text-muted float-end">Oct 15</small></li>
                                <li class="list-group-item">History - World War II <small class="text-muted float-end">Oct 10</small></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4 p-4 bg-white rounded-3 border">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="fw-bold mb-0">Curriculum & Syllabus Manager</h5>
                    <button class="btn btn-sm btn-outline-primary" onclick="alert('Syncing with District Standards...')">
                        <span class="material-icons align-middle fs-6 me-1">sync</span> Sync Standards
                    </button>
                </div>
                
                <div class="row">
                    <div class="col-md-4">
                        <div class="list-group list-group-flush border rounded-3 overflow-hidden">
                            <a href="#" class="list-group-item list-group-item-action active fw-bold" onclick="showSyllabusDetail('math')">
                                Mathematics (Grade 9)
                                <div class="progress mt-2" style="height: 4px;">
                                    <div class="progress-bar bg-warning" role="progressbar" style="width: 65%"></div>
                                </div>
                            </a>
                            <a href="#" class="list-group-item list-group-item-action fw-bold" onclick="showSyllabusDetail('science')">
                                Physics (Grade 10)
                                <div class="progress mt-2" style="height: 4px;">
                                    <div class="progress-bar bg-success" role="progressbar" style="width: 40%"></div>
                                </div>
                            </a>
                        </div>
                    </div>
                    
                    <div class="col-md-8">
                        <div id="syllabus-detail-view" class="p-3 bg-light rounded-3 h-100">
                           <!-- Default View -->
                           <h6 class="fw-bold text-primary">Mathematics - Grade 9</h6>
                           <div class="d-flex justify-content-between text-muted small mb-3">
                                <span>Progress: 65% Completed</span>
                                <span>Term: Fall 2025</span>
                           </div>

                           <div class="table-responsive">
                                <table class="table table-sm table-hover bg-white rounded shadow-sm">
                                    <thead class="table-light">
                                        <tr>
                                            <th>Unit</th>
                                            <th>Topic</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Unit 1</td>
                                            <td>Real Numbers</td>
                                            <td><span class="badge bg-success">Completed</span></td>
                                            <td><button class="btn btn-link btn-sm p-0">Review</button></td>
                                        </tr>
                                         <tr>
                                            <td>Unit 2</td>
                                            <td>Polynomials</td>
                                            <td><span class="badge bg-success">Completed</span></td>
                                            <td><button class="btn btn-link btn-sm p-0">Review</button></td>
                                        </tr>
                                         <tr>
                                            <td>Unit 3</td>
                                            <td>Linear Equations</td>
                                            <td><span class="badge bg-warning text-dark">In Progress</span></td>
                                            <td><button class="btn btn-link btn-sm p-0">Edit</button></td>
                                        </tr>
                                         <tr>
                                            <td>Unit 4</td>
                                            <td>Quadratic Eq.</td>
                                            <td><span class="badge bg-secondary">Pending</span></td>
                                            <td><button class="btn btn-link btn-sm p-0">Plan</button></td>
                                        </tr>
                                    </tbody>
                                </table>
                           </div>
                           <button class="btn btn-primary-custom btn-sm mt-2" onclick="alert('Add New Topic Modal')">+ Add Topic</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadClassSchedules() {
    const container = document.getElementById('academic-content-area');
    // Reuse existing class loading logic internally or mock for now
    container.innerHTML = `
        <div class="p-4 h-100">
             <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                <h4 class="fw-bold m-0 text-primary">Class Schedules</h4>
                 <button class="btn btn-primary-custom" onclick="document.getElementById('scheduleClassModal').classList.add('show'); document.getElementById('scheduleClassModal').style.display='block';">
                    <span class="material-icons align-middle fs-5 me-1">add_circle</span> Schedule New Class
                </button>
            </div>
            
             <!-- Embedded Live Classes View -->
             <div id="academics-live-classes-container">
                <div class="text-center p-3"><div class="spinner-border text-primary"></div></div>
             </div>
        </div>
    `;

    // Fetch real classes
    try {
        const res = await fetchAPI('/live-classes');
        if (res.ok) {
            const classes = await res.json();
            const listContainer = document.getElementById('academics-live-classes-container');
            if (classes.length === 0) {
                listContainer.innerHTML = '<p class="text-muted text-center">No active classes scheduled.</p>';
            } else {
                listContainer.innerHTML = classes.map(cls => `
                    <div class="card mb-3 border-0 shadow-sm">
                        <div class="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="fw-bold mb-1">${cls.topic}</h5>
                                <p class="text-muted mb-0 small">
                                    <span class="material-icons align-middle fs-6 me-1">event</span> ${new Date(cls.date).toLocaleString()}
                                </p>
                            </div>
                            <a href="${cls.meet_link}" target="_blank" class="btn btn-success rounded-pill px-4">Join Class</a>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (e) { console.error(e); }
}

function loadAttendanceTracking() {
    const container = document.getElementById('academic-content-area');
    container.innerHTML = `
        <div class="p-4 h-100">
            <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Attendance Tracking</h4>
            
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                    <div class="row text-center">
                        <div class="col-4 border-end">
                            <h3 class="fw-bold text-success">98%</h3>
                            <small class="text-muted">Average Attendance</small>
                        </div>
                         <div class="col-4 border-end">
                            <h3 class="fw-bold text-warning">12</h3>
                            <small class="text-muted">Absent Today</small>
                        </div>
                         <div class="col-4">
                            <h3 class="fw-bold text-danger">3</h3>
                            <small class="text-muted">Chronic Absentees</small>
                        </div>
                    </div>
                </div>
            </div>

            <h5 class="fw-bold mb-3">Mark Attendance</h5>
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="bg-light">
                        <tr>
                            <th>Student Name</th>
                            <th>Status</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="align-middle">Alex Johnson</td>
                            <td>
                                <select class="form-select form-select-sm">
                                    <option class="text-success">Present</option>
                                    <option class="text-danger">Absent</option>
                                    <option class="text-warning">Late</option>
                                </select>
                            </td>
                            <td><input type="text" class="form-control form-control-sm" placeholder="Optional"></td>
                        </tr>
                         <tr>
                            <td class="align-middle">Maria Rodriguez</td>
                            <td>
                                <select class="form-select form-select-sm">
                                    <option class="text-success">Present</option>
                                    <option class="text-danger">Absent</option>
                                    <option class="text-warning">Late</option>
                                </select>
                            </td>
                            <td><input type="text" class="form-control form-control-sm" placeholder="Optional"></td>
                        </tr>
                         <tr>
                            <td class="align-middle">Sam Smith</td>
                            <td>
                                <select class="form-select form-select-sm">
                                    <option class="text-warning">Late</option>
                                    <option class="text-success">Present</option>
                                    <option class="text-danger">Absent</option>
                                </select>
                            </td>
                            <td><input type="text" class="form-control form-control-sm" value="Bus delay"></td>
                        </tr>
                    </tbody>
                </table>
                <button class="btn btn-primary-custom float-end" onclick="alert('Attendance Saved!')">Submit Attendance</button>
            </div>
        </div>
    `;
}

function loadAssignmentsView() {
    const container = document.getElementById('academic-content-area');
    container.innerHTML = `
        <div class="p-4 h-100">
             <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                <h4 class="fw-bold m-0 text-primary">Homework & Assignments</h4>
                 <button class="btn btn-primary-custom" onclick="document.getElementById('createAssignmentModal').classList.add('show'); document.getElementById('createAssignmentModal').style.display='block';">
                    <span class="material-icons align-middle fs-5 me-1">add_circle</span> Create Assignment
                </button>
            </div>
            
            <!-- List of existing groups/assignments context -->
            <p class="text-muted">Select a class group to view active assignments:</p>
            <div class="list-group">
                <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="loadGroupAssignmentsMock(1)">
                    <span>Available Assignments (9th Grade Math)</span>
                    <span class="badge bg-primary rounded-pill">3 Active</span>
                </button>
                 <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="loadGroupAssignmentsMock(2)">
                    <span>Project Work (Science)</span>
                    <span class="badge bg-primary rounded-pill">1 Active</span>
                </button>
            </div>
            
            <div id="academics-assignments-list" class="mt-4"></div>
        </div>
    `;
}

function loadGroupAssignmentsMock(groupId) {
    const list = document.getElementById('academics-assignments-list');
    if (groupId === 1) {
        list.innerHTML = `
            <div class="card mb-3 border-0 shadow-sm border-start border-4 border-primary">
                <div class="card-body">
                    <h5 class="fw-bold">Algebra Worksheet #4</h5>
                    <p class="text-muted small mb-2">Due: Oct 25, 2025</p>
                    <p class="mb-2">Complete the attached PDF exercises regarding quadratic equations.</p>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="alert('View Submissions')">View 15 Submissions</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="alert('Delete')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    } else {
        list.innerHTML = `
            <div class="card mb-3 border-0 shadow-sm border-start border-4 border-warning">
                <div class="card-body">
                    <h5 class="fw-bold">Plant Cell Model</h5>
                    <p class="text-muted small mb-2">Due: Nov 01, 2025</p>
                    <p class="mb-2">Build a 3D model of a plant cell using recycled materials.</p>
                     <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="alert('View Submissions')">View 2 Submissions</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="alert('Delete')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }
}

function loadExamsView() {
    const container = document.getElementById('academic-content-area');
    container.innerHTML = `
        <div class="p-4 h-100">
            <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Exams & Grading</h4>
            
            <div class="alert alert-warning">
                <span class="material-icons align-middle me-2">construction</span>
                Exam scheduling and automated grading features are currently being upgraded.
            </div>
            
            <div class="row g-4">
                <div class="col-md-6">
                    <div class="card mb-3 h-100">
                        <div class="card-header fw-bold bg-white">Mid-Term Exams</div>
                        <div class="card-body">
                            <p>Upcoming Schedule:</p>
                            <ul class="list-unstyled">
                                <li class="mb-2"><strong>Math:</strong> Nov 15</li>
                                <li class="mb-2"><strong>Science:</strong> Nov 16</li>
                                <li class="mb-2"><strong>English:</strong> Nov 17</li>
                            </ul>
                            <button class="btn btn-outline-dark btn-sm w-100">Edit Schedule</button>
                        </div>
                    </div>
                </div>
                 <div class="col-md-6">
                    <div class="card mb-3 h-100">
                        <div class="card-header fw-bold bg-white">Gradebook</div>
                        <div class="card-body d-flex flex-column justify-content-center align-items-center">
                            <span class="material-icons fs-1 text-secondary mb-2">table_view</span>
                            <button class="btn btn-primary-custom" onclick="alert('Opening Gradebook spreadsheet...')">Open Master Gradebook</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadReportCardsView() {
    const container = document.getElementById('academic-content-area');
    container.innerHTML = `
        <div class="p-4 h-100">
            <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Report Cards</h4>
            
            <div class="card bg-light border-0 p-4">
                <h5 class="fw-bold mb-3">Generate Student Reports</h5>
                <form onsubmit="event.preventDefault(); alert('Reports Generated! Downloading PDF...');">
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label">Term</label>
                            <select class="form-select">
                                <option>Fall 2025</option>
                                <option>Spring 2026</option>
                            </select>
                        </div>
                         <div class="col-md-4">
                            <label class="form-label">Grade Level</label>
                            <select class="form-select">
                                <option>Grade 9</option>
                                <option>Grade 10</option>
                                <option>Grade 11</option>
                                <option>Grade 12</option>
                            </select>
                        </div>
                         <div class="col-md-4">
                            <label class="form-label text-light">Action</label>
                            <button type="submit" class="btn btn-dark w-100 fw-bold">Generate PDFs</button>
                        </div>
                    </div>
                </form>
            </div>
            
            <hr class="my-5">
            
            <h5 class="fw-bold mb-3">Recent Reports</h5>
            <div class="list-group">
                <a href="#" class="list-group-item list-group-item-action">
                    <span class="material-icons align-middle text-danger me-2">picture_as_pdf</span>
                    Fall_2024_Grade9_Summary.pdf
                </a>
                 <a href="#" class="list-group-item list-group-item-action">
                    <span class="material-icons align-middle text-danger me-2">picture_as_pdf</span>
                    Spring_2024_Grade10_Full_Report.pdf
                </a>
            </div>
        </div>
    `;
}

function showLessonPlanner() {
    // 1. Create Modal HTML dynamically
    const modalId = 'lessonPlannerModal';
    let modalEl = document.getElementById(modalId);

    if (modalEl) {
        modalEl.remove(); // Clean up existing
    }

    const modalHTML = `
    <div class="modal fade" id="${modalId}" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">
                        <span class="material-icons align-middle me-2">psychology</span> AI Lesson Planner
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <form id="lesson-plan-form">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label fw-bold">Subject</label>
                                <select class="form-select" name="subject" required>
                                    <option value="Mathematics">Mathematics</option>
                                    <option value="Science">Science</option>
                                    <option value="History">History</option>
                                    <option value="English Literature">English Literature</option>
                                    <option value="Computer Science">Computer Science</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-bold">Grade Level</label>
                                <select class="form-select" name="grade_level" required>
                                    <option value="Grade 1">Grade 1</option>
                                    <option value="Grade 2">Grade 2</option>
                                    <option value="Grade 3">Grade 3</option>
                                    <option value="Grade 4">Grade 4</option>
                                    <option value="Grade 5">Grade 5</option>
                                    <option value="Grade 6">Grade 6</option>
                                    <option value="Grade 7">Grade 7</option>
                                    <option value="Grade 8">Grade 8</option>
                                    <option value="Grade 9">Grade 9</option>
                                    <option value="Grade 10">Grade 10</option>
                                    <option value="Grade 11">Grade 11</option>
                                    <option value="Grade 12">Grade 12</option>
                                </select>
                            </div>
                            <div class="col-md-8">
                                <label class="form-label fw-bold">Topic</label>
                                <input type="text" class="form-control" name="topic" placeholder="e.g., Photosynthesis, Quadratic Equations, The Civil War" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-bold">Duration</label>
                                <select class="form-select" name="duration">
                                    <option value="30 minutes">30 Minutes</option>
                                    <option value="45 minutes" selected>45 Minutes</option>
                                    <option value="60 minutes">60 Minutes</option>
                                    <option value="90 minutes">90 Minutes</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="d-grid mt-4">
                            <button type="submit" class="btn btn-primary-custom py-2 fw-bold">
                                <span class="material-icons align-middle me-2">auto_awesome</span> Generate Lesson Plan
                            </button>
                        </div>
                    </form>

                    <div id="lesson-plan-result" class="mt-4 d-none">
                        <hr>
                        <h5 class="fw-bold mb-3 text-success">Generated Plan</h5>
                        <div class="p-4 bg-light rounded-3 border" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;" id="lesson-plan-content"></div>
                        <button class="btn btn-outline-dark w-100 mt-3" onclick="alert('PDF Export coming soon!')">
                            <span class="material-icons align-middle me-2">download</span> Save as PDF
                        </button>
                    </div>

                     <div id="lesson-plan-loading" class="text-center mt-5 d-none">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 text-muted">Consulting with AI Curriculum Expert...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();

    // Handle Form Submit
    document.getElementById('lesson-plan-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // UI updates
        document.getElementById('lesson-plan-form').classList.add('d-none');
        document.getElementById('lesson-plan-loading').classList.remove('d-none');
        document.getElementById('lesson-plan-result').classList.add('d-none');

        try {
            const data = Object.fromEntries(formData.entries());
            const response = await fetchAPI('/ai/generate-lesson-plan', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                const contentDiv = document.getElementById('lesson-plan-content');
                // Basic markdown cleanup for display
                let formatted = result.plan_markdown
                    .replace(/^# (.*$)/gim, '<h2 class="h4 border-bottom pb-2">$1</h2>')
                    .replace(/^## (.*$)/gim, '<h3 class="h5 mt-3 fw-bold">$1</h3>')
                    .replace(/^\- (.*$)/gim, '• $1');

                contentDiv.innerHTML = formatted;

                document.getElementById('lesson-plan-result').classList.remove('d-none');
            } else {
                alert("Failed to generate plan. Please try again.");
                document.getElementById('lesson-plan-form').classList.remove('d-none');
            }
        } catch (error) {
            console.error(error);
            alert("Error connecting to AI service.");
            document.getElementById('lesson-plan-form').classList.remove('d-none');
        } finally {
            document.getElementById('lesson-plan-loading').classList.add('d-none');
        }
    });
}

function showSyllabusDetail(subject) {
    const detailView = document.getElementById('syllabus-detail-view');
    // Simple mock switching logic
    if (subject === 'math') {
        detailView.innerHTML = `
           <h6 class="fw-bold text-primary">Mathematics - Grade 9</h6>
           <div class="d-flex justify-content-between text-muted small mb-3">
                <span>Progress: 65% Completed</span>
                <span>Term: Fall 2025</span>
           </div>

           <div class="table-responsive">
                <table class="table table-sm table-hover bg-white rounded shadow-sm">
                    <thead class="table-light">
                        <tr>
                            <th>Unit</th>
                            <th>Topic</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Unit 1</td>
                            <td>Real Numbers</td>
                            <td><span class="badge bg-success">Completed</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Review</button></td>
                        </tr>
                         <tr>
                            <td>Unit 2</td>
                            <td>Polynomials</td>
                            <td><span class="badge bg-success">Completed</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Review</button></td>
                        </tr>
                         <tr>
                            <td>Unit 3</td>
                            <td>Linear Equations</td>
                            <td><span class="badge bg-warning text-dark">In Progress</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Edit</button></td>
                        </tr>
                         <tr>
                            <td>Unit 4</td>
                            <td>Quadratic Eq.</td>
                            <td><span class="badge bg-secondary">Pending</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Plan</button></td>
                        </tr>
                    </tbody>
                </table>
           </div>
           <button class="btn btn-primary-custom btn-sm mt-2" onclick="alert('Add New Topic Modal')">+ Add Topic</button>
        `;
    } else if (subject === 'science') {
        detailView.innerHTML = `
           <h6 class="fw-bold text-success">Physics - Grade 10</h6>
           <div class="d-flex justify-content-between text-muted small mb-3">
                <span>Progress: 40% Completed</span>
                <span>Term: Fall 2025</span>
           </div>

           <div class="table-responsive">
                <table class="table table-sm table-hover bg-white rounded shadow-sm">
                    <thead class="table-light">
                        <tr>
                            <th>Unit</th>
                            <th>Topic</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Unit 1</td>
                            <td>Motion & Time</td>
                            <td><span class="badge bg-success">Completed</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Review</button></td>
                        </tr>
                         <tr>
                            <td>Unit 2</td>
                            <td>Force & Laws</td>
                            <td><span class="badge bg-success">Completed</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Review</button></td>
                        </tr>
                         <tr>
                            <td>Unit 3</td>
                            <td>Gravitation</td>
                            <td><span class="badge bg-warning text-dark">In Progress</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Edit</button></td>
                        </tr>
                         <tr>
                            <td>Unit 4</td>
                            <td>Work & Energy</td>
                            <td><span class="badge bg-secondary">Pending</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Plan</button></td>
                        </tr>
                         <tr>
                            <td>Unit 5</td>
                            <td>Sound</td>
                            <td><span class="badge bg-secondary">Pending</span></td>
                            <td><button class="btn btn-link btn-sm p-0">Plan</button></td>
                        </tr>
                    </tbody>
                </table>
           </div>
           <button class="btn btn-primary-custom btn-sm mt-2" onclick="alert('Add New Topic Modal')">+ Add Topic</button>
        `;
    }

    // Update active state in sidebar
    const listItems = document.querySelectorAll('#academic-content-area .list-group-item');
    listItems.forEach(item => item.classList.remove('active'));
    // This is a bit hacky for a mockup, ideally we'd pass 'this'
    const clickedItem = Array.from(listItems).find(item => item.textContent.toLowerCase().includes(subject === 'math' ? 'mathematics' : 'physics'));
    if (clickedItem) clickedItem.classList.add('active');
}

// --- FINANCE & BILLING LOGIC ---

function renderFinanceDashboard() {
    // Default to Fee Structures
    switchFinanceTab('fees');
}

function switchFinanceTab(tabId, btnElement) {
    // Update Sidebar Active State
    if (btnElement) {
        document.querySelectorAll('#finance-view .list-group-item').forEach(el => el.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const contentArea = document.getElementById('finance-content-area');
    contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div></div>';

    setTimeout(() => {
        switch (tabId) {
            case 'fees': loadFeeStructures(contentArea); break;
            case 'installments': loadInstallmentPlans(contentArea); break;
            case 'discounts': loadDiscountsView(contentArea); break;
            case 'invoicing': loadInvoicingView(contentArea); break;
            case 'payments': loadOnlinePaymentsView(contentArea); break;
            case 'refunds': loadRefundsView(contentArea); break;
            case 'reports': loadFinancialReportsView(contentArea); break;
            case 'currency': loadMultiCurrencyView(contentArea); break;
        }
    }, 300); // Simulate loading
}

function loadFeeStructures(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Fee Structures</h4>
        <div class="card border-0 shadow-sm mb-4">
            <div class="card-body">
                <div class="d-flex justify-content-between mb-3">
                    <h5 class="fw-bold">Academic Year 2025-2026</h5>
                    <button class="btn btn-primary-custom btn-sm" onclick="alert('Create New Fee Structure')">+ Create New</button>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Grade Level</th>
                                <th>Tuition Fee</th>
                                <th>Library Fee</th>
                                <th>Lab Fee</th>
                                <th>Total (Yearly)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Primary (Gr 1-5)</td>
                                <td>,000</td>
                                <td></td>
                                <td>-</td>
                                <td class="fw-bold">,200</td>
                                <td><button class="btn btn-sm btn-outline-primary">Edit</button></td>
                            </tr>
                            <tr>
                                <td>Middle (Gr 6-8)</td>
                                <td>,500</td>
                                <td></td>
                                <td></td>
                                <td class="fw-bold">,200</td>
                                <td><button class="btn btn-sm btn-outline-primary">Edit</button></td>
                            </tr>
                             <tr>
                                <td>High School (Gr 9-12)</td>
                                <td>,000</td>
                                <td></td>
                                <td>,000</td>
                                <td class="fw-bold">,500</td>
                                <td><button class="btn btn-sm btn-outline-primary">Edit</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function loadInstallmentPlans(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Installment Plans</h4>
        <div class="row g-4">
            <div class="col-md-6">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                             <h5 class="fw-bold mb-0">Standard Term Plan</h5>
                             <span class="badge bg-success">Active</span>
                        </div>
                        <p class="text-muted small">Standard plan splitting fees into 3 term payments.</p>
                        <ul class="list-unstyled text-muted small">
                            <li class="mb-2"><strong>Term 1 (40%):</strong> Due Sep 1st</li>
                            <li class="mb-2"><strong>Term 2 (30%):</strong> Due Jan 15th</li>
                            <li class="mb-2"><strong>Term 3 (30%):</strong> Due Apr 15th</li>
                        </ul>
                        <button class="btn btn-outline-dark btn-sm w-100">Manage Rules</button>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                 <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                             <h5 class="fw-bold mb-0">Monthly Installments</h5>
                             <span class="badge bg-warning text-dark">Approval Req.</span>
                        </div>
                        <p class="text-muted small">10 Monthly payments for financial hardship cases.</p>
                         <ul class="list-unstyled text-muted small">
                            <li class="mb-2"><strong>Initial:</strong> 10% Due on Admission</li>
                            <li class="mb-2"><strong>Recurring:</strong> 9 payments of 10% (Oct - Jun)</li>
                            <li class="mb-2"><strong>Surcharge:</strong> 2% administrative fee</li>
                        </ul>
                        <button class="btn btn-outline-dark btn-sm w-100">Manage Rules</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadDiscountsView(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Discounts & Scholarships</h4>
        <div class="card border-0 shadow-sm">
            <div class="card-body">
                 <div class="d-flex justify-content-between mb-3">
                    <h5 class="fw-bold">Active Programs</h5>
                    <button class="btn btn-primary-custom btn-sm">+ Add Program</button>
                </div>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="fw-bold mb-0">Sibling Discount</h6>
                            <small class="text-muted">10% off tuition for second child onwards</small>
                        </div>
                        <span class="badge bg-success rounded-pill">Auto-Applied</span>
                    </li>
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="fw-bold mb-0">Staff Rate</h6>
                            <small class="text-muted">50% waiver for faculty children</small>
                        </div>
                         <span class="badge bg-success rounded-pill">Active</span>
                    </li>
                     <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="fw-bold mb-0">Merit Scholarship (Gold)</h6>
                            <small class="text-muted">Full tuition waiver for top 5 students</small>
                        </div>
                         <span class="badge bg-primary rounded-pill">Competitive</span>
                    </li>
                </ul>
            </div>
        </div>
    `;
}

function loadInvoicingView(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Invoicing</h4>
         <div class="d-flex justify-content-between mb-3">
            <div class="btn-group">
                <button class="btn btn-outline-secondary active">Unpaid</button>
                <button class="btn btn-outline-secondary">Paid</button>
                <button class="btn btn-outline-secondary">Overdue</button>
            </div>
            <button class="btn btn-primary-custom" onclick="alert('Bulk Generate Invoices')">Bulk Generate</button>
        </div>
        <div class="table-responsive bg-white rounded shadow-sm border p-3">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Invoice #</th>
                        <th>Student</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>INV-2025-001</td>
                        <td>Alice Smith (G5-A)</td>
                        <td>Term 1 Tuition</td>
                        <td>,000.00</td>
                        <td>Sep 01, 2025</td>
                        <td><span class="badge bg-danger">Overdue</span></td>
                        <td><button class="btn btn-sm btn-link">Send Reminder</button></td>
                    </tr>
                     <tr>
                        <td>INV-2025-002</td>
                        <td>Bob Jones (G6-B)</td>
                        <td>Lab Fees</td>
                        <td>.00</td>
                        <td>Oct 01, 2025</td>
                        <td><span class="badge bg-warning text-dark">Unpaid</span></td>
                        <td><button class="btn btn-sm btn-link">Email</button></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function loadOnlinePaymentsView(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Online Payments Gateway</h4>
        <div class="row g-4">
            <div class="col-md-8">
                 <div class="card border-0 shadow-sm">
                    <div class="card-header bg-light fw-bold">Recent Transactions</div>
                    <div class="card-body p-0">
                         <table class="table table-striped mb-0">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Payer</th>
                                    <th>Amount</th>
                                    <th>Method</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>TXN_998877</td>
                                    <td>Sarah Parent</td>
                                    <td>,000.00</td>
                                    <td>Stripe (CC)</td>
                                    <td>Today, 10:45 AM</td>
                                    <td><span class="badge bg-success">Success</span></td>
                                </tr>
                                 <tr>
                                    <td>TXN_998876</td>
                                    <td>Mike Parent</td>
                                    <td>.00</td>
                                    <td>PayPal</td>
                                    <td>Yesterday</td>
                                    <td><span class="badge bg-success">Success</span></td>
                                </tr>
                            </tbody>
                         </table>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm mb-3">
                    <div class="card-body text-center">
                        <h6 class="text-muted mb-2">Total Collections (Today)</h6>
                        <h3 class="fw-bold text-success">,150.00</h3>
                    </div>
                </div>
                 <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h6 class="fw-bold">Payment Methods</h6>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span><span class="material-icons align-middle fs-6 me-1">credit_card</span> Stripe</span>
                            <div class="form-check form-switch">
                              <input class="form-check-input" type="checkbox" checked>
                            </div>
                        </div>
                         <div class="d-flex justify-content-between align-items-center mt-3">
                            <span><span class="material-icons align-middle fs-6 me-1">payments</span> PayPal</span>
                            <div class="form-check form-switch">
                              <input class="form-check-input" type="checkbox" checked>
                            </div>
                        </div>
                         <div class="d-flex justify-content-between align-items-center mt-3">
                            <span><span class="material-icons align-middle fs-6 me-1">account_balance</span> Bank Transfer</span>
                            <div class="form-check form-switch">
                              <input class="form-check-input" type="checkbox">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadRefundsView(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Refund Requests</h4>
        <div class="alert alert-info border-0 shadow-sm">
            <span class="material-icons align-middle me-2">info</span> Refund processing usually takes 5-7 business days.
        </div>
        <div class="card border-0 shadow-sm text-center p-5">
            <span class="material-icons display-4 text-muted mb-3">receipt_long</span>
            <h5>No Pending Refund Requests</h5>
            <p class="text-muted">All clear! No refund requests are currently active.</p>
        </div>
    `;
}

function loadFinancialReportsView(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Financial Reports</h4>
        <div class="row g-4">
            <div class="col-md-6">
                 <button class="btn btn-light w-100 p-4 text-start shadow-sm border h-100" onclick="alert('Generating Revenue Report...')">
                    <span class="material-icons text-success display-6 d-block mb-3">trending_up</span>
                    <h5 class="fw-bold">Annual Revenue Report</h5>
                    <p class="text-muted small mb-0">Detailed breakdown of tuition and fees revenue vs projections.</p>
                 </button>
            </div>
             <div class="col-md-6">
                 <button class="btn btn-light w-100 p-4 text-start shadow-sm border h-100" onclick="alert('Generating Outstanding Fees Report...')">
                    <span class="material-icons text-danger display-6 d-block mb-3">running_with_errors</span>
                    <h5 class="fw-bold">Outstanding Fees</h5>
                    <p class="text-muted small mb-0">List of overdue accounts and aging report (30/60/90 days).</p>
                 </button>
            </div>
             <div class="col-md-6">
                 <button class="btn btn-light w-100 p-4 text-start shadow-sm border h-100" onclick="alert('Generating Expense Report...')">
                    <span class="material-icons text-warning display-6 d-block mb-3">money_off</span>
                    <h5 class="fw-bold">Expense Report</h5>
                    <p class="text-muted small mb-0">Operational expenses, salaries, and facility maintenance costs.</p>
                 </button>
            </div>
             <div class="col-md-6">
                 <button class="btn btn-light w-100 p-4 text-start shadow-sm border h-100" onclick="alert('Generating Tax Documents...')">
                    <span class="material-icons text-primary display-6 d-block mb-3">description</span>
                    <h5 class="fw-bold">Tax Summaries</h5>
                    <p class="text-muted small mb-0">Consolidated reports for tax filing purposes.</p>
                 </button>
            </div>
        </div>
    `;
}

function loadMultiCurrencyView(container) {
    container.innerHTML = `
        <h4 class="fw-bold text-primary mb-4 border-bottom pb-3">Multi-Currency Settings</h4>
        <div class="card border-0 shadow-sm">
            <div class="card-body">
                <form>
                    <div class="mb-4">
                        <label class="form-label fw-bold">Base Platform Currency</label>
                        <select class="form-select bg-light" disabled>
                            <option>USD ($)</option>
                        </select>
                        <div class="form-text">The base currency cannot be changed once transactions are recorded.</div>
                    </div>
                    
                    <h6 class="fw-bold mb-3">Accepted Currencies for Payment</h6>
                    <div class="list-group">
                        <label class="list-group-item d-flex gap-3">
                            <input class="form-check-input flex-shrink-0" type="checkbox" value="" checked>
                            <span>
                                <strong>USD</strong> - United States Dollar
                                <div class="small text-muted">Primary</div>
                            </span>
                        </label>
                        <label class="list-group-item d-flex gap-3">
                            <input class="form-check-input flex-shrink-0" type="checkbox" value="">
                            <span>
                                <strong>EUR</strong> - Euro
                                <div class="small text-muted">Exchange Rate: 1.08 USD</div>
                            </span>
                        </label>
                         <label class="list-group-item d-flex gap-3">
                            <input class="form-check-input flex-shrink-0" type="checkbox" value="">
                            <span>
                                <strong>GBP</strong> - British Pound
                                <div class="small text-muted">Exchange Rate: 1.25 USD</div>
                            </span>
                        </label>
                         <label class="list-group-item d-flex gap-3">
                            <input class="form-check-input flex-shrink-0" type="checkbox" value="">
                            <span>
                                <strong>INR</strong> - Indian Rupee
                                <div class="small text-muted">Exchange Rate: 0.012 USD</div>
                            </span>
                        </label>
                    </div>
                    
                    <button type="button" class="btn btn-primary-custom mt-4" onclick="alert('Currency Settings Saved')">Save Settings</button>
                </form>
            </div>
    `;
}

/* --- COMPLIANCE & SECURITY LOGIC (REFACTORED for Navigation Style) --- */

function showComplianceMenu() {
    document.getElementById('compliance-menu-area').classList.remove('d-none');
    document.getElementById('compliance-detail-area').classList.add('d-none');
    document.getElementById('compliance-back-btn').classList.add('d-none');
    document.getElementById('compliance-top-title').textContent = 'Compliance & Security';
}

function loadComplianceTab(tabId) {
    const menuArea = document.getElementById('compliance-menu-area');
    const detailArea = document.getElementById('compliance-detail-area');
    const container = document.getElementById('compliance-tab-content');
    const title = document.getElementById('compliance-top-title');
    const backBtn = document.getElementById('compliance-back-btn');

    // Switch View State
    menuArea.classList.add('d-none');
    detailArea.classList.remove('d-none');
    backBtn.classList.remove('d-none');

    // Set Loading State
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Loading data...</p></div>';

    if (tabId === 'audit-logs') {
        title.textContent = 'System Audit Logs';
        fetchAPI('/admin/compliance/audit-logs')
            .then(res => res.json())
            .then(logs => {
                if (logs.length === 0) {
                    container.innerHTML = `
                        <div class="text-center py-5">
                            <span class="material-icons fs-1 text-muted">history_edu</span>
                            <p class="text-muted mt-2">No audit logs found.</p>
                        </div>`;
                    return;
                }
                let table = `
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0 align-middle">
                            <thead class="bg-light">
                                <tr>
                                    <th class="py-3 ps-4">Time</th>
                                    <th class="py-3">User</th>
                                    <th class="py-3">Event</th>
                                    <th class="py-3">Details</th>
                                </tr>
                            </thead>
                            <tbody>`;
                logs.forEach(log => {
                    const dateObj = new Date(log.timestamp);
                    const dateStr = dateObj.toLocaleDateString();
                    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    table += `<tr>
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${dateStr}</div>
                            <div class="small text-muted">${timeStr}</div>
                        </td>
                        <td>${log.user_id}</td>
                        <td><span class="badge bg-light text-dark border">${log.event_type}</span></td>
                        <td class="text-muted small">${log.details || '-'}</td>
                    </tr>`;
                });
                table += '</tbody></table></div></div>';
                container.innerHTML = table;
            })
            .catch(err => {
                container.innerHTML = '<div class="alert alert-danger">Failed to load logs.</div>';
                console.error(err);
            });
    } else if (tabId === 'access-logs') {
        title.textContent = 'Access & Login Logs';
        fetchAPI('/admin/compliance/access-logs')
            .then(res => res.json())
            .then(logs => {
                if (logs.length === 0) {
                    container.innerHTML = `
                        <div class="text-center py-5">
                            <span class="material-icons fs-1 text-muted">vpn_key</span>
                            <p class="text-muted mt-2">No access logs found.</p>
                        </div>`;
                    return;
                }
                let table = `
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0 align-middle">
                            <thead class="bg-light">
                                <tr>
                                    <th class="py-3 ps-4">Time</th>
                                    <th class="py-3">User</th>
                                    <th class="py-3">Event</th>
                                    <th class="py-3">Duration</th>
                                </tr>
                            </thead>
                            <tbody>`;
                logs.forEach(log => {
                    let dur = log.duration_minutes ? `${log.duration_minutes}m` : '-';
                    const dateObj = new Date(log.timestamp);
                    const dateStr = dateObj.toLocaleDateString();
                    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const badgeClass = log.event_type.includes('Success') ? 'bg-success-subtle text-success' :
                        (log.event_type.includes('Fail') ? 'bg-danger-subtle text-danger' : 'bg-secondary-subtle text-secondary');

                    table += `<tr>
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${dateStr}</div>
                            <div class="small text-muted">${timeStr}</div>
                        </td>
                         <td>${log.user_id}</td>
                        <td><span class="badge ${badgeClass}">${log.event_type}</span></td>
                        <td>${dur}</td>
                    </tr>`;
                });
                table += '</tbody></table></div></div>';
                container.innerHTML = table;
            })
            .catch(err => {
                container.innerHTML = '<div class="alert alert-danger">Failed to load logs.</div>';
                console.error(err);
            });
    } else if (tabId === 'retention') {
        title.textContent = 'Data Retention Policies';
        fetchAPI('/admin/compliance/retention')
            .then(res => res.json())
            .then(data => {
                container.innerHTML = `
                <div class="card border-0 shadow-sm rounded-4 p-4" style="max-width: 800px; margin: 0 auto;">
                    <form id="retention-form" onsubmit="saveRetentionPolicies(event)">
                        <div class="mb-4">
                            <label class="form-label fw-bold">Audit Log Retention (Days)</label>
                            <div class="input-group">
                                <span class="input-group-text bg-light border-0"><span class="material-icons fs-5 text-muted">history</span></span>
                                <input type="number" name="audit_logs_days" class="form-control bg-light border-0" value="${data.audit_logs_days}" required>
                            </div>
                             <div class="form-text mt-2">Audit logs older than this will be automatically archived or deleted.</div>
                        </div>
                        <div class="mb-4">
                            <label class="form-label fw-bold">Access Log Retention (Days)</label>
                            <div class="input-group">
                                <span class="input-group-text bg-light border-0"><span class="material-icons fs-5 text-muted">vpn_key</span></span>
                                <input type="number" name="access_logs_days" class="form-control bg-light border-0" value="${data.access_logs_days}" required>
                            </div>
                        </div>
                         <div class="mb-4">
                            <label class="form-label fw-bold">Inactive Student Data Retention (Years)</label>
                            <div class="input-group">
                                <span class="input-group-text bg-light border-0"><span class="material-icons fs-5 text-muted">person_off</span></span>
                                <input type="number" name="student_data_years" class="form-control bg-light border-0" value="${data.student_data_years}" required>
                            </div>
                             <div class="form-text mt-2">Time to keep personal data for students who have left the institution.</div>
                        </div>
                        <div class="d-flex justify-content-end pt-3 border-top">
                            <button type="submit" class="btn btn-primary-custom px-5 py-2 fw-bold rounded-pill">Save Changes</button>
                        </div>
                    </form>
                </div>
                `;
            })
            .catch(err => {
                container.innerHTML = '<p class="text-danger">Failed to load policies. ' + (err.detail || err.message) + '</p>';
            });
    }
}


async function saveRetentionPolicies(e) {
    e.preventDefault();
    const form = e.target;
    const body = {
        audit_logs_days: parseInt(form.audit_logs_days.value),
        access_logs_days: parseInt(form.access_logs_days.value),
        student_data_years: parseInt(form.student_data_years.value)
    };

    try {
        const res = await fetchAPI('/admin/compliance/retention', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (res.ok) {
            alert("Policies Saved!");
        } else {
            alert("Failed to save.");
        }
    } catch (err) {
        console.error(err);
        alert("Error saving policies.");
    }
}

// --- FINANCE & BILLING HANDLERS ---
function showFinanceMenu() {
    document.getElementById('finance-menu-area').classList.remove('d-none');
    document.getElementById('finance-detail-area').classList.add('d-none');
    document.getElementById('finance-back-btn').classList.add('d-none');
    document.getElementById('finance-top-title').textContent = '3.6 Finance & Billing';
}

function loadFinanceTab(tabId) {
    const menuArea = document.getElementById('finance-menu-area');
    const detailArea = document.getElementById('finance-detail-area');
    const backBtn = document.getElementById('finance-back-btn');
    const title = document.getElementById('finance-top-title');
    const container = document.getElementById('finance-tab-content');

    // Switch View
    menuArea.classList.add('d-none');
    detailArea.classList.remove('d-none');
    backBtn.classList.remove('d-none');

    // Clear previous
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    // Set Title Map
    const titles = {
        'fee-structures': 'Fee Structures',
        'installment-plans': 'Installment Plans',
        'discounts-scholarships': 'Discounts & Scholarships',
        'invoicing': 'Invoicing',
        'online-payments': 'Online Payments',
        'refunds': 'Refunds',
        'financial-reports': 'Financial Reports',
        'multi-currency': 'Multi-currency Settings'
    };
    title.textContent = titles[tabId] || 'Finance Details';

    // Since we don't have backend logic for all these yet, show a placeholder for most
    // In a real app, each case would fetch data from specific endpoints
    setTimeout(() => {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-3">
                    <span class="material-icons fs-1 text-muted" style="font-size: 48px;">construction</span>
                </div>
                <h4 class="fw-bold text-dark">Feature Under Construction</h4>
                <p class="text-muted">The <strong>${titles[tabId]}</strong> module is currently being implemented.</p>
                <div class="mt-4">
                    <button class="btn btn-outline-secondary" onclick="showFinanceMenu()">Return to Menu</button>
                </div>
            </div>
        `;
    }, 500);
}

// --- STAFF & FACULTY HANDLERS ---
function showStaffMenu() {
    document.getElementById('staff-menu-area').classList.remove('d-none');
    document.getElementById('staff-detail-area').classList.add('d-none');
    document.getElementById('staff-back-btn').classList.add('d-none');
    document.getElementById('staff-top-title').textContent = '3.4 Staff & Faculty Management';
}

function loadStaffTab(tabId) {
    const menuArea = document.getElementById('staff-menu-area');
    const detailArea = document.getElementById('staff-detail-area');
    const backBtn = document.getElementById('staff-back-btn');
    const title = document.getElementById('staff-top-title');
    const container = document.getElementById('staff-tab-content');

    // Switch View
    menuArea.classList.add('d-none');
    detailArea.classList.remove('d-none');
    backBtn.classList.remove('d-none');

    // Clear previous
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    // Set Title Map
    const titles = {
        'profiles': 'Staff Profiles',
        'role-assignment': 'Role Assignment',
        'department-grouping': 'Department Grouping',
        'workload': 'Workload Allocation',
        'attendance': 'Staff Attendance',
        'payroll': 'Payroll Integration',
        'performance': 'Performance Reviews'
    };
    title.textContent = titles[tabId] || 'Staff Details';

    // Routing
    if (tabId === 'department-grouping') {
        loadStaffDepartments();
    } else if (tabId === 'profiles') {
        loadStaffProfiles();
    } else if (tabId === 'attendance') {
        loadStaffAttendance();
    } else if (tabId === 'performance') {
        loadStaffPerformance();
    } else if (tabId === 'role-assignment') {
        // Redirect to main User Management for now, but filtered?
        // Actually, let's keep it here but link to user management or show simple list
        container.innerHTML = `
            <div class="p-4 text-center">
                <p>Role Assignment is managed via the central User Management or Role Management modules.</p>
                <div class="d-flex justify-content-center gap-3">
                    <button class="btn btn-primary" onclick="openUserManagement()">Go to User Management</button>
                    <button class="btn btn-outline-primary" onclick="handleTeacherViewToggle('roles-view')">Go to Roles & Perms</button>
                </div>
            </div>
        `;
    } else {
        // Placeholder for others
        container.innerHTML = `
             <div class="p-5 text-center bg-white rounded shadow-sm">
                <div class="mb-3">
                    <span class="material-icons text-muted" style="font-size: 48px;">construction</span>
                </div>
                <h4 class="fw-bold text-dark">Feature Under Construction</h4>
                <p class="text-muted">The <strong>${titles[tabId]}</strong> module is currently being implemented.</p>
            </div>
        `;
    }
}

// ... (Existing Functions) ...

// 4. Performance Reviews Logic
async function loadStaffPerformance() {
    const container = document.getElementById('staff-tab-content');
    container.innerHTML = `
        <div class="text-center py-5">
            <h5 class="text-muted">Select a staff member from the "Profiles" tab to view/add reviews.</h5>
            <button class="btn btn-primary" onclick="loadStaffTab('profiles')">Go to Profiles</button>
        </div>
    `;
    // Ideally this would be a list of recent reviews or a selector. 
    // To keep it simple: link back to profiles where we can add a "Review" button? 
    // Or just show a list of all reviews here?

    // Let's show recent reviews
    const headerHtml = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold text-primary m-0">Performance Review Log</h5>
        </div>
    `;

    // We don't have a specific "get all reviews" endpoint (only per user).
    // Let's fetch profiles first, then maybe allow selection?
    // Actually, for MVP 'implement these things', let's stick to the 'Profiles' suggestion or add a quick "Review" button in profiles.

    // Let's UPDATE loadStaffProfiles to include a "Review" button!
}

// 1. Departments Logic
async function loadStaffDepartments() {
    const container = document.getElementById('staff-tab-content');

    // Header with Create Button
    const headerHtml = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h5 class="fw-bold text-primary m-0">Departments</h5>
            <button class="btn btn-primary btn-sm rounded-pill px-3" onclick="openCreateDeptModal()">
                <span class="material-icons align-middle fs-6 me-1">add</span> New Department
            </button>
        </div>
    `;

    try {
        const res = await fetchAPI('/staff/departments');
        const depts = await res.json();

        if (depts.length === 0) {
            container.innerHTML = headerHtml + `<div class="alert alert-info">No departments found. Create one to get started.</div>`;
            return;
        }

        const listHtml = depts.map(d => `
            <div class="col-md-4">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                             <h6 class="fw-bold text-dark">${d.name}</h6>
                             <span class="material-icons text-muted small" style="cursor:pointer;">more_vert</span>
                        </div>
                        <p class="text-muted small mb-3">${d.description || 'No description'}</p>
                        <hr class="my-2 border-primary-subtle opacity-25">
                        <div class="d-flex align-items-center">
                            <i class="material-icons fs-6 me-1 text-secondary">person</i>
                            <span class="small text-secondary">Head: ${d.head_of_department_id || 'Not Assigned'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = headerHtml + `<div class="row g-3">${listHtml}</div>`;

    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error loading departments: ${e.message}</div>`;
    }
}

function openCreateDeptModal() {
    const modalHtml = `
      <div class="modal fade" id="createDeptModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow">
            <div class="modal-header border-bottom-0 pb-0">
              <h5 class="modal-title fw-bold">Create Department</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="dept-form">
                <div class="mb-3">
                    <label class="form-label small fw-bold">Department Name</label>
                    <input type="text" id="dept-name" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Description</label>
                    <textarea id="dept-desc" class="form-control" rows="2"></textarea>
                </div>
                <button type="submit" class="btn btn-primary w-100 rounded-pill fw-bold">Create</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    // Clean up old
    const old = document.getElementById('createDeptModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('createDeptModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById('dept-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetchAPI('/staff/departments', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('dept-name').value,
                    description: document.getElementById('dept-desc').value
                })
            });
            if (res.ok) {
                modal.hide();
                loadStaffDepartments(); // Refresh
            } else {
                alert("Failed to create department");
            }
        } catch (err) { alert("Error"); }
    };
}

// 2. Staff Profiles Logic
async function loadStaffProfiles() {
    const container = document.getElementById('staff-tab-content');

    try {
        const res = await fetchAPI('/staff/profiles');
        const staff = await res.json();

        if (staff.length === 0) {
            container.innerHTML = `<div class="alert alert-info">No staff members found.</div>`;
            return;
        }

        const tableHtml = `
            <div class="card border-0 shadow-sm">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="bg-light">
                            <tr>
                                <th class="ps-4">Name</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Position</th>
                                <th>Status</th>
                                <th class="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${staff.map(s => `
                                <tr>
                                    <td class="ps-4">
                                        <div class="d-flex align-items-center">
                                            <div class="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center me-2 fw-bold" style="width: 32px; height: 32px;">
                                                ${s.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div class="fw-bold text-dark">${s.name}</div>
                                                <div class="small text-muted" style="font-size: 11px;">${s.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span class="badge bg-light text-dark border">${s.role}</span></td>
                                    <td>${s.department_name ? `<span class="badge bg-info-subtle text-info-emphasis">${s.department_name}</span>` : '<span class="text-muted small">-</span>'}</td>
                                    <td>${s.position_title || '-'}</td>
                                    <td><span class="badge bg-success-subtle text-success">Active</span></td>
                                    <td class="text-end pe-4">
                                        <button class="btn btn-sm btn-link" onclick="openStaffEditModal('${s.id}')">Edit</button>
                                        <button class="btn btn-sm btn-link text-warning" onclick="openStaffReviewModal('${s.id}', '${s.name.replace(/'/g, "\\'")}')">Review</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = tableHtml;

    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
    }
}

function openStaffReviewModal(userId, userName) {
    const modalHtml = `
      <div class="modal fade" id="staffReviewModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content border-0 shadow">
            <div class="modal-header bg-warning-subtle text-dark">
              <h5 class="modal-title fw-bold">Performance Review: ${userName}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="staff-review-form">
                <div class="mb-3">
                    <label class="form-label small fw-bold">Review Date</label>
                    <input type="date" id="review-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Rating (1-5)</label>
                    <div class="d-flex gap-2">
                        ${[1, 2, 3, 4, 5].map(n => `
                            <div>
                                <input type="radio" class="btn-check" name="rating" id="rating-${n}" value="${n}" required>
                                <label class="btn btn-outline-warning fw-bold" for="rating-${n}">${n}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Comments / Feedback</label>
                    <textarea id="review-comments" class="form-control" rows="3" required></textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Goals for Next Period</label>
                    <textarea id="review-goals" class="form-control" rows="2"></textarea>
                </div>
                <button type="submit" class="btn btn-warning w-100 fw-bold">Submit Review</button>
              </form>
              
              <hr class="my-3">
              <h6 class="fw-bold small text-muted">Recent Reviews</h6>
              <div id="recent-reviews-list">
                 <div class="text-center text-muted small py-2"><div class="spinner-border spinner-border-sm"></div> Loading history...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const old = document.getElementById('staffReviewModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('staffReviewModal'));
    modal.show();

    // Fetch History
    fetchAPI(`/staff/performance/${userId}`)
        .then(res => res.json())
        .then(reviews => {
            const list = document.getElementById('recent-reviews-list');
            if (reviews.length === 0) {
                list.innerHTML = `<div class="text-center text-muted small">No past reviews found.</div>`;
            } else {
                list.innerHTML = reviews.map(r => `
                    <div class="p-2 border rounded mb-2 bg-light small">
                        <div class="d-flex justify-content-between">
                            <strong>${r.review_date}</strong>
                            <span class="badge bg-warning text-dark">Rating: ${r.rating}/5</span>
                        </div>
                        <div class="text-muted mt-1">${r.comments}</div>
                    </div>
                `).join('');
            }
        });

    document.getElementById('staff-review-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const rating = document.querySelector('input[name="rating"]:checked').value;
            const payload = {
                user_id: userId,
                review_date: document.getElementById('review-date').value,
                rating: parseInt(rating),
                comments: document.getElementById('review-comments').value,
                goals: document.getElementById('review-goals').value
            };

            const res = await fetchAPI('/staff/performance', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Review submitted!");
                modal.hide();
            } else {
                alert("Failed to submit review.");
            }
        } catch (err) { alert("Error."); }
    };
}

async function openStaffEditModal(userId) {
    // We need to fetch departments first for the dropdown
    let depts = [];
    try {
        const r = await fetchAPI('/staff/departments');
        depts = await r.json();
    } catch (e) { }

    const modalHtml = `
      <div class="modal fade" id="editStaffModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content border-0 shadow">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">Edit Staff Profile</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="staff-edit-form">
                <div class="mb-3">
                    <label class="form-label small fw-bold">Department</label>
                    <select id="staff-dept" class="form-select">
                        <option value="">Select Department...</option>
                        ${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Position Title</label>
                    <input type="text" id="staff-position" class="form-control" placeholder="e.g. Senior Lecturer">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Contract Type</label>
                    <select id="staff-contract" class="form-select">
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                    </select>
                </div>
                 <div class="mb-3">
                    <label class="form-label small fw-bold">Salary (Annual)</label>
                    <input type="number" id="staff-salary" class="form-control" placeholder="0.00">
                </div>
                <button type="submit" class="btn btn-primary w-100">Save Profile</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    const old = document.getElementById('editStaffModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('editStaffModal'));
    modal.show();

    // Fetch existing details if possible, for now just open structure
    // Ideally we fetch GET /staff/profiles again or filter from list.

    document.getElementById('staff-edit-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            // Handle empty department value
            const deptVal = document.getElementById('staff-dept').value;
            const payload = {
                department_id: deptVal ? parseInt(deptVal) : null,
                position_title: document.getElementById('staff-position').value,
                contract_type: document.getElementById('staff-contract').value,
                salary: parseFloat(document.getElementById('staff-salary').value) || 0
            };

            const res = await fetchAPI(`/staff/profiles/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                modal.hide();
                loadStaffProfiles();
            } else {
                alert("Failed to update.");
            }
        } catch (err) { alert("Error updating profile."); }
    };
}

// 3. Attendance Logic
async function loadStaffAttendance() {
    const container = document.getElementById('staff-tab-content');

    // Simple Log View + Mark Button
    const headerHtml = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold text-primary m-0">Daily Attendance Log</h5>
            <button class="btn btn-outline-primary btn-sm" onclick="alert('Manual marking coming soon')">
                Mark Attendance
            </button>
        </div>
    `;

    try {
        const res = await fetchAPI('/staff/attendance');
        const logs = await res.json();

        const tableHtml = `
            <table class="table table-sm table-bordered">
                <thead class="bg-light">
                    <tr><th>Date</th><th>Staff Name</th><th>Status</th><th>In</th><th>Out</th></tr>
                </thead>
                <tbody>
                    ${logs.length ? logs.map(l => `
                        <tr>
                            <td>${l.date}</td>
                            <td class="fw-bold">${l.staff_name}</td>
                            <td>${l.status}</td>
                            <td>${l.check_in_time || '-'}</td>
                            <td>${l.check_out_time || '-'}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" class="text-center text-muted">No attendance records.</td></tr>'}
                </tbody>
            </table>
        `;

        container.innerHTML = headerHtml + tableHtml;

    } catch (e) {
        container.innerHTML = "Error loading attendance.";
    }
}

// --- STUDENT INFORMATION HANDLERS ---
function showStudentInfoMenu() {
    document.getElementById('student-info-menu-area').classList.remove('d-none');
    document.getElementById('student-info-detail-area').classList.add('d-none');
    document.getElementById('student-info-back-btn').classList.add('d-none');
    document.getElementById('student-info-top-title').textContent = '3.3 Student Information Management';
}

async function loadStudentInfoTab(tabId) {
    const menuArea = document.getElementById('student-info-menu-area');
    const detailArea = document.getElementById('student-info-detail-area');
    const backBtn = document.getElementById('student-info-back-btn');
    const title = document.getElementById('student-info-top-title');
    const container = document.getElementById('student-info-tab-content');

    // Switch View
    menuArea.classList.add('d-none');
    detailArea.classList.remove('d-none');
    backBtn.classList.remove('d-none');

    // Clear previous
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    const titles = {
        'profiles': 'Student Profiles & Enrollment',
        'class-assignment': 'Class & Section Assignment',
        'guardians': 'Guardian Relationships',
        'health': 'Health & Emergency Info',
        'documents': 'Student Documents'
    };
    title.textContent = titles[tabId] || 'Student Details';

    // Router
    switch (tabId) {
        case 'profiles':
            renderStudentProfilesList(container);
            break;
        case 'class-assignment':
            await renderClassAssignmentView(container);
            break;
        case 'guardians':
            renderStudentSearchForModule(container, 'guardians');
            break;
        case 'health':
            renderStudentSearchForModule(container, 'health');
            break;
        case 'documents':
            renderStudentSearchForModule(container, 'documents');
            break;
    }
}

// 1. PROFILES MODULE
function renderStudentProfilesList(container) {
    // Re-use appState.allStudents if available, else fetch
    // For now assuming appState.allStudents is populated (it usually is on load)

    let html = `
        <div class="d-flex justify-content-between mb-3">
             <div class="search-box">
                <span class="material-icons">search</span>
                <input type="text" id="profile-search" class="form-control" placeholder="Search students..." onkeyup="filterProfileList()">
            </div>
            <button class="btn btn-primary" onclick="openAddUserModal()"><span class="material-icons align-middle me-1">add</span> New Student</button>
        </div>
        <div class="card border-0 shadow-sm">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" id="profiles-table">
                    <thead class="bg-light">
                        <tr>
                            <th class="ps-4">Name</th>
                            <th>ID</th>
                            <th>Grade / Section</th>
                            <th>Status</th>
                            <th class="text-end pe-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="profiles-table-body">
    `;

    appState.allStudents.forEach(s => {
        html += `
            <tr class="profile-row" data-name="${s.name.toLowerCase()}">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle bg-light d-flex align-items-center justify-content-center text-primary fw-bold" style="width: 40px; height: 40px; font-size: 14px;">
                            ${s.name.charAt(0)}
                        </div>
                        <div>
                            <div class="fw-bold text-dark">${s.name}</div>
                            <small class="text-muted">Joined ${s.joined_date || '2025'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="font-monospace small bg-light px-2 py-1 rounded border">${s.id}</span></td>
                <td>
                    <span class="badge bg-info-subtle text-info text-dark">Grade ${s.grade || 9}</span>
                </td>
                <td><span class="badge bg-success-subtle text-success">Active</span></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="openEditStudentModal('${s.id}')">View Profile</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
}

function filterProfileList() {
    const term = document.getElementById('profile-search').value.toLowerCase();
    document.querySelectorAll('.profile-row').forEach(row => {
        const name = row.getAttribute('data-name');
        row.style.display = name.includes(term) ? '' : 'none';
    });
}

// 2. CLASS ASSIGNMMENT MODULE
async function renderClassAssignmentView(container) {
    try {

        const sectionsRes = await fetchAPI('/sections');
        const sections = await sectionsRes.json();

        container.innerHTML = `
            <div class="row h-100">
                <div class="col-md-4 border-end">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold m-0">Sections</h5>
                        <button class="btn btn-sm btn-outline-primary" onclick="openCreateSectionModal()">
                            <span class="material-icons align-middle">add</span>
                        </button>
                    </div>
                    <div class="list-group list-group-flush" id="sections-list">
                        ${sections.map(s => `
                            <button class="list-group-item list-group-item-action py-3" onclick="loadSectionRoster(${s.id}, '${s.name}')">
                                <div class="d-flex justify-content-between align-items-center">
                                    <strong>${s.name}</strong>
                                    <span class="badge bg-light text-dark border">Grade ${s.grade_level}</span>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="col-md-8 px-4" id="section-detail-panel">
                    <div class="text-center text-muted py-5">
                        <span class="material-icons display-4 opacity-25">class</span>
                        <p>Select a section to manage enrollment</p>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = '<div class="alert alert-danger">Error loading sections</div>';
    }
}

async function createSection() {
    const name = prompt("Enter Section Name (e.g. Red Group):");
    if (!name) return;
    const grade = parseInt(prompt("Enter Grade Level:", "9"));

    try {
        const res = await fetchAPI('/sections', {
            method: 'POST',
            body: JSON.stringify({ name, grade_level: grade, school_id: appState.activeSchoolId || 1 })
        });
        if (res.ok) {
            loadStudentInfoTab('class-assignment'); // Reload
        }
    } catch (e) { alert("Error creating section"); }
}

window.openCreateSectionModal = createSection; // Quick bind

async function loadSectionRoster(sectionId, sectionName) {
    const panel = document.getElementById('section-detail-panel');
    panel.innerHTML = `
        <h5 class="fw-bold mb-3">Enrolled in ${sectionName}</h5>
        <div class="input-group mb-3">
             <input type="text" id="add-student-id-input" class="form-control" placeholder="Enter Student ID to add...">
             <button class="btn btn-primary" onclick="assignStudentToSection(${sectionId})">Add Student</button>
        </div>
        <div class="card border-0 shadow-sm">
            <table class="table table-hover mb-0">
                <thead><tr><th>Student Name</th><th>ID</th><th>Action</th></tr></thead>
                <tbody id="section-roster-body"><tr><td colspan="3" class="text-center">Loading...</td></tr></tbody>
            </table>
        </div>
    `;

    refreshSectionRosterList(sectionId);
}

function refreshSectionRosterList(sectionId) {
    const tbody = document.getElementById('section-roster-body');
    if (!tbody) return;

    // Filter students locally using the updated backend data (which now includes Section ID in teacher overview)
    // Note: appState.allStudents keys might vary based on capitalized Roster keys vs raw keys.
    // The TeacherOverview returns "Section ID" (capped).
    // Let's check keys available.

    if (!appState.allStudents || appState.allStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No student data loaded. Please visit Dashboard first.</td></tr>';
        return;
    }

    const students = appState.allStudents.filter(s => {
        // Handle various key formats just in case
        const sSecId = s["Section ID"] || s.section_id;
        return sSecId == sectionId;
    });

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No students assigned to this section yet.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(s => {
        const name = s.Name || s.name;
        const id = s.ID || s.id;
        return `
            <tr>
                <td>${name}</td>
                <td><span class="font-monospace small bg-light px-2 border rounded">${id}</span></td>
                <td>
                    <button class="btn btn-sm text-danger" onclick="removeStudentFromSection('${id}')" title="Remove (Unassign)">
                        <span class="material-icons" style="font-size:18px;">remove_circle_outline</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function assignStudentToSection(sectionId) {
    const sid = document.getElementById('add-student-id-input').value.trim();
    if (!sid) return;

    try {
        const res = await fetchAPI(`/students/${sid}/assign-section?section_id=${sectionId}`, { method: 'POST' });
        if (res.ok) {
            alert("Assigned successfully!");
            document.getElementById('add-student-id-input').value = '';

            // Re-fetch global students to update the "Section ID" listing
            // This is heavy but necessary to see the change reflect in the list immediately without page reload
            const overviewRes = await fetchAPI('/teacher/overview');
            if (overviewRes.ok) {
                const data = await overviewRes.json();
                appState.allStudents = data.roster || [];
            }
            refreshSectionRosterList(sectionId);
        } else {
            const err = await res.json();
            alert("Failed: " + (err.detail || "Student not found"));
        }
    } catch (e) { alert("Network Error"); }
}

async function removeStudentFromSection(studentId) {
    if (!confirm("Remove student from this section?")) return;
    // To 'remove', we can just assign to a null section or specific endpoint?
    // Using assign-0 or similar trick if backend supports it, or I need to add that logic.
    // For now, let's just warn it's not implemented or implement a quick unassign.
    // Actually, assign-section takes section_id. If I pass 0 or filtered out, backend might choke.
    // Let's skip 'remove' for this turn or just alert.
    alert("To remove, please assign the student to another section.");
}


// 3, 4, 5. COMMON SEARCH MODULE (Guardians, Health, Docs)
function renderStudentSearchForModule(container, moduleName) {
    container.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-md-6 text-center">
                <h5 class="fw-bold mb-3">Find Student</h5>
                <div class="position-relative">
                    <input type="text" class="form-control form-control-lg rounded-pill shadow-sm ps-5" 
                           placeholder="Search by Name or ID..." onkeyup="handleStudentSearch(this, '${moduleName}')">
                    <span class="material-icons position-absolute top-50 start-0 translate-middle-y ms-3 text-muted">search</span>
                </div>
                <div id="student-search-results-${moduleName}" class="list-group mt-3 text-start shadow-sm" style="max-height: 300px; overflow-y: auto;"></div>
            </div>
            <div class="col-12 mt-5 d-none" id="module-detail-view-${moduleName}">
                <!-- Data goes here -->
            </div>
        </div>
    `;
}

function handleStudentSearch(input, moduleName) {
    const term = input.value.toLowerCase();
    const resultsDiv = document.getElementById(`student-search-results-${moduleName}`);
    resultsDiv.innerHTML = '';

    if (term.length < 2) return;

    const matches = appState.allStudents.filter(s => s.name.toLowerCase().includes(term) || s.id.toLowerCase().includes(term));

    matches.slice(0, 10).forEach(s => {
        const item = document.createElement('button');
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        item.innerHTML = `<div><strong>${s.name}</strong> <small class="text-muted">(${s.id})</small></div> <span class="material-icons fs-6">arrow_forward</span>`;
        item.onclick = () => loadModuleDataForStudent(moduleName, s);
        resultsDiv.appendChild(item);
    });
}

async function loadModuleDataForStudent(moduleName, student) {
    // Hide search, show detail
    document.getElementById(`student-search-results-${moduleName}`).innerHTML = ''; // clear results
    const view = document.getElementById(`module-detail-view-${moduleName}`);
    view.classList.remove('d-none');

    if (moduleName === 'guardians') {
        renderGuardianView(view, student);
    } else if (moduleName === 'health') {
        renderHealthView(view, student);
    } else if (moduleName === 'documents') {
        renderDocumentsView(view, student);
    }
}

// GUARDIANS VIEW
async function renderGuardianView(container, student) {
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold">Guardians for: <span class="text-primary">${student.name}</span></h5>
            <button class="btn btn-sm btn-outline-primary" onclick="openAddGuardianModal('${student.id}')">
                <span class="material-icons align-middle">add</span> Add Guardian
            </button>
        </div>
        <div id="guardian-list-container">Loading...</div>
    `;

    try {
        const res = await fetchAPI(`/students/${student.id}/guardians`);
        const guardians = await res.json();

        if (guardians.length === 0) {
            document.getElementById('guardian-list-container').innerHTML = '<p class="text-muted">No guardians listed.</p>';
            return;
        }

        let html = '<div class="row g-3">';
        guardians.forEach(g => {
            html += `
                <div class="col-md-6">
                    <div class="card p-3 h-100 border shadow-sm">
                        <div class="d-flex justify-content-between">
                            <h6 class="fw-bold">${g.name} <span class="badge bg-light text-dark border ms-2">${g.relationship}</span></h6>
                            ${g.is_emergency_contact ? '<span class="badge bg-danger">Emergency</span>' : ''}
                        </div>
                        <ul class="list-unstyled small mt-2 mb-0">
                            <li class="mb-1"><span class="material-icons align-middle fs-6 me-1 opacity-50">phone</span> ${g.phone}</li>
                            <li class="mb-1"><span class="material-icons align-middle fs-6 me-1 opacity-50">email</span> ${g.email || '--'}</li>
                            <li><span class="material-icons align-middle fs-6 me-1 opacity-50">home</span> ${g.address || '--'}</li>
                        </ul>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        document.getElementById('guardian-list-container').innerHTML = html;

    } catch (e) { container.innerHTML = 'Error loading guardians.'; }
}

async function openAddGuardianModal(studentId) {
    const name = prompt("Guardian Name:");
    if (!name) return;
    const rel = prompt("Relationship (Father, Mother, etc):");
    const phone = prompt("Phone:");

    try {
        await fetchAPI(`/students/${studentId}/guardians`, {
            method: 'POST',
            body: JSON.stringify({ name, relationship: rel, phone, is_emergency_contact: true })
        });
        alert("Added!");
    } catch (e) { alert("Error"); }
}

// HEALTH VIEW
async function renderHealthView(container, student) {
    container.innerHTML = '<div class="spinner-border text-primary"></div> Loading Health Record...';
    try {
        const res = await fetchAPI(`/students/${student.id}/health`);
        // returns null or object
        const record = res.ok ? await res.json() : null;

        const data = record || {};

        container.innerHTML = `
            <div class="card border-0 shadow-sm p-4">
                <h5 class="fw-bold mb-4 border-bottom pb-2">Medical Profile: ${student.name}</h5>
                <div class="row g-3">
                    <div class="col-md-3">
                        <label class="form-label small fw-bold text-muted">Blood Group</label>
                        <input type="text" class="form-control" id="h-blood" value="${data.blood_group || ''}">
                    </div>
                    <div class="col-md-9">
                        <label class="form-label small fw-bold text-muted">Allergies</label>
                        <input type="text" class="form-control" id="h-allergies" value="${data.allergies || ''}">
                    </div>
                    <div class="col-md-12">
                        <label class="form-label small fw-bold text-muted">Medical Conditions</label>
                        <textarea class="form-control" id="h-conditions">${data.medical_conditions || ''}</textarea>
                    </div>
                    <div class="col-md-12">
                         <label class="form-label small fw-bold text-muted">Medications</label>
                        <textarea class="form-control" id="h-medications">${data.medications || ''}</textarea>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted">Emergency Contact Name</label>
                        <input type="text" class="form-control" id="h-em-name" value="${data.emergency_contact_name || ''}">
                    </div>
                     <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted">Emergency Phone</label>
                        <input type="text" class="form-control" id="h-em-phone" value="${data.emergency_contact_phone || ''}">
                    </div>
                </div>
                <div class="mt-4 text-end">
                    <button class="btn btn-primary" onclick="saveHealthRecord('${student.id}')">Save Records</button>
                </div>
            </div>
         `;
    } catch (e) { container.innerHTML = 'Error.'; }
}

async function saveHealthRecord(studentId) {
    const data = {
        blood_group: document.getElementById('h-blood').value,
        allergies: document.getElementById('h-allergies').value,
        medical_conditions: document.getElementById('h-conditions').value,
        medications: document.getElementById('h-medications').value,
        emergency_contact_name: document.getElementById('h-em-name').value,
        emergency_contact_phone: document.getElementById('h-em-phone').value
    };

    await fetchAPI(`/students/${studentId}/health`, { method: 'PUT', body: JSON.stringify(data) });
    alert("Saved.");
}

// DOCUMENTS VIEW
async function renderDocumentsView(container, student) {
    container.innerHTML = `
        <h5 class="fw-bold mb-3">Documents: ${student.name}</h5>
        
        <div class="card mb-4 p-3 bg-light border-dashed">
             <div class="d-flex align-items-center gap-3">
                <input type="file" class="form-control" id="doc-upload-input">
                <select class="form-select" id="doc-type-select" style="max-width: 150px;">
                    <option value="ID">ID Card</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Report Card">Report Card</option>
                    <option value="Other">Other</option>
                </select>
                <button class="btn btn-dark" onclick="uploadDocument('${student.id}')">Upload</button>
             </div>
        </div>
        
        <div id="docs-list" class="list-group">Loading...</div>
     `;

    refreshDocsList(student.id);
}

async function refreshDocsList(studentId) {
    try {
        const res = await fetchAPI(`/students/${studentId}/documents`);
        const docs = await res.json();
        const list = document.getElementById('docs-list');
        list.innerHTML = '';

        if (docs.length === 0) { list.innerHTML = '<div class="text-muted text-center">No documents found.</div>'; return; }

        docs.forEach(d => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <span class="material-icons text-primary">description</span>
                    <div>
                        <strong>${d.document_name}</strong>
                        <div class="small text-muted">${d.document_type} • ${d.upload_date.split('T')[0]}</div>
                    </div>
                </div>
                <button class="btn btn-sm text-danger" onclick="deleteDocument(${d.id})"><span class="material-icons">delete</span></button>
            `;
            list.appendChild(item);
        });
    } catch (e) { }
}

async function uploadDocument(studentId) {
    const fileInput = document.getElementById('doc-upload-input');
    if (!fileInput.files[0]) return alert("Select file");

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("document_type", document.getElementById('doc-type-select').value);

    // Custom fetch for FormData
    await fetch(`${API_BASE_URL}/students/${studentId}/documents`, {
        method: 'POST',
        headers: {
            'X-User-Id': appState.userId,
            'X-User-Role': appState.role
        },
        body: formData
    });

    alert("Uploaded");
    refreshDocsList(studentId);
}

async function deleteDocument(docId) {
    if (!confirm("Delete?")) return;
    await fetchAPI(`/documents/${docId}`, { method: 'DELETE' });
    alert("Deleted");
}


// --- RESOURCE MANAGEMENT ---
async function loadResources(category = 'All') {
    const container = document.getElementById('resources-list-container');
    container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

    try {
        let url = `/resources`;
        if (category && category !== 'All') {
            url += `?category=${category}`;
        }
        if (appState.schoolId) {
            url += (url.includes('?') ? '&' : '?') + `school_id=${appState.schoolId}`;
        }

        const response = await fetchAPI(url);
        if (!response.ok) throw new Error("Failed to fetch resources");
        const resources = await response.json();
        renderResources(resources);
    } catch (error) {
        console.error("Error loading resources:", error);
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                 <div class="mb-3"><span class="material-icons fs-1 text-muted opacity-50">cloud_off</span></div>
                 <h5 class="text-muted">Unable to load resources</h5>
                 <p class="small text-secondary">Please check your connection or contact the administrator.</p>
            </div>`;
    }
}

function renderResources(resources) {
    const container = document.getElementById('resources-list-container');
    container.innerHTML = '';

    if (!resources || resources.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted">No resources found.</div>';
        return;
    }

    resources.forEach(res => {
        const isPolicy = res.category === 'Policy';
        const isSchedule = res.category === 'Schedule';
        const isForm = res.category === 'Form';

        let icon = 'description';
        let colorClass = 'text-primary';
        let bgClass = 'bg-primary';

        // Check file extension
        const fileExt = res.file_path ? res.file_path.split('.').pop().toLowerCase() : '';

        if (fileExt === 'pdf') { icon = 'picture_as_pdf'; colorClass = 'text-danger'; bgClass = 'bg-danger'; }
        else if (['doc', 'docx'].includes(fileExt)) { icon = 'article'; colorClass = 'text-primary'; bgClass = 'bg-primary'; }
        else if (['xls', 'xlsx'].includes(fileExt)) { icon = 'table_chart'; colorClass = 'text-success'; bgClass = 'bg-success'; }
        else if (isSchedule) { icon = 'calendar_today'; colorClass = 'text-warning'; bgClass = 'bg-warning'; }
        else if (isPolicy) { icon = 'gavel'; colorClass = 'text-danger'; bgClass = 'bg-danger'; }
        else if (isForm) { icon = 'assignment'; colorClass = 'text-success'; bgClass = 'bg-success'; }

        // Mock download/view action
        // Construct Full URL
        // API_BASE_URL usually ends with /api. We need the root for static files.
        const backendRoot = API_BASE_URL.replace('/api', '');
        const fullUrl = res.file_path.startsWith('http') ? res.file_path : `${backendRoot}${res.file_path}`;

        // View Action (Modal or New Tab)
        const viewAction = `onclick="viewResource('${fullUrl}', '${res.title}', '${fileExt}')"`;

        // Buttons
        const actionBtn = `<button ${viewAction} class="btn btn-sm btn-light border fw-medium d-flex align-items-center gap-1 px-3"><span class="material-icons fs-6">visibility</span> View</button>`;

        let deleteBtn = '';
        if (appState.role === 'Tenant_Admin' || appState.role === 'Principal' || appState.isSuperAdmin) {
            deleteBtn = `<button class="btn btn-sm btn-light border text-danger d-flex align-items-center justify-content-center px-2" onclick="deleteResource(${res.id})" title="Delete"><span class="material-icons fs-6">delete</span></button>`;
        }

        const html = `
            <div class="col-md-6 col-lg-4 col-xl-3">
                <div class="card h-100 border-0 shadow-sm hover-up transition-hover glass-card-solid">
                    <div class="card-body p-4 d-flex flex-column">
                        <!-- Header -->
                        <div class="d-flex align-items-start justify-content-between mb-3">
                            <div class="rounded-circle d-flex align-items-center justify-content-center ${bgClass} bg-opacity-10" style="width:48px; height:48px;">
                                <span class="material-icons ${colorClass} fs-5">${icon}</span>
                            </div>
                            <span class="badge bg-white text-secondary border rounded-pill px-2 py-1" style="font-weight:500; font-size:11px;">${res.category}</span>
                        </div>
                        
                        <!-- Content -->
                        <h6 class="fw-bold mb-2 text-dark text-truncate-2" title="${res.title}" style="line-height:1.4;">${res.title}</h6>
                        <p class="text-muted small mb-4 flex-grow-1 clamp-3" style="font-size: 13px;">${res.description || 'No description available.'}</p>
                        
                        <!-- Footer -->
                        <div class="d-flex align-items-end justify-content-between pt-3 border-top mt-auto">
                             <div class="d-flex flex-column">
                                <small class="text-uppercase text-muted" style="font-size:10px; font-weight:700; letter-spacing:0.5px;">Uploaded</small>
                                <small class="text-dark fw-medium" style="font-size:12px;">${new Date(res.uploaded_at).toLocaleDateString()}</small>
                             </div>
                             <div class="d-flex gap-2">
                                ${actionBtn}
                                ${deleteBtn}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

async function viewResource(url, title, ext) {
    // Show loading toast if available
    if (typeof showToast === 'function') showToast("Opening preview...", "info");

    // Check if file is accessible via HEAD request to prevent 404 inside modal
    try {
        const check = await fetch(url, { method: 'HEAD' });
        if (!check.ok) {
            throw new Error("File not found");
        }
    } catch (e) {
        console.error("Resource not found:", e);
        if (typeof showToast === 'function') showToast("Error: File not found on server.", "error");
        else alert("Error: File not found on server. Please ask admin to re-upload.");
        return;
    }

    if (ext === 'pdf' || ext === 'txt' || ['jpg', 'jpeg', 'png'].includes(ext)) {
        // Use Modal for valid types
        let modalHtml = '';
        if (ext === 'pdf') {
            modalHtml = `<iframe src="${url}" width="100%" height="600px" style="border:none;" title="${title}"></iframe>`;
        } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
            modalHtml = `<img src="${url}" class="img-fluid" alt="${title}">`;
        } else {
            modalHtml = `<iframe src="${url}" width="100%" height="600px" style="border:none; background:white;" title="${title}"></iframe>`;
        }

        // Inject modal if not exists (or update existing)
        let modalEl = document.getElementById('resourcePreviewModal');
        if (!modalEl) {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal fade" id="resourcePreviewModal" tabindex="-1" aria-hidden="true" style="z-index: 1060;">
                    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content border-0 shadow-lg" style="height: 90vh;">
                            <div class="modal-header border-bottom-0">
                                <h5 class="modal-title fw-bold text-truncate" id="previewTitle">Preview</h5>
                                <div class="d-flex gap-2">
                                     <a href="#" id="previewDownloadBtn" target="_blank" class="btn btn-sm btn-primary rounded-pill px-3 d-flex align-items-center gap-1">
                                        <span class="material-icons fs-6">download</span> Download
                                     </a>
                                     <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                            </div>
                            <div class="modal-body p-0 bg-light d-flex align-items-center justify-content-center" id="previewBody">
                                <!-- Content -->
                            </div>
                        </div>
                    </div>
                </div>
            `);
            modalEl = document.getElementById('resourcePreviewModal');
        }

        document.getElementById('previewTitle').textContent = title;
        document.getElementById('previewBody').innerHTML = modalHtml;
        document.getElementById('previewDownloadBtn').href = url;

        document.getElementById('previewDownloadBtn').href = url;

        new bootstrap.Modal(modalEl).show();
    } else {
        // Fallback for docs/others
        window.open(url, '_blank');
    }
}

function filterResources(category, btnElement) {
    if (btnElement) {
        // Update active state
        const buttons = btnElement.parentElement.querySelectorAll('.btn');
        buttons.forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }
    loadResources(category);
}

// Redirect to VIEW instead of Modal
function openUploadResourceModal() {
    switchView('upload-resource-view');
    document.getElementById('upload-resource-form-view').reset();
    document.getElementById('file-name-display').classList.add('d-none');
}

// Handle Form Submit from VIEW
async function handleUploadResourceView(e) {
    e.preventDefault();
    const title = document.getElementById('res-title-view').value;
    const category = document.getElementById('res-category-view').value;
    const desc = document.getElementById('res-desc-view').value;
    const fileInput = document.getElementById('res-file-view');

    if (!title || !fileInput.files[0]) {
        alert("Title and File are required.");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("description", desc);
    formData.append("file", fileInput.files[0]);
    formData.append("school_id", appState.schoolId || 1);

    try {
        // Show loading state
        const btn = e.submitter;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

        const response = await fetch(`${API_BASE_URL}/resources`, {
            method: 'POST',
            headers: {
                'X-User-Id': appState.userId || '',
            },
            body: formData
        });

        if (!response.ok) throw await response.text();

        // Success
        switchView('resources-view');
        loadResources(document.querySelector('#resources-view .btn.active')?.innerText || 'All');
        if (typeof showToast === 'function') showToast("Resource uploaded successfully!", "success");

    } catch (error) {
        console.error("Upload Error:", error);
        alert("Upload Failed: " + (typeof error === 'string' ? error : error.message));
    } finally {
        const btn = e.submitter;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Keep legacy just in case
async function handleUploadResource() {
    const title = document.getElementById('res-title').value;
    const category = document.getElementById('res-category').value;
    const desc = document.getElementById('res-desc').value;
    const fileInput = document.getElementById('res-file');

    if (!title || !fileInput.files[0]) {
        alert("Title and File are required.");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("description", desc);
    formData.append("file", fileInput.files[0]);
    formData.append("school_id", appState.schoolId || 1);

    try {
        // Upload via standard fetch since fetchAPI sets Content-Type to JSON
        const response = await fetch(`${API_BASE_URL}/resources`, {
            method: 'POST',
            headers: {
                'X-User-Id': appState.userId || '',
                // Content-Type is auto-set with boundary for FormData
            },
            body: formData
        });

        if (!response.ok) throw await response.text();

        const modalEl = document.getElementById('uploadResourceModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        loadResources(document.querySelector('#resources-view .btn.active')?.innerText || 'All');
        // Simple toast mock if not exists
        if (typeof showToast === 'function') showToast("Resource uploaded successfully!", "success");
        else alert("Resource uploaded!");
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast("Failed to upload resource.", "error");
        else alert("Failed to upload resource.");
    }
}

async function deleteResource(id) {
    if (!confirm("Are you sure you want to delete this resource?")) return;

    try {
        await fetchAPI(`/resources/${id}`, { method: 'DELETE' });
        loadResources(); // Refresh
        if (typeof showToast === 'function') showToast("Resource deleted.", "success");
        else alert("Resource deleted.");
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast("Failed to delete resource.", "error");
        else alert("Failed to delete resource.");
    }
}



// --- SIDEBAR CHATBOT LOGIC (NEW) ---

function toggleSidebarChat() {
    const sidebar = document.getElementById('ai-sidebar');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    } else {
        sidebar.classList.add('open');
        // Focus input
        setTimeout(() => {
            const el = document.getElementById('sidebar-chat-input');
            if (el) el.focus();
        }, 100);
    }
}

function handleSidebarEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendSidebarMessage();
    }
}

async function sendSidebarMessage() {
    const input = document.getElementById('sidebar-chat-input');
    const message = input.value.trim();
    const fileInput = document.getElementById('chat-file-input');
    const file = fileInput && fileInput.files[0];

    if (!message && !file) return;

    // Clear and Append User Message
    input.value = '';

    let userMsgDisplay = message;
    if (file) {
        userMsgDisplay += `<br><small class="text-muted"><span class="material-icons fs-6 align-middle">attach_file</span> ${file.name}</small>`;
    }
    appendSidebarMessage('user', userMsgDisplay);

    // Clear File Input
    if (fileInput) {
        fileInput.value = '';
        clearChatFile();
    }

    // Show Typing Indicator
    const typingId = appendSidebarMessage('ai', '...', true);

    try {
        const studentId = appState.userId || 'guest';
        let response;

        if (file) {
            // File Upload Flow
            const formData = new FormData();
            formData.append('prompt', message || "Analyze this file");
            formData.append('file', file);

            // Note: fetchAPI adds Content-Type: json by default if not FormData... 
            // but we need to ensure fetchAPI logic handles FormData correctly (it usually shouldn't set Content-Type header manually for FormData)
            // My fetchAPI wrapper sets Content-Type: application/json by default. I need to override it.

            response = await fetch(`${API_BASE_URL}/ai/chat_with_file/${studentId}`, {
                method: 'POST',
                headers: {
                    'X-User-Id': appState.userId || '',
                    'X-User-Role': appState.role || ''
                },
                body: formData
            });

        } else {
            // Text Only Flow
            response = await fetchAPI(`/ai/chat/${studentId}`, {
                method: 'POST',
                body: JSON.stringify({ prompt: message })
            });
        }

        const data = await response.json();

        // Remove Typing Indicator
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        // Append AI Response
        if (data.reply) {
            appendSidebarMessage('ai', data.reply);
        } else {
            appendSidebarMessage('ai', "I'm having trouble thinking right now.");
        }

    } catch (error) {
        console.error(error);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        appendSidebarMessage('ai', "Connection error. Please try again.");
    }
}

function handleChatFileSelect(input) {
    const preview = document.getElementById('chat-file-preview');
    const nameSpan = document.getElementById('chat-file-name');
    if (input.files && input.files[0]) {
        preview.style.display = 'block';
        nameSpan.innerText = input.files[0].name;
    } else {
        clearChatFile();
    }
}

function clearChatFile() {
    const input = document.getElementById('chat-file-input');
    const preview = document.getElementById('chat-file-preview');
    if (input) input.value = '';
    if (preview) preview.style.display = 'none';
}

function appendSidebarMessage(sender, text, isTyping = false) {
    const chatBody = document.getElementById('sidebar-chat-body');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;

    if (isTyping) {
        msgDiv.id = `typing-${Date.now()}`;
        msgDiv.innerHTML = '<span class="material-icons fw-bold fs-6 anim-icon">more_horiz</span>';
    } else {
        // Use Marked.js if available, else plain text
        if (sender === 'ai' && typeof marked !== 'undefined') {
            msgDiv.innerHTML = marked.parse(text);
        } else {
            msgDiv.innerText = text;
        }
    }

    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msgDiv.id;
}

// --- MOODLE INTEGRATION ---
// --- ENGAGEMENT HELPER LOGIC ---
function updateEngagementFileName() {
    const input = document.getElementById('engagement-pdf-input');
    const display = document.getElementById('engagement-filename');
    if (input.files && input.files[0]) {
        display.textContent = `Selected: ${input.files[0].name}`;
        display.classList.remove('d-none');
    } else {
        display.classList.add('d-none');
    }
}

async function analyzeEngagementDocs() {
    const input = document.getElementById('engagement-pdf-input');
    if (!input.files || !input.files[0]) {
        alert("Please select a PDF file first.");
        return;
    }

    // Switch tabs
    // Switch tabs
    const resultsTabBtn = document.getElementById('engagement-results-tab');
    resultsTabBtn.disabled = false;
    const tab = new bootstrap.Tab(resultsTabBtn);
    tab.show();

    // Show Loader
    document.getElementById('engagement-loader').classList.remove('d-none');
    document.getElementById('engagement-content').classList.add('d-none');

    // Upload
    const formData = new FormData();
    formData.append("file", input.files[0]);

    try {
        const response = await fetch(`${API_BASE_URL}/ai/analyze-engagement`, {
            method: 'POST',
            headers: {
                'X-User-Id': appState.userId || '',
                'X-User-Role': appState.role || ''
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Analysis failed");
        }

        const data = await response.json();
        renderEngagementResults(data);

    } catch (e) {
        console.error(e);
        document.getElementById('engagement-loader').classList.add('d-none');
        document.getElementById('engagement-content').classList.remove('d-none');
        document.getElementById('engagement-content').innerHTML = `
            <div class="alert alert-danger">
                <h5 class="fw-bold">Error</h5>
                <p>${e.message}</p>
                <button class="btn btn-sm btn-outline-danger" onclick="analyzeEngagementDocs()">Try Again</button>
            </div>
        `;
    }
}

function renderEngagementResults(data) {
    const loader = document.getElementById('engagement-loader');
    const content = document.getElementById('engagement-content');

    loader.classList.add('d-none');
    content.classList.remove('d-none');

    if (!data.is_educational) {
        content.innerHTML = `
            <div class="text-center py-5">
                <span class="material-icons text-warning" style="font-size: 64px;">warning_amber</span>
                <h4 class="fw-bold mt-3">Not an Educational Document?</h4>
                <p class="text-muted px-5 mb-4">Our AI analyzed this document and it doesn't seem to be related to educational content.</p>
                <div class="p-3 bg-light rounded text-start mx-auto" style="max-width: 500px;">
                    <strong>Reasoning:</strong>
                    <p class="mb-0 text-secondary">${data.message || "Content appears to be unrelated to classroom topics."}</p>
                </div>
                 <button class="btn btn-primary mt-4" onclick="document.getElementById('upload-tab').click()">Try Another File</button>
            </div>
        `;
        return;
    }

    // Build Lists
    const buildList = (items, icon) => {
        if (!items || items.length === 0) return '<p class="text-muted fst-italic">No suggestions generated.</p>';
        return items.map(i => `
            <div class="d-flex gap-3 mb-3 p-3 rounded bg-white shadow-sm border element-hover">
                <span class="material-icons text-primary">${icon}</span>
                <div>${i}</div>
            </div>
        `).join('');
    };

    content.innerHTML = `
        <div class="alert alert-success d-flex align-items-center gap-3">
             <span class="material-icons">check_circle</span>
             <div>
                <strong>Content Verified: Educational</strong>
                <div class="small">${data.summary || ""}</div>
             </div>
        </div>
        
        <div class="row g-4">
            <!-- Activities -->
            <div class="col-md-6">
                <h6 class="fw-bold text-uppercase text-secondary mb-3 small ls-1">Interactive Activities</h6>
                ${buildList(data.activities, 'groups')}
            </div>
             <!-- Examples -->
            <div class="col-md-6">
                <h6 class="fw-bold text-uppercase text-secondary mb-3 small ls-1">Real-Life Examples</h6>
                ${buildList(data.real_life_examples, 'public')}
            </div>
             <!-- Discussion -->
            <div class="col-md-6">
                <h6 class="fw-bold text-uppercase text-secondary mb-3 small ls-1">Discussion Questions</h6>
                ${buildList(data.discussion_questions, 'question_answer')}
            </div>
             <!-- Games -->
            <div class="col-md-6">
                <h6 class="fw-bold text-uppercase text-secondary mb-3 small ls-1">Gamification Ideas</h6>
                ${buildList(data.games, 'sports_esports')}
            </div>
        </div>
        
        <div class="mt-4 text-center">
             <button class="btn btn-outline-primary rounded-pill me-2" onclick="window.print()">
                <span class="material-icons align-middle">print</span> Print
             </button>
             <button class="btn btn-dark rounded-pill" onclick="document.getElementById('upload-tab').click()">
                Analyze Another
             </button>
        </div>
    `;
}


