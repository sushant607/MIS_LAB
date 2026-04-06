// src/services/api.ts - Simpler version
const API_BASE_URL = 'http://localhost:5000/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: string;
  department: string;
  skills: string[];
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    skills: string[];
  };
}

export interface ChatRequest {
  message: string;
};

export interface ChatResponse {
  reply: string;
  toolUsed?: string;
  timestamp?: string;
};

export interface ErrorResponse {
  errors: Array<{ msg: string }>;
}

interface ApiErrorData {
  status: number;
  message: string;
  errors: Array<{ msg: string }>;
}

class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('auth_token');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        const errorData: ApiErrorData = {
          status: response.status,
          message: data.errors?.[0]?.msg || 'An error occurred',
          errors: data.errors || []
        };
        throw errorData;
      }

      return data;
    } catch (error: unknown) {
      // Check if it's already our error format
      if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
        throw error;
      }
      
      // Handle network errors
      const networkError: ApiErrorData = {
        status: 500,
        message: 'Network error. Please check your connection.',
        errors: []
      };
      throw networkError;
    }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.makeRequest<{ status: string }>('/health');
  }

  async chatMessage(chatMessage: ChatRequest): Promise<ChatResponse> {
    return this.makeRequest<ChatResponse> ('/ai-chat', {
      method: 'POST',
      body: JSON.stringify(chatMessage)
    });
  } 
}

export const apiService = new ApiService();
