'use client';

import { useEffect, useRef, useState } from 'react';

const DEMO = `Although excessive out-of-school assignments induce debilitating stress and erode vital domestic recreation, purposeful and well-regulated homework consolidates daytime instruction and nurtures independent self-discipline; therefore, educators should calibrate assignment volume thoughtfully rather than abandon independent practice entirely.`;

const MODELS = [
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', note: 'Fastest & most budget-friendly' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', note: 'Best balance for daily explanations' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', note: 'Highest quality for difficult text' },
];

const THEMES = [
  { id: 'midnight', name: 'Midnight Lime' },
  { id: 'amoled', name: 'AMOLED' },
  { id: 'paper', name: 'Paper' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'sunset', name: 'Sunset' },
];

function classifySelection(text) {
  const t = text.trim();
  if (!t) return 'text';
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words === 1) return 'word';
  if (/[.!?;:]$/.test(t) || words >= 9) return 'sentence';
  return 'phrase';
}

function formatNumber(n) {
  return new Intl.NumberFormat().format(Number(n || 0));
}

export default function Home() {
  const [text, setText] = useState(DEMO);
  const [selection, setSelection] = useState('');
  const [kind, setKind] = useState('word');
  const [anchor, setAnchor] = useState(null);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [theme, setTheme] = useState('midnight');
  const [sessionUsage, setSessionUsage] = useState({ input: 0, output: 0, total: 0, requests: 0 });
  const readerRef = useRef(null);

  useEffect(() => {
    const savedModel = localStorage.getItem('sellexplain-model');
    const savedTheme = localStorage.getItem('sellexplain-theme');
    if (MODELS.some(m => m.id === savedModel)) setModel(savedModel);
    if (THEMES.some(t => t.id === savedTheme)) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('sellexplain-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sellexplain-model', model);
  }, [model]);

  useEffect(() => {
    function handleSelection() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setSelection('');
        setAnchor(null);
        return;
      }

      const selected = sel.toString().trim();
      const reader = readerRef.current;
      if (!selected || !reader) return;

      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

      if (!reader.contains(container)) return;

      const rect = range.getBoundingClientRect();
      setSelection(selected);
      setKind(classifySelection(selected));
      setAnchor({
        left: Math.min(window.innerWidth - 150, Math.max(16, rect.left + rect.width / 2 - 60)),
        top: Math.max(12, rect.top - 48),
      });
    }

    document.addEventListener('selectionchange', handleSelection);
    window.addEventListener('scroll', handleSelection, true);
    window.addEventListener('resize', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      window.removeEventListener('scroll', handleSelection, true);
      window.removeEventListener('resize', handleSelection);
    };
  }, []);

  async function explain() {
    if (!selection || loading) return;
    setLoading(true);
    setError('');
    setCard(null);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection, kind, context: text, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not explain selection.');

      setCard(data);
      const usage = data.usage || {};
      setSessionUsage(prev => ({
        input: prev.input + Number(usage.inputTokens || 0),
        output: prev.output + Number(usage.outputTokens || 0),
        total: prev.total + Number(usage.totalTokens || 0),
        requests: prev.requests + 1,
      }));
      setAnchor(null);
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <nav className="appNav">
        <div className="brand"><span className="brandMark">S</span><span>Sellexplain</span></div>
        <div className="navRight">
          <div className="miniUsage" title="Session token usage">
            <span>{formatNumber(sessionUsage.total)} tokens</span>
            <small>{sessionUsage.requests} request{sessionUsage.requests === 1 ? '' : 's'}</small>
          </div>
          <button className="iconButton" onClick={() => setSettingsOpen(true)} aria-label="Open settings">⚙</button>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">SELECT → EXPLAIN</div>
        <h1>Understand difficult English without leaving the text.</h1>
        <p>Paste anything, highlight a word, phrase or sentence, then tap Explain.</p>
      </section>

      <section className="workspace">
        <div className="topbar">
          <div>
            <div className="label">SOURCE TEXT</div>
            <div className="hint">Paste your paragraph below</div>
          </div>
          <div className="actions">
            <button className="ghost" onClick={() => setText('')}>Clear</button>
            <button className="ghost" onClick={() => setText(DEMO)}>Demo</button>
          </div>
        </div>

        <textarea
          className="editor"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste text here..."
          spellCheck="false"
        />

        <div className="divider" />

        <div className="readerHeader">
          <div>
            <div className="label">READ & SELECT</div>
            <div className="hint">Highlight any part of the text</div>
          </div>
          <div className="modelBadge">{MODELS.find(m => m.id === model)?.name}</div>
        </div>
        <article ref={readerRef} className="reader" aria-label="Selectable reading text">
          {text || <span className="placeholder">Your text will appear here.</span>}
        </article>
      </section>

      {selection && anchor && (
        <button
          className="floatingExplain"
          style={{ left: anchor.left, top: anchor.top }}
          onMouseDown={e => e.preventDefault()}
          onClick={explain}
        >
          {loading ? <><span className="spinner" /> Explaining…</> : '✦ Explain'}
        </button>
      )}

      {card && (
        <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setCard(null)}>
          <section className="explainCard" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setCard(null)} aria-label="Close">×</button>
            <div className="cardMetaRow">
              <div className="typePill">{card.type}</div>
              <div className="cardModel">{MODELS.find(m => m.id === card.model)?.name || card.model}</div>
            </div>
            <h2>{card.selectedText}</h2>

            <div className="cardSection primary">
              <span className="sectionLabel">SIMPLE MEANING</span>
              <p>{card.simpleMeaning}</p>
            </div>

            {card.hinglish && (
              <div className="cardSection">
                <span className="sectionLabel">EASY HINGLISH</span>
                <p>{card.hinglish}</p>
              </div>
            )}

            {card.breakdown?.length > 0 && (
              <div className="cardSection">
                <span className="sectionLabel">BREAKDOWN</span>
                <div className="chips">
                  {card.breakdown.map((item, i) => (
                    <div className="chip" key={i}>
                      <b>{item.part}</b><span>{item.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {card.inContext && (
              <div className="cardSection">
                <span className="sectionLabel">IN THIS CONTEXT</span>
                <p>{card.inContext}</p>
              </div>
            )}

            {card.ieltsAlternative && (
              <div className="cardSection compact">
                <span className="sectionLabel">IELTS ALTERNATIVE</span>
                <p>{card.ieltsAlternative}</p>
              </div>
            )}

            <div className="usagePanel">
              <div className="usageTitle"><span>Token usage</span><small>This explanation</small></div>
              <div className="usageGrid">
                <div><b>{formatNumber(card.usage?.inputTokens)}</b><span>Input</span></div>
                <div><b>{formatNumber(card.usage?.outputTokens)}</b><span>Output</span></div>
                <div><b>{formatNumber(card.usage?.totalTokens)}</b><span>Total</span></div>
              </div>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="settingsOverlay" onMouseDown={e => e.target === e.currentTarget && setSettingsOpen(false)}>
          <aside className="settingsPanel">
            <div className="settingsHead">
              <div><div className="eyebrow">PREFERENCES</div><h2>Settings</h2></div>
              <button className="close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>

            <div className="settingGroup">
              <div className="settingTitle">AI MODEL</div>
              <p className="settingHelp">Choose quality vs speed/cost. Your choice is saved on this device.</p>
              <div className="modelOptions">
                {MODELS.map(item => (
                  <button key={item.id} className={`modelOption ${model === item.id ? 'selected' : ''}`} onClick={() => setModel(item.id)}>
                    <span><b>{item.name}</b><small>{item.note}</small></span>
                    <span className="radioDot" />
                  </button>
                ))}
              </div>
            </div>

            <div className="settingGroup">
              <div className="settingTitle">THEME</div>
              <p className="settingHelp">Switch the complete app appearance.</p>
              <div className="themeGrid">
                {THEMES.map(item => (
                  <button key={item.id} className={`themeOption ${theme === item.id ? 'selected' : ''}`} onClick={() => setTheme(item.id)}>
                    <span className={`themePreview theme-${item.id}`}><i /><i /><i /></span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settingGroup">
              <div className="settingTitle">SESSION USAGE</div>
              <div className="sessionCard">
                <div><span>Total tokens</span><b>{formatNumber(sessionUsage.total)}</b></div>
                <div><span>Input</span><b>{formatNumber(sessionUsage.input)}</b></div>
                <div><span>Output</span><b>{formatNumber(sessionUsage.output)}</b></div>
                <div><span>Requests</span><b>{formatNumber(sessionUsage.requests)}</b></div>
              </div>
              <button className="resetButton" onClick={() => setSessionUsage({ input: 0, output: 0, total: 0, requests: 0 })}>Reset session counter</button>
            </div>
          </aside>
        </div>
      )}

      {error && <div className="toast">{error}<button onClick={() => setError('')}>×</button></div>}
    </main>
  );
}
