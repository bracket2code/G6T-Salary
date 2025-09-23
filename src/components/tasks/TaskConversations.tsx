import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Paperclip, Play, Pause, Download, Trash2, User, Calendar, FileText, Volume2, Image, ChevronDown, ChevronUp, MessageSquare, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { Avatar } from '../ui/Avatar';
import { TaskConversation, ConversationAttachment } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../lib/utils';

interface Worker {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface TaskConversationsProps {
  taskId: string;
  conversations: TaskConversation[];
  onConversationsChange: () => void;
}

export const TaskConversations: React.FC<TaskConversationsProps> = ({
  taskId,
  conversations,
  onConversationsChange,
}) => {
  const { user } = useAuthStore();
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attachments, setAttachments] = useState<{ [key: string]: ConversationAttachment[] }>({});
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkers();
    fetchAttachments();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('id, name, email, role, avatar_url');

      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const fetchAttachments = async () => {
    try {
      const conversationIds = conversations.map(c => c.id);
      if (conversationIds.length === 0) return;

      const { data, error } = await supabase
        .from('conversation_attachments')
        .select('*')
        .in('conversation_id', conversationIds);

      if (error) throw error;

      const attachmentsByConversation = (data || []).reduce((acc, attachment) => {
        if (!acc[attachment.conversation_id]) {
          acc[attachment.conversation_id] = [];
        }
        acc[attachment.conversation_id].push(attachment);
        return acc;
      }, {} as { [key: string]: ConversationAttachment[] });

      setAttachments(attachmentsByConversation);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleSubmitMessage = async () => {
    if (!newMessage.trim() || !user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('task_conversations')
        .insert({
          task_id: taskId,
          user_id: user.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage('');
      onConversationsChange();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setAudioChunks([]);
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `conversation-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      // Create a conversation with attachment
      const { data: conversationData, error: conversationError } = await supabase
        .from('task_conversations')
        .insert({
          task_id: taskId,
          user_id: user.id,
          message: `Archivo adjunto: ${file.name}`,
        })
        .select()
        .single();

      if (conversationError) throw conversationError;

      // Add attachment
      const fileType = file.type.startsWith('image/') ? 'image' : 
                      file.type.startsWith('audio/') ? 'audio' : 'document';

      const { error: attachmentError } = await supabase
        .from('conversation_attachments')
        .insert({
          conversation_id: conversationData.id,
          file_name: file.name,
          file_type: fileType,
          file_url: publicUrl,
          file_size: file.size,
        });

      if (attachmentError) throw attachmentError;

      onConversationsChange();
      fetchAttachments();
    } catch (error) {
      console.error('Error uploading file:', error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const playAudio = (url: string, attachmentId: string) => {
    if (playingAudio === attachmentId) {
      setPlayingAudio(null);
      return;
    }

    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    setPlayingAudio(attachmentId);
  };

  const downloadAttachment = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase
        .from('conversation_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
      fetchAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  const toggleConversationExpanded = (conversationId: string) => {
    setExpandedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const getWorkerById = (workerId: string) => {
    return workers.find(w => w.id === workerId);
  };

  const renderAttachment = (attachment: ConversationAttachment) => {
    const isPlaying = playingAudio === attachment.id;

    switch (attachment.file_type) {
      case 'image':
        return (
          <div key={attachment.id} className="relative group">
            <img
              src={attachment.file_url}
              alt={attachment.file_name}
              className="max-w-xs rounded-lg shadow-sm"
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadAttachment(attachment.file_url, attachment.file_name)}
                  className="p-1 h-6 w-6"
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteAttachment(attachment.id)}
                  className="p-1 h-6 w-6"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div key={attachment.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Button
              size="sm"
              variant="outline"
              onClick={() => playAudio(attachment.file_url, attachment.id)}
              className="p-1 h-8 w-8"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <Volume2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">{attachment.file_name}</span>
              </div>
              {attachment.duration && (
                <span className="text-xs text-gray-500">
                  {Math.floor(attachment.duration / 60)}:{(attachment.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadAttachment(attachment.file_url, attachment.file_name)}
                className="p-1 h-6 w-6"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteAttachment(attachment.id)}
                className="p-1 h-6 w-6"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );

      case 'document':
        return (
          <div key={attachment.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <FileText className="h-8 w-8 text-gray-500" />
            <div className="flex-1">
              <div className="font-medium text-sm">{attachment.file_name}</div>
              {attachment.file_size && (
                <div className="text-xs text-gray-500">
                  {(attachment.file_size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadAttachment(attachment.file_url, attachment.file_name)}
                className="p-1 h-6 w-6"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteAttachment(attachment.id)}
                className="p-1 h-6 w-6"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with toggle button */}
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center space-x-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Conversaciones ({conversations.length})
          </h3>
          <div className="ml-2">
            {isCollapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2"
        >
          {isCollapsed ? 'Mostrar' : 'Ocultar'}
        </Button>
      </div>

      {!isCollapsed && (
        <>
      {/* Conversations List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay conversaciones aún</p>
            <p className="text-sm">Sé el primero en comentar esta tarea</p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const worker = getWorkerById(conversation.user_id);
            const conversationAttachments = attachments[conversation.id] || [];
            const isExpanded = expandedConversations.has(conversation.id);
            const hasAttachments = conversationAttachments.length > 0;

            return (
              <div key={conversation.id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar
                    src={worker?.avatar_url}
                    alt={worker?.name || 'Usuario'}
                    fallback={worker?.name?.charAt(0) || 'U'}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {worker?.name || 'Usuario desconocido'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(conversation.created_at)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-700 mb-2">
                      {conversation.message}
                    </div>

                    {hasAttachments && (
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleConversationExpanded(conversation.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 p-0 h-auto"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Ocultar archivos ({conversationAttachments.length})
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Ver archivos ({conversationAttachments.length})
                            </>
                          )}
                        </Button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {conversationAttachments.map(renderAttachment)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t pt-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <TextArea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitMessage();
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSubmitMessage}
              disabled={!newMessage.trim() || isSubmitting}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
          className="hidden"
        />
      </div>
        </>
      )}
    </div>
  );
};