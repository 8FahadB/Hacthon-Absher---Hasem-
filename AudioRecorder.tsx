import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
interface AudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  isProcessing?: boolean;
}
export default function AudioRecorder({ onRecordingComplete, isProcessing = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number[]>([0, 0, 0, 0, 0]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 16000
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      analyserRef.current = analyser;
      const updateLevels = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray.slice(0, 5)).map(v => v / 255);
        setAudioLevel(levels);
        animationRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete?.(blob);
        stream.getTracks().forEach(track => track.stop());
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setAudioLevel([0, 0, 0, 0, 0]);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("خطأ في الوصول للميكروفون:", error);
      alert("لا يمكن الوصول للميكروفون. تأكد من منح الإذن للمتصفح.");
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };
  return (
    <Card data-testid="audio-recorder">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mic className="w-5 h-5" />
          واجهة التسجيل
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <div className="flex items-end justify-center gap-1 h-16">
          {audioLevel.map((level, i) => (
            <div
              key={i}
              className={`w-3 rounded-sm transition-all duration-75 ${
                isRecording ? "bg-destructive" : "bg-muted"
              }`}
              style={{ height: `${Math.max(8, level * 64)}px` }}
            />
          ))}
        </div>
        <div className="text-4xl font-mono font-bold tabular-nums" data-testid="recording-timer">
          {formatTime(recordingTime)}
        </div>
        <div className="flex items-center gap-4">
          {isProcessing ? (
            <Button size="lg" disabled className="w-20 h-20 rounded-full">
              <Loader2 className="w-10 h-10 animate-spin" />
            </Button>
          ) : isRecording ? (
            <Button
              size="lg"
              variant="destructive"
              onClick={stopRecording}
              className="w-20 h-20 rounded-full"
              data-testid="button-stop-recording"
            >
              <Square className="w-8 h-8" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={startRecording}
              className="w-20 h-20 rounded-full"
              data-testid="button-start-recording"
            >
              <Mic className="w-10 h-10" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {isProcessing
            ? "جاري تحليل التسجيل..."
            : isRecording
            ? "جاري التسجيل - اضغط للإيقاف"
            : "اضغط لبدء التسجيل"}
        </p>
      </CardContent>
    </Card>
  );
}