
// --- PARTICLE ANIMATION (Vanilla JS Adaptation with p5.js + GSAP) ---
// Adapts the React ParticleAnimation component logic.

function initParticleAnimation() {
    const container = document.getElementById('particle-animation-container');
    if (!container) return;

    // Ensure p5 and gsap are loaded
    if (typeof p5 === 'undefined' || typeof gsap === 'undefined') {
        console.warn("p5.js or GSAP not loaded.");
        return;
    }

    // Clear Container
    container.innerHTML = '';

    const sketch = (p) => {
        const particles = [];
        // Determine amount based on window size
        const amount = p.windowWidth < 600 || p.windowHeight < 600 ? 1000 : 2000;
        const durationShrink = 8;
        const durationGrow = 8;
        const total = durationShrink + durationGrow;
        const theme = ["#393e46", "#00adb5", "#393e46", "#00adb5", "#e6eeef"];

        const proxy = {
            progress: 1,
            val: 0,
        };

        let progressAnim; // GSAP tween
        let interpolator; // GSAP timeline

        class Particle {
            constructor(i) {
                this.i = i;
                this.cos = p.cos(i * p.TWO_PI);
                this.sin = p.sin(i * p.TWO_PI);
                this.r = p.floor(p.random(2, 8));
                this.offset = p.pow(p.random(1, 2), 2.5) * p.random(-0.015, 0.015);
                this.color = p.random(theme);
            }

            draw() {
                // GSAP timeline 'progress' allows us to seek to a specific point
                // The original code does: interpolator.progress((proxy.progress + this.i) % 1)
                // We must ensure the timeline wraps correctly
                if (interpolator) {
                    interpolator.progress((proxy.progress + this.i) % 1);
                }

                // Calculate radius and position
                const r = p.width * (0.35 + proxy.val * this.offset);
                const x = this.cos * r + p.width / 2;
                const y = this.sin * r + p.height / 2; // Fixed: using p.height for Y centering

                p.fill(this.color);
                p.circle(x, y, this.r);
            }
        }

        p.setup = () => {
            // Create canvas filling the container
            const w = container.clientWidth;
            const h = container.clientHeight;
            const canvas = p.createCanvas(w, h);
            canvas.parent(container);
            p.noStroke();

            if (navigator.userAgent.indexOf("Firefox") < 0) {
                p.blendMode(p.SCREEN);
            }

            // Initialize GSAP Animations
            progressAnim = gsap.to(proxy, {
                progress: 0,
                ease: "none",
                duration: total,
                repeat: -1,
            });

            interpolator = gsap.timeline({
                paused: true,
                reverse: true, // Not sure if reverse:true works as intended on init in GSAP 3 without onReverseComplete, but converting literally.
            })
                .to(proxy, {
                    val: 1,
                    duration: durationShrink,
                    ease: "elastic.in(1.5, 0.15)",
                })
                .to(proxy, {
                    val: 0,
                    duration: durationGrow,
                    ease: "back.in(3)",
                });

            // Init Particles
            for (let i = 0; i < amount; i++) {
                particles.push(new Particle(i / amount));
            }
        };

        p.windowResized = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            p.resizeCanvas(w, h);
        };

        p.touchMoved = () => {
            if (p.touches.length === 0) return;
            onMove(p.touches[0].x, p.touches[0].y);
        };

        p.mouseMoved = () => {
            onMove(p.mouseX, p.mouseY);
        };

        const onMove = (x, y) => {
            let mouseAngle = p.atan2(y - p.height / 2, x - p.width / 2);
            mouseAngle = mouseAngle < 0 ? mouseAngle + p.TWO_PI : mouseAngle;
            mouseAngle = p.abs(mouseAngle / p.TWO_PI) * total;

            // Seek the progress tween
            if (progressAnim) {
                progressAnim.time(mouseAngle);
            }
        };

        p.draw = () => {
            p.clear();
            particles.forEach((particle) => {
                particle.draw();
            });
        };
    };

    new p5(sketch);
}

// Init on Load
document.addEventListener('DOMContentLoaded', initParticleAnimation);
