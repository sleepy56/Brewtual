import { getSchema, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';

export const emptyNote: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
export function allowedNoteLink(href: string) {
  try {
    return !/[\u0000-\u0020\u007f]/.test(href) && ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol);
  } catch { return false; }
}
export const noteExtensions = () => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, isAllowedUri: allowedNoteLink, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } },
  }),
  TaskList, TaskItem.configure({ nested: true }),
];

const schema = getSchema(noteExtensions());
export function parseNoteDocument(value: unknown): JSONContent {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 48000) throw new Error('Keep notes under 48,000 characters.');
  const pending = [{ value, depth: 0 }];
  while (pending.length) {
    const entry = pending.pop()!;
    if (entry.depth > 32) throw new Error('This note has too many nested blocks.');
    if (entry.value && typeof entry.value === 'object') {
      for (const child of Object.values(entry.value)) pending.push({ value: child, depth: entry.depth + 1 });
    }
  }
  const doc = schema.nodeFromJSON(value);
  if (doc.type.name !== 'doc') throw new Error('Use a note document.');
  doc.check();
  doc.descendants(node => {
    for (const mark of node.marks) {
      if (mark.type.name === 'link' && (typeof mark.attrs.href !== 'string' || !allowedNoteLink(mark.attrs.href))) throw new Error('Use an https, http, or email link.');
    }
  });
  return doc.toJSON();
}
