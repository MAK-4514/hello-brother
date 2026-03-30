/**
 * Main Application Script
 * Navigation, form handling, and global interactions
 */
(function() {
  // =========================================
  // Initialize Lucide Icons
  // =========================================
  document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
      lucide.createIcons();
    }
  });

  // =========================================
  // Navbar Scroll Effect
  // =========================================
  const navbar = document.getElementById('navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  }, { passive: true });

  // =========================================
  // Active Nav Link on Scroll
  // =========================================
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link[data-section]');

  function updateActiveLink() {
    const scrollY = window.scrollY + 200;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });

  // =========================================
  // Mobile Hamburger Menu
  // =========================================
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  const navOverlay = document.getElementById('nav-overlay');

  function toggleMenu() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('open');
    navOverlay.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
  }

  function closeMenu() {
    hamburger.classList.remove('active');
    navMenu.classList.remove('open');
    navOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', toggleMenu);
  navOverlay.addEventListener('click', closeMenu);

  // Close mobile menu on nav link click
  navLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // =========================================
  // Smooth Scroll for Anchor Links
  // =========================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        const navHeight = navbar.offsetHeight;
        const targetPos = target.offsetTop - navHeight - 20;
        window.scrollTo({
          top: targetPos,
          behavior: 'smooth'
        });
      }
    });
  });

  // =========================================
  // Booking Form Handler
  // =========================================
  const bookingForm = document.getElementById('booking-form');

  if (bookingForm) {
    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('booking-start');
    const endInput = document.getElementById('booking-end');

    if (startInput) startInput.min = today;
    if (endInput) endInput.min = today;

    // Update end min when start changes
    startInput?.addEventListener('change', () => {
      if (endInput) {
        endInput.min = startInput.value;
        if (endInput.value && endInput.value < startInput.value) {
          endInput.value = startInput.value;
        }
      }
    });

    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('booking-submit-btn');
      const originalText = submitBtn.innerHTML;

      // Loading state
      submitBtn.innerHTML = `
        <svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Sending...
      `;
      submitBtn.disabled = true;

      // Collect form data
      const formData = {
        name: document.getElementById('booking-name').value,
        phone: document.getElementById('booking-phone').value,
        email: document.getElementById('booking-email').value,
        service: document.getElementById('booking-service').value,
        startDate: document.getElementById('booking-start').value,
        endDate: document.getElementById('booking-end').value,
        message: document.getElementById('booking-message').value
      };

      try {
        // Try to send to backend
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        // Show success regardless (demo mode)
        showNotification('✅ Booking request submitted! Our team will contact you within 30 minutes.', 'success');
        bookingForm.reset();
      } catch (error) {
        // Still show success for demo
        showNotification('✅ Booking request received! We\'ll reach out to you shortly.', 'success');
        bookingForm.reset();
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // =========================================
  // Notification Toast
  // =========================================
  function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.style.cssText = `
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 10000;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'};
      border: 1px solid ${type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'};
      backdrop-filter: blur(20px);
      border-radius: 12px;
      color: #f8fafc;
      font-size: 0.9rem;
      font-family: 'Inter', sans-serif;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    toast.textContent = message;

    // Add animation keyframes
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // =========================================
  // Service Card Click — scroll to booking
  // =========================================
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking a link inside
      if (e.target.closest('a')) return;

      const serviceSelect = document.getElementById('booking-service');
      const cardId = card.id;

      // Map card to service option
      const serviceMap = {
        'service-cars': 'car',
        'service-bikes': 'bike',
        'service-cameras': 'camera',
        'service-holidays': 'holiday'
      };

      if (serviceSelect && serviceMap[cardId]) {
        serviceSelect.value = serviceMap[cardId];
      }

      // Scroll to form
      const contact = document.getElementById('contact');
      if (contact) {
        const navHeight = navbar.offsetHeight;
        window.scrollTo({
          top: contact.offsetTop - navHeight - 20,
          behavior: 'smooth'
        });
      }
    });
  });

  // =========================================
  // Lazy load images
  // =========================================
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  }

  // =========================================
  // Keyboard Accessibility
  // =========================================
  hamburger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMenu();
    }
  });

})();
