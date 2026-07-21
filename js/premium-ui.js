/* ========================================
   WIMP-DROP PREMIUM UI ENHANCEMENTS
   Modern Animations & Micro-Interactions
   ======================================== */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  initializePremiumUI();
});

// Main Premium UI Initialization
function initializePremiumUI() {
  setupHeaderEffects();
  setupScrollAnimations();
  setupMobileNavigation();
  setupInteractions();
  setupPageTransitions();
  setupLazyLoading();
}

// ==================== HEADER EFFECTS ====================
function setupHeaderEffects() {
  const header = document.querySelector('header');
  if (!header) return;
  
  let lastScrollTop = 0;
  const scrollThreshold = 50;
  
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > scrollThreshold) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    
    lastScrollTop = scrollTop;
  }, { passive: true });
}

// ==================== SCROLL ANIMATIONS ====================
function setupScrollAnimations() {
  const observerOptions = {
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
  }, observerOptions);
  
  // Observe all sections and cards
  document.querySelectorAll('section, .product-card, .counter-card, .panel-item').forEach(el => {
    observer.observe(el);
  });
}

// ==================== MOBILE NAVIGATION ====================
function setupMobileNavigation() {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const header = document.querySelector('header');
  
  if (!mobileMenuBtn) return;
  
  // Create mobile menu
  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'mobile-menu';
  mobileMenu.innerHTML = `
    <div class="mobile-menu-content">
      <a href="/index.html" class="mobile-menu-link">Home</a>
      <a href="/pages/shop.html" class="mobile-menu-link">Shop</a>
      <a href="/pages/about.html" class="mobile-menu-link">About</a>
      <a href="/pages/contact.html" class="mobile-menu-link">Contact</a>
    </div>
  `;
  document.body.appendChild(mobileMenu);
  
  // Toggle menu
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
  });
  
  // Close menu when link clicked
  mobileMenu.querySelectorAll('.mobile-menu-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('active');
    });
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      mobileMenu.classList.remove('active');
    }
  });
}

// ==================== INTERACTIONS ====================
function setupInteractions() {
  setupButtonRipples();
  setupProductCardHovers();
  setupWishlistToggle();
  setupCartInteractions();
  setupFormAnimations();
}

function setupButtonRipples() {
  document.querySelectorAll('.btn, .icon-btn, .product-actions button').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.style.position = 'absolute';
      ripple.style.width = '20px';
      ripple.style.height = '20px';
      ripple.style.background = 'rgba(255,255,255,0.6)';
      ripple.style.borderRadius = '50%';
      ripple.style.pointerEvents = 'none';
      ripple.style.animation = 'ripple 0.6s ease-out';
      
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

function setupProductCardHovers() {
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-12px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0) scale(1)';
    });
  });
}

function setupWishlistToggle() {
  document.querySelectorAll('.product-wishlist, [data-wishlist-btn]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      this.classList.toggle('active');
      
      // Burst animation
      if (this.classList.contains('active')) {
        createHeartBurst(this);
      }
    });
  });
}

function createHeartBurst(element) {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  for (let i = 0; i < 8; i++) {
    const heart = document.createElement('div');
    heart.innerHTML = '❤';
    heart.style.position = 'fixed';
    heart.style.left = x + 'px';
    heart.style.top = y + 'px';
    heart.style.pointerEvents = 'none';
    heart.style.fontSize = '1.5rem';
    heart.style.animation = `heartBurst 0.8s ease-out forwards`;
    heart.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
    heart.style.setProperty('--ty', Math.random() * -100 - 50 + 'px');
    
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 800);
  }
}

function setupCartInteractions() {
  // Cart bounce animation
  const cartBtn = document.querySelector('[data-cart-badge]');
  if (cartBtn) {
    document.addEventListener('addToCart', () => {
      cartBtn.style.animation = 'bounce 0.5s ease-out';
      setTimeout(() => cartBtn.style.animation = '', 500);
    });
  }
}

function setupFormAnimations() {
  document.querySelectorAll('.form-group input, .form-group textarea').forEach(input => {
    input.addEventListener('focus', function() {
      this.parentElement.style.animation = 'fadeInUp 0.3s ease-out';
    });
  });
}

// ==================== PAGE TRANSITIONS ====================
function setupPageTransitions() {
  document.querySelectorAll('a:not([target="_blank"]):not([data-no-transition])').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      
      // Don't transition for hash links or external links
      if (href.startsWith('#') || href.includes('://')) {
        return;
      }
      
      e.preventDefault();
      
      const fadeOut = document.createElement('div');
      fadeOut.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--bg-primary);
        animation: fadeIn 0.3s ease-out;
        z-index: 9999;
        pointer-events: none;
      `;
      
      document.body.appendChild(fadeOut);
      
      setTimeout(() => {
        window.location.href = href;
      }, 150);
    });
  });
}

// ==================== LAZY LOADING ====================
function setupLazyLoading() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px'
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

// ==================== COUNTER ANIMATION ====================
function animateCounter(element, target, duration = 2000) {
  const start = 0;
  const startTime = Date.now();
  
  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const value = Math.floor(start + (target - start) * easeOutQuad(progress));
    element.textContent = value;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

function easeOutQuad(t) {
  return t * (2 - t);
}

// ==================== NOTIFICATION SYSTEM ====================
function showNotification(message, type = 'info', duration = 4000) {
  const container = document.getElementById('notification-container') || createNotificationContainer();
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1rem;">
      <span>${getNotificationIcon(type)}</span>
      <span>${message}</span>
    </div>
  `;
  
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.id = 'notification-container';
  container.style.cssText = `
    position: fixed;
    top: 1.5rem;
    left: 1.5rem;
    right: 1.5rem;
    z-index: var(--z-modal);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    pointer-events: none;
  `;
  document.body.appendChild(container);
  return container;
}

function getNotificationIcon(type) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || icons.info;
}

// ==================== SCROLL TO TOP ====================
function setupScrollToTop() {
  const scrollBtn = document.createElement('button');
  scrollBtn.innerHTML = '↑';
  scrollBtn.className = 'scroll-to-top';
  scrollBtn.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #FF4D4D, #FF7A45);
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    display: none;
    z-index: 999;
    box-shadow: 0 4px 12px rgba(255, 77, 77, 0.3);
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(scrollBtn);
  
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 500) {
      scrollBtn.style.display = 'flex';
      scrollBtn.style.alignItems = 'center';
      scrollBtn.style.justifyContent = 'center';
    } else {
      scrollBtn.style.display = 'none';
    }
  });
  
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

setupScrollToTop();

// ==================== GLOBAL ANIMATIONS ====================
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple {
    to {
      width: 300px;
      height: 300px;
      opacity: 0;
    }
  }
  
  @keyframes heartBurst {
    0% {
      opacity: 1;
      transform: translate(0, 0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(var(--tx), var(--ty)) scale(0);
    }
  }
  
  @keyframes bounce {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
  }
  
  @keyframes fadeOut {
    to {
      opacity: 0;
    }
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .scroll-to-top:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(255, 77, 77, 0.4);
  }
  
  .scroll-to-top:active {
    transform: scale(0.95);
  }
`;

document.head.appendChild(style);

// Export for use in other scripts
window.PremiumUI = {
  showNotification,
  animateCounter,
  createHeartBurst
};
