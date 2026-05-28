// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ AIChat v2.0.0                                         ║
// ║  Browser-native AI chat with Heady Brain integration           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Sparkles, Brain, User, Copy, Check, Code, RotateCcw } from 'lucide-react';

const HEADY_API_BASE = 'https://manager.headysystems.com';

const AIChat = ({ model, onClose, activeFile }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        type: 'ai',
        content: `Welcome to **HeadyAI-IDE**! I'm your ${model || 'AI'} assistant powered by the Heady Brain service.\n\nI can help you with:\n- 🧠 Code analysis & explanation\n- 🔧 Debugging & refactoring\n- 📝 Writing new code\n- 🏗️ Architecture guidance\n- ⚡ Performance optimization\n\nJust ask me anything about your code!`,
        timestamp: new Date(),
      },
    ]);
  }, [model]);

  const copyToClipboard = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback copy
    }
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Build context from active file
      const context = activeFile ? {
        fileName: activeFile.name,
        filePath: activeFile.path,
        fileContent: activeFile.content?.slice(0, 3000),
        language: activeFile.name?.split('.').pop(),
      } : {};

      // Try Heady Brain API
      let responseText = '';

      try {
        const res = await fetch(`${HEADY_API_BASE}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: currentInput,
            model: model || 'claude-sonnet',
            context,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          responseText = data.response || data.message || data.content || '';
        }
      } catch {
        // API unreachable — use intelligent fallback
      }

      // Intelligent local fallback if API is unreachable
      if (!responseText) {
        responseText = generateLocalResponse(currentInput, context);
      }

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'I encountered an error processing your request. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea
  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 144) + 'px';
    }
  };

  // Render message content with markdown-like formatting
  const renderContent = (content) => {
    // Split into code blocks and text
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const lines = part.slice(3, -3).split('\n');
        const lang = lines[0] || '';
        const code = lines.slice(1).join('\n') || lines.join('\n');
        return (
          <div key={i} className="code-block">
            <div className="code-block-header">
              <span className="code-lang">{lang || 'code'}</span>
              <button
                className="copy-code-btn"
                onClick={() => copyToClipboard(code, `code-${i}`)}
              >
                {copiedId === `code-${i}` ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <pre><code>{code}</code></pre>
          </div>
        );
      }
      // Parse bold and inline code
      return (
        <div key={i} className="text-block">
          {part.split('\n').map((line, j) => (
            <p key={j}>
              {line.split(/(\*\*.*?\*\*|`.*?`)/g).map((seg, k) => {
                if (seg.startsWith('**') && seg.endsWith('**')) {
                  return <strong key={k}>{seg.slice(2, -2)}</strong>;
                }
                if (seg.startsWith('`') && seg.endsWith('`')) {
                  return <code key={k} className="inline-code">{seg.slice(1, -1)}</code>;
                }
                return <span key={k}>{seg}</span>;
              })}
            </p>
          ))}
        </div>
      );
    });
  };

  return (
    <div className="ai-chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <Brain className="chat-icon" size={18} />
          <span>HeadyBuddy AI</span>
          <span className="model-badge">{model || 'auto'}</span>
        </div>
        <div className="chat-actions">
          <button className="chat-action-btn" title="Clear chat" onClick={() => setMessages([messages[0]])}>
            <RotateCcw size={14} />
          </button>
          <button className="chat-action-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>

      {activeFile && (
        <div className="chat-context-bar">
          <Code size={12} />
          <span>{activeFile.name}</span>
        </div>
      )}

      <div className="chat-messages">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={`message ${message.type}`}
            >
              <div className="message-avatar">
                {message.type === 'user' ? (
                  <User size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
              </div>
              <div className="message-content">
                {renderContent(message.content)}
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="message ai loading"
          >
            <div className="message-avatar">
              <Sparkles size={14} />
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyPress}
          placeholder="Ask HeadyBuddy anything about your code..."
          disabled={isLoading}
          rows={1}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="send-btn"
          onClick={handleSendMessage}
          disabled={isLoading || !input.trim()}
        >
          <Send size={16} />
        </motion.button>
      </div>
    </div>
  );
};

// Intelligent local fallback responses
function generateLocalResponse(query, context) {
  const q = query.toLowerCase();
  const fileName = context.fileName || '';
  const lang = context.language || '';

  if (q.includes('explain') || q.includes('what does')) {
    if (fileName) {
      return `I can see you're working on **${fileName}** (${lang}). While I can't reach the Heady Brain service right now, here's what I can tell you:\n\nTo get a full AI-powered analysis, please ensure the Heady Manager service at \`manager.headysystems.com\` is accessible. In the meantime, I'm running in local mode with limited capabilities.\n\nTry checking:\n- Network connectivity to the Heady Cloud\n- Your API authentication token\n- The \`HEADY_API_KEY\` environment variable`;
    }
    return 'I\'d be happy to explain! However, I\'m currently in **local fallback mode** since the Heady Brain API isn\'t reachable. Please open a file first so I can analyze it locally, or check your network connection.';
  }

  if (q.includes('debug') || q.includes('error') || q.includes('fix')) {
    return `I'm in **local fallback mode** right now. For full debugging assistance:\n\n1. Ensure the Heady Brain service is running\n2. Check the terminal for error output\n3. Share the error message and I'll help once connected\n\n**Quick debugging checklist:**\n- Check for syntax errors\n- Verify import paths\n- Look for undefined variables\n- Check API response formats`;
  }

  if (q.includes('refactor') || q.includes('improve') || q.includes('optimize')) {
    return `Great question about optimization! In **local mode**, here are general best practices:\n\n- **Extract** repeated logic into reusable functions\n- **Use** φ-derived constants (PHI = 1.618) instead of magic numbers\n- **Apply** CSL gates for threshold decisions\n- **Add** proper error handling with structured logging\n- **Follow** the Heady coding standards (ESM, Zod validation, pino logger)`;
  }

  return `I'm your HeadyBuddy AI assistant running in **local mode**. The Heady Brain API at \`manager.headysystems.com\` isn't currently reachable.\n\nHere's what I can still do locally:\n- 📖 Provide coding best practices\n- 🏗️ Suggest architecture patterns\n- 📋 Share Heady coding standards\n\nOnce connected, I'll have full access to:\n- Multi-model AI (Claude, GPT-4, Gemini)\n- Context-aware code analysis\n- Live code generation & refactoring`;
}

export default AIChat;
