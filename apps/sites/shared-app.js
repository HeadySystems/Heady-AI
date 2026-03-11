/* ============================================
   HEADY ECOSYSTEM — Shared App Logic
   Theme toggle · Scroll reveal · Mobile menu
   ============================================ */

(function() {
  'use strict';

  /* --- Mobile Menu --- */
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      navToggle.classList.toggle('active');
      const isOpen = navLinks.classList.contains('active');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', function(e) {
      if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('active');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --- Scroll Reveal --- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length > 0) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -34px 0px' });

    reveals.forEach(function(el) { observer.observe(el); });
  }

  /* --- Nav scroll effect --- */
  var lastScroll = 0;
  var nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      var currentScroll = window.pageYOffset;
      if (currentScroll > 89) {
        nav.style.background = 'rgba(10, 10, 15, 0.95)';
      } else {
        nav.style.background = 'rgba(10, 10, 15, 0.85)';
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  /* --- Smooth anchor scrolling --- */
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (navLinks) {
          navLinks.classList.remove('active');
          if (navToggle) {
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
          }
        }
      }
    });
  });

  /* --- Stat counter animation --- */
  var statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length > 0) {
    var statObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          animateNumber(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    statNumbers.forEach(function(el) { statObserver.observe(el); });
  }

  function animateNumber(el) {
    var text = el.textContent;
    var match = text.match(/([\d,]+)/);
    if (!match) return;
    var target = parseInt(match[1].replace(/,/g, ''), 10);
    var suffix = text.replace(match[0], '');
    var prefix = text.substring(0, text.indexOf(match[0]));
    var duration = 1200;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);
      el.textContent = prefix + current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

})();
