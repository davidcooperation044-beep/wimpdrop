// ===== LUXURY THEME - PREMIUM UI INTERACTIONS =====
// Enhanced interactions for black, gold & blue theme

function initializeLuxuryUI() {
  setupHeaderEffects();
  setupScrollAnimations();
  setupMobileNavigation();
  setupButtonRipples();
  setupCardHovers();
  setupWishlistToggle();
  setupCartInteractions();
  setupScrollToTop();
  setupLazyLoading();
  setupFormEnhancements();
}

// ===== HEADER EFFECTS =====

function setupHeaderEffects() {
  const header = document.querySelector('header');
  if (!header) return;

  let ticking = false;

  function updateHeader() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });
}

// ===== SCROLL ANIMATIONS =====

function setupScrollAnimations() {
  const options = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
        observer.unobserve(entry.target);
      }
    });
  }, options);

  // Observe cards and sections
  document.querySelectorAll('.card, .product-card, .section, .category-card').forEach(el => {
    observer.observe(el);
  });
}

// ===== MOBILE NAVIGATION =====

function setupMobileNavigation() {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  if (!mobileMenuBtn) return;

  mobileMenuBtn.addEventListener('click', () => {
    const nav = document.querySelector('nav');
    if (nav) {
      nav.classList.toggle('active');
      mobileMenuBtn.classList.toggle('active');
    }
  });

  // Close menu on link click
  document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => {
      const nav = document.querySelector('nav');
      if (nav) {
        nav.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
      }
    });
  });
}

// ===== BUTTON RIPPLES =====

function setupButtonRipples() {
  document.querySelectorAll('.btn, .product-actions button').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.style.position = 'absolute';
      ripple.style.width = '0';
      ripple.style.height = '0';
      ripple.style.borderRadius = '50%';
      ripple.style.background = 'rgba(212, 175, 55, 0.6)';
      ripple.style.pointerEvents = 'none';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.style.transform = 'translate(-50%, -50%)';
      ripple.style.animation = 'ripple-expand 0.6s ease-out forwards';
      
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// ===== CARD HOVER EFFECTS =====

function setupCardHovers() {
  const cards = document.querySelectorAll('.card, .product-card, .category-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });
}

// ===== WISHLIST TOGGLE =====

function setupWishlistToggle() {
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      btn.classList.toggle('active');
      
      if (btn.classList.contains('active')) {
        createHeartBurst(e.pageX, e.pageY);
        showNotification('Added to wishlist', 'success');
      } else {
        showNotification('Removed from wishlist', 'info');
      }
    });
  });
}

// ===== HEART BURST ANIMATION =====

function createHeartBurst(x, y) {
  const colors = ['#d4af37', '#e8c547', '#ff69b4', '#ffa500'];
  
  for (let i = 0; i < 8; i++) {
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.style.position = 'fixed';
    heart.style.left = x + 'px';
    heart.style.top = y + 'px';
    heart.style.font Size = '1.5rem';
    heart.style.pointerEvents = 'none';
    heart.style.zIndex = '9999';
    heart.style.animation = `heart-burst 1s ease-out forwards`;
    heart.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
    heart.style.setProperty('--ty', Math.random() * -200 + 'px');
    
    document.body.appendChild(heart);
    
    setTimeout(() => heart.remove(), 1000);
  }
}

// ===== CART INTERACTIONS =====

function setupCartInteractions() {
  const cartBtn = document.querySelector('[data-cart-badge]')?.parentElement;
  if (!cartBtn) return;

  // Listen for custom cart events
  window.addEventListener('addToCart', (e) => {
    const badge = document.querySelector('[data-cart-badge]');
    if (badge) {
      badge.classList.remove('hidden');
      cartBtn.style.animation = 'bounce 0.5s ease';
      setTimeout(() => {
        cartBtn.style.animation = '';
      }, 500);
    }
  });
}

// ===== SCROLL TO TOP =====

function setupScrollToTop() {
  const scrollBtn = document.createElement('button');
  scrollBtn.innerHTML = '↑';
  scrollBtn.className = 'scroll-to-top';
  scrollBtn.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--gold), var(--gold-light));
    color: var(--black);
    border: none;
    cursor: pointer;
    font-size: 1.5rem;
    font-weight: 700;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
    z-index: 1000;
    box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
  `;

  document.body.appendChild(scrollBtn);

  let ticking = false;

  function updateScrollBtn() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 500) {
      scrollBtn.style.opacity = '1';
      scrollBtn.style.pointerEvents = 'auto';
    } else {
      scrollBtn.style.opacity = '0';
      scrollBtn.style.pointerEvents = 'none';
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollBtn);
      ticking = true;
    }
  }, { passive: true });

  scrollBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  scrollBtn.addEventListener('mouseenter', () => {
    scrollBtn.style.transform = 'scale(1.1)';
  });

  scrollBtn.addEventListener('mouseleave', () => {
    scrollBtn.style.transform = '';
  });
}

// ===== LAZY LOADING =====

function setupLazyLoading() {
  const options = {
    threshold: 0.1,
    rootMargin: '50px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  }, options);

  document.querySelectorAll('img[data-src]').forEach(img => {
    observer.observe(img);
  });
}

// ===== FORM ENHANCEMENTS =====

function setupFormEnhancements() {
  // Auto-focus effects
  document.querySelectorAll('input, textarea').forEach(field => {
    field.addEventListener('focus', function() {
      this.parentElement.style.borderColor = 'var(--gold)';
    });

    field.addEventListener('blur', function() {
      this.parentElement.style.borderColor = '';
    });
  });

  // Form validation
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
      let isValid = true;

      form.querySelectorAll('input[required], textarea[required]').forEach(field => {
        if (!field.value.trim()) {
          field.style.borderColor = 'var(--error)';
          isValid = false;
        } else {
          field.style.borderColor = '';
        }
      });

      if (!isValid) {
        e.preventDefault();
        showNotification('Please fill in all required fields', 'error');
      }
    });
  });
}

// ===== NOTIFICATIONS =====

function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    padding: 16px 24px;
    background: ${
      type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' :
      type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
      type === 'warning' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
      'linear-gradient(135deg, #3b82f6, #2563eb)'
    };
    color: white;
    border-radius: 8px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    animation: slideInRight 0.3s ease-out;
    max-width: 300px;
  `;
  notification.textContent = message;

  container.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ===== INJECT ANIMATIONS =====

function injectAnimationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(100px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes slideOutRight {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100px); }
    }

    @keyframes bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    @keyframes ripple-expand {
      0% {
        width: 0;
        height: 0;
        opacity: 1;
      }
      100% {
        width: 300px;
        height: 300px;
        opacity: 0;
      }
    }

    @keyframes heart-burst {
      0% {
        opacity: 1;
        transform: translate(0, 0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(var(--tx), var(--ty)) scale(0);
      }
    }

    .scroll-to-top:hover {
      box-shadow: 0 0 30px rgba(212, 175, 55, 0.8) !important;
    }
  `;
  document.head.appendChild(style);
}

// ===== INITIALIZE =====

document.addEventListener('DOMContentLoaded', () => {
  injectAnimationStyles();
  initializeLuxuryUI();
});

// Fallback for already loaded DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectAnimationStyles();
    initializeLuxuryUI();
  });
} else {
  injectAnimationStyles();
  initializeLuxuryUI();
}
