import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UseElevenLabsSpeechReturn {
  speak: (text: string, emotionProfile?: string, onEnd?: () => void) => void;
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
  const speechQueue = useRef<Array<{ text: string; emotionProfile?: string }>>([]);
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSpokenTextRef = useRef<string>('');
  const lastEmotionProfileRef = useRef<string | undefined>();
  const canReplayRef = useRef(false);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const lastAudioUrlRef = useRef<string | null>(null);
  const canSaveRef = useRef(false);

  const isSupported = typeof window !== 'undefined' && typeof Audio !== 'undefined';

  // Cleanup function for audio
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onpause = null;
      audioRef.current.onplay = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
  }, []);

  // Process speech queue
  const processQueue = useCallback(async () => {
    if (!isSupported || isProcessingRef.current || speechQueue.current.length === 0) {
      return;
    }

    const speechItem = speechQueue.current.shift();
    if (!speechItem) return;

    // Store the text and emotion profile being spoken for replay
    lastSpokenTextRef.current = speechItem.text;
    lastEmotionProfileRef.current = speechItem.emotionProfile;
    canReplayRef.current = true;

    isProcessingRef.current = true;
    setIsSpeaking(true);
    console.log(`🔊 [ElevenLabs Hook] Processing queue item: "${speechItem.text.substring(0, 30)}..."`);

    // Create new abort controller for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const requestBody: { text: string; emotionProfile?: string } = {
        text: speechItem.text
      };

      if (speechItem.emotionProfile) {
        requestBody.emotionProfile = speechItem.emotionProfile;
      }

      const response = await fetch('/api/speech/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.status}`);
      }
      console.log(`🔊 [ElevenLabs Hook] API Success, processing blob...`);

      // Check if we should still be processing (e.g. if stop was called)
      if (!isProcessingRef.current) {
        return;
      }

      const audioBlob = await response.blob();

      // Check again after blob processing
      if (!isProcessingRef.current) {
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);

      // Store blob and URL for saving
      lastAudioBlobRef.current = audioBlob;
      if (lastAudioUrlRef.current) {
        URL.revokeObjectURL(lastAudioUrlRef.current);
      }
      lastAudioUrlRef.current = audioUrl;
      canSaveRef.current = true;

      // Stop any currently playing audio before starting new one
      cleanupAudio();

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        isProcessingRef.current = false;
        audioRef.current = null;

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

        if (onEndCallbackRef.current) {
          onEndCallbackRef.current();
          onEndCallbackRef.current = undefined;
        }

        // Process next item in queue
        setTimeout(processQueue, 100);
      };

      await audio.play();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ElevenLabs synthesis aborted');
        return;
      }

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
    } finally {
      abortControllerRef.current = null;
    }
  }, [isSupported, cleanupAudio]);

  const speak = useCallback((text: string, emotionProfile?: string, onEnd?: () => void) => {
    if (!isSupported || !text.trim()) return;

    // Store the callback
    if (onEnd) {
      onEndCallbackRef.current = onEnd;
    }

    // Add to queue
    speechQueue.current.push({
      text: text.trim(),
      emotionProfile
    });

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

    // Abort any pending synthesis request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop and cleanup current audio
    cleanupAudio();

    speechQueue.current = [];
    setIsSpeaking(false);
    setIsPaused(false);
    isProcessingRef.current = false;
    onEndCallbackRef.current = undefined;
  }, [isSupported, cleanupAudio]);

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
    speak(lastSpokenTextRef.current, lastEmotionProfileRef.current);
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