import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  externalJwt: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

function parseJWT(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (_error) {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  externalJwt: null,
  
  refreshSession: async () => {
    // Session refresh logic can be implemented here if needed
  },
  
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const externalApiUrl = import.meta.env.VITE_API_BASE_URL;
      
      if (!externalApiUrl) {
        throw new Error('API externa no configurada. Configure VITE_API_BASE_URL en las variables de entorno.');
      }

      const requestBody = { 
        username: email,
        password: password,
        appSource: 'g6t-tasker'
      };
      
      const externalApiResponse = await fetch(`${externalApiUrl}/User/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify(requestBody),
      });

      if (!externalApiResponse.ok) {
        const errorText = await externalApiResponse.text();
        throw new Error(`Credenciales incorrectas o error del servidor: ${externalApiResponse.status} - ${errorText}`);
      }

      const externalApiData = await externalApiResponse.json();

      const externalJwt = externalApiData.accessToken;

      if (!externalJwt) {
        throw new Error('Token de acceso no recibido de la API externa');
      }

      set({ externalJwt });
      
      localStorage.setItem('external_jwt', externalJwt);

      // Parse JWT to get user data
      const jwtPayload = parseJWT(externalJwt);
      if (!jwtPayload) {
        throw new Error('JWT inválido recibido');
      }

      // Create user object from JWT data
      const user: User = {
        id: jwtPayload.sub || jwtPayload.id || email,
        email: email.toLowerCase(),
        name: jwtPayload.name || jwtPayload.username || email.split('@')[0],
        role: jwtPayload.role || 'tecnico',
        avatarUrl: jwtPayload.avatar_url || null,
        created_at: new Date().toISOString(),
        organization: jwtPayload.organization,
        companies: jwtPayload.companies,
        workerIdRelation: jwtPayload.workerIdRelation
      };

      set({ user, isLoading: false, error: null });

    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Error durante el inicio de sesión',
        isLoading: false,
      });
    }
  },
  
  logout: async () => {
    set({ isLoading: true });
    try {
      localStorage.removeItem('external_jwt');
      
      set({ user: null, externalJwt: null, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'An error occurred during logout',
        isLoading: false,
      });
    }
  },
  
  checkSession: async () => {
    set({ isLoading: true });
    try {
      // Check if we have a stored JWT
      const storedJwt = localStorage.getItem('external_jwt');
      if (!storedJwt) {
        set({ isLoading: false });
        return;
      }

      // Parse JWT to get user data
      const jwtPayload = parseJWT(storedJwt);
      if (!jwtPayload) {
        localStorage.removeItem('external_jwt');
        set({ isLoading: false });
        return;
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (jwtPayload.exp && jwtPayload.exp < now) {
        localStorage.removeItem('external_jwt');
        set({ isLoading: false });
        return;
      }

      // Create user object from JWT data
      const user: User = {
        id: jwtPayload.sub || jwtPayload.id || 'unknown',
        email: jwtPayload.email || 'unknown@example.com',
        name: jwtPayload.name || jwtPayload.username || 'Usuario',
        role: jwtPayload.role || 'tecnico',
        avatarUrl: jwtPayload.avatar_url || null,
        created_at: jwtPayload.iat ? new Date(jwtPayload.iat * 1000).toISOString() : new Date().toISOString(),
        organization: jwtPayload.organization,
        companies: jwtPayload.companies,
        workerIdRelation: jwtPayload.workerIdRelation
      };

      set({ user, externalJwt: storedJwt, isLoading: false, error: null });

    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Error checking session',
        isLoading: false,
      });
    }
  },
}));
