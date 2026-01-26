
// --- TESTIMONIAL CARDS ANIMATION ---
// Adapts the React TestimonialCards component to vanilla JS/GSAP.

const testimonials = [
    {
        id: 1,
        testimonial: "I feel like I've learned as much from Class Bridge as I did completing my masters. It's the first thing I read every morning.",
        author: "Jenn F. - Marketing Director @ Square",
        img: "1"
    },
    {
        id: 2,
        testimonial: "My boss thinks I know what I'm doing. Honestly, I just read this newsletter.",
        author: "Adrian Y. - Product Marketing @ Meta",
        img: "2"
    },
    {
        id: 3,
        testimonial: "Can not believe this is free. If Class Bridge was $5,000 a month, it would be worth every penny. I plan to name my next child after Class Bridge.",
        author: "Devin R. - Growth Marketing Lead @ OpenAI",
        img: "3"
    }
];

class TestimonialStack {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.positions = ["front", "middle", "back"];
        this.cards = [];
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.display = 'flex';
        this.container.style.alignItems = 'center';
        this.container.style.justifyContent = 'center';
        this.container.style.overflow = 'hidden';
        this.container.style.background = '#0f172a'; // slate-900

        // Create cards
        testimonials.forEach((data, index) => {
            const card = this.createCard(data, index);
            this.cards.push(card);
            this.container.appendChild(card);
        });

        this.updateCards();
        this.addEventListeners();
    }

    createCard(data, index) {
        const el = document.createElement('div');
        el.className = 'testimonial-card';
        // Tailwind styles adaptation
        el.style.position = 'absolute';
        //    el.style.height = '450px';
        //    el.style.width = '350px';
        el.style.maxWidth = '90%';
        el.style.padding = '1.5rem';
        el.style.borderRadius = '1rem';
        el.style.border = '2px solid #334155'; // slate-700
        el.style.backgroundColor = 'rgba(30, 41, 59, 0.2)'; // slate-800/20
        el.style.backdropFilter = 'blur(12px)';
        el.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.gap = '1.5rem';
        el.style.userSelect = 'none';
        el.style.touchAction = 'none';
        el.style.cursor = 'grab';

        // Add explicit dimensions via CSS class or inline
        el.style.width = '350px';
        el.style.height = '450px';

        el.innerHTML = `
            <img src="https://i.pravatar.cc/128?img=${data.img}" alt="${data.author}" 
                style="width: 8rem; height: 8rem; border-radius: 50%; border: 2px solid #334155; background-color: #e2e8f0; object-fit: cover; pointer-events: none;">
            <span style="text-align: center; font-size: 1.125rem; font-style: italic; color: #94a3b8;">"${data.testimonial}"</span>
            <span style="text-align: center; font-size: 0.875rem; font-weight: 500; color: #818cf8;">${data.author}</span>
        `;

        el.dataset.index = index;
        return el;
    }

    updateCards() {
        this.cards.forEach((card, index) => {
            const pos = this.positions[index];
            let zIndex, rotate, x, scale, opacity;

            if (pos === 'front') {
                zIndex = 3;
                rotate = '-6deg';
                x = '0%';
                scale = 1;
                opacity = 1;
                card.style.cursor = 'grab';
                card.style.pointerEvents = 'auto';
            } else if (pos === 'middle') {
                zIndex = 2;
                rotate = '0deg';
                x = '20%'; // Slightly less overlap to be visible
                scale = 0.95;
                opacity = 0.8;
                card.style.cursor = 'default';
                card.style.pointerEvents = 'none';
            } else if (pos === 'back') {
                zIndex = 1;
                rotate = '6deg';
                x = '40%';
                scale = 0.9;
                opacity = 0.6;
                card.style.cursor = 'default';
                card.style.pointerEvents = 'none';
            }

            gsap.to(card, {
                duration: 0.5,
                x: x,
                rotation: rotate,
                scale: scale,
                autoAlpha: opacity,
                zIndex: zIndex,
                ease: "back.out(1.2)"
            });
        });
    }

    handleShuffle() {
        // Shift positions: front -> back, middle -> front, back -> middle
        // Actually, the demo does: pop the last and unshift?
        // Demo: newPositions.unshift(newPositions.pop());
        // positions array matches the cards array indices.
        // If positions = ['front', 'middle', 'back']
        // unshift(pop()) -> ['back', 'front', 'middle']
        // Card 0 becomes back, Card 1 becomes front, Card 2 becomes middle.

        const last = this.positions.pop();
        this.positions.unshift(last);
        this.updateCards();
    }

    addEventListeners() {
        // Only the 'front' card should trigger drag.
        // But since we attach listeners to the container or window, we need to check target.
        // Simpler: attach to container and delegated to card that is 'front'.

        const onStart = (e) => {
            const target = e.target.closest('.testimonial-card');
            if (!target) return;

            // Find which card is front
            const index = parseInt(target.dataset.index);
            if (this.positions[index] !== 'front') return;

            this.isDragging = true;
            this.startX = e.clientX || e.touches[0].clientX;
            this.currentCard = target;
            this.currentCard.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!this.isDragging || !this.currentCard) return;

            const clientX = e.clientX || e.touches[0].clientX;
            const diff = clientX - this.startX;

            // Only allow dragging roughly horizontally, mostly to the right/left?
            // Demo says: if drag > 150 (right), shuffle.
            // We can just move the card with the mouse.

            gsap.set(this.currentCard, { x: diff });
        };

        const onEnd = (e) => {
            if (!this.isDragging || !this.currentCard) return;

            const clientX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
            const diff = clientX - this.startX;

            if (Math.abs(diff) > 100) { // Threshold
                this.handleShuffle();
            } else {
                // Reset
                this.updateCards();
            }

            this.isDragging = false;
            this.currentCard.style.cursor = 'grab';
            this.currentCard = null;
        };

        this.container.addEventListener('mousedown', onStart);
        this.container.addEventListener('touchstart', onStart);

        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove);

        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
    }
}

// Init
function initTestimonialCards() {
    new TestimonialStack('testimonial-cards-container');
}

document.addEventListener('DOMContentLoaded', initTestimonialCards);
