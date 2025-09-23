import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Mic, MicOff, Play, Pause, Trash2, Download, Eye, ChevronDown, ChevronUp, Paperclip, User, FileText, Volume2, Image, Video } from 'lucide-react';
import { Button } from '../ui/Button';
import { MediaViewerModal } from './MediaViewerModal';
import { UserContactModal } from './UserContactModal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatDateGMT2, formatTimeGMT2, formatTimeWithSecondsGMT2 } from '../../lib/timezone';

interface TaskAttachment {
  id: string;
  fileName?: string;
  file_name?: string;
  fileType?: string;
  file_type?: string;
  fileUrl?: string;
  file_url?: string;
  fileSize?: number;
  file_size?: number;
  duration?: number;
  uploadedBy?: string;
  uploaded_by?: string;
  uploaderName?: string;
  createdAt?: string;
  created_at?: string;
}

interface TaskAttachmentsProps {
  taskId: string;
  attachments: TaskAttachment[];
  onAttachmentsChange: (attachments: TaskAttachment[]) => void;
}

export const TaskAttachments: React.FC<TaskAttachmentsProps> = ({
  taskId,
  attachments,
  onAttachmentsChange,
}) => {
  const { user, isLoading } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [workers, setWorkers] = useState<Record<string, any>>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isLoadingUserContact, setIsLoadingUserContact] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { currentTime: number, duration: number }>>({});
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
    fileType: 'image' | 'video';
  }>({
    isOpen: false,
    fileUrl: '',
    fileName: '',
    fileType: 'image',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const DEFAULT_ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';

  // Sync local attachments with props
  useEffect(() => {
    setLocalAttachments(attachments);
  }, [attachments]);

  useEffect(() => {
    fetchWorkers();
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('id, name, email, phone, role, avatar_url');

      if (error) throw error;
      
      const workersMap = (data || []).reduce((acc: Record<string, any>, worker) => {
        acc[worker.id] = {
          id: worker.id,
          name: worker.name,
          email: worker.email,
          phone: worker.phone,
          role: worker.role,
          avatarUrl: worker.avatar_url
        };
        return acc;
      }, {} as Record<string, any>);
      
      setWorkers(workersMap);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const refreshAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select(`
          id,
          task_id,
          file_name,
          file_type,
          file_url,
          file_size,
          duration,
          uploaded_by,
          created_at,
          workers!task_attachments_uploaded_by_fkey(
            id,
            name
          )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedAttachments = (data || []).map(attachment => ({
        id: attachment.id,
        file_name: attachment.file_name,
        file_type: attachment.file_type,
        file_url: attachment.file_url,
        file_size: attachment.file_size,
        duration: attachment.duration,
        uploaded_by: attachment.uploaded_by,
        created_at: attachment.created_at,
        uploaderName: attachment.workers?.name || workers[attachment.uploaded_by] || 'Usuario desconocido'
      }));
      
      setLocalAttachments(formattedAttachments);
      onAttachmentsChange(formattedAttachments);
    } catch (error) {
      console.error('Error refreshing attachments:', error);
    }
  };

  const getStoragePathFromUrl = (publicUrl: string): string | null => {
    try {
      const parsedUrl = new URL(publicUrl);
      const pathPrefix = '/storage/v1/object/public/task-attachments/';
      const { pathname } = parsedUrl;

      if (!pathname.includes(pathPrefix)) {
        return decodeURIComponent(pathname.startsWith('/') ? pathname.slice(1) : pathname);
      }

      const storagePath = pathname.split(pathPrefix)[1];
      return storagePath ? decodeURIComponent(storagePath) : null;
    } catch (error) {
      console.warn('Invalid storage URL:', error);
      return null;
    }
  };

  const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileExt = originalName.split('.').pop() || 'bin';
    const baseName = originalName.replace(/\.[^/.]+$/, "");
    return `${timestamp}-${randomId}-${baseName}.${fileExt}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user || isLoading) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Generate unique filename
        const fileName = generateUniqueFileName(file.name);
        
        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Error al subir archivo: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(fileName);

        // Verify the URL is accessible
        if (!publicUrl) {
          throw new Error('No se pudo generar URL pública para el archivo');
        }

        // Determine file type
        let fileType = 'image';
        if (file.type.startsWith('video/')) {
          fileType = 'video';
        } else if (file.type.startsWith('audio/')) {
          fileType = 'audio';
        }

        // Create database record
        const attachmentData = {
          task_id: taskId,
          file_name: file.name,
          file_type: fileType,
          file_url: publicUrl,
          file_size: file.size,
          uploaded_by: user.id
        };

        const { error: dbError } = await supabase
          .from('task_attachments')
          .insert(attachmentData);

        if (dbError) {
          console.error('Database insert error:', dbError);
          // Try to clean up the uploaded file
          await supabase.storage
            .from('task-attachments')
            .remove([fileName]);
          throw new Error(`Error al guardar archivo en base de datos: ${dbError.message}`);
        }
      }

      // Refresh attachments after upload
      await refreshAttachments();
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error al subir archivos: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.accept = DEFAULT_ACCEPT;
      }
    }
  };

  const startRecording = async () => {
    if (!user || isLoading) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await uploadAudioRecording(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error al iniciar grabación: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const uploadAudioRecording = async (blob: Blob) => {
    if (!user || isLoading) {
      return;
    }
    
    setIsUploading(true);
    try {
      const fileName = generateUniqueFileName(`audio-recording-${Date.now()}.webm`);
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Error al subir audio: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);

      const now = new Date();
      const attachmentData = {
        task_id: taskId,
        file_name: `Audio ${formatDateGMT2(now)}, ${formatTimeWithSecondsGMT2(now)}`,
        file_type: 'audio',
        file_url: publicUrl,
        file_size: blob.size,
        duration: recordingTime,
        uploaded_by: user.id
      };

      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert(attachmentData);

      if (dbError) {
        // Clean up uploaded file
        await supabase.storage
          .from('task-attachments')
          .remove([fileName]);
        throw new Error(`Error al guardar audio: ${dbError.message}`);
      }

      // Refresh attachments after upload
      await refreshAttachments();
    } catch (error) {
      console.error('Error uploading audio:', error);
      alert('Error al subir audio: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId: string, fileUrl: string) => {
    if (!user || isLoading) {
      console.warn('Cannot delete attachment: user not authenticated or loading');
      return;
    }
    
    // Add to deleting set to show loading state
    setDeletingIds(prev => new Set(prev).add(attachmentId));
    
    try {
      // Delete from database first
      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;

      // Try to delete from storage (but don't fail if it doesn't exist)
      if (fileUrl) {
        try {
          const storagePath = getStoragePathFromUrl(fileUrl);

          if (storagePath) {
            const { error: storageError } = await supabase.storage
              .from('task-attachments')
              .remove([storagePath]);

            if (storageError) {
              console.warn('Storage deletion failed:', storageError);
            }
          }
        } catch (storageError) {
          console.warn('Storage deletion error:', storageError);
        }
      }

      // Refresh attachments after deletion
      await refreshAttachments();
      
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Error al eliminar archivo: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      // Refresh local state if deletion failed
      await refreshAttachments();
    } finally {
      // Remove from deleting set
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(attachmentId);
        return newSet;
      });
    }
  };

  const playAudio = (url: string, attachmentId: string) => {
    // Si ya está reproduciéndose este audio, pausarlo
    if (playingAudio === attachmentId) {
      const audio = audioElements[attachmentId];
      if (audio) {
        audio.pause();
      }
      setPlayingAudio(null);
      return;
    }

    // Pausar cualquier otro audio que esté reproduciéndose
    if (playingAudio && audioElements[playingAudio]) {
      audioElements[playingAudio].pause();
    }

    // Crear o reutilizar elemento de audio
    let audio = audioElements[attachmentId];
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'metadata';
      
      // Event listeners para el audio
      audio.onloadedmetadata = () => {
        setAudioProgress(prev => ({
          ...prev,
          [attachmentId]: {
            currentTime: 0,
            duration: audio.duration
          }
        }));
      };
      
      audio.ontimeupdate = () => {
        setAudioProgress(prev => ({
          ...prev,
          [attachmentId]: {
            currentTime: audio.currentTime,
            duration: audio.duration
          }
        }));
      };
      
      audio.onended = () => {
        setPlayingAudio(null);
        setAudioProgress(prev => ({
          ...prev,
          [attachmentId]: {
            ...prev[attachmentId],
            currentTime: 0
          }
        }));
      };
      
      audio.onerror = () => {
        console.error('Error loading audio:', url);
        setPlayingAudio(null);
      };
      
      setAudioElements(prev => ({
        ...prev,
        [attachmentId]: audio
      }));
    }
    
    audio.play().then(() => {
      setPlayingAudio(attachmentId);
    }).catch(error => {
      console.error('Error playing audio:', error);
      setPlayingAudio(null);
    });
  };

  const handleProgressClick = (attachmentId: string, event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioElements[attachmentId];
    const progress = audioProgress[attachmentId];
    
    if (!audio || !progress) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * progress.duration;
    
    audio.currentTime = newTime;
  };

  const formatAudioTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleDownloadFile = (fileUrl: string, fileName: string) => {
    if (!fileUrl || fileUrl === 'undefined' || fileUrl === 'null') {
      alert('El archivo no está disponible para descarga o la URL es inválida');
      return;
    }

    try {
      const parsedUrl = new URL(fileUrl, window.location.origin);
      const safeUrl = parsedUrl.toString();

      const link = document.createElement('a');
      link.href = safeUrl;
      link.download = fileName || 'archivo';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);

      try {
        const parsedUrl = new URL(fileUrl, window.location.origin);
        window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer');
      } catch (fallbackError) {
        console.error('Fallback download attempt failed:', fallbackError);
        alert('Error al descargar el archivo: URL inválida');
      }
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return 'Sin tamaño';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 10) / 10 + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds === 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCreatedAt = (dateString?: string) => {
    if (!dateString) return 'Sin fecha';
    const dateLabel = formatDateGMT2(dateString);
    const timeLabel = formatTimeGMT2(dateString);

    if (dateLabel === 'Fecha inválida' || dateLabel === 'N/A') {
      return dateLabel;
    }

    return `${dateLabel} ${timeLabel}`;
  };

  const getUserName = (attachment: TaskAttachment): string => {
    // Priorizar uploaderName si existe
    if (attachment.uploaderName) {
      return attachment.uploaderName;
    }
    
    // Buscar en el mapa de workers
    const uploadedBy = attachment.uploadedBy || attachment.uploaded_by;
    if (uploadedBy && workers[uploadedBy]) {
      return workers[uploadedBy].name;
    }
    
    // Si es el usuario actual
    if (uploadedBy === user?.id) {
      return user.name;
    }
    
    return 'Usuario desconocido';
  };

  const handleUserClick = (attachment: TaskAttachment) => {
    const uploadedBy = attachment.uploadedBy || attachment.uploaded_by;
    
    if (!uploadedBy) {
      console.warn('No uploaded_by ID found for attachment');
      return;
    }

    // Buscar el email del usuario en la base de datos local
    const localWorker = workers[uploadedBy];
    if (!localWorker) {
      console.warn('Worker not found in local cache:', uploadedBy);
      return;
    }

    // Llamar a la función Edge para obtener datos completos
    fetchUserContactFromAPI(localWorker.email);
  };

  const fetchUserContactFromAPI = async (userEmail: string) => {
    setIsLoadingUserContact(true);
    
    try {
      console.log('🔍 Fetching contact info for:', userEmail);
      
      // Primero obtener datos básicos de Supabase como fallback
      const { data: supabaseUser, error: supabaseError } = await supabase
        .from('workers')
        .select('*')
        .eq('email', userEmail)
        .single();
      
      if (supabaseError || !supabaseUser) {
        console.error('❌ Error fetching user from Supabase:', supabaseError);
        // Como último recurso, usar datos del cache local
        const uploadedBy = Object.keys(workers).find(id => workers[id].email === userEmail);
        if (uploadedBy && workers[uploadedBy]) {
          console.log('📋 Using local cache as fallback');
          setSelectedUser({
            ...workers[uploadedBy],
            source: 'local_cache'
          });
        } else {
          console.error('❌ No user data available');
        }
        return;
      }
      
      // Datos base de Supabase
      let finalUserData = {
        id: supabaseUser.id,
        name: supabaseUser.name,
        email: supabaseUser.email,
        phone: supabaseUser.phone,
        role: supabaseUser.role,
        avatarUrl: supabaseUser.avatar_url,
        source: 'supabase_only'
      };
      
      // Intentar enriquecer con datos de la API externa
      try {
        const functionUrl = import.meta.env.DEV 
          ? '/supabase-functions/v1/get-user-contact-info'
          : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-contact-info`;
        
        console.log('🌐 Calling API for enhanced user data...');
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            user_email: userEmail
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.user) {
            finalUserData = result.user;
            console.log('✅ Enhanced user data fetched from API:', result.user.name);
          } else {
            console.warn('⚠️ API response OK but no user data returned');
          }
        } else {
          const errorText = await response.text();
          console.warn('⚠️ API call failed, using Supabase data only:', errorText);
        }
      } catch (apiError) {
        console.warn('⚠️ API call failed, using Supabase data only:', apiError);
      }
      
      // Mostrar los datos que se pudieron obtener
      console.log('📋 Final user data:', finalUserData);
      setSelectedUser(finalUserData);
      
    } catch (error) {
      console.error('❌ Error fetching user contact info:', error);
      
      // Como último recurso, usar datos del cache local
      const uploadedBy = Object.keys(workers).find(id => workers[id].email === userEmail);
      if (uploadedBy && workers[uploadedBy]) {
        console.log('📋 Using local cache as last resort for:', workers[uploadedBy].name);
        setSelectedUser({
          ...workers[uploadedBy],
          source: 'local_cache'
        });
      } else {
        console.error('❌ No user data available from any source');
        // No mostrar alert, simplemente no abrir el modal
      }
    } finally {
      setIsLoadingUserContact(false);
    }
  };

  const handleViewMedia = (attachment: TaskAttachment) => {
    const fileType = attachment.file_type || attachment.fileType;
    if (fileType === 'image' || fileType === 'video') {
      setViewerModal({
        isOpen: true,
        fileUrl: attachment.fileUrl || attachment.file_url || '',
        fileName: attachment.fileName || attachment.file_name || 'Archivo',
        fileType: fileType as 'image' | 'video',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with title and action buttons */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center space-x-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Paperclip size={20} className="text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Archivos ({localAttachments.length})
            </h3>
            <div className="ml-2">
              {isCollapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            disabled={isUploading || !user || isLoading}
          >
            {isCollapsed ? 'Mostrar' : 'Ocultar'}
          </Button>
        </div>

        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !user || isLoading}
              className="flex items-center space-x-2"
            >
              <Upload size={16} />
              <span>Subir Archivo</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = 'image/*';
                  fileInputRef.current.click();
                  fileInputRef.current.accept = DEFAULT_ACCEPT;
                }
              }}
              disabled={isUploading || !user || isLoading}
              className="flex items-center space-x-2"
            >
              <Camera size={16} />
              <span>Foto</span>
            </Button>

            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading || !user || isLoading}
              className="flex items-center space-x-2"
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              <span>
                {isRecording ? `Parar (${formatDuration(recordingTime)})` : 'Grabar Audio'}
              </span>
            </Button>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={DEFAULT_ACCEPT}
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {!isCollapsed && (
        <>
          {/* Loading state */}
          {isUploading && (
            <div className="flex items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-blue-700 dark:text-blue-300">Subiendo archivo...</span>
            </div>
          )}

          {/* Attachments List */}
          {localAttachments.length === 0 && !isUploading ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No hay archivos adjuntos
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Graba audio o sube imágenes y videos para documentar la tarea
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {localAttachments.map((attachment) => {
                const isDeleting = deletingIds.has(attachment.id);
                const userName = getUserName(attachment);
                const isPlaying = playingAudio === attachment.id;
                const progress = audioProgress[attachment.id];
                
              const fileType = attachment.file_type || attachment.fileType;
              const fileName = attachment.fileName || attachment.file_name || 'Sin nombre';
              const fileSize = attachment.fileSize || attachment.file_size;
              const createdAt = attachment.createdAt || attachment.created_at;
              const fileUrl = attachment.fileUrl || attachment.file_url || '';
                return (
                  <div
                    key={attachment.id}
                    className={`p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow ${isDeleting ? 'opacity-50' : ''}`}
                  >
                    {/* Audio files - Full width player */}
                  {/* Unified design for all file types */}
                  <div>
                    {/* File name - Full width, single line */}
                    <p className="text-sm font-medium text-gray-900 dark:text-white w-full truncate mb-3" title={fileName}>
                      {fileName}
                    </p>
                    
                    {/* File info and actions row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {/* File type icon with action */}
                        <div className="flex-shrink-0">
                          {fileType === 'audio' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => playAudio(fileUrl, attachment.id)}
                              className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center hover:bg-green-200 dark:hover:bg-green-800 transition-colors p-0"
                            >
                              {isPlaying ? (
                                <Pause size={20} className="text-green-600 dark:text-green-400" />
                              ) : (
                                <Play size={20} className="text-green-600 dark:text-green-400" />
                              )}
                            </Button>
                          ) : fileType === 'image' ? (
                            <div 
                              className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                              onClick={() => handleViewMedia(attachment)}
                            >
                              <Image size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                          ) : fileType === 'video' ? (
                            <div 
                              className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                              onClick={() => handleViewMedia(attachment)}
                            >
                              <Video size={20} className="text-red-600 dark:text-red-400" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center">
                              <FileText size={20} className="text-gray-600 dark:text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* File metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{formatFileSize(fileSize)}</span>
                              <span>| {formatCreatedAt(createdAt)}</span>
                            </div>
                            <div 
                              className={`flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors ${isLoadingUserContact ? 'opacity-50' : ''}`}
                              onClick={() => handleUserClick(attachment)}
                              title="Ver información de contacto"
                            >
                              {isLoadingUserContact ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-t border-blue-600"></div>
                              ) : (
                                <User size={12} />
                              )}
                              <span>{userName}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadFile(fileUrl, fileName)}
                          className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200"
                          disabled={isDeleting || !fileUrl}
                          title="Descargar archivo"
                        >
                          <Download size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAttachment(attachment.id, fileUrl)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          disabled={isUploading || isDeleting}
                          title="Eliminar archivo"
                        >
                          {isDeleting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500"></div>
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Audio progress bar - Full width below everything for audio files */}
                    {fileType === 'audio' && progress && (
                      <div className="mt-3 w-full">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>{formatAudioTime(progress.currentTime)}</span>
                          <span>{formatAudioTime(progress.duration)}</span>
                        </div>
                        <div
                          className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full cursor-pointer relative group"
                          onClick={(e) => handleProgressClick(attachment.id, e)}
                        >
                          <div
                            className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-300 ease-linear"
                            style={{ width: `${progress.duration > 0 ? (progress.currentTime / progress.duration) * 100 : 0}%` }}
                          />
                          <div
                            className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            style={{ left: `calc(${progress.duration > 0 ? (progress.currentTime / progress.duration) * 100 : 0}% - 6px)` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      
      {/* Media Viewer Modal */}
      <MediaViewerModal
        isOpen={viewerModal.isOpen}
        onClose={() => setViewerModal({ ...viewerModal, isOpen: false })}
        fileUrl={viewerModal.fileUrl}
        fileName={viewerModal.fileName}
        fileType={viewerModal.fileType}
      />
      
      {/* User Contact Modal */}
      <UserContactModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        user={selectedUser}
      />
    </div>
  );
};
