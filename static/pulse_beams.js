
// --- PULSE BEAMS EFFECT (Vanilla JS Adaptation) ---
// Adapts the React PulseBeams component logic to pure JavaScript/SVG.

const initPulseBeams = () => {
    const container = document.getElementById('login-visual-panel');
    if (!container) return;

    // Beam Paths Data (from the React component)
    const beams = [
        {
            path: "M269 220.5H16.5C10.9772 220.5 6.5 224.977 6.5 230.5V398.5",
            gradientConfig: {
                initial: { x1: 0, x2: 0, y1: 80, y2: 100 },
                animate: { x1: [0, 0, 200], x2: [0, 0, 180], y1: [80, 0, 0], y2: [100, 20, 20] },
                duration: 4000
            },
            connectionPoints: [{ cx: 6.5, cy: 398.5, r: 6 }, { cx: 269, cy: 220.5, r: 6 }]
        },
        {
            path: "M568 200H841C846.523 200 851 195.523 851 190V40",
            gradientConfig: {
                initial: { x1: 0, x2: 0, y1: 80, y2: 100 },
                animate: { x1: [20, 100, 100], x2: [0, 90, 90], y1: [80, 80, -20], y2: [100, 100, 0] },
                duration: 4500
            },
            connectionPoints: [{ cx: 851, cy: 34, r: 6.5 }, { cx: 568, cy: 200, r: 6 }]
        },
        {
            path: "M425.5 274V333C425.5 338.523 421.023 343 415.5 343H152C146.477 343 142 347.477 142 353V426.5",
            gradientConfig: {
                initial: { x1: 0, x2: 0, y1: 80, y2: 100 },
                animate: { x1: [20, 100, 100], x2: [0, 90, 90], y1: [80, 80, -20], y2: [100, 100, 0] },
                duration: 3800
            },
            connectionPoints: [{ cx: 142, cy: 427, r: 6.5 }, { cx: 425.5, cy: 274, r: 6 }]
        },
        // Add more beams as specific paths require
        {
            path: "M493 274V333.226C493 338.749 497.477 343.226 503 343.226H760C765.523 343.226 770 347.703 770 353.226V427",
            gradientConfig: {
                initial: { x1: 40, x2: 50, y1: 160, y2: 180 },
                animate: { x1: [40, 0], x2: [50, 10], y1: [160, -40], y2: [180, -20] },
                duration: 5000
            },
            connectionPoints: [{ cx: 770, cy: 427, r: 6.5 }, { cx: 493, cy: 274, r: 6 }]
        }
    ];

    // Colors
    const baseColor = "#1e293b"; // Slate 800
    const accentColor = "#475569"; // Slate 600
    const gradientColors = { start: "#18CCFC", middle: "#6344F5", end: "#AE48FF" };

    // Create SVG
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Clear container
    container.innerHTML = '';

    // We add an absolute positioned SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 858 434`); // Use the demo's viewBox
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    // Defs for gradients
    const defs = document.createElementNS(svgNS, "defs");
    svg.appendChild(defs);

    beams.forEach((beam, index) => {
        // 1. Base Path (Static)
        const basePath = document.createElementNS(svgNS, "path");
        basePath.setAttribute("d", beam.path);
        basePath.setAttribute("stroke", baseColor);
        basePath.setAttribute("stroke-width", "1");
        basePath.setAttribute("fill", "none");
        svg.appendChild(basePath);

        // 2. Animated Gradient
        const gradId = `beam-grad-${index}`;
        const gradient = document.createElementNS(svgNS, "linearGradient");
        gradient.setAttribute("id", gradId);
        gradient.setAttribute("gradientUnits", "userSpaceOnUse");

        // Define stops
        const stop1 = document.createElementNS(svgNS, "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", gradientColors.start);
        stop1.setAttribute("stop-opacity", "0");

        const stop2 = document.createElementNS(svgNS, "stop");
        stop2.setAttribute("offset", "20%");
        stop2.setAttribute("stop-color", gradientColors.start);
        stop2.setAttribute("stop-opacity", "1");

        const stop3 = document.createElementNS(svgNS, "stop");
        stop3.setAttribute("offset", "50%");
        stop3.setAttribute("stop-color", gradientColors.middle);
        stop3.setAttribute("stop-opacity", "1");

        const stop4 = document.createElementNS(svgNS, "stop");
        stop4.setAttribute("offset", "100%");
        stop4.setAttribute("stop-color", gradientColors.end);
        stop4.setAttribute("stop-opacity", "0");

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        gradient.appendChild(stop3);
        gradient.appendChild(stop4);
        defs.appendChild(gradient);

        // 3. Animated Path (Overlay)
        const animPath = document.createElementNS(svgNS, "path");
        animPath.setAttribute("d", beam.path);
        animPath.setAttribute("stroke", `url(#${gradId})`);
        animPath.setAttribute("stroke-width", "2");
        animPath.setAttribute("stroke-linecap", "round");
        animPath.setAttribute("fill", "none");
        svg.appendChild(animPath);

        // 4. Connection Points
        if (beam.connectionPoints) {
            beam.connectionPoints.forEach(pt => {
                const circle = document.createElementNS(svgNS, "circle");
                circle.setAttribute("cx", pt.cx);
                circle.setAttribute("cy", pt.cy);
                circle.setAttribute("r", pt.r);
                circle.setAttribute("fill", baseColor);
                circle.setAttribute("stroke", accentColor);
                svg.appendChild(circle);
            });
        }

        // 5. ANIMATION LOGIC (JS Interpolation)
        let startTime = null;
        const config = beam.gradientConfig;

        function animate(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = (timestamp - startTime) % config.duration / config.duration;

            // Simple Linear interpolation for x1, x2, y1, y2
            // NOTE: The React component uses framer-motion's complex array interpolation.
            // We mimic a simple linear loop for simplicity in Vanilla JS.

            // For x1: interpolate from -100% to 200% to simulate movement
            // This is a simplification of the complex keyframes

            // Simplified Beam Movement Logic:
            // Move the gradient coordinates from 0% -> 100% along the vector

            // Update Gradient Attributes
            // We use a simplified 'flow' animation logic here
            const p = progress * 100;

            // Move the gradient 'window'
            gradient.setAttribute("x1", `${p - 20}%`);
            gradient.setAttribute("x2", `${p}%`);
            gradient.setAttribute("y1", `${p - 20}%`); // diagonal movement approx
            gradient.setAttribute("y2", `${p}%`);

            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);

    });

    container.appendChild(svg);
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initPulseBeams();
});
