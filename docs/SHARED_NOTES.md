# Shared notes

Open **Shared notes**, choose a **Partner** or **Group** notebook, and select **Create note**. Notes belong to the selected space immediately. All members, including people who join later, can read and edit them. Other spaces cannot access them. You can prepare notes before another member joins.

The Tiptap editor supports headings, bold, italic, underline, strikethrough, links, bullet and numbered lists, nested checklists, quotes, code blocks, undo, redo, and Markdown shortcuts. It uses the [official Next.js integration](https://tiptap.dev/docs/editor/getting-started/install/nextjs). Notes save after a 1.5-second pause; **Save note** or **Ctrl/⌘+S** saves immediately. A failed save keeps the draft open and offers a retry. Leaving with unsaved changes asks for confirmation.

Shared updates refresh every 10 seconds while the page is visible. This first version does not provide live cursors or simultaneous character merging. A version check prevents silent overwrites. When two drafts overlap, the editor shows the latest shared version with the local draft. Review it, copy any changes you need, and choose **I’ve reviewed it · save my draft**, or explicitly discard your draft with **Use shared version**. Drafts are held in memory; closing or leaving after accepting the warning discards unsaved changes.

Notes allow up to 160 title characters and 48,000 characters of structured document data, within the API’s existing 64 KB request limit. Documents are validated against the editor schema. Links allow only HTTP, HTTPS, and mailto addresses. No raw user HTML is rendered.

## Setup

Run `npm install` and `npm run db:migrate` before starting the updated app. Migration `20261031000000_shared_notes` creates the new `SharedNote` table without changing existing data. Apply it to each deployment’s database before releasing the updated server.

## API

All endpoints require an authenticated session and membership in the note’s space.

| Method | Endpoint | Input |
| --- | --- | --- |
| GET | `/api/v1/notes?scopeKind=PAIR&scopeId=<uuid>` | `PAIR` or `GROUP` and a space UUID; returns note summaries |
| POST | `/api/v1/notes` | `{ scopeKind, scopeId }`; creates an empty shared note |
| GET | `/api/v1/notes/<uuid>` | Returns the note and its current version |
| POST | `/api/v1/notes/<uuid>/edit` | `{ title, content, version }`; `content` is Tiptap JSON |

Edit requests cannot change the author or space. A stale version returns HTTP 409. Notes use the planner’s membership checks without its market requirement for two members. The standalone Expo client has no notes screen yet; the responsive website includes the feature on phones.

Run `npm test` and `npm run typecheck`. The PostgreSQL integration suite also verifies membership inheritance, group isolation, and concurrent edits. Use the local disposable database described in [Development](DEVELOPMENT.md) and run `npm run test:integration`.
