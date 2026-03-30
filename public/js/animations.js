/**
 * Scroll Animations
 * IntersectionObserver-based animations (AOS-style, zero dependencies)
 * Optimized for mobile performance
 */
(function() {
  // Animate elements when they enter the viewport
  const animatedElements = document.querySelectorAll('[data-animate]');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add delay if specified
          const delay = entry.target.getAttribute('data-delay');
          if (delay) {
            entry.target.style.transitionDelay = `${delay}ms`;
          }
          entry.target.classList.add('animated');
          observer.unobserve(entry.target); // Only animate once
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(el => observer.observe(el));
  } else {
    // Fallback: show everything immediately
    animatedElements.forEach(el => el.classList.add('animated'));
  }

  // ---- Counter Animation for Stats ----
  function animateCounter(element, target, suffix = '') {
    const duration = 2000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * eased);

      element.textContent = current.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // Observe stat elements
  const statsSection = document.querySelector('.hero-stats');
  if (statsSection) {
    let statsAnimated = false;
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !statsAnimated) {
          statsAnimated = true;

          const statVehicles = document.getElementById('stat-vehicles');
          const statCustomers = document.getElementById('stat-customers');
          const statCities = document.getElementById('stat-cities');
          const statRating = document.getElementById('stat-rating');

          if (statVehicles) animateCounter(statVehicles, 500, '+');
          if (statCustomers) animateCounter(statCustomers, 15, 'K+');
          if (statCities) animateCounter(statCities, 25, '+');
          if (statRating) {
            const ratingDuration = 2000;
            const ratingStart = performance.now();
            function updateRating(currentTime) {
              const elapsed = currentTime - ratingStart;
              const progress = Math.min(elapsed / ratingDuration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = (4.8 * eased).toFixed(1);
              statRating.textContent = current;
              if (progress < 1) requestAnimationFrame(updateRating);
            }
            requestAnimationFrame(updateRating);
          }

          statsObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    statsObserver.observe(statsSection);
  }

  // ---- Parallax-lite for hero section ----
  const hero = document.querySelector('.hero');
  if (hero && window.innerWidth > 768) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const heroHeight = hero.offsetHeight;
          if (scrollY < heroHeight) {
            const content = hero.querySelector('.hero-content');
            if (content) {
              content.style.transform = `translateY(${scrollY * 0.15}px)`;
              content.style.opacity = 1 - (scrollY / heroHeight) * 0.5;
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
})();
