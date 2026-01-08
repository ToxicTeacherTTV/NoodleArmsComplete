import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useElevenLabsSpeech } from "@/hooks/use-elevenlabs-speech";

export const useJazzVoice = () => {
    const {
        isListening,
        startListening,
        stopListening,
        transcript,
        interimTranscript,
        resetTranscript
    } = useSpeechRecognition();

    const {
        speak: speakElevenLabs,
        isSpeaking: isSpeakingElevenLabs,
        isPaused: isPausedElevenLabs,
        stop: stopElevenLabs,
        pause: pauseElevenLabs,
        resume: resumeElevenLabs,
        replay: replayElevenLabs,
        canReplay: canReplayElevenLabs,
        saveAudio: saveAudioElevenLabs,
        canSave: canSaveElevenLabs
    } = useElevenLabsSpeech();

    const toggleListening = (onSend?: (text: string) => void) => {
        if (isListening) {
            stopListening();
            const finalText = (transcript || interimTranscript).trim();
            if (finalText && onSend) {
                onSend(finalText);
            }
            resetTranscript();
        } else {
            resetTranscript();
            startListening();
        }
    };

    return {
        // Recognition
        isListening,
        startListening,
        stopListening,
        toggleListening,
        transcript,
        interimTranscript,
        resetTranscript,

        // Synthesis (TTS)
        speak: speakElevenLabs,
        isSpeaking: isSpeakingElevenLabs,
        isPaused: isPausedElevenLabs,
        stopSpeaking: stopElevenLabs,
        pauseSpeaking: pauseElevenLabs,
        resumeSpeaking: resumeElevenLabs,
        replaySpeaking: replayElevenLabs,
        canReplay: canReplayElevenLabs,
        saveAudio: saveAudioElevenLabs,
        canSaveAudio: canSaveElevenLabs
    };
};
