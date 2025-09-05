import { useState, useEffect, useRef } from 'react';
import type { VoiceActivity } from '@/types';

export function useVoiceActivity(isListening: boolean): VoiceActivity {
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivity>({
    isActive: false,
    volume: 0,
    transcript: '',
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isListening) {
      // Stop monitoring when not listening
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setVoiceActivity({
        isActive: false,
        volume: 0,
        transcript: '',
      });
      
      return;
    }

    // Start monitoring voice activity
    const startVoiceActivityDetection = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
          } 
        });
        
        streamRef.current = stream;
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
        
        const microphone = audioContext.createMediaStreamSource(stream);
        microphoneRef.current = microphone;
        microphone.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dataArrayRef.current = dataArray;
        
        const checkVoiceActivity = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i];
          }
          const averageVolume = sum / dataArrayRef.current.length;
          
          // Voice activity detection threshold
          const threshold = 20; // Adjust as needed
          const isActive = averageVolume > threshold;
          
          // Calculate normalized volume (0-100)
          const normalizedVolume = Math.min(100, (averageVolume / 128) * 100);
          
          setVoiceActivity(prev => ({
            ...prev,
            isActive,
            volume: normalizedVolume,
          }));
          
          if (isListening) {
            animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
          }
        };
        
        checkVoiceActivity();
        
      } catch (error) {
        console.error('Failed to access microphone for voice activity detection:', error);
        setVoiceActivity({
          isActive: false,
          volume: 0,
          transcript: '',
        });
      }
    };

    startVoiceActivityDetection();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isListening]);

  return voiceActivity;
}
