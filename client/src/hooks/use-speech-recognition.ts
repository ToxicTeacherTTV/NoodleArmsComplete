import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
  isSupported: boolean;
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition(
  options: SpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    continuous = true,
    interimResults = true,
    lang = 'en-US',
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const recognitionRef = useRef<any>(null);
  const maxRetries = 3;
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setFinalTranscript('');
  }, []);

  const startListening = useCallback(() => {
    console.log('📢 startListening called, isSupported:', isSupported, 'isListening:', isListening);
    
    if (!isSupported) {
      console.error('❌ Speech recognition not supported');
      setError('Speech recognition is not supported in this browser');
      return;
    }

    if (isListening) {
      console.log('⏸️ Already listening, skipping start');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('🎤 Creating speech recognition:', !!SpeechRecognition);
    recognitionRef.current = new SpeechRecognition();

    const recognition = recognitionRef.current;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      console.log('✅ Speech recognition started');
      setIsListening(true);
      setError(null);
      setRetryCount(0); // Reset retry count on successful start
    };

    recognition.onresult = (event: any) => {
      console.log('🎯 Speech result received:', event.results.length, 'results');
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log(`   Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`);
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      console.log('📝 Setting transcripts - interim:', interim, 'final:', final);
      setInterimTranscript(interim);
      if (final) {
        setFinalTranscript(prev => prev + final);
        setTranscript(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
      
      // Smart retry with exponential backoff
      if ((event.error === 'network' || event.error === 'no-speech') && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        console.log(`🔄 Retrying speech recognition in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        setTimeout(() => {
          if (recognitionRef.current && !isListening) {
            setRetryCount(prev => prev + 1);
            startListening();
          }
        }, delay);
      } else if (retryCount >= maxRetries) {
        console.warn('❌ Max speech recognition retries reached, stopping auto-restart');
        setError(`Speech recognition failed after ${maxRetries} attempts. Please try manually.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      
      // Auto-restart if we were supposed to be continuous (but respect retry limits)
      if (continuous && recognitionRef.current && retryCount < maxRetries) {
        setTimeout(() => {
          startListening();
        }, 100);
      } else if (retryCount >= maxRetries) {
        console.warn('❌ Speech recognition onend: Max retries reached, not restarting');
      }
    };

    try {
      console.log('🚀 Starting speech recognition...');
      recognition.start();
    } catch (err) {
      console.error('❌ Failed to start speech recognition:', err);
      setError('Failed to start speech recognition');
      setIsListening(false);
    }
  }, [isSupported, isListening, continuous, interimResults, lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    finalTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported,
  };
}
