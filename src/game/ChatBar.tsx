import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNet } from "./net";
import { G, lockPointer } from "./state";
import { getChatMessages, subscribeChat, sendChat } from "./chat";
import { SETTINGS } from "./settings";

function useChat() {
  return useSyncExternalStore(subscribeChat, getChatMessages, getChatMessages);
}

export function ChatBar() {
  const net = useNet();
  const messages = useChat();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const chatOn = SETTINGS.chatEnabled !== false;
  const show =
    chatOn &&
    net.online &&
    (net.kind === "lobby" || net.kind === "pvp" || net.kind === "coop");

  // Sync local open from G.chatOpen (center-click / resume can clear it)
  useEffect(() => {
    const id = setInterval(() => {
      if (!G.chatOpen && open) {
        setOpen(false);
        setDraft("");
      }
    }, 50);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!show) {
      setOpen(false);
      G.chatOpen = false;
    }
  }, [show]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.code === "Slash" && !G.chatOpen && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        e.stopPropagation();
        openChat();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [show]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const openChat = () => {
    G.chatOpen = true;
    G.userPaused = false; // never open pause for chat
    setOpen(true);
    try { document.exitPointerLock?.(); } catch { /* ignore */ }
    try {
      document.body.style.cursor = "";
      const canvas = document.querySelector("canvas") as HTMLElement | null;
      if (canvas) canvas.style.cursor = "";
    } catch { /* ignore */ }
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeChatResume = (reLock: boolean) => {
    G.chatOpen = false;
    setOpen(false);
    setDraft("");
    if (reLock && G.phase === "playing" && !G.userPaused) {
      try { lockPointer(); } catch { /* ignore */ }
    }
  };

  const onSend = () => {
    const t = draft.trim();
    if (!t) return;
    sendChat(t);
    setDraft("");
    // Instantly close chat after send
    closeChatResume(true);
  };

  if (!show) return null;

  return (
    <div
      className="pointer-events-auto fixed z-40 font-mono text-sm"
      style={{ right: "1.25rem", top: "50%", transform: "translateY(-50%)", width: "min(22rem, 42vw)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`flex flex-col rounded-xl border transition ${
          open ? "border-white/25 bg-black/75 backdrop-blur-md" : "border-white/10 bg-black/25 backdrop-blur-sm"
        }`}
        style={{ opacity: open ? 1 : 0.55, maxHeight: "40vh" }}
      >
        <div
          ref={listRef}
          className="overflow-y-auto px-3 py-2 space-y-1"
          style={{ maxHeight: open ? "28vh" : "18vh" }}
          onWheel={(e) => e.stopPropagation()}
        >
          {messages.length === 0 && (
            <div className="text-xs text-white/40">Click / to type…</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="leading-snug break-words" style={{ color: "#fff" }}>
              <span className="font-bold text-crosshair">{`{${m.name}}`}</span>
              <span className="text-white/90">: {m.text}</span>
            </div>
          ))}
        </div>
        {open ? (
          <div className="flex gap-2 border-t border-white/10 p-2">
            <input
              ref={inputRef}
              value={draft}
              maxLength={50}
              onChange={(e) => setDraft(e.target.value.slice(0, 50))}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSend();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  // Esc only closes chat — pauseGame blocked while chatOpen
                  closeChatResume(true);
                }
              }}
              placeholder="Message… (50)"
              className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-white outline-none focus:border-crosshair"
            />
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-bold uppercase text-white hover:bg-white/20"
              onClick={onSend}
            >
              Send
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="border-t border-white/10 px-3 py-1.5 text-left text-[11px] text-white/50 hover:text-white/80"
            onClick={openChat}
          >
            Click / to type
          </button>
        )}
      </div>
    </div>
  );
}

/** Center click closes chat + re-locks without opening pause. */
export function ChatResumeCatcher() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setActive(!!G.chatOpen), 40);
    return () => clearInterval(id);
  }, []);
  if (!active) return null;
  return (
    <div
      className="fixed inset-0 z-30"
      style={{ pointerEvents: "auto", cursor: "default" }}
      onMouseDown={(e) => {
        // Ignore clicks on the chat panel (right side)
        if (e.clientX > window.innerWidth * 0.55) return;
        e.preventDefault();
        e.stopPropagation();
        G.chatOpen = false;
        G.userPaused = false;
        if (G.phase === "playing") {
          try { lockPointer(); } catch { /* ignore */ }
        }
      }}
    />
  );
}
