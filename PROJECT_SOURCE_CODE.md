نظام حسم الأمني - الكود المصدري الكامل
Husam Security System - Complete Source Code
نظرة عامة / Overview
نظام ذكي لتحليل الاتصالات الصوتية الميدانية باستخدام الذكاء الاصطناعي. Intelligent system for analyzing field voice communications using AI.

الميزات / Features:
تسجيل صوتي مباشر / Direct audio recording
تحويل الصوت لنص (Whisper) / Speech-to-text
استخراج المعلومات التكتيكية (GPT-4) / Tactical info extraction
تحويل الملخص لصوت (TTS) / Text-to-speech summary
واجهة عربية كاملة / Full Arabic interface
هيكل المشروع / Project Structure
``` ├── client/src/ # Frontend React │ ├── components/ # المكونات │ ├── pages/ # الصفحات │ ├── lib/ # المكتبات │ └── hooks/ # React Hooks ├── server/ # Backend Express │ ├── openai.ts # تكامل OpenAI │ ├── routes.ts # API endpoints │ └── storage.ts # تخزين البيانات ├── shared/ # أنواع مشتركة │ └── schema.ts # Data models └── python-backend/ # وضع الأوفلاين (اختياري) ```

1. shared/schema.ts - أنواع البيانات / Data Types
import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

2. server/openai.ts - تكامل OpenAI / OpenAI Integration
import OpenAI from "openai";
import fs from "fs";
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("مفتاح OpenAI API غير موجود. يرجى إضافة OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
export interface TacticalExtraction {
  command: string;
  direction: string;
  location: string;
  target: string;
  friendlyTarget: string;
  enemyPresence: string;
  urgency: "عاجل" | "عادي" | "غير محدد";
  confidence: "مؤكد" | "محتمل" | "غير مؤكد";
  notes: string;
  originalQuotes: string[];
  summary: string;
  validationIssues: string[];
  isValidated: boolean;
}
export interface AnalysisResult {
  originalText: string;
  extraction: TacticalExtraction;
  summary: string;
  summaryAudioBase64?: string;
}
export async function transcribeAudio(audioFilePath: string): Promise<string> {
  const openai = getOpenAIClient();
  const audioReadStream = fs.createReadStream(audioFilePath);
  const transcription = await openai.audio.transcriptions.create({
    file: audioReadStream,
    model: "whisper-1",
    language: "ar",
  });
  return transcription.text;
}
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ٖ]/g, "")
    .toLowerCase()
    .trim();
}
const COMPOUND_DIRECTIONS = [
  "الجنوب الشرقي", "الجنوب الغربي", "الشمال الشرقي", "الشمال الغربي",
  "جنوب شرق", "جنوب غرب", "شمال شرق", "شمال غرب",
];
const SIMPLE_DIRECTIONS = ["شمال", "جنوب", "شرق", "غرب", "الشمال", "الجنوب", "الشرق", "الغرب", "الشمالية", "الجنوبية", "الشرقية", "الغربية"];
const ALL_DIRECTIONS = [...COMPOUND_DIRECTIONS, ...SIMPLE_DIRECTIONS];
const NEGATION_WORDS = ["لا", "لن", "ما", "ليس", "بدون", "عدم"];
function findExactWord(word: string, text: string): boolean {
  const normalizedWord = normalizeArabic(word);
  const normalizedText = normalizeArabic(text);
  
  // For multi-word phrases (like locations), check if all words exist
  if (normalizedWord.includes(" ")) {
    const words = normalizedWord.split(" ");
    return words.every(w => normalizedText.includes(w));
  }
  
  // For single words, use flexible matching with Arabic prefixes
  const wordPattern = new RegExp(`(^|\\s|ب|لل|ال|و|ف|ل)${normalizedWord}(\\s|$|ي|ه|ا|ة)`, "i");
  return wordPattern.test(normalizedText);
}
function checkNegation(field: string, text: string): boolean {
  const normalizedText = normalizeArabic(text);
  
  for (const negWord of NEGATION_WORDS) {
    const pattern = new RegExp(`${normalizeArabic(negWord)}\\s+.*${normalizeArabic(field)}`, "i");
    if (pattern.test(normalizedText)) {
      return true;
    }
  }
  return false;
}
function validateQuoteContainsFields(quote: string, extraction: TacticalExtraction): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (extraction.direction !== "غير مذكور") {
    const dirFound = ALL_DIRECTIONS.some((dir: string) => {
      const normalizedDir = normalizeArabic(dir);
      const normalizedExtDir = normalizeArabic(extraction.direction);
      if (normalizedDir.includes(normalizedExtDir) || normalizedExtDir.includes(normalizedDir)) {
        return findExactWord(dir, quote);
      }
      return false;
    }) || findExactWord(extraction.direction, quote);
    
    if (!dirFound) {
      issues.push(`الاتجاه "${extraction.direction}" غير موجود في الاقتباس`);
    }
    
    if (checkNegation(extraction.direction, quote)) {
      issues.push(`الاتجاه "${extraction.direction}" منفي في الاقتباس`);
    }
  }
  
  if (extraction.target !== "غير مذكور") {
    if (!findExactWord(extraction.target, quote)) {
      issues.push(`الهدف "${extraction.target}" غير موجود في الاقتباس`);
    }
  }
  
  if (extraction.command !== "غير مذكور") {
    if (!findExactWord(extraction.command, quote)) {
      issues.push(`الأمر "${extraction.command}" غير موجود في الاقتباس`);
    }
    if (checkNegation(extraction.command, quote)) {
      issues.push(`الأمر "${extraction.command}" منفي في الاقتباس`);
    }
  }
  
  if (extraction.location !== "غير مذكور") {
    if (!findExactWord(extraction.location, quote)) {
      issues.push(`الموقع "${extraction.location}" غير موجود في الاقتباس`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}
function countDirectionsInText(text: string): number {
  const normalizedText = normalizeArabic(text);
  
  for (const compound of COMPOUND_DIRECTIONS) {
    if (normalizedText.includes(normalizeArabic(compound))) {
      return 1;
    }
  }
  
  let count = 0;
  const foundDirs: string[] = [];
  for (const dir of SIMPLE_DIRECTIONS) {
    if (findExactWord(dir, text) && !foundDirs.some(f => normalizeArabic(dir).includes(normalizeArabic(f)) || normalizeArabic(f).includes(normalizeArabic(dir)))) {
      foundDirs.push(dir);
      count++;
    }
  }
  return count;
}
function validateExtraction(extraction: TacticalExtraction, originalText: string): TacticalExtraction {
  const issues: string[] = [];
  let confidence = extraction.confidence;
  let isValidated = true;
  
  const directionCount = countDirectionsInText(originalText);
  if (directionCount > 1 && extraction.direction !== "غير مذكور") {
    issues.push(`تحذير: النص يحتوي على ${directionCount} اتجاهات - تحقق يدوياً من الاتجاه الصحيح`);
    confidence = "غير مؤكد";
    isValidated = false;
  }
  const bestQuote = extraction.originalQuotes.find(q => 
    normalizeArabic(originalText).includes(normalizeArabic(q))
  );
  
  if (!bestQuote) {
    issues.push("الاقتباس غير موجود في النص الأصلي");
    confidence = "غير مؤكد";
    isValidated = false;
  } else {
    const quoteValidation = validateQuoteContainsFields(bestQuote, extraction);
    if (!quoteValidation.valid) {
      issues.push(...quoteValidation.issues);
      confidence = "غير مؤكد";
      isValidated = false;
    }
  }
  // Keep the built summary - don't overwrite with quote
  return {
    ...extraction,
    confidence: confidence as "مؤكد" | "محتمل" | "غير مؤكد",
    validationIssues: issues,
    isValidated: isValidated && issues.length === 0,
  };
}
export async function extractTacticalInfo(text: string): Promise<TacticalExtraction> {
  const openai = getOpenAIClient();
  
  const systemPrompt = `أنت محلل اتصالات عسكرية تكتيكية. مهمتك استخراج المعلومات وإنتاج ملخص شديد الإيجاز.
قواعد الملخص (مهم جداً):
1. الملخص يجب أن يكون 15-25 كلمة فقط كحد أقصى
2. لا تنسخ النص الأصلي - اختصره بشكل كبير
3. استخدم عبارات مركبة: "توزيع مراقبين على 3 بوابات" بدلاً من تكرار كل أمر
4. اذكر الأسماء والمواقع بإيجاز: "سعد/خالد/سعود → ألف/باء/جيم"
5. لا تضف تفاصيل ثانوية - فقط جوهر المهمة
استخرج بصيغة JSON:
{
  "command": "الفعل الرئيسي",
  "direction": "الاتجاه أو غير مذكور",
  "location": "المكان/المواقع",
  "friendlyTarget": "الأشخاص المعنيون أو غير مذكور",
  "enemyPresence": "نعم/لا",
  "urgency": "عاجل/عادي/غير محدد",
  "confidence": "مؤكد/محتمل/غير مؤكد",
  "notes": "تفاصيل إضافية",
  "originalQuotes": ["النص كاملاً"],
  "summary": "ملخص مختصر جداً (15-25 كلمة) يوصل الفكرة الأساسية"
}
مثال 1:
النص: "يرجى التوجه للبوابة الشرقية لدعم زملائك الجنود الدعم مطلوب بشكل عاجل"
الملخص: "دعم الزملاء بالبوابة الشرقية - عاجل"
مثال 2:
النص: "سعد توجه فورا الى بوابة ألف وتولى المراقبة هناك خالد انتقل الى بوابة باء وثبت موقعك دون تأخير سعود اتجه الى بوابة جيم وراقب الحركة بدقة ابلغوا مباشرة عن اي امر غير طبيعي"
الملخص: "توزيع مراقبين: سعد/خالد/سعود على بوابات ألف/باء/جيم - إبلاغ فوري"
مثال 3:
النص: "فريق ألفا تقدم نحو المبنى الشمالي فريق براڤو غطِّ الجناح الأيسر فريق تشارلي ابق في موقعك للاحتياط"
الملخص: "3 فرق: ألفا→شمال، براڤو→غطاء أيسر، تشارلي→احتياط"`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `استخرج المعلومات التكتيكية من النص التالي:\n\n${text}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 800,
    temperature: 0,
  });
  const content = response.choices[0].message.content || "{}";
  
  try {
    const parsed = JSON.parse(content);
    
    // Build concise tactical summary - command + location/direction + context + urgency
    const summaryParts: string[] = [];
    
    // Command (normalize to imperative form)
    const command = parsed.command || "";
    if (command && command !== "غير مذكور") {
      // Normalize: "التوجه" -> "توجه", "يرجى التوجه" -> "توجه"
      const normalizedCmd = command.replace(/^(يرجى |ال)/, "");
      summaryParts.push(normalizedCmd);
    }
    
    // Location
    if (parsed.location && parsed.location !== "غير مذكور") {
      summaryParts.push(`إلى ${parsed.location}`);
    }
    
    // Direction (only if no location)
    if (parsed.direction && parsed.direction !== "غير مذكور" && (!parsed.location || parsed.location === "غير مذكور")) {
      summaryParts.push(`باتجاه ${parsed.direction}`);
    }
    
    // Friendly Target (who to support) - only if mentioned
    if (parsed.friendlyTarget && parsed.friendlyTarget !== "غير مذكور") {
      summaryParts.push(`لدعم ${parsed.friendlyTarget}`);
    }
    
    // Enemy Presence (threat warning) - CRITICAL: enemy is a threat, not target to support!
    if (parsed.enemyPresence === "نعم") {
      summaryParts.push("- العدو متواجد");
    }
    
    // Urgency
    if (parsed.urgency === "عاجل") {
      summaryParts.push("- عاجل");
    }
    
    // Use GPT's summary if available (better for multiple commands), fallback to built summary
    const builtSummary = summaryParts.length > 0 ? summaryParts.join(" ") : text;
    const finalSummary = parsed.summary || builtSummary;
    
    const extraction: TacticalExtraction = {
      command: parsed.command || "غير مذكور",
      direction: parsed.direction || "غير مذكور",
      location: parsed.location || "غير مذكور",
      target: parsed.friendlyTarget || "غير مذكور",
      friendlyTarget: parsed.friendlyTarget || "غير مذكور",
      enemyPresence: parsed.enemyPresence || "لا",
      urgency: parsed.urgency || "غير محدد",
      confidence: parsed.confidence || "غير مؤكد",
      notes: parsed.notes || "",
      originalQuotes: parsed.originalQuotes || [],
      summary: finalSummary,
      validationIssues: [],
      isValidated: false,
    };
    
    return validateExtraction(extraction, text);
  } catch {
    return {
      command: "غير مذكور",
      direction: "غير مذكور",
      location: "غير مذكور",
      target: "غير مذكور",
      friendlyTarget: "غير مذكور",
      enemyPresence: "لا",
      urgency: "غير محدد",
      confidence: "غير مؤكد",
      notes: "",
      originalQuotes: [text],
      summary: text,
      validationIssues: ["فشل في تحليل الاستجابة - استخدم النص الأصلي"],
      isValidated: false,
    };
  }
}
export async function textToSpeech(text: string): Promise<Buffer> {
  const openai = getOpenAIClient();
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "onyx",
    input: text,
    speed: 1.0,
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  return buffer;
}
export async function analyzeAudio(audioFilePath: string, skipTTS: boolean = false): Promise<AnalysisResult> {
  const originalText = await transcribeAudio(audioFilePath);
  
  if (!originalText.trim()) {
    throw new Error("لم يتم التعرف على أي كلام في التسجيل");
  }
  const extraction = await extractTacticalInfo(originalText);
  
  let summaryAudioBase64: string | undefined;
  
  // Generate TTS only if not skipped (for faster initial response)
  if (!skipTTS) {
    try {
      const summaryAudioBuffer = await textToSpeech(extraction.summary);
      summaryAudioBase64 = summaryAudioBuffer.toString("base64");
    } catch (error) {
      console.error("TTS error:", error);
    }
  }
  return {
    originalText,
    extraction,
    summary: extraction.summary,
    summaryAudioBase64,
  };
}
export async function generateSpeech(text: string): Promise<string> {
  const buffer = await textToSpeech(text);
  return buffer.toString("base64");
}

3. server/routes.ts - API Endpoints
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeAudio, generateSpeech } from "./openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname) || ".webm"}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/analyze", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "لم يتم رفع ملف صوتي" });
      }
      const audioPath = req.file.path;
      try {
        const result = await analyzeAudio(audioPath, true);
        const message = await storage.createMessage({
          originalText: result.originalText,
          summary: result.summary,
          summaryAudioBase64: result.summaryAudioBase64,
          status: "processed",
        });
        res.json({
          id: message.id,
          originalText: result.originalText,
          summary: result.summary,
          extraction: result.extraction,
          summaryAudioBase64: result.summaryAudioBase64,
          timestamp: message.timestamp.toISOString(),
          status: "processed",
        });
      } finally {
        fs.unlink(audioPath, () => {});
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ 
        message: error.message || "حدث خطأ أثناء تحليل التسجيل" 
      });
    }
  });
  app.get("/api/messages", async (_req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json(messages.map(m => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })));
    } catch (error: any) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء جلب الرسائل" });
    }
  });
  app.delete("/api/messages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMessage(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete message error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء حذف الرسالة" });
    }
  });
  // TTS endpoint - generate speech on demand
  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ message: "النص مطلوب" });
      }
      const audioBase64 = await generateSpeech(text);
      res.json({ audioBase64 });
    } catch (error: any) {
      console.error("TTS error:", error);
      res.status(500).json({ message: "حدث خطأ في تحويل النص لصوت" });
    }
  });
  return httpServer;
}

4. server/storage.ts - تخزين البيانات / Data Storage
import { randomUUID } from "crypto";
export interface Message {
  id: string;
  originalText: string;
  summary: string;
  summaryAudioBase64?: string;
  timestamp: Date;
  status: "processed" | "error";
}
export interface InsertMessage {
  originalText: string;
  summary: string;
  summaryAudioBase64?: string;
  status: "processed" | "error";
}
export interface IStorage {
  getMessages(): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
}
export class MemStorage implements IStorage {
  private messages: Map<string, Message>;
  constructor() {
    this.messages = new Map();
  }
  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }
  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
  }
}
export const storage = new MemStorage();

5. client/src/App.tsx - التطبيق الرئيسي / Main App
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;

6. client/src/pages/Home.tsx - الصفحة الرئيسية / Home Page
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

7. client/src/components/Header.tsx - الشريط العلوي / Header
import { Radio, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
interface HeaderProps {
  systemStatus?: "operational" | "processing" | "error";
}
export default function Header({ systemStatus = "operational" }: HeaderProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);
  const toggleTheme = () => setIsDark(!isDark);
  const getStatusBadge = () => {
    switch (systemStatus) {
      case "processing":
        return <Badge variant="secondary" className="bg-amber-600/20 text-amber-400 border-amber-600/30">جاري المعالجة</Badge>;
      case "error":
        return <Badge variant="destructive">خطأ في النظام</Badge>;
      default:
        return <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">جاهز للعمل</Badge>;
    }
  };
  return (
    <header className="h-16 bg-card border-b border-card-border flex items-center justify-between px-6" data-testid="header">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Radio className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">نظام حسم الأمني</h1>
        </div>
        {getStatusBadge()}
      </div>
      
      <Button 
          size="icon" 
          variant="ghost" 
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
    </header>
  );
}

8. client/src/components/AudioRecorder.tsx - مسجل الصوت / Audio Recorder
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

9. client/src/components/AnalysisResult.tsx - نتائج التحليل / Analysis Results
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

10. client/src/components/MessageLog.tsx - سجل الرسائل / Message Log
import { useState } from "react";
import { Clock, Volume2, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
interface Message {
  id: string;
  summary: string;
  originalText: string;
  timestamp: Date;
  status: "processed" | "error";
}
interface MessageLogProps {
  messages: Message[];
  onDelete?: (id: string) => void;
  onPlayAudio?: (id: string) => void;
}
export default function MessageLog({ messages, onDelete, onPlayAudio }: MessageLogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filteredMessages = messages.filter(
    (msg) =>
      msg.summary.includes(searchQuery) || msg.originalText.includes(searchQuery)
  );
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  return (
    <Card data-testid="message-log">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            سجل الرسائل
            <Badge variant="secondary" className="mr-2">{messages.length}</Badge>
          </CardTitle>
        </div>
        <div className="relative mt-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="البحث في الرسائل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search-messages"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "لا توجد نتائج للبحث" : "لا توجد رسائل بعد"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 bg-muted/50 rounded-md border border-border hover-elevate"
                  data-testid={`message-item-${message.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(message.timestamp)}</span>
                      <span>-</span>
                      <span>{formatTime(message.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={message.status === "processed" ? "secondary" : "destructive"}
                        className={message.status === "processed" ? "bg-primary/20 text-primary border-primary/30" : ""}
                      >
                        {message.status === "processed" ? "تم التحليل" : "خطأ"}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm font-medium mb-2 line-clamp-2" data-testid={`text-message-summary-${message.id}`}>
                    {message.summary}
                  </p>
                  {expandedId === message.id && (
                    <div className="mt-3 p-3 bg-background rounded border border-border">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {message.originalText}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === message.id ? null : message.id)}
                      data-testid={`button-expand-${message.id}`}
                    >
                      {expandedId === message.id ? (
                        <>
                          <ChevronUp className="w-4 h-4 ml-1" />
                          إخفاء النص
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 ml-1" />
                          عرض النص الكامل
                        </>
                      )}
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onPlayAudio?.(message.id)}
                        data-testid={`button-play-${message.id}`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete?.(message.id)}
                        data-testid={`button-delete-${message.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

11. client/src/lib/api.ts - واجهة API / API Client
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

12. client/src/lib/queryClient.ts - إعدادات React Query
import { QueryClient, QueryFunction } from "@tanstack/react-query";
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    await throwIfResNotOk(res);
    return await res.json();
  };
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

13. server/index.ts - نقطة البداية / Entry Point
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
const app = express();
const httpServer = createServer(app);
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await registerRoutes(httpServer, app);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

14. package.json - الاعتماديات / Dependencies
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "tsx script/build.ts",
    "start": "NODE_ENV=production node dist/index.cjs",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@jridgewell/trace-mapping": "^0.3.25",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@tanstack/react-query": "^5.60.5",
    "@types/multer": "^2.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "connect-pg-simple": "^10.0.0",
    "date-fns": "^3.6.0",
    "drizzle-orm": "^0.39.3",
    "drizzle-zod": "^0.7.0",
    "embla-carousel-react": "^8.6.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "framer-motion": "^11.13.1",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.453.0",
    "memorystore": "^1.6.7",
    "multer": "^2.0.2",
    "next-themes": "^0.4.6",
    "openai": "^6.10.0",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "pg": "^8.16.3",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.2",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.2.5",
    "vaul": "^1.1.2",
    "wouter": "^3.3.5",
    "ws": "^8.18.0",
    "zod": "^3.24.2",
    "zod-validation-error": "^3.4.0"
  },
  "devDependencies": {
    "@replit/vite-plugin-cartographer": "^0.4.4",
    "@replit/vite-plugin-dev-banner": "^0.1.1",
    "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.3",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "20.16.11",
    "@types/passport": "^1.0.16",
    "@types/passport-local": "^1.0.38",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@types/ws": "^8.5.13",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.31.4",
    "esbuild": "^0.25.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.5",
    "typescript": "5.6.3",
    "vite": "^5.4.20"
  },
  "optionalDependencies": {
    "bufferutil": "^4.0.8"
  }
}

15. client/src/index.css - الأنماط / Styles
@tailwind base;
@tailwind components;
@tailwind utilities;
/* LIGHT MODE */
:root {
  --button-outline: rgba(0,0,0, .10);
  --badge-outline: rgba(0,0,0, .05);
  --opaque-button-border-intensity: -8;
  --elevate-1: rgba(0,0,0, .03);
  --elevate-2: rgba(0,0,0, .08);
  --background: 0 0% 100%;
  --foreground: 0 0% 10%;
  --border: 0 0% 92%;
  --card: 0 0% 98%;
  --card-foreground: 0 0% 10%;
  --card-border: 0 0% 94%;
  --sidebar: 0 0% 96%;
  --sidebar-foreground: 0 0% 10%;
  --sidebar-border: 0 0% 92%;
  --sidebar-primary: 142 70% 28%;
  --sidebar-primary-foreground: 142 70% 98%;
  --sidebar-accent: 142 8% 88%;
  --sidebar-accent-foreground: 142 8% 15%;
  --sidebar-ring: 142 70% 28%;
  --popover: 0 0% 94%;
  --popover-foreground: 0 0% 10%;
  --popover-border: 0 0% 90%;
  --primary: 142 70% 28%;
  --primary-foreground: 142 70% 98%;
  --secondary: 0 0% 90%;
  --secondary-foreground: 0 0% 10%;
  --muted: 142 6% 92%;
  --muted-foreground: 142 6% 35%;
  --accent: 142 8% 94%;
  --accent-foreground: 142 8% 15%;
  --destructive: 0 72% 32%;
  --destructive-foreground: 0 72% 98%;
  --input: 0 0% 70%;
  --ring: 142 70% 28%;
  --chart-1: 142 70% 28%;
  --chart-2: 32 85% 35%;
  --chart-3: 210 75% 32%;
  --chart-4: 280 65% 35%;
  --chart-5: 20 80% 38%;
  --font-sans: 'Cairo', sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Menlo, monospace;
  --radius: .5rem;
  --shadow-2xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-sm: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow-md: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 2px 4px -1px hsl(0 0% 0% / 0.00);
  --shadow-lg: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 4px 6px -1px hsl(0 0% 0% / 0.00);
  --shadow-xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 8px 10px -1px hsl(0 0% 0% / 0.00);
  --shadow-2xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.00);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
/* Fallback for older browsers */
  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-primary-border: hsl(from hsl(var(--sidebar-primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --sidebar-accent-border: hsl(from hsl(var(--sidebar-accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --primary-border: hsl(var(--primary));
  --primary-border: hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --secondary-border: hsl(var(--secondary));
  --secondary-border: hsl(from hsl(var(--secondary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --muted-border: hsl(var(--muted));
  --muted-border: hsl(from hsl(var(--muted)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --accent-border: hsl(var(--accent));
  --accent-border: hsl(from hsl(var(--accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --destructive-border: hsl(var(--destructive));
  --destructive-border: hsl(from hsl(var(--destructive)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
}
.dark {
  --button-outline: rgba(255,255,255, .10);
  --badge-outline: rgba(255,255,255, .05);
  --opaque-button-border-intensity: 9;
  --elevate-1: rgba(255,255,255, .04);
  --elevate-2: rgba(255,255,255, .09);
  --background: 0 0% 8%;
  --foreground: 0 0% 98%;
  --border: 0 0% 18%;
  --card: 0 0% 10%;
  --card-foreground: 0 0% 98%;
  --card-border: 0 0% 13%;
  --sidebar: 0 0% 6%;
  --sidebar-foreground: 0 0% 98%;
  --sidebar-border: 0 0% 9%;
  --sidebar-primary: 142 65% 35%;
  --sidebar-primary-foreground: 142 65% 98%;
  --sidebar-accent: 142 8% 12%;
  --sidebar-accent-foreground: 142 8% 85%;
  --sidebar-ring: 142 65% 35%;
  --popover: 0 0% 12%;
  --popover-foreground: 0 0% 98%;
  --popover-border: 0 0% 15%;
  --primary: 142 65% 35%;
  --primary-foreground: 142 65% 98%;
  --secondary: 0 0% 14%;
  --secondary-foreground: 0 0% 98%;
  --muted: 142 6% 13%;
  --muted-foreground: 142 6% 70%;
  --accent: 142 8% 11%;
  --accent-foreground: 142 8% 88%;
  --destructive: 0 70% 32%;
  --destructive-foreground: 0 70% 98%;
  --input: 0 0% 35%;
  --ring: 142 65% 35%;
  --chart-1: 142 65% 55%;
  --chart-2: 32 80% 60%;
  --chart-3: 210 70% 65%;
  --chart-4: 280 60% 65%;
  --chart-5: 20 75% 62%;
  --shadow-2xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-sm: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow-md: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 2px 4px -1px hsl(0 0% 0% / 0.00);
  --shadow-lg: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 4px 6px -1px hsl(0 0% 0% / 0.00);
  --shadow-xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.00), 0px 8px 10px -1px hsl(0 0% 0% / 0.00);
  --shadow-2xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.00);
/* Fallback for older browsers */
  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-primary-border: hsl(from hsl(var(--sidebar-primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --sidebar-accent-border: hsl(from hsl(var(--sidebar-accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --primary-border: hsl(var(--primary));
  --primary-border: hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --secondary-border: hsl(var(--secondary));
  --secondary-border: hsl(from hsl(var(--secondary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --muted-border: hsl(var(--muted));
  --muted-border: hsl(from hsl(var(--muted)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --accent-border: hsl(var(--accent));
  --accent-border: hsl(from hsl(var(--accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  /* Fallback for older browsers */
  --destructive-border: hsl(var(--destructive));
  --destructive-border: hsl(from hsl(var(--destructive)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
}
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
}
/**
 * Using the elevate system.
 * Automatic contrast adjustment.
 *
 * <element className="hover-elevate" />
 * <element className="active-elevate-2" />
 *
 * // Using the tailwind utility when a data attribute is "on"
 * <element className="toggle-elevate data-[state=on]:toggle-elevated" />
 * // Or manually controlling the toggle state
 * <element className="toggle-elevate toggle-elevated" />
 *
 * Elevation systems have to handle many states.
 * - not-hovered, vs. hovered vs. active  (three mutually exclusive states)
 * - toggled or not
 * - focused or not (this is not handled with these utilities)
 *
 * Even without handling focused or not, this is six possible combinations that
 * need to be distinguished from eachother visually.
 */
@layer utilities {
  /* Hide ugly search cancel button in Chrome until we can style it properly */
  input[type="search"]::-webkit-search-cancel-button {
    @apply hidden;
  }
  /* Placeholder styling for contentEditable div */
  [contenteditable][data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: hsl(var(--muted-foreground));
    pointer-events: none;
  }
  /* .no-default-hover-elevate/no-default-active-elevate is an escape hatch so consumers of
   * buttons/badges can remove the automatic brightness adjustment on interactions
   * and program their own. */
  .no-default-hover-elevate {}
  .no-default-active-elevate {}
  /**
   * Toggleable backgrounds go behind the content. Hoverable/active goes on top.
   * This way they can stack/compound. Both will overlap the parent's borders!
   * So borders will be automatically adjusted both on toggle, and hover/active,
   * and they will be compounded.
   */
  .toggle-elevate::before,
  .toggle-elevate-2::before {
    content: "";
    pointer-events: none;
    position: absolute;
    inset: 0px;
    /*border-radius: inherit;   match rounded corners */
    border-radius: inherit;
    z-index: -1;
    /* sits behind content but above backdrop */
  }
  .toggle-elevate.toggle-elevated::before {
    background-color: var(--elevate-2);
  }
  /* If there's a 1px border, adjust the inset so that it covers that parent's border */
  .border.toggle-elevate::before {
    inset: -1px;
  }
  /* Does not work on elements with overflow:hidden! */
  .hover-elevate:not(.no-default-hover-elevate),
  .active-elevate:not(.no-default-active-elevate),
  .hover-elevate-2:not(.no-default-hover-elevate),
  .active-elevate-2:not(.no-default-active-elevate) {
    position: relative;
    z-index: 0;
  }
  .hover-elevate:not(.no-default-hover-elevate)::after,
  .active-elevate:not(.no-default-active-elevate)::after,
  .hover-elevate-2:not(.no-default-hover-elevate)::after,
  .active-elevate-2:not(.no-default-active-elevate)::after {
    content: "";
    pointer-events: none;
    position: absolute;
    inset: 0px;
    /*border-radius: inherit;   match rounded corners */
    border-radius: inherit;
    z-index: 999;
    /* sits in front of content */
  }
  .hover-elevate:hover:not(.no-default-hover-elevate)::after,
  .active-elevate:active:not(.no-default-active-elevate)::after {
    background-color: var(--elevate-1);
  }
  .hover-elevate-2:hover:not(.no-default-hover-elevate)::after,
  .active-elevate-2:active:not(.no-default-active-elevate)::after {
    background-color: var(--elevate-2);
  }
  /* If there's a 1px border, adjust the inset so that it covers that parent's border */
  .border.hover-elevate:not(.no-hover-interaction-elevate)::after,
  .border.active-elevate:not(.no-active-interaction-elevate)::after,
  .border.hover-elevate-2:not(.no-hover-interaction-elevate)::after,
  .border.active-elevate-2:not(.no-active-interaction-elevate)::after,
  .border.hover-elevate:not(.no-hover-interaction-elevate)::after {
    inset: -1px;
  }
}

16. vite.config.ts - إعدادات Vite
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

17. tailwind.config.ts - إعدادات Tailwind
import type { Config } from "tailwindcss";
export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem", /* 9px */
        md: ".375rem", /* 6px */
        sm: ".1875rem", /* 3px */
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

كيفية التشغيل / How to Run
المتطلبات / Requirements:
Node.js 18+
مفتاح OpenAI API
التثبيت:
ثبت الحزم ثم شغل المشروع

إضافة مفتاح API:
أضف OPENAI_API_KEY في متغيرات البيئة

التطبيق سيعمل على المنفذ 5000

API Endpoints
Method	Endpoint	الوصف
POST	/api/analyze	تحليل تسجيل صوتي
POST	/api/tts	تحويل نص لصوت
GET	/api/messages	جلب الرسائل
DELETE	/api/messages/:id	حذف رسالة
