export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: 'sin_asignar' | 'pendiente' | 'en_progreso' | 'en_proceso' | 'aplazada' | 'completada' | 'cancelada' | 'archivada';
          priority: 'baja' | 'media' | 'alta' | 'critica';
          location_id: string | null;
          start_date: string | null;
          end_date: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: 'sin_asignar' | 'pendiente' | 'en_progreso' | 'en_proceso' | 'aplazada' | 'completada' | 'cancelada' | 'archivada';
          priority?: 'baja' | 'media' | 'alta' | 'critica';
          location_id?: string | null;
          start_date?: string | null;
          end_date: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: 'sin_asignar' | 'pendiente' | 'en_progreso' | 'en_proceso' | 'aplazada' | 'completada' | 'cancelada' | 'archivada';
          priority?: 'baja' | 'media' | 'alta' | 'critica';
          location_id?: string | null;
          start_date?: string | null;
          end_date?: string;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      workers: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'admin' | 'supervisor' | 'tecnico';
          phone: string | null;
          created_at: string;
          updated_at: string | null;
          avatar_url: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: 'admin' | 'supervisor' | 'tecnico';
          phone?: string | null;
          created_at?: string;
          updated_at?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: 'admin' | 'supervisor' | 'tecnico';
          phone?: string | null;
          created_at?: string;
          updated_at?: string | null;
          avatar_url?: string | null;
        };
      };
      locations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          cif: string | null;
          company_name: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          province: string | null;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          cif?: string | null;
          company_name?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          province?: string | null;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          cif?: string | null;
          company_name?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          province?: string | null;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      user_locations: {
        Row: {
          id: string;
          user_id: string;
          location_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          location_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          location_id?: string;
          created_at?: string | null;
        };
      };
      user_skills: {
        Row: {
          id: string;
          user_id: string;
          skill_type: 'electricidad' | 'electronica' | 'general' | 'fontaneria' | 'construccion' | 'tecnologia' | 'cerrajeria' | 'cristaleria' | 'limpieza' | 'sonido';
          skill_level: 'principiante' | 'intermedio' | 'experto';
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          skill_type: 'electricidad' | 'electronica' | 'general' | 'fontaneria' | 'construccion' | 'tecnologia' | 'cerrajeria' | 'cristaleria' | 'limpieza' | 'sonido';
          skill_level?: 'principiante' | 'intermedio' | 'experto';
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          skill_type?: 'electricidad' | 'electronica' | 'general' | 'fontaneria' | 'construccion' | 'tecnologia' | 'cerrajeria' | 'cristaleria' | 'limpieza' | 'sonido';
          skill_level?: 'principiante' | 'intermedio' | 'experto';
          created_at?: string;
          updated_at?: string | null;
        };
      };
      task_assignments: {
        Row: {
          id: string;
          task_id: string;
          worker_id: string;
          assigned_at: string;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          worker_id: string;
          assigned_at?: string;
          assigned_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          worker_id?: string;
          assigned_at?: string;
          assigned_by?: string | null;
          created_at?: string;
        };
      };
      task_attachments: {
        Row: {
          id: string;
          task_id: string;
          file_name: string;
          file_type: string;
          file_url: string;
          file_size: number | null;
          duration: number | null;
          uploaded_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          file_name: string;
          file_type: string;
          file_url: string;
          file_size?: number | null;
          duration?: number | null;
          uploaded_by?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          file_name?: string;
          file_type?: string;
          file_url?: string;
          file_size?: number | null;
          duration?: number | null;
          uploaded_by?: string | null;
          created_at?: string | null;
        };
      };
      task_recurrence: {
        Row: {
          id: string;
          task_id: string;
          recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
          interval_value: number;
          days_of_week: number[] | null;
          day_of_month: number | null;
          month_of_year: number | null;
          start_date: string;
          end_date: string;
          status: 'active' | 'paused' | 'completed' | 'cancelled';
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
          interval_value?: number;
          days_of_week?: number[] | null;
          day_of_month?: number | null;
          month_of_year?: number | null;
          start_date: string;
          end_date: string;
          status?: 'active' | 'paused' | 'completed' | 'cancelled';
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
          interval_value?: number;
          days_of_week?: number[] | null;
          day_of_month?: number | null;
          month_of_year?: number | null;
          start_date?: string;
          end_date?: string;
          status?: 'active' | 'paused' | 'completed' | 'cancelled';
          created_at?: string;
          updated_at?: string | null;
        };
      };
      recurring_task_instances: {
        Row: {
          id: string;
          recurrence_id: string;
          original_task_id: string;
          generated_task_id: string;
          scheduled_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          recurrence_id: string;
          original_task_id: string;
          generated_task_id: string;
          scheduled_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          recurrence_id?: string;
          original_task_id?: string;
          generated_task_id?: string;
          scheduled_date?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      task_status: 'sin_asignar' | 'pendiente' | 'en_progreso' | 'en_proceso' | 'aplazada' | 'completada' | 'cancelada' | 'archivada';
      task_priority: 'baja' | 'media' | 'alta' | 'critica';
      worker_role: 'admin' | 'supervisor' | 'tecnico';
      skill_level: 'principiante' | 'intermedio' | 'experto';
      skill_type: 'electricidad' | 'electronica' | 'general' | 'fontaneria' | 'construccion' | 'tecnologia' | 'cerrajeria' | 'cristaleria' | 'limpieza' | 'sonido';
      recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
      recurrence_status: 'active' | 'paused' | 'completed' | 'cancelled';
    };
  };
}