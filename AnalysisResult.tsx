import { useState, useEffect, useRef } from "react";
import { FileText, Volume2, VolumeX, Copy, Check, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, HelpCircle, Target, Compass, MapPin, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateTTS, type TacticalExtraction } from "@/lib/api";
interface AnalysisResultProps {
  originalText?: string;
  originalAudioUrl?: string;
  summary?: string;
  extraction?: TacticalExtraction;
  summaryAudioUrl?: string;
  timestamp?: Date;
  isLoading?: boolean;
}
export default function AnalysisResult({
  originalText,
  originalAudioUrl,
  summary,
  extraction,
  summaryAudioUrl,
  timestamp,
  isLoading = false,
}: AnalysisResultProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPlayingSummary, setIsPlayingSummary] = useState(false);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | undefined>(undefined);
  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  const playSummaryAudio = async () => {
    // If we have cached audio or pre-loaded audio, play it
    const audioToPlay = audioBase64 || summaryAudioUrl;
    
    if (audioToPlay && summaryAudioRef.current) {
      summaryAudioRef.current.play();
      return;
    }
    
    // Otherwise, fetch TTS on demand
    if (summary && !isLoadingAudio) {
      setIsLoadingAudio(true);
      try {
        const base64 = await generateTTS(summary);
        setAudioBase64(base64);
        const audioUrl = `data:audio/mp3;base64,${base64}`;
        const audio = new Audio(audioUrl);
        summaryAudioRef.current = audio;
        audio.onplay = () => setIsPlayingSummary(true);
        audio.onended = () => setIsPlayingSummary(false);
        audio.onerror = () => setIsPlayingSummary(false);
        audio.play();
      } catch (error) {
        console.error("TTS error:", error);
      } finally {
        setIsLoadingAudio(false);
      }
    }
  };
  const stopSummaryAudio = () => {
    if (summaryAudioRef.current) {
      summaryAudioRef.current.pause();
      summaryAudioRef.current.currentTime = 0;
      setIsPlayingSummary(false);
    }
  };
  const playOriginalAudio = () => {
    if (originalAudioUrl && originalAudioRef.current) {
      originalAudioRef.current.play();
    }
  };
  const stopOriginalAudio = () => {
    if (originalAudioRef.current) {
      originalAudioRef.current.pause();
      originalAudioRef.current.currentTime = 0;
      setIsPlayingOriginal(false);
    }
  };
  useEffect(() => {
    const audioSrc = summaryAudioUrl || (audioBase64 ? `data:audio/mp3;base64,${audioBase64}` : null);
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      summaryAudioRef.current = audio;
      audio.onplay = () => setIsPlayingSummary(true);
      audio.onended = () => setIsPlayingSummary(false);
      audio.onerror = () => setIsPlayingSummary(false);
    }
  }, [summaryAudioUrl, audioBase64]);
  
  // Reset audio when summary changes
  useEffect(() => {
    setAudioBase64(undefined);
  }, [summary]);
  useEffect(() => {
    if (originalAudioUrl) {
      const audio = new Audio(originalAudioUrl);
      originalAudioRef.current = audio;
      audio.onplay = () => setIsPlayingOriginal(true);
      audio.onended = () => setIsPlayingOriginal(false);
      audio.onerror = () => setIsPlayingOriginal(false);
    }
  }, [originalAudioUrl]);
  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case "مؤكد": return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
      case "محتمل": return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
      case "غير مؤكد": return "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };
  const getConfidenceIcon = (confidence?: string) => {
    switch (confidence) {
      case "مؤكد": return <CheckCircle className="w-4 h-4" />;
      case "محتمل": return <HelpCircle className="w-4 h-4" />;
      case "غير مؤكد": return <AlertTriangle className="w-4 h-4" />;
      default: return null;
    }
  };
  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case "عاجل": return "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30";
      case "عادي": return "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };
  if (isLoading) {
    return (
      <Card data-testid="analysis-result-loading">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">جاري تحليل التسجيل الصوتي...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!originalText && !summary) {
    return (
      <Card data-testid="analysis-result-empty">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">لا توجد نتائج بعد</p>
              <p className="text-sm text-muted-foreground">
                ابدأ بالتسجيل للحصول على تحليل فوري
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card data-testid="analysis-result">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            نتائج التحليل
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {extraction?.confidence && (
              <Badge 
                variant="outline" 
                className={`gap-1 ${getConfidenceColor(extraction.confidence)}`}
                data-testid="badge-confidence"
              >
                {getConfidenceIcon(extraction.confidence)}
                {extraction.confidence}
              </Badge>
            )}
            {extraction?.urgency && extraction.urgency !== "غير محدد" && (
              <Badge 
                variant="outline" 
                className={`gap-1 ${getUrgencyColor(extraction.urgency)}`}
                data-testid="badge-urgency"
              >
                <Zap className="w-3 h-3" />
                {extraction.urgency}
              </Badge>
            )}
            {timestamp && (
              <Badge variant="secondary" data-testid="badge-timestamp">
                {timestamp.toLocaleTimeString("ar-SA")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {extraction && (
          <div className="flex flex-wrap gap-3 p-4 bg-primary/5 rounded-md border border-primary/20" data-testid="extraction-grid">
            {extraction.command && extraction.command !== "غير مذكور" && (
              <div className="flex items-start gap-2">
                <Target className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <span className="text-xs text-muted-foreground block">الأمر</span>
                  <span className="text-sm font-medium" data-testid="text-command">{extraction.command}</span>
                </div>
              </div>
            )}
            {extraction.direction && extraction.direction !== "غير مذكور" && (
              <div className="flex items-start gap-2">
                <Compass className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <span className="text-xs text-muted-foreground block">الاتجاه</span>
                  <span className="text-sm font-medium" data-testid="text-direction">{extraction.direction}</span>
                </div>
              </div>
            )}
            {extraction.location && extraction.location !== "غير مذكور" && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <span className="text-xs text-muted-foreground block">الموقع</span>
                  <span className="text-sm font-medium" data-testid="text-location">{extraction.location}</span>
                </div>
              </div>
            )}
            {extraction.target && extraction.target !== "غير مذكور" && (
              <div className="flex items-start gap-2">
                <Target className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <span className="text-xs text-muted-foreground block">الهدف</span>
                  <span className="text-sm font-medium" data-testid="text-target">{extraction.target}</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="space-y-3 p-4 bg-primary/10 rounded-md">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">الملخص</span>
          </div>
          {summary && (
            <div className="flex justify-center">
              <Button
                size="lg"
                variant={isPlayingSummary ? "destructive" : "default"}
                onClick={isPlayingSummary ? stopSummaryAudio : playSummaryAudio}
                disabled={isLoadingAudio}
                className="gap-2 min-w-40"
                data-testid="button-play-summary"
              >
                {isLoadingAudio ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري التحميل...
                  </>
                ) : isPlayingSummary ? (
                  <>
                    <VolumeX className="w-5 h-5" />
                    إيقاف
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    تشغيل الصوت
                  </>
                )}
              </Button>
            </div>
          )}
          {summary && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm leading-relaxed flex-1" data-testid="text-summary">{summary}</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copyToClipboard(summary, "summary")}
                data-testid="button-copy-summary"
              >
                {copiedField === "summary" ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </div>
        {extraction?.validationIssues && extraction.validationIssues.length > 0 && (
          <div className="p-3 bg-yellow-500/10 rounded-md border border-yellow-500/30" data-testid="validation-warnings">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-yellow-700 dark:text-yellow-400">ملاحظة للمراجعة</span>
            </div>
          </div>
        )}
        {(originalText || originalAudioUrl) && (
          <div className="space-y-2 border-t pt-4">
            <Button
              variant="ghost"
              className="w-full justify-between px-0"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="button-toggle-transcript"
            >
              <span className="font-semibold text-sm">التسجيل الأصلي (للمقارنة)</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {isExpanded && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-md">
                {originalAudioUrl && (
                  <div className="flex justify-center">
                    <Button
                      variant={isPlayingOriginal ? "destructive" : "outline"}
                      onClick={isPlayingOriginal ? stopOriginalAudio : playOriginalAudio}
                      className="gap-2"
                      data-testid="button-play-original"
                    >
                      {isPlayingOriginal ? (
                        <>
                          <VolumeX className="w-4 h-4" />
                          إيقاف التسجيل
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          تشغيل التسجيل الأصلي
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {originalText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">النص المستخرج:</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(originalText, "original")}
                        className="gap-1 h-7"
                        data-testid="button-copy-original"
                      >
                        {copiedField === "original" ? (
                          <Check className="w-3 h-3 text-primary" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        نسخ
                      </Button>
                    </div>
                    <p 
                      className="text-sm leading-relaxed p-3 bg-card rounded border"
                      data-testid="text-original"
                    >
                      {originalText}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}