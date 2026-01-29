import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Send, MessageCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: history, isLoading: historyLoading } = trpc.chat.history.useQuery();
  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "ขอโทษครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Load history on mount
  useEffect(() => {
    if (history && messages.length === 0) {
      const loadedMessages: Message[] = history.map((log) => ({
        role: log.role as "user" | "assistant",
        content: log.content,
        timestamp: new Date(log.createdAt),
      }));
      setMessages(loadedMessages);
    }
  }, [history]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /**
   * Internal send helper (string-only). Never pass events here.
   */
  const sendText = (rawText: string, opts?: { clearInput?: boolean }) => {
    const text = rawText.trim();
    if (!text || sendMessage.isPending) return;

    if (opts?.clearInput) {
      setInput("");
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        timestamp: new Date(),
      },
    ]);

    sendMessage.mutate({ message: text });
  };

  /**
   * Safe, parameterless handler for UI events (button click / Enter key).
   */
  const handleSend = () => {
    sendText(input, { clearInput: true });
  };

  /**
   * Safe helper for sending a known string (e.g. quick actions).
   */
  const handleSendText = (text: string) => {
    sendText(text, { clearInput: false });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    "วันนี้ขายได้เท่าไหร่",
    "ของอะไรใกล้หมด",
    "ใครค้างเงินอยู่",
    "พรุ่งนี้ต้องซื้ออะไร",
  ];

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
    // Auto send if question is the detailed sales summary
    if (question === "สรุปยอดวันนี้พร้อมรายการสินค้า") {
      setTimeout(() => {
        handleSend();
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-secondary-foreground hover:bg-white/10">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <img src="/mascot.png" alt="Thai Smart" className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold">น้องสมาร์ท</h1>
            <p className="text-xs opacity-80">ผู้ช่วย AI ของร้าน</p>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {historyLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <img src="/mascot.png" alt="Thai Smart" className="w-24 h-24 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">สวัสดีครับ!</h2>
            <p className="text-muted-foreground mb-6">
              ผมคือน้องสมาร์ท ผู้ช่วย AI ของร้าน<br />
              ถามอะไรเกี่ยวกับร้านได้เลยครับ
            </p>
            
            {/* Quick Questions */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">ลองถามคำถามเหล่านี้:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-2 bg-muted rounded-full text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <img
                    src="/mascot.png"
                    alt="AI"
                    className="w-8 h-8 mr-2 flex-shrink-0"
                  />
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}>
                    {msg.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <img src="/mascot.png" alt="AI" className="w-8 h-8 mr-2" />
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-muted-foreground">กำลังคิด...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Quick Questions (when has messages) */}
      {messages.length > 0 && (
        <div className="px-4 py-2 bg-card border-t border-border overflow-x-auto">
          <div className="flex gap-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setInput(q);
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 bg-muted rounded-full text-sm whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Button - สรุปยอดวันนี้พร้อมรายการสินค้า */}
      <div className="px-4 py-2 bg-muted/50 border-t border-border">
        <button
          onClick={() => {
            const question = "สรุปยอดวันนี้พร้อมรายการสินค้า";
            handleSendText(question);
          }}
          disabled={sendMessage.isPending}
          className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          <span>สรุปยอดวันนี้พร้อมรายการสินค้า</span>
        </button>
      </div>

      {/* Input */}
      <div className="p-4 bg-card border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="พิมพ์ข้อความ..."
            className="ts-input flex-1"
            disabled={sendMessage.isPending}
          />
          <Button
            className="ts-btn-primary px-4"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
