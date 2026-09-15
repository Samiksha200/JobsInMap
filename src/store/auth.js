import { defineStore } from "pinia";
import axios from "axios";

// Configure axios default for credentials (httpOnly cookies)
axios.defaults.withCredentials = true;

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    token: localStorage.getItem("token") || null,
    loading: false,
    error: null,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  }),

  getters: {
    isAuthenticated: (state) => !!state.user || !!state.token,
    userName: (state) => state.user?.name || "User",
  },

  actions: {
    setToken(token) {
      this.token = token;
      if (token) {
        localStorage.setItem("token", token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      } else {
        localStorage.removeItem("token");
        delete axios.defaults.headers.common["Authorization"];
      }
    },

    setUser(user) {
      this.user = user;
    },

    async signup({ name, email, password }) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post(`${this.apiBaseUrl}/auth/signup`, {
          name,
          email,
          password,
        });

        if (response.data.success) {
          this.setUser(response.data.user);
          if (response.data.token) {
            this.setToken(response.data.token);
          }
        }
        return response.data;
      } catch (err) {
        this.error = err.response?.data?.message || "Failed to sign up";
        throw new Error(this.error);
      } finally {
        this.loading = false;
      }
    },

    async login({ email, password }) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post(`${this.apiBaseUrl}/auth/login`, {
          email,
          password,
        });

        if (response.data.success) {
          this.setUser(response.data.user);
          if (response.data.token) {
            this.setToken(response.data.token);
          }
        }
        return response.data;
      } catch (err) {
        this.error = err.response?.data?.message || "Invalid email or password";
        throw new Error(this.error);
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await axios.post(`${this.apiBaseUrl}/auth/logout`);
      } catch (err) {
        console.warn("Logout error:", err);
      } finally {
        this.setToken(null);
        this.setUser(null);
      }
    },

    async fetchCurrentUser() {
      try {
        const response = await axios.get(`${this.apiBaseUrl}/auth/me`);
        if (response.data.success) {
          this.setUser(response.data.user);
          return response.data.user;
        }
      } catch (err) {
        this.setUser(null);
        return null;
      }
    },
  },
});
