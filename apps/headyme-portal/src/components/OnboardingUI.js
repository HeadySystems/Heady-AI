import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from '../services/firebase.js';

export class OnboardingUI {
  constructor(container) {
    this.container = container;
  }

  render() {
    this.container.innerHTML = `
      <div class="onboarding-container">
        <div class="glass-panel">
          <h1>HeadyMe Portal</h1>
          <p class="subtitle">Access the Latent OS Control Plane</p>
          
          <form id="auth-form">
            <div class="input-group">
              <label for="email">Email</label>
              <input type="email" id="email" required placeholder="operative@headysystems.com" />
            </div>
            
            <div class="input-group">
              <label for="password">Password</label>
              <input type="password" id="password" required />
            </div>

            <div class="error-message" id="error-msg"></div>

            <div class="actions">
              <button type="submit" id="login-btn" class="primary-btn">Sign In</button>
              <button type="button" id="signup-btn" class="secondary-btn">Create Account</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const form = document.getElementById('auth-form');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-msg');

    const handleAuth = async (isLogin) => {
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      loginBtn.disabled = true;
      signupBtn.disabled = true;
      errorMsg.textContent = '';

      try {
        if (isLogin) {
          await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        } else {
          await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        }
        // State change handled by global listener in main.js
      } catch (err) {
        errorMsg.textContent = err.message;
        loginBtn.disabled = false;
        signupBtn.disabled = false;
      }
    };

    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleAuth(true);
    });

    signupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleAuth(false);
    });
  }
}
