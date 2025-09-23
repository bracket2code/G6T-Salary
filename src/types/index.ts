export type Theme = 'light' | 'dark';

export interface User {
  id: string; // Worker ID used across domain tables
  authId?: string; // Supabase auth user id when it differs from worker id
  email: string;
  role: 'admin' | 'supervisor' | 'tecnico';
  name: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  created_at?: string;
  worker_profile?: Partial<Worker>;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'sin_asignar' | 'pendiente' | 'en_progreso' | 'aplazada' | 'cancelada' | 'completada' | 'archivada';
  priority: 'baja' | 'media' | 'alta' | 'critica';
  locationId: string | null;
  locationName?: string;
  createdAt: string;
  updatedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  assignedWorkers?: Worker[];
  attachments?: TaskAttachment[];
  recurrence?: TaskRecurrence;
  requiredSkills?: string[];
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
  skills?: WorkerSkill[];
  locations?: UserLocation[];
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

export interface TaskRecurrence {
  id: string;
  taskId: string;
  recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  patternType?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays' | 'weekends' | 'odd_days' | 'even_days' | 'custom_days' | 'nth_weekday' | 'last_weekday' | 'business_days';
  intervalValue: number; // cada X días/semanas/meses/años
  daysOfWeek?: number[]; // para repetición semanal (0=domingo, 1=lunes, etc.)
  customDays?: number[]; // para días personalizados del mes
  dayOfMonth?: number; // para repetición mensual (1-31)
  monthOfYear?: number; // para repetición anual (1-12)
  nthOccurrence?: number; // para "primer/segundo/tercer" día de la semana
  weekdayType?: number; // tipo de día de la semana (0-6)
  skipHolidays?: boolean; // saltar días festivos
  maxInstances?: number; // máximo número de instancias a generar
  startDate: string;
  endDate: string; // fecha obligatoria de fin de repetición
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface WorkerSkill {
  id: string;
  userId: string;
  skill_type: 'electricidad' | 'electronica' | 'general' | 'fontaneria' | 'construccion' | 'tecnologia' | 'cerrajeria' | 'cristaleria' | 'limpieza' | 'sonido' | 'luces';
  skill_level: 'principiante' | 'intermedio' | 'experto';
  createdAt: string;
  updatedAt?: string;
}

export interface UserLocation {
  id: string;
  location_id: string;
  location_name: string;
  created_at: string;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  workerId: string;
  assignedAt: string;
  assignedBy?: string;
  createdAt: string;
  worker?: Worker;
}

export interface TaskNote {
  id: string;
  taskId: string;
  workerId: string;
  content: string;
  createdAt: string;
  worker?: Worker;
}

export interface DashboardStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  criticalTasks: number;
  tasksByArea: Record<string, number>;
  recentTasks: Task[];
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileType: 'audio' | 'video' | 'image';
  fileUrl: string;
  fileSize?: number;
  duration?: number; // duration in seconds for audio/video
  uploadedBy?: string;
  uploaderName?: string;
  createdAt: string;
}

export interface TaskConversation {
  id: string;
  taskId: string;
  userId: string;
  message: string;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
  attachments?: ConversationAttachment[];
}

export interface ConversationAttachment {
  id: string;
  conversationId: string;
  fileName: string;
  fileType: 'audio' | 'document' | 'image';
  fileUrl: string;
  fileSize?: number;
  duration?: number; // duration in seconds for audio files
  createdAt: string;
}
