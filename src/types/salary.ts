export interface WorkerCompanyContract {
  id: string;
  hasContract: boolean;
  relationType?: number;
  typeLabel?: string;
  hourlyRate?: number;
  companyId?: string;
  companyName?: string;
  label?: string;
  position?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  details?: Record<string, string>;
}

export interface WorkerCompanyStats {
  companyId?: string;
  contractCount: number;
  assignmentCount: number;
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
  companies?: string | null;
  companyNames?: string[];
  companyContracts?: Record<string, WorkerCompanyContract[]>;
  companyStats?: Record<string, WorkerCompanyStats>;
}

export interface SalaryCalculation {
  id: string;
  workerId: string;
  workerName: string;
  baseSalary: number;
  hoursWorked: number;
  overtimeHours: number;
  bonuses: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  taxes: number;
  socialSecurity: number;
  calculationDate: string;
  period: string; // 'monthly' | 'weekly' | 'daily'
  notes?: string;
}

export interface HourEntry {
  id: string;
  workerId: string;
  workerName: string;
  date: string;
  regularHours: number;
  overtimeHours: number;
  description?: string;
  approved: boolean;
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Contract {
  id: string;
  workerId: string;
  contractType: 'full_time' | 'part_time' | 'freelance';
  baseSalary: number;
  hourlyRate?: number;
  startDate: string;
  endDate?: string;
  department: string;
  position: string;
  benefits: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SalaryReport {
  workerId: string;
  workerName: string;
  totalCalculations: number;
  averageGrossSalary: number;
  averageNetSalary: number;
  totalHoursWorked: number;
  lastCalculationDate: string;
}
