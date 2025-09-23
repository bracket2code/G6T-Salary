import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface AudioPlayerProps {
  src: string;
  fileName: string;
  duration?: number;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  fileName,
  duration,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);

    const handleLoadedMetadata = () => {
      setTotalDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      console.error('Error loading audio file');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [isDragging]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * totalDuration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(event);

    const handleMouseMove = (e: MouseEvent) => {
      const progressBar = progressBarRef.current;
      const audio = audioRef.current;
      if (!progressBar || !audio) return;

      const rect = progressBar.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = clickX / rect.width;
      const newTime = percentage * totalDuration;

      audio.currentTime = newTime;
      setCurrentTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const formatTime = (time: number): string => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.round(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={`w-full bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* File name header 
      <div className="flex items-center mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {fileName}
        </span>
      </div>

      */}

      {/* Controls */}
      <div className="flex items-center space-x-3 w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          disabled={isLoading}
          className="p-1 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Play className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-0.5" />
          )}
        </Button>

        {/* Progress bar - Only show when playing or has been played */}
        {(isPlaying || currentTime > 0) && (
          <div className="flex-1 flex items-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[35px]">
              {formatTime(currentTime)}
            </span>
            
            <div
              ref={progressBarRef}
              className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full cursor-pointer relative group"
              onClick={handleProgressClick}
              onMouseDown={handleProgressMouseDown}
            >
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-150"
                style={{ width: `${progressPercentage}%` }}
              />
              <div
                className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-blue-600 dark:bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ left: `calc(${progressPercentage}% - 6px)` }}
              />
            </div>
            
            <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[35px]">
              {formatTime(totalDuration)}
            </span>
          </div>
        )}
      </div>
      
      {/* File metadata below controls */}
      <div className="flex justify-end mt-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {/* This will be populated by the parent component */}
        </div>
      </div>
    </div>
  );
};