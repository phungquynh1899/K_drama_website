// Global Authentication Management
const AuthManager = {
    // Token management
    getAccessToken() {
        return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    },

    getRefreshToken() {
        return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    },

    isTokenExpired() {
        const expiry = localStorage.getItem('tokenExpiry') || sessionStorage.getItem('tokenExpiry');
        return expiry && Date.now() > parseInt(expiry);
    },

    setTokens(accessToken, refreshToken, remember = false) {
        if (remember) {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('tokenExpiry', Date.now() + (3 * 24 * 60 * 60 * 1000));
        } else {
            sessionStorage.setItem('accessToken', accessToken);
            sessionStorage.setItem('refreshToken', refreshToken);
            sessionStorage.setItem('tokenExpiry', Date.now() + (3 * 24 * 60 * 60 * 1000));
        }
    },

    clearTokens() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('tokenExpiry');
    },

    async refreshAccessToken() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch('/api/v1/auth/refreshToken', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const result = await response.json();
            const newAccessToken = result.metadata.accessToken;
            
            // Update the stored access token
            if (localStorage.getItem('accessToken')) {
                localStorage.setItem('accessToken', newAccessToken);
                localStorage.setItem('tokenExpiry', Date.now() + (3 * 24 * 60 * 60 * 1000));
            } else {
                sessionStorage.setItem('accessToken', newAccessToken);
                sessionStorage.setItem('tokenExpiry', Date.now() + (3 * 24 * 60 * 60 * 1000));
            }

            return newAccessToken;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearTokens();
            throw error;
        }
    },

    // Authentication state
    isAuthenticated() {
        return !!this.getAccessToken() && !this.isTokenExpired();
    },

    // User management
    async getUserInfo() {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            const response = await fetch('/api/v1/user/profile', {
                headers: {
                    'Authorization': `Bearer ${this.getAccessToken()}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    return this.getUserInfo(); // Retry with new token
                }
                throw new Error('Failed to get user info');
            }

            const result = await response.json();
            return result.metadata;
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    },

    // Logout
    async logout() {
        try {
            const response = await fetch('/api/v1/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAccessToken()}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearTokens();
            window.location.href = '/';
        }
    },

    // Auto-refresh token
    startAutoRefresh() {
        setInterval(async () => {
            if (this.isTokenExpired()) {
                try {
                    await this.refreshAccessToken();
                } catch (error) {
                    console.error('Auto token refresh failed:', error);
                    this.clearTokens();
                    window.location.href = '/auth/login';
                }
            }
        }, 60000); // Check every minute
    },

    // Update UI based on auth state
    async updateAuthUI() {
        const userInfo = await this.getUserInfo();
        const authElements = document.querySelectorAll('[data-auth]');
        
        authElements.forEach(element => {
            const authType = element.getAttribute('data-auth');
            
            if (authType === 'user-info' && userInfo) {
                const email = userInfo.email;
                const firstLetter = email.charAt(0).toUpperCase();
                
                // Update user avatar
                const avatar = element.querySelector('.user-avatar');
                if (avatar) {
                    avatar.textContent = firstLetter;
                }
                
                // Update user email
                const emailElement = element.querySelector('.user-email');
                if (emailElement) {
                    emailElement.textContent = email;
                }
                
                element.style.display = 'block';
            } else if (authType === 'login-link' && !userInfo) {
                element.style.display = 'block';
            } else if (authType === 'logout-link' && userInfo) {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });
    }
};

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Start auto token refresh
    AuthManager.startAutoRefresh();
    
    // Update UI based on auth state
    AuthManager.updateAuthUI();
});

// Export for use in other scripts
window.AuthManager = AuthManager; 