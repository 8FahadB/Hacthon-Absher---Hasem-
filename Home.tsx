import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import AudioRecorder from "@/components/AudioRecorder";
import AnalysisResult from "@/components/AnalysisResult";
import MessageLog from "@/components/MessageLog";
import { analyzeAudio, getMessages, deleteMessage, playBase64Audio, parseAnalysisResponse, type AnalysisResponse, type TacticalExtraction } from "@/lib/api";
export default function Home() {
  const { toast } = useToast();
  const [currentResult, setCurrentResult] = useState<{
    originalText?: string;
    originalAudioUrl?: string;
    summary?: string;
    extraction?: TacticalExtraction;
    summaryAudioBase64?: string;
    timestamp?: Date;
  }>({});
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["/api/messages"],
    queryFn: getMessages,
  });
  const analyzeMutation = useMutation({
    mutationFn: analyzeAudio,
    onSuccess: (data: AnalysisResponse) => {
      const parsed = parseAnalysisResponse(data);
      setCurrentResult(prev => ({
        ...prev,
        originalText: parsed.originalText,
        summary: parsed.summary,
        extraction: parsed.extraction,
        summaryAudioBase64: parsed.summaryAudioBase64,
        timestamp: parsed.timestamp,
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "تم التحليل بنجاح",
        description: "تم تحويل التسجيل وتلخيصه",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في التحليل",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "تم الحذف",
        description: "تم حذف الرسالة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في حذف الرسالة",
        variant: "destructive",
      });
    },
  });
  const handleRecordingComplete = async (audioBlob: Blob) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    setCurrentResult(prev => ({ ...prev, originalAudioUrl: audioUrl }));
    analyzeMutation.mutate(audioBlob);
  };
  const handleDeleteMessage = (id: string) => {
    deleteMutation.mutate(id);
  };
  const handlePlayAudio = async (id: string) => {
    const message = messages.find((m) => m.id === id);
    if (message?.summaryAudioBase64) {
      try {
        await playBase64Audio(message.summaryAudioBase64);
      } catch {
        toast({
          title: "خطأ",
          description: "فشل في تشغيل الصوت",
          variant: "destructive",
        });
      }
    }
  };
  const handlePlayCurrentSummary = async () => {
    if (currentResult.summaryAudioBase64) {
      try {
        await playBase64Audio(currentResult.summaryAudioBase64);
      } catch {
        toast({
          title: "خطأ",
          description: "فشل في تشغيل الصوت",
          variant: "destructive",
        });
      }
    }
  };
  return (
    <div className="min-h-screen bg-background" data-testid="home-page">
      <Header 
        isOnline={true} 
        systemStatus={analyzeMutation.isPending ? "processing" : "operational"} 
      />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          <div className="lg:col-span-2">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              isProcessing={analyzeMutation.isPending}
            />
          </div>
          <div className="lg:col-span-3">
            <AnalysisResult
              originalText={currentResult.originalText}
              originalAudioUrl={currentResult.originalAudioUrl}
              summary={currentResult.summary}
              extraction={currentResult.extraction}
              summaryAudioUrl={currentResult.summaryAudioBase64 ? `data:audio/mp3;base64,${currentResult.summaryAudioBase64}` : undefined}
              timestamp={currentResult.timestamp}
              isLoading={analyzeMutation.isPending}
            />
          </div>
        </div>
        <MessageLog
          messages={messages.map((m) => ({
            id: m.id,
            summary: m.summary,
            originalText: m.originalText,
            timestamp: m.timestamp,
            status: m.status,
          }))}
          onDelete={handleDeleteMessage}
          onPlayAudio={handlePlayAudio}
        />
      </main>
    </div>
  );
}