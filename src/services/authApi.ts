/**
 * Smile Clinic — Authentication API Service
 * Connects frontend Signup, OTP Verification, and Login to the FastAPI Backend
 */

const API_BASE_URL = (
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8000' : '')
).replace(/\/$/, '');

export interface SignupPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  country_code?: string;
  role?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string;
  age?: number;
  gender?: string;
  height?: string;
  weight?: string;
  hasAllergies?: boolean;
  allergiesDescription?: string;
  profileCompleted?: boolean;
  authProvider?: string;
  twoFactorEnabled?: boolean;
}

export interface AuthApiResponse {
  status: 'success' | 'error' | 'otp_required';
  message: string;
  token?: string;
  user?: UserProfile;
  dev_otp?: string;
}

export const authApi = {
  /**
   * Register a new clinician account and trigger OTP dispatch
   */
  async signup(payload: SignupPayload): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Registration failed');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server. Please ensure the backend server is running on port 8000.');
      }
      throw err;
    }
  },

  /**
   * Verify the 6-digit OTP code and retrieve session JWT token
   */
  async verifyOtp(email: string, otp_code: string): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp_code: otp_code.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Invalid or expired OTP code');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server. Please check connection.');
      }
      throw err;
    }
  },

  /**
   * Resend a fresh 6-digit OTP to the clinician's email
   */
  async resendOtp(email: string): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to resend code');
      }
      return data;
    } catch (err: any) {
      throw err;
    }
  },

  /**
   * Log in with verified email and password
   */
  async login(
    email: string,
    password: string,
    remember_device: boolean = true,
    device_id?: string
  ): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          remember_device,
          device_id
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Login failed. Please check credentials.');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to connect to clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Verify the 2FA login OTP dispatched when Remember Device is unchecked
   */
  async verifyLoginOtp(
    email: string,
    otp_code: string,
    remember_device: boolean = false,
    device_id?: string
  ): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp_code: otp_code.trim(),
          remember_device,
          device_id
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Invalid or expired sign-in code.');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to connect to clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Request password reset OTP to clinician email
   */
  async forgotPassword(email: string): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Password reset request failed');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Reset password with verified 6-digit OTP
   */
  async resetPassword(email: string, otp_code: string, new_password: string): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp_code: otp_code.trim(),
          new_password
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Password reset failed');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Toggle Two-Factor Authentication on/off in the database
   */
  async toggle2FA(email: string, enabled: boolean): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/toggle-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, enabled })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to update Two-Factor Authentication status.');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Authenticate or register via Google OAuth credential
   */
  async googleAuth(
    email: string,
    fullName: string,
    idToken?: string,
    photoUrl?: string,
    deviceId?: string
  ): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          id_token: idToken || '',
          photo_url: photoUrl || '',
          device_id: deviceId || ''
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        data = { message: text || `Authentication server responded with status ${res.status}` };
      }
      if (!res.ok) {
        throw new Error(data.detail || data.message || `Google authentication failed (${res.status}).`);
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Validate password reset 6-digit OTP code against backend
   */
  async verifyResetOtp(email: string, otp_code: string): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp_code: otp_code.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Invalid or expired verification code.');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Verify clinician's current/previous password directly without requiring OTP
   */
  async verifyCurrentPassword(email: string, password: string): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Incorrect current password. Please enter your valid clinical password.');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Update clinical password directly using verified current password (no OTP needed)
   */
  async changePasswordWithCurrent(email: string, current_password: string, new_password: string): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          current_password,
          new_password
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to update clinical password.');
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical authentication server.');
      }
      throw err;
    }
  },

  /**
   * Update clinical health profile details (Age, Gender, Height, Weight, Allergies, Phone, Name)
   */
  async updateProfile(payload: {
    email: string;
    full_name?: string;
    phone?: string;
    age?: number;
    gender?: string;
    height?: string;
    weight?: string;
    has_allergies?: boolean;
    allergies_description?: string;
    profile_completed?: boolean;
  }): Promise<AuthApiResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to update user profile.');
      }
      if (data.user) {
        this.saveSession(data.token || localStorage.getItem('smileclinic_jwt_token') || '', data.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`profile_completed_${data.user.email.toLowerCase()}`, 'true');
        }
      }
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to reach clinical server to save profile.');
      }
      throw err;
    }
  },

  /**
   * Fetch current clinical profile status from backend to sync cross-device completion
   */
  async getProfileStatus(email: string): Promise<{ status: string; profileCompleted: boolean; user?: UserProfile }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) return { status: 'error', profileCompleted: false };
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/profile-status?email=${encodeURIComponent(cleanEmail)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        return { status: 'error', profileCompleted: false };
      }
      const data = await res.json();
      if (data && data.profileCompleted) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`profile_completed_${cleanEmail}`, 'true');
          if (data.user) {
            localStorage.setItem('smileclinic_auth_user', JSON.stringify(data.user));
          }
        }
      }
      return data;
    } catch {
      const isLocalDone = typeof window !== 'undefined' && localStorage.getItem(`profile_completed_${email.trim().toLowerCase()}`) === 'true';
      return { status: 'offline', profileCompleted: isLocalDone };
    }
  },

  /**
   * Persist session JWT and clinician profile
   */
  saveSession(token: string, user: UserProfile): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('rxguard_authenticated', 'true');
    if (token) sessionStorage.setItem('rxguard_jwt_token', token);
    sessionStorage.setItem('rxguard_prescriber_name', user.fullName);
    sessionStorage.setItem('rxguard_prescriber_email', user.email);
    sessionStorage.setItem('rxguard_prescriber_role', user.role);
    sessionStorage.setItem('rxguard_prescriber_id', user.id);
    sessionStorage.setItem('rxguard_prescriber_npi', user.id);
    if (user.authProvider) {
      sessionStorage.setItem('rxguard_auth_provider', user.authProvider);
      localStorage.setItem('rxguard_auth_provider', user.authProvider);
    }
    if (user.phone) sessionStorage.setItem('rxguard_prescriber_phone', user.phone);
    if (user.twoFactorEnabled !== undefined) {
      sessionStorage.setItem('rxguard_two_factor_enabled', String(user.twoFactorEnabled));
    }
    if (token) localStorage.setItem('smileclinic_jwt_token', token);
    localStorage.setItem('smileclinic_auth_user', JSON.stringify(user));
    if (user.profileCompleted) {
      localStorage.setItem(`profile_completed_${user.email.toLowerCase()}`, 'true');
    }
  },

  /**
   * Register or update an active workstation session on the backend
   */
  async recordSession(payload: {
    email: string;
    device_id: string;
    device_name: string;
    browser_os: string;
    ip_address?: string;
    location?: string;
    status?: string;
    details?: string;
  }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/record-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * Retrieve all active and historical sessions across devices from PostgreSQL
   */
  async getSessions(email: string, current_device_id?: string): Promise<{ status: string; sessions: any[]; history: any[] }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const currDev = current_device_id || '';
      const res = await fetch(
        `${API_BASE_URL}/api/v1/auth/sessions?email=${encodeURIComponent(cleanEmail)}&current_device_id=${encodeURIComponent(currDev)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return await res.json();
    } catch {
      return { status: 'offline', sessions: [], history: [] };
    }
  },

  /**
   * Revoke a specific workstation session remotely
   */
  async revokeSession(email: string, device_id?: string, session_id?: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/revoke-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          device_id,
          session_id
        })
      });
      return await res.json();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to revoke workstation session');
    }
  },

  /**
   * Heartbeat to verify if this client device has been remotely revoked/logged out
   */
  async checkSessionStatus(email: string, device_id: string): Promise<{ valid: boolean; active: boolean; revoked?: boolean; message?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(
        `${API_BASE_URL}/api/v1/auth/session-status?email=${encodeURIComponent(cleanEmail)}&device_id=${encodeURIComponent(device_id)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      if (!res.ok) return { valid: true, active: true, revoked: false };
      return await res.json();
    } catch {
      return { valid: true, active: true, revoked: false };
    }
  },

  /**
   * Clear session on logout
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('rxguard_authenticated');
    sessionStorage.removeItem('rxguard_jwt_token');
    sessionStorage.removeItem('rxguard_prescriber_name');
    sessionStorage.removeItem('rxguard_prescriber_email');
    sessionStorage.removeItem('rxguard_prescriber_role');
    sessionStorage.removeItem('rxguard_prescriber_id');
    sessionStorage.removeItem('rxguard_prescriber_npi');
    sessionStorage.removeItem('rxguard_auth_provider');
    sessionStorage.removeItem('rxguard_two_factor_enabled');
    localStorage.removeItem('rxguard_auth_provider');
    localStorage.removeItem('smileclinic_jwt_token');
    localStorage.removeItem('smileclinic_auth_user');
  }
};
