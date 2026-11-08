'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import type { JSONContent } from '@tiptap/core';
import { api, ApiError } from './client';
import type { PlannerSpace } from './planner-types';
import { allowedNoteLink, noteExtensions } from '../shared/note-document';

type NoteSummary = { id: string; title: string; version: number; updatedAt: string; updatedById: string };
type Note = NoteSummary & { content: JSONContent; scopeKind: 'PAIR' | 'GROUP'; scopeId: string };
const message = (error: unknown) => error instanceof Error ? error.message : 'Could not load your notes. Try again.';
const key = (space: PlannerSpace) => `${space.scopeKind}:${space.scopeId}`;

export function SharedNotes({ spaces, userId, initialSpace = '', onPendingChange, connect }: {
  spaces: PlannerSpace[]; userId: string; initialSpace?: string; onPendingChange: (pending: boolean) => void; connect: () => void;
}) {
  const [selected, setSelected] = useState(initialSpace);
  const pending = useRef(false);
  const space = spaces.find(item => key(item) === selected) ?? spaces[0];
  const reportPending = useCallback((value: boolean) => { pending.current = value; onPendingChange(value); }, [onPendingChange]);
  if (!space) return <section className="empty"><span className="notes-empty-icon" aria-hidden="true">▤</span><h2>A shared place for your thoughts.</h2><p className="muted">Connect a partner or create a friend circle to start a notebook together.</p><button className="primary" onClick={connect}>Find your people →</button></section>;
  return <section className="shared-notes">
    <div className="notes-space-heading"><label className="market-selector">Shared notebook<select aria-label="Shared notebook" value={key(space)} onChange={event => {
      if (!pending.current || window.confirm('Leave this note? Unsaved changes will be lost.')) setSelected(event.target.value);
    }}>{spaces.map(item => <option value={key(item)} key={key(item)}>{item.scopeKind === 'PAIR' ? 'Partner' : 'Group'} · {item.name}</option>)}</select></label><p className="muted small">Everyone in this space can read and edit every note, including people who join later.</p></div>
    <Notebook key={key(space)} space={space} userId={userId} onPendingChange={reportPending}/>
  </section>;
}

function Notebook({ space, userId, onPendingChange }: { space: PlannerSpace; userId: string; onPendingChange: (pending: boolean) => void }) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const request = useRef(0);
  const busy = useRef(false);
  const reportPending = useCallback((value: boolean) => { pending.current = value; onPendingChange(value); }, [onPendingChange]);
  const load = useCallback(async () => {
    const result = await api<NoteSummary[]>(`/notes?scopeKind=${space.scopeKind}&scopeId=${space.scopeId}`);
    setNotes(result); setLoaded(true);
  }, [space.scopeKind, space.scopeId]);
  useEffect(() => {
    let active = true;
    const refresh = () => { if (document.visibilityState === 'visible') void load().catch(error => { if (active) setError(message(error)); }); };
    refresh();
    // shortcut: shared notes refresh every 10 seconds; use a collaboration service for live cursors and merging.
    const timer = window.setInterval(refresh, 10000);
    return () => { active = false; window.clearInterval(timer); ++request.current; };
  }, [load]);
  function canLeave() { return !pending.current || window.confirm('Leave this note? Unsaved changes will be lost.'); }
  async function open(id: string) {
    if (busy.current || id === note?.id || !canLeave()) return;
    const current = ++request.current;
    setNote(null); setOpening(true); setError('');
    try { const result = await api<Note>(`/notes/${id}`); if (current === request.current) setNote(result); }
    catch (error) { if (current === request.current) setError(message(error)); }
    finally { if (current === request.current) setOpening(false); }
  }
  async function create() {
    if (busy.current || !canLeave()) return;
    busy.current = true; const current = ++request.current;
    setNote(null); setOpening(true); setError('');
    try {
      const result = await api<Note>('/notes', 'POST', { scopeKind: space.scopeKind, scopeId: space.scopeId });
      if (current === request.current) { setNotes(items => [result, ...items]); setNote(result); setLoaded(true); }
    } catch (error) { if (current === request.current) setError(message(error)); }
    finally { busy.current = false; if (current === request.current) setOpening(false); }
  }
  const saved = useCallback((result: Note) => {
    setNotes(items => [result, ...items.filter(item => item.id !== result.id)]);
  }, []);
  return <>
    {error && <div className="notice error" role="alert">{error} <button className="text-button" onClick={() => void load().then(() => setError('')).catch(error => setError(message(error)))}>Retry loading</button></div>}
    <div className="notes-layout"><aside className="notes-list" aria-label="Notes in this notebook">
      <div className="row between"><h2>Our notes <span className="muted small">{notes.length}</span></h2><button className="primary" disabled={opening} onClick={() => void create()}>＋ Create note</button></div>
      {!loaded && !error && <p className="muted small" role="status">Opening your notebook…</p>}
      {notes.map(item => <button className={`note-list-item ${item.id === note?.id ? 'selected' : ''}`} key={item.id} aria-current={item.id === note?.id ? 'page' : undefined} disabled={opening} onClick={() => void open(item.id)}><span aria-hidden="true">▤</span><span><strong>{item.title}</strong><small className="muted">{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.updatedById === userId ? 'You' : space.members.find(member => member.userId === item.updatedById)?.user.email.split('@')[0] ?? 'A member'}</small></span></button>)}
      {loaded && !notes.length && <p className="muted small notes-list-empty">Ideas, plans, and the little things worth remembering. Keep them here, together.</p>}
    </aside><div className="notes-page" aria-busy={opening}>
      {opening && <p className="muted small" role="status">Opening note…</p>}
      {note ? <NoteEditor key={note.id} note={note} space={space} onSaved={saved} onPendingChange={reportPending}/> : <div className="notes-blank"><span className="notes-empty-icon" aria-hidden="true">▤</span><p className="eyebrow">A LITTLE SPACE TO THINK TOGETHER</p><h2>Your next idea starts here.</h2><p className="muted">Make a weekend plan, collect your ideas, or leave a little note. It’s already shared with {space.name}.</p><button className="primary" disabled={opening} onClick={() => void create()}>＋ Create your first note</button></div>}
    </div></div>
  </>;
}

function NoteEditor({ note, space, onSaved, onPendingChange }: {
  note: Note; space: PlannerSpace; onSaved: (note: Note) => void; onPendingChange: (pending: boolean) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(0);
  const [error, setError] = useState('');
  const [latest, setLatest] = useState<Note | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  const baseline = useRef(note);
  const titleRef = useRef(title);
  const pending = useRef(false);
  const unsaved = useRef(false);
  const active = useRef(true);
  const editor = useEditor({
    extensions: [...noteExtensions(), Placeholder.configure({ placeholder: 'Write something together… Try # for a heading or [] for a checklist.' })],
    content: note.content, immediatelyRender: false,
    editorProps: { attributes: { class: 'note-prose', role: 'textbox', 'aria-label': 'Note content', 'aria-multiline': 'true' } },
    onUpdate: () => { unsaved.current = true; setDirty(true); setChanged(value => value + 1); },
  });
  const formatting = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor?.isActive('bold'), italic: editor?.isActive('italic'), underline: editor?.isActive('underline'), strike: editor?.isActive('strike'),
    bulletList: editor?.isActive('bulletList'), orderedList: editor?.isActive('orderedList'), taskList: editor?.isActive('taskList'), blockquote: editor?.isActive('blockquote'), codeBlock: editor?.isActive('codeBlock'), link: editor?.isActive('link'),
    block: editor?.isActive('heading', { level: 1 }) ? '1' : editor?.isActive('heading', { level: 2 }) ? '2' : editor?.isActive('heading', { level: 3 }) ? '3' : 'paragraph',
  }) });
  useEffect(() => { active.current = true; return () => { active.current = false; onPendingChange(false); }; }, [onPendingChange]);
  useEffect(() => {
    onPendingChange(dirty || saving);
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); }
    if (dirty || saving) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving, onPendingChange]);

  const save = useCallback(async () => {
    if (!editor || pending.current || !unsaved.current || latest) return;
    const snapshot = { title: titleRef.current.trim() || 'Untitled note', content: editor.getJSON() };
    if (JSON.stringify(snapshot.content).length > 48000) { setError('This note is full. Keep this draft open and move some content to a new note before saving.'); return; }
    pending.current = true; setSaving(true); setError('');
    try {
      const result = await api<Note>(`/notes/${note.id}/edit`, 'POST', { ...snapshot, version: baseline.current.version });
      if (!active.current) return;
      baseline.current = result; onSaved(result);
      const stillDirty = (titleRef.current.trim() || 'Untitled note') !== snapshot.title || JSON.stringify(editor.getJSON()) !== JSON.stringify(snapshot.content);
      unsaved.current = stillDirty; setDirty(stillDirty);
    } catch (error) {
      if (!active.current) return;
      setError(message(error));
      if (error instanceof ApiError && error.status === 409) {
        try { const result = await api<Note>(`/notes/${note.id}`); if (active.current) setLatest(result); }
        catch { /* Keep the draft and the conflict message visible until retry. */ }
      }
    } finally { pending.current = false; if (active.current) setSaving(false); }
  }, [editor, latest, note.id, onSaved]);
  useEffect(() => {
    if (!dirty || saving || error || latest) return;
    const timer = window.setTimeout(() => void save(), 1500);
    return () => window.clearTimeout(timer);
  }, [changed, dirty, saving, error, latest, save]);
  useEffect(() => {
    async function refresh() {
      if (document.visibilityState !== 'visible' || pending.current) return;
      try {
        const result = await api<Note>(`/notes/${note.id}`);
        if (active.current && !unsaved.current) setError('');
        if (!active.current || pending.current || result.version <= baseline.current.version) return;
        if (unsaved.current) { setLatest(result); return; }
        baseline.current = result; titleRef.current = result.title; setTitle(result.title);
        editor?.commands.setContent(result.content, { emitUpdate: false }); onSaved(result);
      } catch (error) { if (active.current) setError(message(error)); }
    }
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [editor, note.id, onSaved]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); } }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [save]);
  if (!editor) return <p role="status">Preparing your editor…</p>;
  return <>
    <div className="note-topline row between"><span className="small muted">{space.scopeKind === 'PAIR' ? '♡ Partner notebook' : '♧ Group notebook'} · Shared automatically</span><div className="row"><span className="small muted" role="status">{saving ? 'Saving…' : latest ? 'Review changes' : error ? 'Needs attention' : dirty ? 'Unsaved changes' : 'All changes saved'}</span><button className="subtle" disabled={saving || !dirty || !!latest} onClick={() => void save()}>{error ? 'Retry save' : 'Save note'}</button></div></div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {latest && <section className="note-conflict notice" aria-label="Conflicting note versions"><h3>There’s a newer version.</h3><p>Your draft is below. Review the shared version, then copy anything you need into your draft.</p><details><summary>Read the latest shared version</summary><h3>{latest.title}</h3><NotePreview key={latest.version} content={latest.content}/></details><div className="row"><button className="subtle" onClick={() => {
      if (!window.confirm('Replace your draft with the latest shared version? Your unsaved changes will be lost.')) return;
      baseline.current = latest; titleRef.current = latest.title; setTitle(latest.title); editor.commands.setContent(latest.content); unsaved.current = false; setDirty(false); setLatest(null); setError(''); onSaved(latest);
    }}>Use shared version</button><button className="primary" onClick={() => { baseline.current = latest; setLatest(null); setError(''); unsaved.current = true; setDirty(true); setChanged(value => value + 1); }}>I’ve reviewed it · save my draft</button></div></section>}
    <div className="note-title-label"><textarea className="note-title" aria-label="Note title" rows={2} maxLength={160} placeholder="Untitled note" value={title} onChange={event => { titleRef.current = event.target.value; setTitle(event.target.value); unsaved.current = true; setDirty(true); setChanged(value => value + 1); }}/></div>
    <div className="note-toolbar" role="group" aria-label="Text formatting">
      <select aria-label="Block style" value={formatting?.block ?? 'paragraph'} onChange={event => { const value = event.target.value; if (value === 'paragraph') editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 | 3 }).run(); }}><option value="paragraph">Text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
      {([
        ['Bold', 'B', formatting?.bold, () => editor.chain().focus().toggleBold().run()],
        ['Italic', 'I', formatting?.italic, () => editor.chain().focus().toggleItalic().run()],
        ['Underline', 'U', formatting?.underline, () => editor.chain().focus().toggleUnderline().run()],
        ['Strikethrough', 'S̶', formatting?.strike, () => editor.chain().focus().toggleStrike().run()],
        ['Bullet list', '• List', formatting?.bulletList, () => editor.chain().focus().toggleBulletList().run()],
        ['Numbered list', '1. List', formatting?.orderedList, () => editor.chain().focus().toggleOrderedList().run()],
        ['Checklist', '☑', formatting?.taskList, () => editor.chain().focus().toggleTaskList().run()],
        ['Quote', '❝', formatting?.blockquote, () => editor.chain().focus().toggleBlockquote().run()],
        ['Code block', '</>', formatting?.codeBlock, () => editor.chain().focus().toggleCodeBlock().run()],
        ['Link', '↗ Link', formatting?.link, () => { setLink(editor.getAttributes('link').href ?? ''); setLinkError(''); }],
        ['Undo', '↶', false, () => editor.chain().focus().undo().run()],
        ['Redo', '↷', false, () => editor.chain().focus().redo().run()],
      ] as const).map(([label, text, pressed, action]) => <button type="button" key={label} aria-label={label} title={label} aria-pressed={!!pressed} onMouseDown={event => event.preventDefault()} onClick={action}>{text}</button>)}
    </div>
    {link !== null && <form className="note-link-form" onSubmit={event => { event.preventDefault(); const href = link.trim(); if (href && !allowedNoteLink(href)) { setLinkError('Enter a full https://, http://, or mailto: link.'); return; } if (href) editor.chain().focus().extendMarkRange('link').setLink({ href }).run(); else editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLink(null); }}><label className="field">Link address<input aria-label="Link address" value={link} maxLength={2000} onChange={event => setLink(event.target.value)} placeholder="https://example.com" autoFocus/></label><div className="row"><button className="primary">{link.trim() ? 'Apply link' : 'Remove link'}</button><button className="subtle" type="button" onClick={() => setLink(null)}>Cancel</button></div>{linkError && <p role="alert">{linkError}</p>}</form>}
    <EditorContent editor={editor}/>
    <p className="note-editor-hint small muted">Changes save automatically. Use Markdown shortcuts as you write · Ctrl / ⌘ + S to save.</p>
  </>;
}

function NotePreview({ content }: { content: JSONContent }) {
  const editor = useEditor({ extensions: noteExtensions(), content, editable: false, immediatelyRender: false, editorProps: { attributes: { class: 'note-prose note-preview', 'aria-label': 'Latest shared version' } } });
  return <EditorContent editor={editor}/>;
}
