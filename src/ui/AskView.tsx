import { useState } from "react";
import { askGuide, historyOf, type Turn } from "../guide/ask";
import { deleteChat, loadChats, saveChat, type SavedChat } from "../guide/chats";
import { Answer } from "./Answer";

const EXAMPLES = ["What does the FAT knob do on the filter?", "How do I assign an LFO to a knob?", "What is the difference between FREE and RETRIG?", "Why do detuned oscillators sound like they are moving?", "How do I warp an audio clip in Live?"];

/**
 * A conversation with the guide. Each question is answered from the library; a follow-up is sent with the
 * last few turns so "and what about its rate?" is understood. Conversations can be saved in this browser
 * and opened again later.
 */
export function AskView() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chatId, setChatId] = useState<string>();
  const [saved, setSaved] = useState<SavedChat[]>(() => loadChats());
  const [note, setNote] = useState<string>();
  const busy = turns.some((t) => !t.outcome);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setQuestion(""); setNote(undefined);
    const history = historyOf(turns);
    setTurns((t) => [...t, { question: text }]);
    const outcome = await askGuide(text, undefined, fetch, history);
    setTurns((t) => t.map((turn, i) => (i === t.length - 1 && !turn.outcome ? { ...turn, outcome } : turn)));
  }
  function save() {
    const done = saveChat({ id: chatId, turns });
    if (!done) { setNote("This browser would not store the chat (private windows often refuse)."); return; }
    setChatId(done.id); setSaved(done.chats); setNote("Saved in this browser. Find it under Saved chats.");
  }
  const fresh = () => { setTurns([]); setChatId(undefined); setNote(undefined); };
  const open = (c: SavedChat) => { setTurns(c.turns); setChatId(c.id); setNote(undefined); };

  return (
    <section className="panel ask">
      <h2>Ask the guide</h2>
      <p className="muted">
        Answers come from the library: the Serum 2 User Guide, the Ableton Live 11 manual, the Rift manual and this app’s knowledge cards. Every claim shows the page it came from, with that page’s pictures.
        If the library does not cover something, the guide says so instead of guessing. Ask a follow-up to go deeper: the guide remembers the conversation. Each question is one paid Claude call.
      </p>
      {saved.length > 0 && (
        <details className="saved-chats">
          <summary>Saved chats ({saved.length})</summary>
          <ul>
            {saved.map((c) => (
              <li key={c.id}>
                <button className="link" onClick={() => open(c)}>{c.title}</button>
                <span className="muted"> · {c.turns.length} question{c.turns.length === 1 ? "" : "s"} · {new Date(c.savedAt).toLocaleDateString()}</span>
                <button className="link danger" aria-label={`Delete saved chat: ${c.title}`} onClick={() => { setSaved(deleteChat(c.id)); if (c.id === chatId) setChatId(undefined); }}>Delete</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {turns.length === 0 && (
        <div className="examples">
          {EXAMPLES.map((e) => <button key={e} className="link" onClick={() => void ask(e)}>{e}</button>)}
        </div>
      )}
      {turns.map((t, i) => (
        <article key={i} className="step turn">
          <h4>{t.question}</h4>
          {!t.outcome && <p className="muted">Looking through the library…</p>}
          {t.outcome && <Answer outcome={t.outcome} question={t.question} />}
        </article>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); void ask(question); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} placeholder={turns.length ? "Ask a follow-up, or something new" : "Ask about synthesis, Serum 2, Ableton Live or Rift"} aria-label="Your question" />
        <button className="primary" disabled={busy || question.trim().length < 3}>{busy ? "Thinking…" : turns.length ? "Ask a follow-up" : "Ask"}</button>
      </form>
      {turns.length > 0 && (
        <p className="chat-actions">
          <button className="link" disabled={busy || !turns.some((t) => t.outcome)} onClick={save}>{chatId ? "Save again" : "Save this chat"}</button>
          <button className="link" disabled={busy} onClick={fresh}>Start a new chat</button>
          {note && <span className="muted" role="status"> {note}</span>}
        </p>
      )}
    </section>
  );
}
