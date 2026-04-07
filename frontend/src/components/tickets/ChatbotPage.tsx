import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, Loader2, Ticket, Copy, Check, ExternalLink, FileText, Clock,  Sparkles,  StopCircle,  RefreshCw,  Settings,  MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  ticketId?: string;
  tickets?: object[];
  isStreaming?: boolean;
}

interface ParsedSection {
  type: 'text' | 'heading' | 'code' | 'list' | 'numbered-list';
  content: string;
  level?: number;
  language?: string;
  items?: string[];
}

export default function ModernChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      content: "Hi! I'm your AI-powered IT support assistant. I can help you with password resets, software troubleshooting, hardware issues, and create support tickets. What can I help you with today?",
      sender: "bot",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [answerFromAttachments, setAnswerFromAttachments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // Enhanced response parser with better markdown support
  const parseMarkdown = (content: string): ParsedSection[] => {
    const sections: ParsedSection[] = [];
    let currentSection: ParsedSection = { type: 'text', content: '' };
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeContent = '';
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          inCodeBlock = true;
          codeLanguage = line.replace('```', '').trim();
          codeContent = '';
          currentSection = { type: 'text', content: '' };
        } else {
          inCodeBlock = false;
          sections.push({
            type: 'code',
            content: codeContent,
            language: codeLanguage
          });
          codeContent = '';
          codeLanguage = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        continue;
      }

      // Handle headings
      if (line.startsWith('### ')) {
        if (currentSection.content.trim()) sections.push({ ...currentSection });
        sections.push({ type: 'heading', content: line.replace('### ', ''), level: 3 });
        currentSection = { type: 'text', content: '' };
      } else if (line.startsWith('## ')) {
        if (currentSection.content.trim()) sections.push({ ...currentSection });
        sections.push({ type: 'heading', content: line.replace('## ', ''), level: 2 });
        currentSection = { type: 'text', content: '' };
      } else if (line.startsWith('# ')) {
        if (currentSection.content.trim()) sections.push({ ...currentSection });
        sections.push({ type: 'heading', content: line.replace('# ', ''), level: 1 });
        currentSection = { type: 'text', content: '' };
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (currentSection.type !== 'list') {
          if (currentSection.content.trim()) sections.push({ ...currentSection });
          currentSection = { type: 'list', content: '', items: [] };
        }
        currentSection.items!.push(line.replace(/^[-*] /, ''));
      } else if (line.match(/^\d+\. /)) {
        if (currentSection.type !== 'numbered-list') {
          if (currentSection.content.trim()) sections.push({ ...currentSection });
          currentSection = { type: 'numbered-list', content: '', items: [] };
        }
        currentSection.items!.push(line.replace(/^\d+\. /, ''));
      } else {
        if (currentSection.type === 'list' || currentSection.type === 'numbered-list') {
          sections.push({ ...currentSection });
          currentSection = { type: 'text', content: '' };
        }
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      }
    }

    if ((currentSection.content && currentSection.content.trim()) || (currentSection.items && currentSection.items.length)) {
      sections.push(currentSection);
    }

    return sections;
  };

  // Enhanced text processing with inline formatting
  const processInlineFormatting = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let keyIndex = 0;

    // Handle bold **text**
    const boldRegex = /\*\*(.*?)\*\*/g;
    const italicRegex = /\*(.*?)\*/g;
    const inlineCodeRegex = /`([^`]+)`/g;
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const urlRegex = /(https?:\/\/[^\s)]+)(?=[\s)|\]]|$)/g;

    let processedText = text;
    
    // First handle markdown links
    processedText = processedText.replace(linkRegex, (match, label, url) => {
      return `MARKDOWN_LINK_${keyIndex++}|${label}|${url}`;
    });

    // Then handle other formatting
    const combinedRegex = /(\*\*.*?\*\*|\*.*?\*|`[^`]+`|https?:\/\/[^\s)]+|MARKDOWN_LINK_\d+\|[^|]+\|[^|]+)/g;
    let match;

    while ((match = combinedRegex.exec(processedText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(processedText.slice(lastIndex, match.index));
      }

      const matchedText = match[1];
      
      if (matchedText.startsWith('MARKDOWN_LINK_')) {
        const [, label, url] = matchedText.split('|');
        parts.push(
          <a
            key={`link-${keyIndex++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline decoration-2 underline-offset-2 transition-colors"
          >
            {label}
          </a>
        );
      } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
        parts.push(
          <strong key={`bold-${keyIndex++}`} className="font-semibold">
            {matchedText.slice(2, -2)}
          </strong>
        );
      } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
        parts.push(
          <em key={`italic-${keyIndex++}`} className="italic">
            {matchedText.slice(1, -1)}
          </em>
        );
      } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
        parts.push(
          <code key={`code-${keyIndex++}`} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
            {matchedText.slice(1, -1)}
          </code>
        );
      } else if (matchedText.startsWith('http')) {
        parts.push(
          <a
            key={`url-${keyIndex++}`}
            href={matchedText}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline decoration-2 underline-offset-2 transition-colors inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            View Link
          </a>
        );
      } else {
        parts.push(matchedText);
      }

      lastIndex = match.index + matchedText.length;
    }

    if (lastIndex < processedText.length) {
      parts.push(processedText.slice(lastIndex));
    }

    return parts.filter(part => part !== '');
  };

  // Enhanced message content renderer
  const renderMessageContent = (message: ChatMessage) => {
    if (message.sender !== "bot") {
      return (
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </div>
      );
    }

    const sections = parseMarkdown(message.content);

    return (
      <div className="space-y-4 ">
        {sections.map((section, index) => {
          switch (section.type) {
            case 'heading':
              const HeadingTag = `h${section.level}` as keyof JSX.IntrinsicElements;
              const headingClasses = {
                1: "text-xl font-bold text-gray-900 dark:text-gray-100 mb-3",
                2: "text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2",
                3: "text-base font-medium text-gray-700 dark:text-gray-300 mb-2"
              };
              return (
                <HeadingTag key={index} className={headingClasses[section.level as keyof typeof headingClasses]}>
                  {section.content}
                </HeadingTag>
              );

            case 'code':
              return (
                <div key={index} className="my-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        {section.language || 'Code'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        onClick={() => {
                          navigator.clipboard.writeText(section.content);
                          toast({ description: "Code copied to clipboard!", duration: 2000});
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <pre className="p-4 text-sm overflow-x-auto">
                      <code className="text-gray-800 dark:text-gray-200 leading-relaxed">
                        {section.content}
                      </code>
                    </pre>
                  </div>
                </div>
              );

            case 'list':
              return (
                <ul key={index} className="space-y-2 my-3">
                  {section.items?.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5 flex-shrink-0" />
                      <span className="leading-relaxed">
                        {processInlineFormatting(item)}
                      </span>
                    </li>
                  ))}
                </ul>
              );

            case 'numbered-list':
              return (
                <ol key={index} className="space-y-2 my-3">
                  {section.items?.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center justify-center mt-1">
                        {itemIndex + 1}
                      </span>
                      <span className="leading-relaxed">
                        {processInlineFormatting(item)}
                      </span>
                    </li>
                  ))}
                </ol>
              );

            default:
              if (!section.content || !section.content.trim()) return null;
              return (
                <div key={index} className="leading-relaxed whitespace-pre-wrap break-words">
                  {processInlineFormatting(section.content)}
                </div>
              );
          }
        })}
      </div>
    );
  };

  const copyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      toast({ description: "Message copied to clipboard!", duration: 2000});
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      toast({ description: "Failed to copy message", variant: "destructive", duration: 2000});
    }
  };

  // Simulated streaming function (replace with actual streaming implementation)
  const simulateStreaming = async (botMessageId: string, fullContent: string) => {
    const words = fullContent.split(' ');
    let currentContent = '';
    
    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? ' ' : '') + words[i];
      
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { ...msg, content: currentContent, isStreaming: true }
          : msg
      ));
      
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    }
    
    setMessages(prev => prev.map(msg => 
      msg.id === botMessageId 
        ? { ...msg, isStreaming: false }
        : msg
    ));
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsStreaming(true);

    // Create placeholder bot message
    const botMessageId = `bot-${Date.now()}`;
    const botMessage: ChatMessage = {
      id: botMessageId,
      content: "",
      sender: "bot",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, botMessage]);

    try {
      if (answerFromAttachments) {
        // console.log("RAG mode enabled");
        const token = localStorage.getItem('auth_token');
        
        const resp = await fetch('http://localhost:5000/api/upload/tickets/me/rag/query', {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          credentials: "include",
          body: JSON.stringify({
            query: userMessage.content,
            topK: 5,
            ensureIndex: true,
            reindex: false
          }),
        });

        if (!resp.ok) {
          const errorData = await resp.json();
          throw new Error(errorData?.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        // console.log("RAG response:", data);
  
        const sources = Array.isArray(data.sources)
          ? data.sources
              .filter(s => s?.url)
              .map((s: any, i: number) => `[${i + 1}] ${s.url}`)
              .join("  ")
          : "";

        const finalContent = sources
          ? `${data.answer || "No answer"}\n\n## Sources\n${sources}`
          : (data.answer || "No relevant information found.");

        await simulateStreaming(botMessageId, finalContent);
      } else {
        const response = await apiService.chatMessage({
          message: userMessage.content,
        });
        
        const lines = response.reply.split("\n");
        
        let tickets = lines
          .map(line => {
            const match = line.match(/\[ID:\s*([a-f0-9]+)\]/i);
            if (match) {
              const id = match[1];
              const cleanLine = line.replace(/\[ID:.*?\]\s*/, "");
              return { id, text: cleanLine.trim() };
            }
            return null;
          })
          .filter(Boolean);
        
        if (tickets.length === 0) tickets = undefined;
        
        await simulateStreaming(botMessageId, response.reply);
        
        if (tickets) {
          setMessages(prev => prev.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, tickets }
              : msg
          ));
        }
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      const errorContent = `I encountered an error while processing your request. ${e?.message || "Please try again."}`;
      await simulateStreaming(botMessageId, errorContent);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { label: "Reset Password", prompt: "I need to reset my password", icon: "🔐" },
    { label: "Software Issue", prompt: "I'm having trouble with software installation", icon: "💻" },
    { label: "Network Problem", prompt: "I'm experiencing network connectivity issues", icon: "🌐" },
    { label: "Hardware Help", prompt: "I need help with hardware problems", icon: "🔧" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10 ring-2 ring-blue-500/20">
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                    <Bot className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
              </div>
              <div>
                <h1 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                  IT Support Assistant
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Sparkles className="w-4 h-4" />
                  AI-powered • Always learning
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Online
              </Badge>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 group ${
                  message.sender === "user" ? "justify-end" : ""
                }`}
              >
                {message.sender === "bot" && (
                  <div className="flex-shrink-0">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}

                <div className={`flex-1 max-w-3xl ${message.sender === "user" ? "flex justify-end" : ""}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      message.sender === "user"
                        ? "bg-blue-600 text-white max-w-lg ml-auto"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {/* Streaming indicator */}
                    {message.isStreaming && (
                      <div className="flex items-center gap-2 mb-2 text-gray-500">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-xs">AI is thinking...</span>
                      </div>
                    )}

                    {/* Ticket Display */}
                    {message.tickets && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-sm text-blue-800 dark:text-blue-200">
                            Related Tickets
                          </span>
                        </div>
                        <div className="space-y-2">
                          {message.tickets.map((ticket: any, idx: number) => (
                            <a
                              key={ticket.id || idx}
                              href={`/dashboard/tickets/${ticket.id}`}
                              className="block p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                            >
                              <span className="text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium">
                                {ticket.text}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message Content */}
                    {renderMessageContent(message)}

                    {/* Message Footer */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>

                      {message.sender === "bot" && !message.isStreaming && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyMessage(message.content, message.id)}
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {message.sender === "user" && (
                  <div className="flex-shrink-0">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-to-br from-gray-600 to-gray-800 text-white">
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Quick actions to get started:
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="h-auto p-3 flex-col gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => setInput(action.prompt)}
                  >
                    <span className="text-lg">{action.icon}</span>
                    <span className="text-xs font-medium">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input Container */}
          <div className="relative">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <div className="relative rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about IT support..."
                    className="w-full px-4 py-3 pr-16 bg-transparent border-none outline-none resize-none min-h-[52px] max-h-[200px] placeholder-gray-400 dark:placeholder-gray-500"
                    disabled={isLoading}
                    rows={1}
                  />
                  
                  <div className="absolute right-2 bottom-2 flex items-center gap-2">
                    {isStreaming && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => {
                          setIsStreaming(false);
                          setIsLoading(false);
                        }}
                      >
                        <StopCircle className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isLoading}
                      size="sm"
                      className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Attachments Toggle */}
              <Button
                variant={answerFromAttachments ? "default" : "outline"}
                size="sm"
                className={`shrink-0 transition-all duration-200 ${
                  answerFromAttachments 
                    ? "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-md" 
                    : "hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => setAnswerFromAttachments(v => !v)}
                disabled={isLoading}
                title="Search through ticket attachments"
              >
                <Ticket className="h-4 w-4 mr-2" />
                {answerFromAttachments ? "RAG On" : "RAG Off"}
                {answerFromAttachments && (
                  <div className="ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                )}
              </Button>
            </div>

            {/* Footer Text */}
            <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
              <div className="flex items-center gap-4">
                <span>Press Enter to send, Shift+Enter for new line</span>
                {answerFromAttachments && (
                  <span className="text-green-600 dark:text-green-400">
                    🔍 Searching attachments enabled
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>AI Assistant v2.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}