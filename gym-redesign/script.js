/* ============================================
   APEX FITNESS - Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initPreloader();
    initCustomCursor();
    initNavigation();
    initHeroParticles();
    initCounterAnimation();
    initScrollReveal();
    initGSAPAnimations();
    initPricingToggle();
    initTestimonialsCarousel();
    initChatbot();
    initNewsletterForm();
    initPaymentGateway();
});

/* ============================================
   Preloader
   ============================================ */
function initPreloader() {
    const preloader = document.getElementById('preloader');
    window.addEventListener('load', () => {
        setTimeout(() => {
            preloader.classList.add('hidden');
            document.body.style.overflow = '';
            animateHeroOnLoad();
        }, 1200);
    });
    // Fallback
    setTimeout(() => {
        preloader.classList.add('hidden');
        document.body.style.overflow = '';
    }, 4000);
}

/* ============================================
   Custom Cursor
   ============================================ */
function initCustomCursor() {
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    if (!dot || !ring) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let mx = 0, my = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

    function animateCursor() {
        cx += (mx - cx) * 0.15;
        cy += (my - cy) * 0.15;
        dot.style.left = mx + 'px';
        dot.style.top = my + 'px';
        dot.style.transform = 'translate(-50%, -50%)';
        ring.style.left = cx + 'px';
        ring.style.top = cy + 'px';
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover effect on interactive elements
    document.querySelectorAll('a, button, .feature-card, .pricing-card, input').forEach(el => {
        el.addEventListener('mouseenter', () => {
            ring.style.width = '52px';
            ring.style.height = '52px';
            ring.style.borderColor = 'rgba(0,255,136,0.6)';
        });
        el.addEventListener('mouseleave', () => {
            ring.style.width = '36px';
            ring.style.height = '36px';
            ring.style.borderColor = 'rgba(0,255,136,0.4)';
        });
    });
}

/* ============================================
   Navigation
   ============================================ */
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const toggle = document.getElementById('navToggle');
    const overlay = document.getElementById('mobileMenuOverlay');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
    });

    // Mobile toggle
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = overlay.classList.contains('active') ? 'hidden' : '';
    });

    // Close on link click
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Active section tracking
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY + 200;
        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');
            if (scrollY >= top && scrollY < top + height) {
                navLinks.forEach(l => l.classList.remove('active'));
                const activeLink = document.querySelector(`.nav-link[data-section="${id}"]`);
                if (activeLink) activeLink.classList.add('active');
            }
        });
    });
}

/* ============================================
   Hero Particles
   ============================================ */
function initHeroParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    const count = window.innerWidth < 768 ? 15 : 30;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (6 + Math.random() * 10) + 's';
        p.style.animationDelay = Math.random() * 8 + 's';
        p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
        if (Math.random() > 0.6) p.style.background = 'var(--accent-cyan)';
        container.appendChild(p);
    }
}

/* ============================================
   Counter Animation
   ============================================ */
function initCounterAnimation() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    let animated = false;

    function animateCounters() {
        if (animated) return;
        const heroStats = document.getElementById('heroStats');
        if (!heroStats) return;
        const rect = heroStats.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) {
            animated = true;
            counters.forEach(counter => {
                const target = parseInt(counter.dataset.target);
                const duration = 2000;
                const startTime = performance.now();
                function update(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const current = Math.floor(target * eased);
                    counter.textContent = current.toLocaleString() + (counter.closest('.stat-item').querySelector('.stat-label').textContent.includes('%') ? '%' : '+');
                    if (progress < 1) requestAnimationFrame(update);
                }
                requestAnimationFrame(update);
            });
        }
    }

    window.addEventListener('scroll', animateCounters);
    animateCounters();
}

/* ============================================
   Scroll Reveal
   ============================================ */
function initScrollReveal() {
    // Add reveal class to elements
    document.querySelectorAll('.section-header, .feature-card, .ai-feature-item, .footer-top > div, .footer-newsletter').forEach((el, i) => {
        el.classList.add('reveal');
        const delayClass = `reveal-delay-${(i % 6) + 1}`;
        el.classList.add(delayClass);
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* ============================================
   GSAP Animations
   ============================================ */
function initGSAPAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    // Features section title
    gsap.from('#features .section-title', {
        scrollTrigger: { trigger: '#features', start: 'top 80%' },
        y: 40, opacity: 0, duration: 0.8
    });

    // AI trainer parallax
    gsap.to('.ai-trainer-img', {
        scrollTrigger: { trigger: '.ai-trainer', start: 'top bottom', end: 'bottom top', scrub: 1 },
        y: -40
    });

    // Pricing cards stagger - simplified to avoid hiding cards completely on scroll errors
    gsap.from('.pricing-card-inner', {
        scrollTrigger: { trigger: '#pricing', start: 'top 85%' },
        y: 40, duration: 0.6, stagger: 0.1, ease: 'power2.out'
    });
}

function animateHeroOnLoad() {
    if (typeof gsap === 'undefined') return;
    const tl = gsap.timeline();
    tl.from('#heroBadge', { y: 30, opacity: 0, duration: 0.6 })
      .from('.title-line', { y: 50, opacity: 0, stagger: 0.12, duration: 0.6 }, '-=0.3')
      .from('#heroSubtitle', { y: 20, opacity: 0, duration: 0.5 }, '-=0.2')
      .from('#heroCtas', { y: 20, opacity: 0, duration: 0.5 }, '-=0.2')
      .from('.stat-item, .stat-divider', { y: 20, opacity: 0, stagger: 0.08, duration: 0.4 }, '-=0.2')
      .from('#heroScrollIndicator', { opacity: 0, duration: 0.5 }, '-=0.1');
}

/* ============================================
   Pricing Toggle
   ============================================ */
function initPricingToggle() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const monthlyLabel = document.getElementById('monthlyLabel');
    const yearlyLabel = document.getElementById('yearlyLabel');
    const monthlyPrices = document.querySelectorAll('.monthly-price');
    const yearlyPrices = document.querySelectorAll('.yearly-price');
    let isYearly = false;

    if (!toggleSwitch) return;

    toggleSwitch.addEventListener('click', () => {
        isYearly = !isYearly;
        toggleSwitch.classList.toggle('active', isYearly);
        monthlyLabel.classList.toggle('active', !isYearly);
        yearlyLabel.classList.toggle('active', isYearly);
        monthlyPrices.forEach(p => p.style.display = isYearly ? 'none' : '');
        yearlyPrices.forEach(p => p.style.display = isYearly ? '' : 'none');

        // Animate price change
        document.querySelectorAll('.amount').forEach(el => {
            if (el.style.display !== 'none') {
                el.style.transform = 'scale(1.15)';
                el.style.color = 'var(--accent-green)';
                setTimeout(() => { el.style.transform = ''; el.style.color = ''; }, 300);
            }
        });
    });
}

/* ============================================
   Testimonials Carousel
   ============================================ */
function initTestimonialsCarousel() {
    const track = document.getElementById('carouselTrack');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    const dots = document.querySelectorAll('.carousel-dot');
    if (!track) return;

    let current = 0;
    const total = track.children.length;

    function goTo(index) {
        current = ((index % total) + total) % total;
        track.style.transform = `translateX(-${current * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
    dots.forEach(dot => dot.addEventListener('click', () => goTo(parseInt(dot.dataset.index))));

    // Auto-play
    let autoplay = setInterval(() => goTo(current + 1), 5000);
    const carousel = document.getElementById('testimonialsCarousel');
    carousel.addEventListener('mouseenter', () => clearInterval(autoplay));
    carousel.addEventListener('mouseleave', () => { autoplay = setInterval(() => goTo(current + 1), 5000); });

    // Touch swipe
    let startX = 0;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) goTo(current + (diff > 0 ? 1 : -1));
    }, { passive: true });
}

/* ============================================
   AI Chatbot
   ============================================ */
function initChatbot() {
    const widget = document.getElementById('chatbotWidget');
    const toggleBtn = document.getElementById('chatbotToggle');
    const minimizeBtn = document.getElementById('chatbotMinimize');
    const form = document.getElementById('chatbotForm');
    const input = document.getElementById('chatbotInput');
    const messages = document.getElementById('chatbotMessages');
    const quickActions = document.querySelectorAll('.quick-action');

    if (!widget) return;

    toggleBtn.addEventListener('click', () => widget.classList.toggle('active'));
    minimizeBtn.addEventListener('click', () => widget.classList.remove('active'));

    // Pre-defined responses
    const responses = {
        'pricing': "Great question! 💰 We have three plans:\n\n🔹 **Basic** — $29/mo (Gym access + Basic AI)\n🔹 **Pro** — $59/mo (24/7 access + Advanced AI + Trainer)\n🔹 **Elite** — $99/mo (Everything unlimited + VIP)\n\nAll plans include a 7-day free trial! Would you like to sign up?",
        'trial': "Awesome! 📅 I'd love to book a trial for you!\n\nOur free trial includes:\n✅ Full gym access for 7 days\n✅ One personal trainer session\n✅ AI workout assessment\n\nJust visit our front desk or call us at +1 (555) 123-4567 to get started!",
        'programs': "We offer amazing programs! 🏋️\n\n💪 Strength Training\n🫀 High-Intensity Cardio\n⚔️ CrossFit\n🧘 Yoga & Mindfulness\n🥊 Boxing & MMA\n👑 Personal Training\n\nEach program is enhanced with AI tracking. Which one interests you?",
        'hours': "Here are our hours! 🕐\n\n📅 Monday - Friday: 5:00 AM - 11:00 PM\n📅 Saturday - Sunday: 6:00 AM - 10:00 PM\n\n🏠 Location: 123 Fitness Avenue, Downtown, NY 10001\n\nWe're open 365 days a year! 💪",
        'default': "Thanks for your message! 🙌 I'm here to help with anything about APEX Fitness.\n\nYou can ask me about:\n💰 Pricing & Plans\n📅 Booking trials\n🏋️ Our programs\n🤖 AI trainer features\n🕐 Operating hours\n\nWhat would you like to know?"
    };

    function addMessage(text, isUser = false) {
        const div = document.createElement('div');
        div.className = `chat-message ${isUser ? 'user' : 'bot'}`;
        div.innerHTML = `
            <div class="message-avatar"><i data-lucide="${isUser ? 'user' : 'bot'}"></i></div>
            <div class="message-bubble"><p>${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p></div>
        `;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        lucide.createIcons({ nodes: [div] });
    }

    function addTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'chat-message bot typing-msg';
        div.innerHTML = `<div class="message-avatar"><i data-lucide="bot"></i></div><div class="message-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        lucide.createIcons({ nodes: [div] });
        return div;
    }

    function getResponse(msg) {
        const lower = msg.toLowerCase();
        if (lower.includes('pric') || lower.includes('cost') || lower.includes('plan') || lower.includes('member')) return responses.pricing;
        if (lower.includes('trial') || lower.includes('book') || lower.includes('visit')) return responses.trial;
        if (lower.includes('program') || lower.includes('class') || lower.includes('offer') || lower.includes('train')) return responses.programs;
        if (lower.includes('hour') || lower.includes('open') || lower.includes('time') || lower.includes('locat') || lower.includes('address')) return responses.hours;
        return responses.default;
    }

    function handleSend(msg) {
        if (!msg.trim()) return;
        addMessage(msg, true);
        const typingEl = addTypingIndicator();
        // Hide quick actions after first message
        document.getElementById('chatbotQuickActions').style.display = 'none';

        setTimeout(() => {
            typingEl.remove();
            addMessage(getResponse(msg));
        }, 800 + Math.random() * 600);
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        handleSend(input.value);
        input.value = '';
    });

    quickActions.forEach(btn => {
        btn.addEventListener('click', () => handleSend(btn.dataset.message));
    });
}

/* ============================================
   Newsletter Form
   ============================================ */
function initNewsletterForm() {
    const form = document.getElementById('newsletterForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const input = document.getElementById('newsletterEmail');
        const btn = document.getElementById('newsletterSubmitBtn');
        btn.innerHTML = '<span>Subscribed! ✓</span>';
        btn.style.background = '#22c55e';
        input.value = '';
        setTimeout(() => {
            btn.innerHTML = '<span>Subscribe</span><i data-lucide="send"></i>';
            btn.style.background = '';
            lucide.createIcons({ nodes: [btn] });
        }, 3000);
    });
}

/* ============================================
   Payment Gateway Logic
   ============================================ */
function initPaymentGateway() {
    const modalOverlay = document.getElementById('paymentModalOverlay');
    const closeBtn = document.getElementById('paymentClose');
    const paymentForm = document.getElementById('paymentForm');
    const paySubmitBtn = document.getElementById('paySubmitBtn');
    const paymentPlanName = document.getElementById('paymentPlanName');
    const paymentAmount = document.getElementById('paymentAmount');
    
    // Open modal buttons
    const planBtns = document.querySelectorAll('.plan-cta');
    
    planBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Get Plan Info
            const card = btn.closest('.pricing-card');
            if(card) {
                const name = card.querySelector('.plan-name').innerText;
                const isYearly = document.getElementById('toggleSwitch').classList.contains('active');
                const price = card.querySelector(isYearly ? '.yearly-price' : '.monthly-price').innerText;
                
                paymentPlanName.innerText = name + ' Plan (' + (isYearly ? 'Yearly' : 'Monthly') + ')';
                paymentAmount.innerText = '₹' + price;
            } else {
                paymentPlanName.innerText = 'APEX Membership';
                paymentAmount.innerText = 'Secure Payment';
            }
            
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if(e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Payment method tabs
    const methods = document.querySelectorAll('.pay-method');
    methods.forEach(m => {
        m.addEventListener('click', () => {
            methods.forEach(x => x.classList.remove('active'));
            m.classList.add('active');
            
            const label = paymentForm.querySelector('label');
            const input = paymentForm.querySelector('input');
            if(m.innerText === 'Card') {
                label.innerText = 'Card Number';
                input.placeholder = '0000 0000 0000 0000';
            } else if(m.innerText === 'Net Banking') {
                label.innerText = 'Bank Account / User ID';
                input.placeholder = 'Enter ID';
            } else {
                label.innerText = 'Enter UPI ID (GPay, PhonePe, Paytm)';
                input.placeholder = 'example@upi';
            }
        });
    });
    
    // Submit payment
    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        paySubmitBtn.innerHTML = '<span>Processing...</span><i data-lucide="loader"></i>';
        
        setTimeout(() => {
            paySubmitBtn.innerHTML = '<span>Payment Successful!</span><i data-lucide="check-circle"></i>';
            paySubmitBtn.style.background = '#22c55e';
            
            setTimeout(() => {
                modalOverlay.classList.remove('active');
                document.body.style.overflow = '';
                paySubmitBtn.innerHTML = '<span>Pay Now</span><i data-lucide="lock"></i>';
                paySubmitBtn.style.background = '';
                paymentForm.reset();
                lucide.createIcons({ nodes: [paySubmitBtn] });
            }, 2000);
        }, 1500);
    });
}
