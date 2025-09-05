import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechSynthesisOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string, onEnd?: () => void) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  setVoice: (voice: SpeechSynthesisVoice) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
}

export function useSpeechSynthesis(
  options: SpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const {
    voice: initialVoice,
    rate = 1,
    pitch = 1,
    volume = 1,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | undefined>(initialVoice);
  const [currentRate, setCurrentRate] = useState(rate);
  const [currentPitch, setCurrentPitch] = useState(pitch);
  const [currentVolume, setCurrentVolume] = useState(volume);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onEndCallbackRef = useRef<(() => void) | undefined>();
  const speechQueue = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Set default voice if none selected
      if (!currentVoice && availableVoices.length > 0) {
        // Prefer English voices
        const englishVoice = availableVoices.find(voice => 
          voice.lang.startsWith('en-') && voice.name.toLowerCase().includes('male')
        ) || availableVoices.find(voice => voice.lang.startsWith('en-'));
        
        if (englishVoice) {
          setCurrentVoice(englishVoice);
        }
      }
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported, currentVoice]);

  // Process speech queue
  const processQueue = useCallback(() => {
    if (!isSupported || isProcessingRef.current || speechQueue.current.length === 0) {
      return;
    }

    const text = speechQueue.current.shift();
    if (!text) return;

    isProcessingRef.current = true;
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = currentVoice || null;
    utterance.rate = currentRate;
    utterance.pitch = currentPitch;
    utterance.volume = currentVolume;

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      isProcessingRef.current = false;
      utteranceRef.current = null;
      
      if (onEndCallbackRef.current) {
        onEndCallbackRef.current();
        onEndCallbackRef.current = undefined;
      }

      // Process next item in queue
      setTimeout(processQueue, 100);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
      setIsPaused(false);
      isProcessingRef.current = false;
      utteranceRef.current = null;
      
      if (onEndCallbackRef.current) {
        onEndCallbackRef.current();
        onEndCallbackRef.current = undefined;
      }

      // Process next item in queue
      setTimeout(processQueue, 100);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [isSupported, currentVoice, currentRate, currentPitch, currentVolume]);

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

    speechSynthesis.cancel();
    speechQueue.current = [];
    setIsSpeaking(false);
    setIsPaused(false);
    isProcessingRef.current = false;
    utteranceRef.current = null;
    onEndCallbackRef.current = undefined;
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported || !isSpeaking) return;
    speechSynthesis.pause();
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (!isSupported || !isPaused) return;
    speechSynthesis.resume();
  }, [isSupported, isPaused]);

  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setCurrentVoice(voice);
  }, []);

  const setRate = useCallback((newRate: number) => {
    setCurrentRate(Math.max(0.1, Math.min(10, newRate)));
  }, []);

  const setPitch = useCallback((newPitch: number) => {
    setCurrentPitch(Math.max(0, Math.min(2, newPitch)));
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    setCurrentVolume(Math.max(0, Math.min(1, newVolume)));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    setVoice,
    setRate,
    setPitch,
    setVolume,
  };
}
