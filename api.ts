import { apiRequest } from "./queryClient";
export interface TacticalExtraction {
  command: string;
  direction: string;
  location: string;
  target: string;
  urgency: "عاجل" | "عادي" | "غير محدد";
  confidence: "مؤكد" | "محتمل" | "غير مؤكد";
  notes: string;
  originalQuotes: string[];
  summary: string;
  validationIssues: string[];
  isValidated: boolean;
}
export interface AnalysisResponse {
  id: string;
  originalText: string;
  summary: string;
  extraction?: TacticalExtraction;
  summaryAudioBase64?: string;
  timestamp: string;
  status: "processed" | "error";
}
export interface Message {
  id: string;
  originalText: string;
  summary: string;
  extraction?: TacticalExtraction;
  summaryAudioBase64?: string;
  timestamp: Date;
  status: "processed" | "error";
}
export async function analyzeAudio(audioBlob: Blob): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "فشل في تحليل التسجيل");
  }
  return response.json();
}
export async function getMessages(): Promise<Message[]> {
  const response = await fetch("/api/messages");
  if (!response.ok) {
    throw new Error("فشل في جلب الرسائل");
  }
  const data = await response.json();
  return data.map((msg: any) => ({
    ...msg,
    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
  }));
}
export function parseAnalysisResponse(data: AnalysisResponse): {
  originalText: string;
  summary: string;
  extraction?: TacticalExtraction;
  summaryAudioBase64?: string;
  timestamp: Date;
} {
  return {
    originalText: data.originalText,
    summary: data.summary,
    extraction: data.extraction,
    summaryAudioBase64: data.summaryAudioBase64,
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
  };
}
export async function deleteMessage(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/messages/${id}`);
}
export function playBase64Audio(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("فشل في تشغيل الصوت"));
    audio.play();
  });
}
export async function generateTTS(text: string): Promise<string> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  
  if (!response.ok) {
    throw new Error("فشل في تحويل النص لصوت");
  }
  
  const data = await response.json();
  return data.audioBase64;
}