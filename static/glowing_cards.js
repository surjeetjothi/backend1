
// --- GLOWING CARD EFFECT ---
// This script handles the mouse-following glow effect on cards.
// It relies on CSS variables --x and --y being updated on the container.

function applyGlowEffects() {
    // Select all cards that should have the glow effect
    const cards = document.querySelectorAll('.glowing-card');

    cards.forEach(card => {
        card.addEventListener('pointermove', (ev) => {
            const rect = card.getBoundingClientRect();
            // Calculate mouse position relative to the card
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;

            // Set CSS custom properties
            card.style.setProperty('--x', `${x}px`);
            card.style.setProperty('--y', `${y}px`);

            // Also update the border element specifically if needed, 
            // but usually setting it on the parent (.glowing-card) is enough 
            // if the CSS uses var(--x) and var(--y) inherited.
            // For the specific CSS we have (radial-gradient), we might need to update the border div directly
            // or ensure the CSS variables are used there.

            // Based on the CSS provided in index.html:
            // mask-image: conic-gradient(from calc(var(--start) * 1deg - var(--spread) * 1deg), ...

            // It seems the CSS is more complex and might rely on 'active' and 'start' angles.
            // Let's implement the specific logic for the "Magic Card" effect
            // which usually involves calculating angle and opacity.

            const border = card.querySelector('.glowing-card-border');
            if (border) {
                // simple spotlight effect implementation
                // We need to pass the precision position to the shader/gradient
                // The provided CSS in index.html for .glowing-card-border refers to:
                // --active, --start, --spread.

                // Let's calculate angle for --start
                // const angle = Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI;
                // BUT the simpler implementation for the "Searchlight" effect is just x/y.

                // However, looking at the CSS:
                // mask-image: conic-gradient(from calc(var(--start) * 1deg ...
                // It seems to be angle-based (conic).

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI) + 90; // +90 to align 0 top

                border.style.setProperty('--start', angle);
                border.style.setProperty('--active', 1); // Make visible on hover
            }
        });

        card.addEventListener('pointerleave', () => {
            const border = card.querySelector('.glowing-card-border');
            if (border) {
                border.style.setProperty('--active', 0); // Hide on leave
            }
        });
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    applyGlowEffects();
});
