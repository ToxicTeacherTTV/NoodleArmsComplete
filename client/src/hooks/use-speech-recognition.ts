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

  const recognitionRef = useRef<any>(null);
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
      
      // Auto-restart on network errors
      if (event.error === 'network' || event.error === 'no-speech') {
        setTimeout(() => {
          if (recognitionRef.current && !isListening) {
            startListening();
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      
      // Auto-restart if we were supposed to be continuous
      if (continuous && recognitionRef.current) {
        setTimeout(() => {
          startListening();
        }, 100);
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
