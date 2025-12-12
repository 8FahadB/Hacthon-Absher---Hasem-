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