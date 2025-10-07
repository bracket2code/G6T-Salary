export type Theme = 'light' | 'dark';

export interface User {
  id: string; // Worker ID used across domain tables
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'tecnico';
  avatarUrl?: string | null;
  created_at?: string;
  // Additional JWT fields
  organization?: string;
  companies?: string; // JSON string array
  workerIdRelation?: string;
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'tecnico';
  phone: string | null;
  createdAt: string;
  updatedAt: string | null;
  avatarUrl: string | null;
  // Salary specific fields
  baseSalary?: number;
  hourlyRate?: number;
  contractType?: 'full_time' | 'part_time' | 'freelance';
  department?: string;
  position?: string;
  startDate?: string;
  dni?: string;
  socialSecurity?: string;
  birthDate?: string;
  address?: string;
  iban?: string;
  category?: string;
  categoryId?: string;
  subcategory?: string;
  subcategoryId?: string;
  staffType?: string;
}

export interface Location {
  id: string;
  name: string;
  createdAt: string;
  // Datos fiscales
  cif?: string;
  companyName?: string;
  // Dirección
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  // Contacto
  contactPerson?: string;
  phone?: string;
  email?: string;
  // Notas
  notes?: string;
}
