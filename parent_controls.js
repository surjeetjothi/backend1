
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

    elements.userControls.appendChild(navList);
}
