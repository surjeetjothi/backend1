
// --- SPARKLES EFFECT INITIALIZATION ---
// Loads the tsParticles engine and configures the "Sparkles" effect.
// This replicates the React SparklesCore component logic using Vanilla JS.

async function initSparkles() {
    if (typeof tsParticles === 'undefined') {
        console.warn("tsParticles library not loaded.");
        return;
    }

    try {
        await tsParticles.load("tsparticles", {
            background: {
                color: {
                    value: "transparent",
                },
            },
            fullScreen: {
                enable: false, // Confined to the hero section div
                zIndex: 0
            },
            fpsLimit: 120,
            interactivity: {
                events: {
                    onClick: {
                        enable: true,
                        mode: "push",
                    },
                    onHover: {
                        enable: false,
                        mode: "repulse",
                    },
                    resize: true,
                },
                modes: {
                    push: {
                        quantity: 4,
                    },
                    repulse: {
                        distance: 200,
                        duration: 0.4,
                    },
                },
            },
            particles: {
                bounce: {
                    horizontal: { value: 1 },
                    vertical: { value: 1 }
                },
                collisions: {
                    enable: false,
                },
                color: {
                    value: "#AAB7B8", // Subtle gray/silver sparkle
                },
                move: {
                    direction: "none",
                    enable: true,
                    outModes: {
                        default: "out",
                    },
                    random: false,
                    speed: { min: 0.1, max: 1 }, // Gentle drift
                    straight: false,
                },
                number: {
                    density: {
                        enable: true,
                        area: 800,
                    },
                    value: 100, // Density of sparkles
                },
                opacity: {
                    value: { min: 0.1, max: 0.8 },
                    animation: {
                        enable: true,
                        speed: 1, // Twinkle speed
                        sync: false,
                        startValue: "random",
                        mode: "auto"
                    },
                },
                shape: {
                    type: "circle", // Or "star" for more literal sparkles
                },
                size: {
                    value: { min: 1, max: 3 },
                    animation: {
                        enable: false,
                        speed: 5,
                        sync: false,
                        startValue: "random",
                    },
                },
            },
            detectRetina: true,
        });
        console.log("Sparkles initialized!");
    } catch (error) {
        console.error("Failed to initialize sparkles:", error);
    }
}

// Initialize on load if landing view is active
document.addEventListener('DOMContentLoaded', () => {
    // Existing initialization...

    // Init sparkles
    initSparkles();
});
