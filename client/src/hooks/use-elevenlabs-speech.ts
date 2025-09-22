import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UseElevenLabsSpeechReturn {
  speak: (text: string, onEnd?: () => void) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  replay: () => void;
  saveAudio: (filename?: string) => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  canReplay: boolean;
  canSave: boolean;
}

export function useElevenLabsSpeech(): UseElevenLabsSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndCallbackRef = useRef<(() => void) | undefined>();
  const speechQueue = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const lastSpokenTextRef = useRef<string>('');
  const canReplayRef = useRef(false);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const lastAudioUrlRef = useRef<string | null>(null);
  const canSaveRef = useRef(false);

  const isSupported = typeof window !== 'undefined' && typeof Audio !== 'undefined';

  // Process speech queue
  const processQueue = useCallback(async () => {
    if (!isSupported || isProcessingRef.current || speechQueue.current.length === 0) {
      return;
    }

    const text = speechQueue.current.shift();
    if (!text) return;

    // Store the text being spoken for replay
    lastSpokenTextRef.current = text;
    canReplayRef.current = true;
    
    isProcessingRef.current = true;
    setIsSpeaking(true);

    try {
      const response = await apiRequest('POST', '/api/speech/synthesize', {
        text: text
      });

      if (!response.ok) {
        throw new Error('Failed to synthesize speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Store blob and URL for saving
      lastAudioBlobRef.current = audioBlob;
      if (lastAudioUrlRef.current) {
        URL.revokeObjectURL(lastAudioUrlRef.current);
      }
      lastAudioUrlRef.current = audioUrl;
      canSaveRef.current = true;
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        isProcessingRef.current = false;
        audioRef.current = null;
        // Don't revoke URL immediately - keep it for saving
        
        if (onEndCallbackRef.current) {
          onEndCallbackRef.current();
          onEndCallbackRef.current = undefined;
        }

        // Process next item in queue
        setTimeout(processQueue, 100);
      };

      audio.onpause = () => {
        setIsPaused(true);
      };

      audio.onplay = () => {
        setIsPaused(false);
      };

      audio.onerror = (error) => {
        console.error('ElevenLabs audio error:', error);
        setIsSpeaking(false);
        setIsPaused(false);
        isProcessingRef.current = false;
        audioRef.current = null;
        // Don't revoke URL on error - keep it for saving
        
        if (onEndCallbackRef.current) {
          onEndCallbackRef.current();
          onEndCallbackRef.current = undefined;
        }

        // Process next item in queue
        setTimeout(processQueue, 100);
      };

      await audio.play();
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      setIsSpeaking(false);
      setIsPaused(false);
      isProcessingRef.current = false;
      
      if (onEndCallbackRef.current) {
        onEndCallbackRef.current();
        onEndCallbackRef.current = undefined;
      }

      // Process next item in queue
      setTimeout(processQueue, 100);
    }
  }, [isSupported]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!isSupported || !text.trim()) return;

    // Store the callback
    if (onEnd) {
      onEndCallbackRef.current = onEnd;
    }

    // Add to queue
    speechQueue.current.push(text.trim());
    
    // Start processing if not already doing so
    if (!isProcessingRef.current) {
      processQueue();
    }
  }, [isSupported, processQueue]);

  const saveAudio = useCallback((filename?: string) => {
    if (!isSupported || !lastAudioBlobRef.current || !canSaveRef.current) return;

    // Generate filename based on spoken text or default
    const defaultFilename = lastSpokenTextRef.current 
      ? `audio-${lastSpokenTextRef.current.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.mp3`
      : `audio-${Date.now()}.mp3`;
    
    const finalFilename = filename || defaultFilename;

    // Create download link
    const downloadUrl = URL.createObjectURL(lastAudioBlobRef.current);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = finalFilename;
    downloadLink.click();
    
    // Clean up the download URL
    URL.revokeObjectURL(downloadUrl);
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    speechQueue.current = [];
    setIsSpeaking(false);
    setIsPaused(false);
    isProcessingRef.current = false;
    onEndCallbackRef.current = undefined;
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported || !audioRef.current || !isSpeaking) return;
    audioRef.current.pause();
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (!isSupported || !audioRef.current || !isPaused) return;
    audioRef.current.play();
  }, [isSupported, isPaused]);

  const replay = useCallback(() => {
    if (!isSupported || !lastSpokenTextRef.current.trim()) return;
    speak(lastSpokenTextRef.current);
  }, [isSupported, speak]);

  return {
    speak,
    stop,
    pause,
    resume,
    replay,
    saveAudio,
    isSpeaking,
    isPaused,
    isSupported,
    canReplay: canReplayRef.current,
    canSave: canSaveRef.current,
  };
}