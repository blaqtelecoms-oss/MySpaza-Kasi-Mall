import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Bot, RefreshCw, Lightbulb, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

const SUGGESTED_QUESTIONS = [
  "How do I price bread to make a profit?",
  "What products sell best in spaza shops?",
  "How do I register my business?",
  "Explain VAT to me simply",
  "How do I calculate my profit?",
  "What should I buy this week?",
  "How do I prevent stock theft?",
  "How can I grow my business?",
  "How do I manage my cash properly?",
  "What is a good markup percentage?",
];

export default function SpazaCoach() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Sawubona! I'm **Spaza Coach**, your personal business advisor.\n\nI can help you with:\n- Pricing and profits\n- Inventory management\n- Business registration\n- Banking and funding\n- Understanding your numbers\n\nWhat would you like to know today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [businessContext, setBusinessContext] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadBusinessContext();
  }, []);

  const loadBusinessContext = async () => {
    try {
      const [sales, products, expenses] = await Promise.all([
        base44.entities.Sale.filter({ sale_date: new Date().toISOString().split("T")[0] }).catch(() => []),
        base44.entities.Product.list().catch(() => []),
        base44.entities.Expense.list("-expense_date", 20).catch(() => []),
      ]);
      const todayRevenue = sales.filter(s => s.status === "completed").reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const stockValue = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock_quantity || 0)), 0);
      const lowStock = products.filter(p => p.stock_quantity <= (p.min_stock_level || 5)).length;
      setBusinessContext({ todayRevenue, stockValue, productCount: products.length, lowStock, products: products.slice(0, 10) });
    } catch (err) { console.error(err); }
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      const contextStr = businessContext
        ? `\nBusiness context: Today's revenue: R${businessContext.todayRevenue.toFixed(2)}, Stock value: R${businessContext.stockValue.toFixed(2)}, Products: ${businessContext.productCount}, Low stock items: ${businessContext.lowStock}.`
        : "";

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Spaza Coach, a friendly business advisor for South African spaza shop owners. 
You speak in simple, clear English that is easy to understand. 
Use practical South African examples and reference local brands, suppliers, and context where relevant.
Always be encouraging and supportive.
${contextStr}

User question: ${userText}

Provide helpful, practical advice. Use bullet points to make it easy to read. Keep responses concise but complete.`,
      });

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again in a moment." }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full max-h-full bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0D0D0D] to-[#1c1c1c] p-4 text-white flex items-center gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
          <Bot size={28} />
        </div>
        <div>
          <h1 className="font-bold text-lg">Spaza Coach</h1>
          <p className="text-white/60 text-sm">Your AI Business Advisor · Always available</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
          <span className="text-xs text-white/60">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-green-600 text-white rounded-br-sm"
                : "bg-card text-foreground rounded-bl-sm shadow-sm border"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center mr-2 flex-shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-card border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Lightbulb size={12} /> Suggested questions:</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="flex-shrink-0 bg-card border border-border hover:border-foreground rounded-full px-3 py-1.5 text-xs text-foreground transition-colors shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-card border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Ask me anything about your business..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            disabled={loading}
            className="flex-1 h-12"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="h-12 w-12 bg-foreground text-background hover:bg-foreground/90 rounded-xl p-0"
          >
            <Send size={18} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {SUGGESTED_QUESTIONS.slice(4).map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-xs text-foreground hover:underline"
            >
              {q} ·
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}