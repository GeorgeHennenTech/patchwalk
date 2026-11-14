// Accounts in the page: the sign-in screen every visitor meets, and the "Account" strip under the header
// (who is signed in, their own Claude key, their password, and, for the owner, everyone else).
import { useState } from "react";
import { onProgressChanged } from "../course/progress";
import { onChatsChanged } from "../guide/chats";
import { keyPromptSeen, looksLikeKey, markKeyPromptSeen, ownKey, setOwnKey } from "../guide/me";
import { changePassword, removeAccount, resetPassword, schedulePush, signIn, signOut, signUp, type AccountInfo, type Session } from "../guide/sync";

// Anything saved in this browser is copied up for the person signed in.
onProgressChanged(() => schedulePush());
onChatsChanged(schedulePush);

/** The first thing anyone sees: sign in, or make an account. */
export function SignInGate({ ownerSet }: { ownerSet: boolean }) {
  const [making, setMaking] = useState(false);
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [note, setNote] = useState<string>(), [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setNote(undefined);
    const done = making ? await signUp(name.trim(), email.trim(), password) : await signIn(email.trim(), password);
    if (!done.ok) { setBusy(false); setNote(done.message); return; }
    window.location.reload(); // every view re-reads this person's things
  }
  return (
    <section className="panel account-gate">
      <h2>{making ? "Make your account" : "Sign in"}</h2>
      <p className="muted">{making ? "Your finished lessons and saved chats are kept under your account and follow you to any device." : "Everyone here has their own account."}</p>
      <form onSubmit={(e) => { e.preventDefault(); void go(); }}>
        {making && <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" required /></label>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" required /></label>
        <label>Password{making && <span className="muted"> (8 characters or more)</span>}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={making ? 8 : 1} maxLength={200} autoComplete={making ? "new-password" : "current-password"} required /></label>
        <button className="primary" disabled={busy}>{busy ? "One moment…" : making ? "Make my account" : "Sign in"}</button>
      </form>
      {note && <p className="note" role="alert">{note}</p>}
      <p><button className="link" onClick={() => { setMaking(!making); setNote(undefined); }}>{making ? "I already have an account" : "New here? Make an account"}</button></p>
      {making
        ? <p className="muted">The site sends no email, so a forgotten password cannot be mailed to you: the site’s owner can set a new one for you. The lessons and the synth are free. Asking the guide needs a Claude key of your own; you will be shown how to get one.</p>
        : <p className="muted">Forgot your password? Ask the site’s owner to set a new one for you.</p>}
      {!ownerSet && <p className="muted">Note for the owner: no owner is set on the server yet (OWNER_EMAIL), so the site’s own Claude key is switched off for everyone.</p>}
    </section>
  );
}

/** How to get a key, in plain steps. The links open Anthropic's own site in a new tab. */
function KeySteps() {
  return (
    <ol className="key-steps">
      <li>Open <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer noopener">console.anthropic.com</a> and make an account. This is separate from a Claude chat subscription: a Pro or Max plan does not include a key.</li>
      <li>Under <strong>Billing</strong>, add a payment card and buy some credit. A question to the guide costs a small amount of it.</li>
      <li>Under <strong>API keys</strong>, choose <strong>Create key</strong>, give it any name, and copy it. It starts with <code>sk-ant-</code> and is shown only once.</li>
      <li>Paste it below and save. It stays in this browser only; the site never stores it. On another device, paste it there too.</li>
    </ol>
  );
}

export function AccountBar({ session }: { session: Extract<Session, { state: "signedIn" }> }) {
  const me = session.account;
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(""), [hasKey, setHasKey] = useState(() => !!ownKey());
  const [asked, setAsked] = useState(() => keyPromptSeen());
  const [old, setOld] = useState(""), [next, setNext] = useState("");
  const [people, setPeople] = useState(session.people ?? []);
  const [note, setNote] = useState<string>(), [busy, setBusy] = useState(false);

  const saveKey = () => {
    if (!looksLikeKey(key)) { setNote("That does not look like a Claude API key (they start with sk-ant-)."); return; }
    setNote(setOwnKey(key) ? "Your key is saved in this browser only. Your questions to the guide are now billed to it." : "This browser would not store the key.");
    setHasKey(!!ownKey()); setKey("");
  };
  const keyForm = hasKey
    ? <p><button className="link" onClick={() => { setOwnKey(undefined); setHasKey(false); setNote("Your key was removed from this browser."); }}>Remove my key from this browser</button></p>
    : <form className="who-add" onSubmit={(e) => { e.preventDefault(); saveKey(); }}><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key here (sk-ant-…)" aria-label="Your Claude API key" autoComplete="off" /> <button className="primary" disabled={!key.trim()}>Save key</button></form>;
  // who pays for this person's questions, in one line
  const pays = hasKey ? "Guide questions are billed to your own Claude key." : me.owner ? "You are the owner: guide questions use the site’s Claude key." : "No Claude key yet: the guide is off for you. Lessons and the synth work without one.";

  async function leave() { setBusy(true); await signOut(); window.location.reload(); }
  async function newPassword() {
    setBusy(true);
    const done = await changePassword(old, next);
    setBusy(false); setNote(done.ok ? "Your password was changed." : done.message);
    if (done.ok) { setOld(""); setNext(""); }
  }
  async function remove(p: AccountInfo) {
    const mine = p.id === me.id;
    if (!window.confirm(mine ? "Delete your account and everything saved under it? This cannot be undone." : `Remove ${p.name} (${p.email}) and everything saved under that account? This cannot be undone.`)) return;
    setBusy(true);
    const done = await removeAccount(p.id);
    if (!done.ok) { setBusy(false); setNote(done.message); return; }
    if (mine) { await signOut(); window.location.reload(); return; }
    setPeople(people.filter((x) => x.id !== p.id)); setBusy(false);
  }
  async function reset(p: AccountInfo) {
    const fresh = window.prompt(`A new password for ${p.name} (8 characters or more). Tell it to them yourself; they can change it after signing in.`);
    if (!fresh) return;
    const done = await resetPassword(p.id, fresh);
    setNote(done.ok ? `${p.name}’s password was changed.` : done.message);
  }

  const askKey = !open && !hasKey && !me.owner && !asked;
  return (
    <section className={`players${open ? " open" : ""}`} aria-label="Account">
      {!open && <p className="playing">Signed in as <strong>{me.name}</strong>{me.owner && " (owner)"} <button className="link" onClick={() => { setOpen(true); setNote(undefined); }}>Account</button> <button className="link" disabled={busy} onClick={() => void leave()}>Sign out</button></p>}
      {askKey && (
        <div className="panel who key-ask">
          <h2>The guide needs your own Claude key, {me.name}</h2>
          <p>The lessons and the synth are free and need nothing. Asking the guide, “Show me where” and “Explain why” call Claude, which costs money, so each person uses a key of their own. Until you add one, those three are switched off for you.</p>
          <KeySteps />
          {keyForm}
          {note && <p className="note" role="status">{note}</p>}
          <p><button className="link" onClick={() => { markKeyPromptSeen(); setAsked(true); setNote(undefined); }}>Not now</button> <span className="muted">You can do this later under “Account”.</span></p>
        </div>
      )}
      {open && (
        <div className="panel who">
          <h2>Account</h2>
          <p><strong>{me.name}</strong> · {me.email}{me.owner && " · owner"}</p>
          <p className="muted">{pays}</p>
          <details className="who-key" open={!hasKey && !me.owner}>
            <summary>My own Claude key{hasKey ? ": on" : ""}</summary>
            <p className="muted">It is kept in this browser only and sent with each question; the site never stores it.</p>
            {!hasKey && <KeySteps />}
            {keyForm}
          </details>
          <details className="who-key">
            <summary>Change my password</summary>
            <form className="who-add" onSubmit={(e) => { e.preventDefault(); void newPassword(); }}>
              <input type="password" value={old} onChange={(e) => setOld(e.target.value)} placeholder="Current password" aria-label="Current password" autoComplete="current-password" />
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (8 or more)" aria-label="New password" minLength={8} autoComplete="new-password" />
              <button disabled={busy || !old || next.length < 8}>Change</button>
            </form>
          </details>
          {me.owner && (
            <details className="who-key" open>
              <summary>Everyone with an account ({people.length})</summary>
              <ul className="people">
                {people.map((p) => (
                  <li key={p.id}><strong>{p.name}</strong> · {p.email}{p.owner ? " · owner (you)" : <> <button className="link" disabled={busy} onClick={() => void reset(p)}>Set a new password</button> <button className="link" disabled={busy} onClick={() => void remove(p)}>Remove</button></>}</li>
                ))}
              </ul>
              <p className="muted">Only your account can use the site’s Claude key. Everyone else needs their own.</p>
            </details>
          )}
          {!session.ownerSet && <p className="note">No owner is set on the server (OWNER_EMAIL), so the site’s own Claude key is switched off for everyone, including you.</p>}
          {note && <p className="note" role="status">{note}</p>}
          <p><button className="link" disabled={busy} onClick={() => setOpen(false)}>Close</button> <button className="link" disabled={busy} onClick={() => void leave()}>Sign out</button>{!me.owner && <> <button className="link" disabled={busy} onClick={() => void remove(me)}>Delete my account</button></>}</p>
        </div>
      )}
    </section>
  );
}

/** For the System check tab: whether the site's database is connected and really stores things. */
export function DatabaseCheck() {
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/store"), body = (await res.json().catch(() => undefined)) as { configured?: boolean; working?: boolean; accounts?: number; ownerSet?: boolean; message?: string } | undefined;
      setResult(!res.ok ? `Could not check: ${body?.message ?? `the site answered ${res.status}`}`
        : !body?.configured ? "No database is connected to this site, so nobody can sign in. If you added one in Vercel, it takes effect after the next deployment."
        : body.working ? `The database is connected and working. ${body.accounts ?? 0} ${body.accounts === 1 ? "account" : "accounts"}. ${body.ownerSet ? "An owner is set on the server." : "No owner is set on the server (OWNER_EMAIL), so the site’s Claude key is off for everyone."}`
        : "The database is connected, but what was written could not be read back.");
    } catch { setResult("Could not reach the site."); }
    setBusy(false);
  }
  return (
    <section className="panel">
      <h2>Database</h2>
      <p className="muted">Checks that the site’s database (used for accounts and for remembering answers) is connected and stores things. Free; no Claude call.</p>
      <button className="primary" disabled={busy} onClick={() => void run()}>{busy ? "Checking…" : "Check the database"}</button>
      {result && <p role="status">{result}</p>}
    </section>
  );
}
