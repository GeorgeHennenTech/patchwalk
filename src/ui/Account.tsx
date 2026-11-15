// Accounts in the page: the sign-in screen every visitor meets, and the "Account" strip under the header
// (who is signed in, their own Claude key, their password, and, for the owner, everyone else).
import { useState } from "react";
import { onProgressChanged } from "../course/progress";
import { onChatsChanged } from "../guide/chats";
import { keyPromptSeen, looksLikeKey, markKeyPromptSeen, ownKey, setOwnKey } from "../guide/me";
import { onRecallChanged } from "../course/recall";
import { onPatchesChanged } from "../synth/patches";
import { changePassword, forgotPassword, recover, removeAccount, resetPassword, schedulePush, signIn, signOut, signUp, type AccountInfo, type Session } from "../guide/sync";

// Anything saved in this browser is copied up for the person signed in.
onProgressChanged(() => schedulePush());
onChatsChanged(schedulePush);
onPatchesChanged(schedulePush);
onRecallChanged(() => schedulePush());

/** The first thing anyone sees: sign in, or make an account. */
export function SignInGate({ ownerSet, mail }: { ownerSet: boolean; mail: boolean }) {
  // a link from a reset email carries ?reset=<token>
  const [token] = useState(() => { const t = new URLSearchParams(window.location.search).get("reset") ?? ""; return /^[a-f0-9]{64}$/.test(t) ? t : undefined; });
  const [mode, setMode] = useState<"in" | "new" | "forgot" | "reset">(token ? "reset" : "in");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [note, setNote] = useState<string>(), [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false); // the eye: show the password as typed
  const making = mode === "new";
  const home = () => { window.location.replace(window.location.pathname); }; // reload without the link's token
  async function go() {
    setBusy(true); setNote(undefined);
    if (mode === "forgot") {
      const done = await forgotPassword(email.trim());
      setBusy(false); setNote(done.ok ? "If there is an account with that email, a link is on its way. It works once, for 30 minutes. Look in spam too." : done.message);
      return;
    }
    const done = mode === "reset" ? await recover(token!, password) : making ? await signUp(name.trim(), email.trim(), password) : await signIn(email.trim(), password);
    if (!done.ok) { setBusy(false); setNote(done.message); return; }
    home(); // every view re-reads this person's things
  }
  const to = (m: typeof mode) => { setMode(m); setNote(undefined); setPassword(""); setShown(false); };
  return (
    <section className="panel account-gate">
      <h2>{{ in: "Sign in", new: "Make your account", forgot: "Forgot your password?", reset: "Choose a new password" }[mode]}</h2>
      <p className="muted">{{ in: "Everyone here has their own account.", new: "Your finished lessons and saved chats are kept under your account and follow you to any device.", forgot: mail ? "Type the email of your account and a link for choosing a new password is sent to it." : "This site cannot send email yet, so ask the site’s owner: they can set a new password for you.", reset: "Then you are signed in." }[mode]}</p>
      {(mode !== "forgot" || mail) && (
        <form onSubmit={(e) => { e.preventDefault(); void go(); }}>
          {making && <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" required /></label>}
          {mode !== "reset" && <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" required /></label>}
          {mode !== "forgot" && <label>{mode === "reset" ? "New password" : "Password"}{mode !== "in" && <span className="muted"> (8 characters or more)</span>}<span className="pw-field"><input type={shown ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "in" ? 1 : 8} maxLength={200} autoComplete={mode === "in" ? "current-password" : "new-password"} required />
            <button type="button" className="pw-eye" aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"} title={shown ? "Hide password" : "Show password"} onClick={() => setShown(!shown)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{shown && <path d="M4 4l16 16" />}</svg>
            </button></span></label>}
          <button className="primary" disabled={busy}>{busy ? "One moment…" : { in: "Sign in", new: "Make my account", forgot: "Email me a link", reset: "Save and sign in" }[mode]}</button>
        </form>
      )}
      {note && <p className="note" role="alert">{note}</p>}
      <p>
        {mode === "in" && <><button className="link" onClick={() => to("new")}>New here? Make an account</button> · <button className="link" onClick={() => to("forgot")}>Forgot password?</button></>}
        {mode === "new" && <button className="link" onClick={() => to("in")}>I already have an account</button>}
        {mode === "forgot" && <button className="link" onClick={() => to("in")}>Back to sign in</button>}
        {mode === "reset" && <button className="link" onClick={home}>Back to sign in</button>}
      </p>
      {making && <p className="muted">The lessons and the synth are free. Asking the guide needs a Claude key of your own; you will be shown how to get one.</p>}
      {!ownerSet && <p className="muted">Note for the owner: no owner is set on the server yet (OWNER_EMAIL), so the site’s own Claude key is switched off for everyone.</p>}
    </section>
  );
}

/** A password box with an eye that shows what was typed. */
function Secret({ value, onChange, label, autoComplete, minLength }: { value: string; onChange: (v: string) => void; label: string; autoComplete: string; minLength?: number }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="pw-field">
      <input type={shown ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} autoComplete={autoComplete} minLength={minLength} />
      <button type="button" className="pw-eye" aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"} title={shown ? "Hide password" : "Show password"} onClick={() => setShown(!shown)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{shown && <path d="M4 4l16 16" />}</svg>
      </button>
    </span>
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
              <Secret value={old} onChange={setOld} label="Current password" autoComplete="current-password" />
              <Secret value={next} onChange={setNext} label="New password (8 or more)" autoComplete="new-password" minLength={8} />
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
