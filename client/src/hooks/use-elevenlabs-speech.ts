import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UseElevenLabsSpeechReturn {
  speak: (text: string, onEnd?: () => void) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useElevenLabsSpeech(): UseElevenLabsSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndCallbackRef = useRef<(() => void) | undefined>();
  const speechQueue = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  const isSupported = typeof window !== 'undefined' && typeof Audio !== 'undefined';

  // Process speech queue
  const processQueue = useCallback(async () => {
    if (!isSupported || isProcessingRef.current || speechQueue.current.length === 0) {
      return;
    }

    const text = speechQueue.current.shift();
    if (!text) return;

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
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        isProcessingRef.current = false;
        audioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        
        if (onEndCallbackRef.current) {
          onEndCallbackRef.current();
          onEndCallbackRef.current = undefined;
        }

        // Process next item in queue
        setTimeout(processQueue, 100);
      };

      audio.onerror = (error) => {
        console.error('ElevenLabs audio error:', error);
        setIsSpeaking(false);
        isProcessingRef.current = false;
        audioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        
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

  const stop = useCallback(() => {
    if (!isSupported) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    speechQueue.current = [];
    setIsSpeaking(false);
    isProcessingRef.current = false;
    onEndCallbackRef.current = undefined;
  }, [isSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
  };
}