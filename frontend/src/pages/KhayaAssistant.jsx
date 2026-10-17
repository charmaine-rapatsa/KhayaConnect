import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Send, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { assistantRoleContent, answerKhayaQuestion, topicQuestion } from "./khayaAssistantLogic";
import "../styles/KhayaAssistant.css";


const KhayaAssistant = forwardRef(function KhayaAssistant({ role, highContrast = false, largeText = false }, ref) {
  const content = assistantRoleContent(role);
  const greeting = { id: "greeting", sender: "bot", text: content.greeting, suggestions: content.topics.slice(0, 3) };
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([greeting]);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  useImperativeHandle(ref, () => ({ open: () => setIsOpen(true) }), []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);
  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const submitQuestion = (value = input) => {
    const question = String(value || "").trim();
    if (!question) {
      setMessages((current) => [...current, { id: `${Date.now()}-empty`, sender: "bot", ...answerKhayaQuestion(role, ""), feedbackAllowed: true }]);
      inputRef.current?.focus();
      return;
    }
    const response = answerKhayaQuestion(role, question);
    setInput("");
    setMessages((current) => [...current, { id: `${Date.now()}-user`, sender: "user", text: question }, { id: `${Date.now()}-bot`, sender: "bot", ...response, feedbackAllowed: true }]);
  };

  const startNewConversation = () => { setMessages([{ ...greeting, id: `${Date.now()}-greeting` }]); setInput(""); inputRef.current?.focus(); };
  const clearConversation = () => { setMessages([{ id: `${Date.now()}-clear`, sender: "bot", text: "Conversation cleared. Ask a new KhayaConnect question whenever you’re ready.", suggestions: content.topics.slice(0, 3) }]); setInput(""); inputRef.current?.focus(); };

  return (
    <div className={`khaya-assistant ${highContrast ? "is-high-contrast" : ""} ${largeText ? "is-large-text" : ""}`}>
      {!isOpen && <button type="button" className="khaya-assistant-launcher" onClick={() => setIsOpen(true)} aria-label={`Open ${content.title}`}><Sparkles size={19} /><span>Ask KhayaConnect</span></button>}
      {isOpen && <section className="khaya-assistant-window" role="dialog" aria-modal="false" aria-labelledby={`khaya-assistant-title-${role}`}>
        <header className="khaya-assistant-header"><div className="khaya-assistant-brand"><span className="khaya-assistant-mark"><Sparkles size={17} /></span><div><strong id={`khaya-assistant-title-${role}`}>{content.title}</strong><small>Here to help you find your way</small></div></div><button type="button" className="khaya-assistant-icon-button" aria-label="Close assistant" title="Close assistant" onClick={() => setIsOpen(false)}><X size={19} /></button></header>
        <div className="khaya-assistant-messages" ref={messagesRef} aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => <article key={message.id} className={`khaya-assistant-message ${message.sender}`}>
            <p>{message.text}</p>
            {message.sender === "bot" && message.feedbackAllowed && <div className="khaya-assistant-feedback"><span>Was this helpful?</span><button type="button" aria-label="Yes, helpful" aria-pressed={message.feedback === "yes"} onClick={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: "yes" } : item))}><ThumbsUp size={14} /></button><button type="button" aria-label="No, not helpful" aria-pressed={message.feedback === "no"} onClick={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: "no" } : item))}><ThumbsDown size={14} /></button>{message.feedback && <small>Thanks for the feedback.</small>}</div>}
            {message.sender === "bot" && message.suggestions?.length > 0 && <div className="khaya-assistant-suggestions" aria-label="Suggested questions">{message.suggestions.map((topic) => <button key={`${message.id}-${topic}`} type="button" onClick={() => submitQuestion(topicQuestion(role, topic))}>{topicQuestion(role, topic)}</button>)}</div>}
          </article>)}
        </div>
        <form className="khaya-assistant-form" onSubmit={(event) => { event.preventDefault(); submitQuestion(); }}><label className="sr-only" htmlFor={`khaya-assistant-input-${role}`}>Ask KhayaConnect</label><input id={`khaya-assistant-input-${role}`} ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your dashboard…" autoComplete="off" /><button type="submit" aria-label="Send question"><Send size={17} /></button></form>
        <nav className="khaya-assistant-actions" aria-label="Conversation options"><button type="button" onClick={() => inputRef.current?.focus()}>Ask another question</button><button type="button" onClick={startNewConversation}>Start a new conversation</button><button type="button" onClick={clearConversation}>Clear conversation</button><button type="button" onClick={() => setIsOpen(false)}>Close assistant</button></nav>
      </section>}
    </div>
  );
});

export default KhayaAssistant;
