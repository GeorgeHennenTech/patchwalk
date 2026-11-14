// "Who's playing?": shown only when the site has a database. Choosing a name brings that person's finished
// lessons and saved chats into this browser, and keeps them copied to the database as they change, so they
// are there on any device. There are no passwords here: everyone is already behind the site's one password.
import { useEffect, useState } from "react";
import { loadDone, onProgressChanged } from "../course/progress";
import { loadChats, onChatsChanged } from "../guide/chats";
import { currentPlayer, keyPromptSeen, looksLikeKey, markKeyPromptSeen, ownKey, setOwnKey } from "../guide/me";
import { addPlayer, playAs, removePlayer, schedulePush, signOut, storeStatus, type PlayerInfo } from "../guide/sync";

// Anything saved in this browser is copied up for the person playing.
onProgressChanged(() => schedulePush());
onChatsChanged(schedulePush);

export function Players() {
  const [status, setStatus] = useState<{ configured: boolean; players: PlayerInfo[] }>();
  const [me, setMe] = useState(() => currentPlayer());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(() => !!ownKey());
  const [note, setNote] = useState<string>();
  const [asked, setAsked] = useState(() => keyPromptSeen());
  const [busy, setBusy] = useState(false);

  useEffect(() => { void storeStatus().then(setStatus); }, []);
  if (!status?.configured) return null;

  // Things already in this browser that belong to nobody yet are kept under the first name chosen here.
  const unowned = !me && (loadDone().length > 0 || loadChats().length > 0);
  async function choose(p: { id: string; name: string }) {
    setBusy(true); setNote(undefined);
    const done = await playAs({ id: p.id, name: p.name }, unowned);
    if (!done.ok) { setBusy(false); setNote(done.message); return; }
    window.location.reload(); // every view re-reads this person's things
  }
  async function add() {
    const text = name.trim();
    if (!text) return;
    setBusy(true); setNote(undefined);
    const made = await addPlayer(text);
    if (!made.player) { setBusy(false); setNote(made.message); return; }
    await choose(made.player);
  }
  async function remove(p: PlayerInfo) {
    if (!window.confirm(`Remove ${p.name} and everything saved under that name? This cannot be undone.`)) return;
    setBusy(true);
    await removePlayer(p.id);
    if (me?.id === p.id) { await signOut(); window.location.reload(); return; }
    setStatus(await storeStatus()); setBusy(false);
  }
  const saveKey = () => {
    if (!looksLikeKey(key)) { setNote("That does not look like a Claude API key (they start with sk-ant-)."); return; }
    setNote(setOwnKey(key) ? "Your key is saved in this browser only. Your questions to the guide are now billed to it." : "This browser would not store the key.");
    setHasKey(!!ownKey()); setKey("");
  };

  const keyForm = hasKey
    ? <p><button className="link" onClick={() => { setOwnKey(undefined); setHasKey(false); setNote("Your key was removed from this browser."); }}>Remove my key from this browser</button></p>
    : <form className="who-add" onSubmit={(e) => { e.preventDefault(); saveKey(); }}><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key here (sk-ant-…)" aria-label="Your Claude API key" autoComplete="off" /> <button className="primary" disabled={!key.trim()}>Save key</button></form>;

  const showPicker = open || !me;
  // Asked once per browser, after a name is chosen: nobody is pushed, and "Not now" is remembered.
  const askKey = !!me && !showPicker && !hasKey && !asked;
  return (
    <section className={`players${showPicker ? " open" : ""}`} aria-label="Who is playing">
      {me && !showPicker && <p className="playing">Playing as <strong>{me.name}</strong> <button className="link" onClick={() => setOpen(true)}>Switch or settings</button></p>}
      {askKey && (
        <div className="panel who key-ask">
          <h2>Set up your own Claude key, {me.name}?</h2>
          <p>The lessons and the synth are free. Asking the guide, “Show me where” and “Explain why” each cost a little, and right now they are paid for by the site’s owner. With a key of your own they are billed to you instead.</p>
          <KeySteps />
          {keyForm}
          {note && <p className="note" role="status">{note}</p>}
          <p><button className="link" onClick={() => { markKeyPromptSeen(); setAsked(true); setNote(undefined); }}>Not now</button> <span className="muted">You can do this later under “Switch or settings”.</span></p>
        </div>
      )}
      {showPicker && (
        <div className="panel who">
          <h2>Who’s playing?</h2>
          <p className="muted">Pick your name and your finished lessons and saved chats follow you to any device.{unowned && " What this browser already holds will be kept under the name you pick."}</p>
          <div className="who-list">
            {status.players.map((p) => (
              <span key={p.id} className="who-item">
                <button className={`who-name${me?.id === p.id ? " on" : ""}`} disabled={busy} onClick={() => (me?.id === p.id ? setOpen(false) : void choose(p))}>{p.name}</button>
                <button className="link who-remove" disabled={busy} aria-label={`Remove ${p.name}`} onClick={() => void remove(p)}>Remove</button>
              </span>
            ))}
          </div>
          <form className="who-add" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="New here? Type your name" aria-label="Your name" />
            <button className="primary" disabled={busy || !name.trim()}>Add me</button>
          </form>
          <details className="who-key">
            <summary>Use my own Claude key (optional){hasKey ? ": on" : ""}</summary>
            <p className="muted">With a key of your own, your questions to the guide are billed to you, not to the site’s owner. It is kept in this browser only and sent with each question; the site never stores it.</p>
            {!hasKey && <KeySteps />}
            {keyForm}
          </details>
          {note && <p className="note" role="status">{note}</p>}
          {me && <p><button className="link" disabled={busy} onClick={() => setOpen(false)}>Close</button> <button className="link" disabled={busy} onClick={async () => { setBusy(true); await signOut(); setMe(undefined); window.location.reload(); }}>Stop playing as {me.name} on this browser</button></p>}
        </div>
      )}
    </section>
  );
}

/** How to get a key, in plain steps. The links open Anthropic's own site in a new tab. */
function KeySteps() {
  return (
    <ol className="key-steps">
      <li>Open <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer noopener">console.anthropic.com</a> and make an account. This is separate from a Claude chat subscription: a Pro or Max plan does not include a key.</li>
      <li>Under <strong>Billing</strong>, add a payment card and buy some credit. Five dollars is the smallest amount and goes a long way here: a question to the guide usually costs a few cents.</li>
      <li>Under <strong>API keys</strong>, choose <strong>Create key</strong>, give it any name, and copy it. It starts with <code>sk-ant-</code> and is shown only once.</li>
      <li>Paste it below and save. It stays in this browser only; the site never stores it. On another device, paste it there too.</li>
    </ol>
  );
}

/** For the System check tab: whether the site's database is connected and really stores things. */
export function DatabaseCheck() {
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/store?check=1"), body = (await res.json().catch(() => undefined)) as { configured?: boolean; working?: boolean; players?: unknown[]; message?: string } | undefined;
      setResult(!res.ok ? `Could not check: ${body?.message ?? `the site answered ${res.status}`}`
        : !body?.configured ? "No database is connected to this site. Everything is kept in each browser, as before. If you added one in Vercel, it takes effect after the next deployment."
        : body.working ? `The database is connected and working. ${body.players?.length ?? 0} ${body.players?.length === 1 ? "person is" : "people are"} on the list.`
        : "The database is connected, but what was written could not be read back.");
    } catch { setResult("Could not reach the site."); }
    setBusy(false);
  }
  return (
    <section className="panel">
      <h2>Database</h2>
      <p className="muted">Checks that the site’s database (used for “Who’s playing?” and for remembering answers) is connected and stores things. Free; no Claude call.</p>
      <button className="primary" disabled={busy} onClick={() => void run()}>{busy ? "Checking…" : "Check the database"}</button>
      {result && <p role="status">{result}</p>}
    </section>
  );
}
