<template>
  <div class="page-container">
    <div class="card">
      <div class="tab-header">
        <button
          :class="['tab-btn', { active: mode === 'login' }]"
          @click="switchMode('login')"
        >
          Sign In
        </button>
        <button
          :class="['tab-btn', { active: mode === 'signup' }]"
          @click="switchMode('signup')"
        >
          Create Account
        </button>
      </div>

      <h2>{{ mode === 'login' ? 'Welcome Back' : 'Get Started' }}</h2>
      <p class="subtitle">
        {{
          mode === 'login'
            ? 'Sign in to access your mapped jobs & applications'
            : 'Create an account to track your location-based job search'
        }}
      </p>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="success-banner">
        {{ successMessage }}
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div v-if="mode === 'signup'" class="form-group">
          <label for="name">Full Name</label>
          <input
            id="name"
            v-model="name"
            type="text"
            required
            placeholder="Jane Doe"
          />
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="jane@example.com"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="6"
            placeholder="At least 6 characters"
          />
        </div>

        <button type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Sign Up' }}
        </button>
      </form>

      <div class="divider">
        <span>or</span>
      </div>

      <div class="oauth-section">
        <button class="google-btn" @click="handleGoogleLogin">
          <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../store/auth.js";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const mode = ref("login");
const name = ref("");
const email = ref("");
const password = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);

onMounted(() => {
  if (route.query.error === "google_not_configured") {
    errorMessage.value =
      "⚠️ Google Sign-In is not configured yet. Please sign in or register with Email & Password above, or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.";
  } else if (route.query.error === "google_cancelled") {
    errorMessage.value = "Google sign-in was cancelled.";
  } else if (route.query.error) {
    errorMessage.value = `Google sign-in failed (${route.query.error}). Please try email & password.`;
  }
});

const switchMode = (newMode) => {
  mode.value = newMode;
  errorMessage.value = "";
  successMessage.value = "";
};

const handleSubmit = async () => {
  errorMessage.value = "";
  successMessage.value = "";
  loading.value = true;

  try {
    if (mode.value === "signup") {
      await authStore.signup({
        name: name.value,
        email: email.value,
        password: password.value,
      });
      successMessage.value = "Account created successfully! Redirecting...";
    } else {
      await authStore.login({
        email: email.value,
        password: password.value,
      });
      successMessage.value = "Logged in successfully! Redirecting...";
    }

    setTimeout(() => {
      router.push("/");
    }, 1000);
  } catch (err) {
    errorMessage.value = err.message || "Authentication failed";
  } finally {
    loading.value = false;
  }
};

const handleGoogleLogin = () => {
  window.location.href = `${authStore.apiBaseUrl}/auth/google`;
};
</script>

<style scoped>
.page-container {
  max-width: 460px;
  margin: 3rem auto;
  padding: 0 1rem;
}
.card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
}
.tab-header {
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 1.5rem;
}
.tab-btn {
  flex: 1;
  padding: 0.6rem;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.active {
  background: white;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
h2 {
  color: #0f172a;
  margin-bottom: 0.25rem;
}
.subtitle {
  color: #64748b;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}
.error-banner {
  background-color: #fee2e2;
  color: #991b1b;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  text-align: left;
}
.success-banner {
  background-color: #dcfce7;
  color: #166534;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  text-align: left;
}
.auth-form {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}
input {
  padding: 0.65rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}
input:focus {
  border-color: #0284c7;
}
.submit-btn {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #0284c7;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}
.submit-btn:hover:not(:disabled) {
  background-color: #0369a1;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  color: #94a3b8;
  font-size: 0.85rem;
}
.divider::before,
.divider::after {
  content: "";
  flex: 1;
  border-bottom: 1px solid #e2e8f0;
}
.divider span {
  padding: 0 0.75rem;
}
.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 1rem;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
}
.google-btn:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}
</style>
