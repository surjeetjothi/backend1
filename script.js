// --- CONFIGURATION ---
const API_BASE_URL = window.location.origin.includes('http://127.0.0.1') || window.location.origin.includes('localhost')
    ? 'http://127.0.0.1:8000/api'
    : 'https://backend1-bzh1.onrender.com/api';

// Check if running from file:// which breaks OAuth
if (window.location.protocol === 'file:') {
    console.warn("Google Sign-In requires running on a server (http://127.0.0.1:8000) to work.");
}

// --- MSAL CONFIGURATION (MICROSOFT) ---
// --- MSAL CONFIGURATION (MICROSOFT) ---
const msalConfig = {
    auth: {
        clientId: "YOUR_MICROSOFT_CLIENT_ID", // PLACEHOLDER: User must replace this!
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin // Dynamic: works on Localhost AND Render
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
    chatMessages: {}
};

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
    addActivityModal: new bootstrap.Modal(document.getElementById('addActivityModal')),
    scheduleClassModal: new bootstrap.Modal(document.getElementById('scheduleClassModal')),
    createGroupModal: new bootstrap.Modal(document.getElementById('createGroupModal')),
    manageMembersModal: new bootstrap.Modal(document.getElementById('manageMembersModal')),
    aboutPortalModal: new bootstrap.Modal(document.getElementById('aboutPortalModal')),
    deleteConfirmationModal: new bootstrap.Modal(document.getElementById('deleteConfirmationModal')),

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

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function renderMetric(container, label, value, colorClass = '') {
    const col = document.createElement('div');
    col.className = 'col-md-3 col-sm-6';
    col.innerHTML = `
            <div class="card h-100 metric-card ${colorClass} border-0 shadow-sm">
                <div class="card-body">
                    <p class="text-uppercase text-muted fw-bold small mb-2">${label}</p>
                    <p class="h2 fw-bold text-dark mb-0">${value}</p>
                </div>
            </div>
        `;
    container.appendChild(col);
}

async function fetchAPI(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };

    // Inject RBAC Headers if logged in
    if (appState.isLoggedIn && appState.role && appState.userId) {
        headers['X-User-Role'] = appState.role;
        headers['X-User-Id'] = appState.userId;
    }

    // Merge user-supplied headers if any
    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const finalOptions = { ...options, headers: headers, signal: controller.signal };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, finalOptions);
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        console.error("Fetch API Error:", error);
        if (error.name === 'AbortError') {
            throw new Error("Request timed out. Server is slow.");
        }
        throw new Error("Network connection failed. Is the server running?");
    }
}

// --- EDIT STUDENT LOGIC ---

function openEditStudentModal(studentId) {
    const student = appState.allStudents.find(s => s.id === studentId);
    if (!student) {
        alert("Student data not found!");
        return;
    }

    document.getElementById('edit-id').value = student.id;
    document.getElementById('edit-id-display').textContent = student.id;
    document.getElementById('edit-name').value = student.name || '';
    document.getElementById('edit-password').value = ''; // Clear previous password input
    document.getElementById('edit-grade').value = student.grade || 9;
    document.getElementById('edit-subject').value = student.preferred_subject || 'General';
    document.getElementById('edit-lang').value = student.home_language || 'English';
    document.getElementById('edit-attendance').value = student.attendance_rate || 0;

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

// --- VIEW NAVIGATION (Modified for Auth) ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    // Handle Sidebar Visibility
    const body = document.body;
    if (viewId === 'login-view' || viewId === 'register-view' || viewId === 'two-factor-view') {
        body.classList.add('login-mode');
    } else {
        body.classList.remove('login-mode');
    }
}

function showRegister(e) {
    e.preventDefault();
    switchView('register-view');
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
        invitation_token: inviteInput // FR-4
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
            msg.innerHTML = `${data.message} <br> <a href="${data.dev_link}" class="fw-bold text-success">Click here to reset (DEV)</a>`;
            msg.className = 'text-center small mb-2 text-success';
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
    const msg = document.getElementById('new-reset-message');

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

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const msgEl = elements.loginMessage;

    if (!username || !password) {
        msgEl.textContent = "Please enter both username and password.";
        msgEl.className = 'text-danger fw-bold';
        return;
    }

    msgEl.textContent = "Checking credentials...";
    msgEl.className = 'text-primary fw-medium';

    try {
        const response = await fetchAPI('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
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
                    'S001': '519384',
                    'S002': '123456',
                    'SURJEET': '192837',
                    'DEVA': '112233',
                    'HARISH': '998877'
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

            // SUCCESSFUL LOGIN
            appState.isLoggedIn = true;
            document.body.classList.remove('login-mode');
            appState.role = data.role;
            appState.userId = data.user_id;
            appState.activeStudentId = (data.role === 'Parent' || data.role === 'Student') ? data.user_id : null;

            msgEl.textContent = `Welcome, ${data.user_id}`;
            msgEl.className = 'text-success fw-bold';

            setTimeout(() => {
                msgEl.textContent = '';
                initializeDashboard();
            }, 500);

        } else {
            // ERROR HANDLING
            const err = await response.json().catch(() => ({ detail: "Login failed" }));
            msgEl.textContent = err.detail || 'Login failed';
            msgEl.className = 'text-danger fw-bold';
        }
    } catch (error) {
        msgEl.textContent = `Network Error: ${error.message}. Is the backend running?`;
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

    try {
        const response = await fetchAPI('/auth/verify-2fa', {
            method: 'POST',
            body: JSON.stringify({
                user_id: appState.tempUserId,
                code: code
            })
        });

        if (response.ok) {
            const data = await response.json();

            // Success!
            appState.isLoggedIn = true;
            document.body.classList.remove('login-mode');
            appState.role = data.role;
            appState.userId = data.user_id; // confirmed ID
            appState.activeStudentId = (data.role === 'Parent' || data.role === 'Student') ? data.user_id : null;

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
            const err = await response.json();
            msgEl.textContent = err.detail || "Verification failed.";
            msgEl.className = "text-danger fw-bold";
        }
    } catch (e) {
        console.error(e);
        msgEl.textContent = "Network error.";
        msgEl.className = "text-danger fw-bold";
    }
}


// --- SOCIAL LOGIN (FR-2 REAL GOOGLE + SIMULATED MICROSOFT) ---

// CALLBACK FOR REAL GOOGLE SIGN-IN
async function handleCredentialResponse(response) {
    elements.loginMessage.textContent = "Verifying Google Token...";
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
            appState.activeStudentId = (data.role === 'Parent' || data.role === 'Student') ? data.user_id : null;

            elements.loginMessage.textContent = `Welcome, ${data.user_id}`;
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
            elements.loginMessage.textContent = errorMsg;
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
                elements.loginMessage.textContent = "Connecting to Microsoft...";
                elements.loginMessage.className = 'text-primary fw-bold';

                const loginRequest = {
                    scopes: ["User.Read"]
                };

                const loginResponse = await msalInstance.loginPopup(loginRequest);

                elements.loginMessage.textContent = "Verifying Microsoft Token...";

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
                    appState.activeStudentId = (data.role === 'Parent' || data.role === 'Student') ? data.user_id : null;
                    elements.loginMessage.textContent = `Success! Welcome, ${data.user_id}`;
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
            appState.activeStudentId = (data.role === 'Parent' || data.role === 'Student') ? data.user_id : null;
            elements.loginMessage.textContent = `Success! Welcome, ${data.user_id}`;
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
    elements.authStatus.innerHTML = `
            <strong>Role:</strong> ${appState.role} <span class="mx-2">|</span> <strong>User:</strong> ${appState.userId}
        `;
    elements.loginMessage.textContent = '';

    await fetchStudents();

    if (appState.role === 'Teacher' || appState.role === 'Admin') {
        renderTeacherControls();
        renderTeacherDashboard();
    } else if ((appState.role === 'Parent' || appState.role === 'Student') && appState.activeStudentId) {
        switchView('student-view');
        loadStudentDashboard(appState.activeStudentId);
    }

    loadLiveClasses();
    checkClassStatus();
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

    Object.assign(appState, { isLoggedIn: false, role: null, userId: null, activeStudentId: null, chatMessages: {} });
    elements.authStatus.innerHTML = 'Login to continue...';
    elements.userControls.innerHTML = '<p class="text-muted small">Navigation controls will appear here.</p>';
    document.getElementById('invite-section').classList.add('d-none'); // Hide invite section
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';

    document.body.classList.add('login-mode');
    switchView('login-view');
    elements.loginMessage.textContent = 'Successfully logged out.';
    elements.loginMessage.className = 'text-success fw-bold';
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

    const options = appState.allStudents.map(s =>
        `<option value="${s.id}">${s.name} (${s.id})</option>`
    ).join('');
    selectElement.innerHTML = options;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('activity-date').value = today;
}

// --- CONTROLS RENDERING ---

function renderTeacherControls() {
    elements.userControls.innerHTML = '';

    // Show Invite Generator
    document.getElementById('invite-section').classList.remove('d-none');

    // View Selector
    const navDiv = document.createElement('div');
    navDiv.className = 'mb-3';
    navDiv.innerHTML = `
                <label class="form-label fw-bold small text-muted text-uppercase">Current View</label>
                <select id="view-select" class="form-select" onchange="handleTeacherViewToggle(this.value)">
                    <option value="teacher-view">Teacher Dashboard</option>
                    <option value="groups-view">Manage Groups</option>
                    <option value="student-view">Student Dashboard</option>
                </select>
            `;
    elements.userControls.appendChild(navDiv);

    // Student Selector Container
    const studentSelector = document.createElement('div');
    studentSelector.id = 'teacher-student-selector';
    studentSelector.style.display = 'none';
    studentSelector.className = 'mb-3 border-top pt-3';
    elements.userControls.appendChild(studentSelector);

    // Buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-grid gap-2';

    const addStudentBtn = document.createElement('button');
    addStudentBtn.innerHTML = '<span class="material-icons align-middle fs-6">add</span> Add New Student';
    addStudentBtn.className = 'btn btn-outline-primary fw-medium text-start';
    addStudentBtn.onclick = () => elements.addStudentModal.show();
    btnGroup.appendChild(addStudentBtn);

    const logActivityBtn = document.createElement('button');
    logActivityBtn.innerHTML = '<span class="material-icons align-middle fs-6">edit_note</span> Log Activity';
    logActivityBtn.className = 'btn btn-outline-warning text-dark fw-medium text-start';
    logActivityBtn.onclick = () => {
        populateStudentSelect(elements.activityStudentSelect);
        elements.addActivityModal.show();
    };
    btnGroup.appendChild(logActivityBtn);

    const aboutBtn = document.createElement('button');
    aboutBtn.innerHTML = '<span class="material-icons align-middle fs-6">info</span> About Portal';
    aboutBtn.className = 'btn btn-outline-info text-dark fw-medium text-start';
    aboutBtn.onclick = () => elements.aboutPortalModal.show();
    btnGroup.appendChild(aboutBtn);

    elements.userControls.appendChild(btnGroup);

    // Logout at bottom
    const logoutDiv = document.createElement('div');
    logoutDiv.className = 'mt-auto pt-4';
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout';
    logoutBtn.className = 'btn btn-danger w-100';
    logoutBtn.onclick = handleLogout;
    logoutDiv.appendChild(logoutBtn);

    elements.userControls.appendChild(logoutDiv);
}

function handleTeacherViewToggle(view) {
    const selectorDiv = document.getElementById('teacher-student-selector');
    if (view === 'teacher-view') {
        switchView('teacher-view');
        renderTeacherDashboard();
        selectorDiv.style.display = 'none';
    } else if (view === 'groups-view') {
        switchView('groups-view');
        loadGroups(); // New function
        selectorDiv.style.display = 'none';
    } else {
        switchView('student-view');
        renderStudentSelector(selectorDiv);
        selectorDiv.style.display = 'block';
    }
}

function renderStudentSelector(container) {
    container.innerHTML = `
            <label class="form-label fw-bold small text-muted text-uppercase">Select Student</label>
            <select id="student-select" class="form-select" onchange="loadStudentDashboard(this.value)">
                <option value="">-- Choose Student --</option>
                ${appState.allStudents.map(s =>
        `<option value="${s.id}" ${appState.activeStudentId === s.id ? 'selected' : ''}>${s.name} (G${s.grade})</option>`
    ).join('')}
            </select>
        `;

    const studentSelectElement = document.getElementById('student-select');
    if (appState.activeStudentId && studentSelectElement.querySelector(`option[value="${appState.activeStudentId}"]`)) {
        studentSelectElement.value = appState.activeStudentId;
        loadStudentDashboard(appState.activeStudentId);
    } else if (appState.allStudents.length > 0) {
        appState.activeStudentId = appState.allStudents[0].id;
        studentSelectElement.value = appState.activeStudentId;
        loadStudentDashboard(appState.activeStudentId);
    } else {
        elements.studentNameHeader.textContent = 'No students available. Add a student first.';
        elements.studentMetrics.innerHTML = '';
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
            elements.addStudentMessage.textContent = data.message;
            elements.addStudentMessage.className = 'text-success fw-bold';
            elements.addStudentForm.reset();
            await initializeDashboard();
        } else {
            elements.addStudentMessage.textContent = data.detail || 'Failed to add student.';
            elements.addStudentMessage.className = 'text-danger fw-bold';
        }
    } catch (error) {
        elements.addStudentMessage.textContent = error.message;
        elements.addStudentMessage.className = 'text-danger fw-bold';
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

        // Metrics
        elements.teacherMetrics.innerHTML = '';
        renderMetric(elements.teacherMetrics, "Total Students", data.total_students, 'border-primary');
        renderMetric(elements.teacherMetrics, "Class Attendance", `${data.class_attendance_avg}%`, 'border-success');
        renderMetric(elements.teacherMetrics, "Activity Score Avg", `${data.class_score_avg}%`, 'border-warning');
        renderMetric(elements.teacherMetrics, "Top Subject", 'Math (Sim)', 'border-info');

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

    const student = appState.allStudents.find(s => s.id === studentId) || { name: studentId, grade: '?', attendance_rate: '?' };
    elements.studentNameHeader.innerHTML = `Student Dashboard: <span class="text-primary-custom">${student.name}</span> <span class="badge bg-secondary fs-6 align-middle">Grade ${student.grade}</span>`;
    elements.studentMetrics.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    elements.recommendationBox.style.display = 'none';
    elements.chatMessagesContainer.innerHTML = appState.chatMessages[studentId] || '';

    try {
        const response = await fetchAPI(`/students/${studentId}/data`);
        if (!response.ok) throw new Error("Failed to load student data");

        const data = await response.json();
        const summary = data.summary;
        const history = data.history;

        elements.studentMetrics.innerHTML = '';
        renderMetric(elements.studentMetrics, "Overall Activity Avg", `${summary.avg_score}%`, 'border-primary');
        renderMetric(elements.studentMetrics, "Total Activities", summary.total_activities, 'border-info');
        renderMetric(elements.studentMetrics, "Math Initial", `${summary.math_score}%`);
        renderMetric(elements.studentMetrics, "Science Initial", `${summary.science_score}%`);
        renderMetric(elements.studentMetrics, "English Initial", `${summary.english_language_score}%`);
        renderMetric(elements.studentMetrics, "Attendance", `${student.attendance_rate}%`, 'border-success');

        if (summary.recommendation) {
            elements.recommendationBox.style.display = 'block';
            elements.recommendationBox.innerHTML = `<strong>💡 Recommendation:</strong> ${summary.recommendation}`;
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
        elements.historyTable.innerHTML = historyHTML;

        // Progress Chart
        const dates = history.map(h => h.date);
        const scores = history.map(h => h.score);
        Plotly.newPlot(elements.studentProgressChart, [{
            x: dates, y: scores, mode: 'lines+markers', type: 'scatter', name: 'Score',
            line: { color: '#4f46e5', width: 2 }
        }], {
            title: 'Activity Score History', height: 350, margin: { t: 40, b: 60, l: 40, r: 10 },
            xaxis: { title: 'Date' }, yaxis: { title: 'Score (%)', range: [0, 100] }
        });

    } catch (error) {
        elements.studentMetrics.innerHTML = `<p class="text-danger">${error.message}</p>`;
    }
    scrollChatToBottom();
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

async function handleChatSubmit(e) {
    e.preventDefault();
    const prompt = elements.chatInput.value.trim();
    const studentId = appState.activeStudentId;

    if (!prompt || !studentId) return;

    appendChatMessage('user', prompt);
    elements.chatInput.value = '';

    try {
        const response = await fetchAPI(`/ai/chat/${studentId}`, {
            method: 'POST',
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();
        if (response.ok) appendChatMessage('assistant', data.reply);
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
        container.innerHTML = '<div class="col-12"><div class="alert alert-secondary">No groups created yet. Click "Create Group" to start.</div></div>';
        return;
    }

    container.innerHTML = groups.map(g => `
            <div class="col-md-4">
                <div class="card h-100 shadow-sm border-0 group-card" style="cursor: pointer;" onclick="openManageMembers('${g.id}', '${g.name}')">
                    <div class="card-body text-center">
                        <div class="mb-2">
                            <span class="material-icons fs-1 text-primary-custom">groups</span>
                        </div>
                        <span class="badge bg-info text-dark rounded-pill mb-2">${g.subject || 'General'}</span>
                        <h5 class="card-title fw-bold">${g.name}</h5>
                        <p class="card-text text-muted small">${g.description || 'No description'}</p>
                        <span class="badge bg-light text-dark border rounded-pill px-3">
                            ${g.member_count} Members
                        </span>
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
    } catch (e) { msg.textContent = 'Error creating group.'; }
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

async function handlePostMaterial(e) {
    e.preventDefault();
    const groupId = document.getElementById('manage-group-id').value;
    const title = document.getElementById('mat-title').value;
    const type = document.getElementById('mat-type').value;
    const content = document.getElementById('mat-content').value;

    try {
        await fetchAPI(`/groups/${groupId}/materials`, {
            method: 'POST',
            body: JSON.stringify({ title, type, content })
        });
        document.getElementById('add-material-form').reset();
        loadGroupMaterials(groupId);
    } catch (e) { alert('Failed to post'); }
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
                container.innerHTML = '<p class="text-muted small">You are not part of any groups yet.</p>';
                return;
            }

            container.innerHTML = groups.map(g => `
                    <div class="col-md-4 col-sm-6">
                        <div class="card h-100 border-0 shadow-sm student-group-card" onclick="openStudentGroup('${g.id}', '${g.name}', '${g.description || ''}')">
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
    if (!confirm("Delete this group?")) return;

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
attachListener(elements.addStudentForm, 'submit', handleAddStudent);
attachListener(elements.addActivityForm, 'submit', handleAddActivity);
attachListener(elements.editStudentForm, 'submit', handleEditStudentSubmit);
// Chat form listener removed - handled via onClick in HTML to prevent reload issues
attachListener(elements.scheduleClassForm, 'submit', handleScheduleClass);

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
