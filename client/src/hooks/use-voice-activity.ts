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
        // Prevent multiple instances
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          console.warn('AudioContext already exists, skipping creation');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
          } 
        });
        
        streamRef.current = stream;
        
        // Create or reuse AudioContext with better state management
        let audioContext = audioContextRef.current;
        if (!audioContext || audioContext.state === 'closed') {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioContext;
        }
        
        // Resume AudioContext if suspended
        if (audioContext.state === 'suspended') {
          try {
            await audioContext.resume();
            console.log('AudioContext resumed successfully');
          } catch (resumeError) {
            console.error('Failed to resume AudioContext:', resumeError);
            throw resumeError;
          }
        }
        
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
          // Additional safety checks
          if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current) return;
          if (audioContextRef.current.state === 'closed') return;
          
          try {
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
            
            if (isListening && audioContextRef.current?.state === 'running') {
              animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
            }
          } catch (analysisError) {
            console.warn('Voice activity analysis error:', analysisError);
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
      // Cleanup animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Cleanup microphone connection
      if (microphoneRef.current) {
        try {
          microphoneRef.current.disconnect();
        } catch (error) {
          console.warn('Error disconnecting microphone:', error);
        }
        microphoneRef.current = null;
      }
      
      // Cleanup media stream
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(track => {
            if (track.readyState !== 'ended') {
              track.stop();
            }
          });
        } catch (error) {
          console.warn('Error stopping media tracks:', error);
        }
        streamRef.current = null;
      }
      
      // Cleanup audio context with proper state management
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (error) {
          console.warn('Error closing AudioContext:', error);
        } finally {
          audioContextRef.current = null;
        }
      }
      
      // Reset refs
      analyserRef.current = null;
      dataArrayRef.current = null;
    };
  }, [isListening]);

  return voiceActivity;
}
