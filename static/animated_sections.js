
// --- ANIMATED SECTIONS (Vanilla JS Adaptation) ---
// Mimics the React AnimatedSections component using GSAP

function initAnimatedSections() {
    const container = document.getElementById('animated-sections-container');
    if (!container || typeof gsap === 'undefined') return;

    gsap.registerPlugin(Observer);

    // Data
    const sectionsData = [
        { text: "Whispers of Radiance", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop" },
        { text: "Ethereal Moments", img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop" },
        { text: "Silent Beauty", img: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=1000&auto=format&fit=crop" }
    ];

    // Build DOM Structure
    container.innerHTML = '';
    container.style.position = 'absolute';
    container.style.overflow = 'hidden';
    container.style.backgroundColor = 'black';
    container.style.color = 'white';

    // 1. Create Sections
    sectionsData.forEach((data, i) => {
        const section = document.createElement('div');
        section.classList.add('anim-section');
        section.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            visibility: hidden; z-index: 0; overflow: hidden;
        `;

        const outer = document.createElement('div');
        outer.classList.add('outer');
        outer.style.cssText = 'width: 100%; height: 100%; overflow: hidden;';

        const inner = document.createElement('div');
        inner.classList.add('inner');
        inner.style.cssText = 'width: 100%; height: 100%; overflow: hidden;';

        const bg = document.createElement('div');
        bg.classList.add('bg');
        bg.style.cssText = `
            width: 100%; height: 100%; 
            display: flex; align-items: center; justify-content: center;
            background-size: cover; background-position: center;
            background-image: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%), url('${data.img}');
        `;

        const heading = document.createElement('h2');
        heading.innerText = data.text;
        heading.style.cssText = `
            font-family: 'Poppins', sans-serif; font-weight: 700; color: white;
            font-size: clamp(2rem, 4vw, 5rem); text-align: center; z-index: 10;
            text-transform: uppercase; line-height: 1; pointer-events: none;
            padding: 0 20px;
        `;

        bg.appendChild(heading);
        inner.appendChild(bg);
        outer.appendChild(inner);
        section.appendChild(outer);
        container.appendChild(section);
    });

    // 2. State & Refs
    let currentIndex = -1;
    let isAnimating = false;
    const sections = document.querySelectorAll('.anim-section');
    const images = document.querySelectorAll('.bg');
    const headings = document.querySelectorAll('h2');
    const outers = document.querySelectorAll('.outer');
    const inners = document.querySelectorAll('.inner');
    const wrap = gsap.utils.wrap(0, sections.length);

    // Helper: SplitText Logic (Basic manual split for lines since plugin is paid)
    // We'll wrap text in spans to simulate lines for animation
    headings.forEach(h => {
        const text = h.innerText;
        h.innerHTML = `<span class="split-line" style="display:inline-block; opacity:0; transform:translateY(100%)">${text}</span>`;
    });

    // 3. Animation Logic
    function gotoSection(index, direction) {
        if (isAnimating) return;
        index = wrap(index);
        isAnimating = true;

        const fromTop = direction === -1;
        const dFactor = fromTop ? -1 : 1;
        const tl = gsap.timeline({
            defaults: { duration: 1.25, ease: 'power1.inOut' },
            onComplete: () => {
                isAnimating = false;
            }
        });

        // Current Section Exit
        if (currentIndex >= 0) {
            gsap.set(sections[currentIndex], { zIndex: 0 });
            tl.to(images[currentIndex], { xPercent: -15 * dFactor })
                .set(sections[currentIndex], { autoAlpha: 0 });
        }

        // New Section Enter
        gsap.set(sections[index], { autoAlpha: 1, zIndex: 1 });

        // Image Reveal Effect
        tl.fromTo([outers[index], inners[index]],
            { xPercent: (i) => (i ? -100 * dFactor : 100 * dFactor) },
            { xPercent: 0 }, 0
        )
            .fromTo(images[index], { xPercent: 15 * dFactor }, { xPercent: 0 }, 0);

        // Text Animation
        const splitLine = headings[index].querySelector('.split-line');
        if (splitLine) {
            gsap.set(splitLine, { opacity: 0, yPercent: 100 });
            tl.to(splitLine, {
                opacity: 1, yPercent: 0,
                duration: 0.8, ease: 'power2.out'
            }, 0.4);
        }

        currentIndex = index;
    }

    // 4. Observer
    Observer.create({
        target: container,
        type: "wheel,touch,pointer",
        wheelSpeed: -1,
        onDown: () => !isAnimating && gotoSection(currentIndex - 1, -1),
        onUp: () => !isAnimating && gotoSection(currentIndex + 1, 1),
        tolerance: 10,
        preventDefault: true
    });

    // Initial Start
    gotoSection(0, 1);
}

// Init
document.addEventListener('DOMContentLoaded', initAnimatedSections);
