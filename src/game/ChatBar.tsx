import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NET, useNet } from "./net";
import { G } from "./state";
import { getChatMessages, subscribeChat, sendChat } from "./chat";
import { lockPointer } from "./state";

function useChat() {
  return useSyncExternalStore(subscribeChat, getChatMessages, getChatMessages);
}

/** Roblox-style chat: middle-right, only when online with peers (or any online room). */
export function ChatBar() {
  const net = useNet();
  const messages = useChat();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Lobby / 1v1 / coop online rooms — show as soon as room is online (peers optional for lobby)
  const show =
    net.online &&
    (net.kind === "lobby" || net.kind === "pvp" || net.kind === "coop") &&
    (net.kind === "lobby" || net.peers.size >= 1 || Object.keys(net.names).length > 1);

  useEffect(() => {
    if (!show) {
      setOpen(false);
      G.chatOpen = false;
    }
  }, [show]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.code === "Slash" && !open && !e.ctrlKey && !e.metaKey) {
        // Don't open if typing in another field
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        e.stopPropagation();
        openChat();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [show, open]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const openChat = () => {
    setOpen(true);
    G.chatOpen = true;
    G.userPaused = false; // must not open pause
    try { document.exitPointerLock?.(); } catch { /* ignore */ }
    setCursorVisible();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeChatResume = () => {
    setOpen(false);
    G.chatOpen = false;
    setDraft("");
    // Re-lock only if still playing
    if (G.phase === "playing" && !G.userPaused) {
      try { lockPointer(); } catch { /* ignore */ }
    }
  };

  const setCursorVisible = () => {
    try {
      document.body.style.cursor = "";
      const canvas = document.querySelector("canvas") as HTMLElement | null;
      if (canvas) canvas.style.cursor = "";
    } catch { /* ignore */ }
  };

  const onSend = () => {
    const t = draft.trim();
    if (!t) return;
    sendChat(t);
    setDraft("");
    // keep open for more messages like Roblox
    inputRef.current?.focus();
  };

  if (!show) return null;

  return (
    <div
      className="pointer-events-auto fixed z-40 font-mono text-sm"
      style={{ right: "1.25rem", top: "50%", transform: "translateY(-50%)", width: "min(22rem, 42vw)" }}
    >
      <div
        className={`flex flex-col rounded-xl border transition ${
          open
            ? "border-white/25 bg-black/75 backdrop-blur-md"
            : "border-white/10 bg-black/25 backdrop-blur-sm"
        }`}
        style={{ opacity: open ? 1 : 0.55, maxHeight: "40vh" }}
      >
        <div
          ref={listRef}
          className="overflow-y-auto px-3 py-2 space-y-1"
          style={{ maxHeight: open ? "28vh" : "18vh", pointerEvents: "auto" }}
          onWheel={(e) => e.stopPropagation()}
        >
          {messages.length === 0 && (
            <div className="text-xs text-white/40">Click / to type…</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="leading-snug break-words" style={{ color: "#fff", opacity: open ? 1 : 0.95 }}>
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
                  closeChatResume();
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
      {open && (
        <button
          type="button"
          className="mt-2 w-full rounded-lg border border-white/20 bg-black/50 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70 hover:bg-white/10"
          onClick={closeChatResume}
        >
          Click here or center screen to return
        </button>
      )}
      {/* Invisible center click target to resume */}
      {open && (
        <div
          className="fixed inset-0 -z-10"
          style={{ pointerEvents: "none" }}
        />
      )}
    </div>
  );
}

/** Center-screen click catcher when chat is open — resume game without pause menu. */
export function ChatResumeCatcher() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOpen(!!G.chatOpen), 100);
    return () => clearInterval(id);
  }, []);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-30"
      style={{ pointerEvents: "auto", cursor: "default" }}
      onClick={(e) => {
        // Only resume if click is roughly center third of screen (not on chat panel)
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        if (x > 0.25 && x < 0.75 && y > 0.25 && y < 0.75) {
          G.chatOpen = false;
          if (G.phase === "playing" && !G.userPaused) {
            try { lockPointer(); } catch { /* ignore */ }
          }
        }
      }}
    />
  );
}
