import { NotesService } from './notes.service';
import { PlannerService } from '../planner/planner.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { editNoteSchema } from '../schemas';
import { emptyNote, parseNoteDocument } from '../../shared/note-document';

describe('shared notebooks', () => {
  const pair = { scopeKind: 'PAIR' as const, scopeId: 'pair' };
  const group = { scopeKind: 'GROUP' as const, scopeId: 'group' };
  let db: any, service: NotesService;
  let note: any;
  beforeEach(() => {
    note = { id: 'note', ...pair, title: 'Our weekend', content: emptyNote, version: 1, createdById: 'alice', updatedById: 'alice' };
    const members = [{ userId: 'alice' }, { userId: 'bob' }];
    db = {
      membership: { findMany: jest.fn().mockResolvedValue(members) },
      circleMember: { findMany: jest.fn().mockResolvedValue(members) },
      sharedNote: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(async () => note),
        findUniqueOrThrow: jest.fn(async () => note),
        create: jest.fn(async ({ data }) => ({ id: 'new', version: 1, ...data })),
        updateMany: jest.fn(async ({ where, data }) => {
          if (where.version !== note.version) return { count: 0 };
          note = { ...note, ...data, version: note.version + 1 };
          return { count: 1 };
        }),
      },
      runInTransaction: (action: (tx: unknown) => unknown) => action(db),
    };
    service = new NotesService(db, new PlannerService(db, { now: () => new Date() }));
  });
  it('creates directly inside a partner or group notebook with no per-note sharing', async () => {
    expect(await service.create('alice', pair)).toMatchObject({ ...pair, content: emptyNote, createdById: 'alice' });
    expect(await service.create('bob', group)).toMatchObject({ ...group, createdById: 'bob' });
    expect(db.circleMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { circleId: 'group' } }));
  });
  it('allows a one-person space to prepare notes before their partner joins', async () => {
    db.membership.findMany.mockResolvedValue([{ userId: 'alice' }]);
    await expect(service.create('alice', pair)).resolves.toMatchObject(pair);
  });
  it('lists only the selected notebook and omits note bodies from the index', async () => {
    await service.list('alice', group);
    expect(db.sharedNote.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: group, select: expect.not.objectContaining({ content: true }) }));
  });
  it('lets another member read and edit a note they did not create', async () => {
    expect(await service.get('bob', 'note')).toMatchObject({ createdById: 'alice' });
    const result = await service.edit('bob', 'note', { title: 'A shared plan', content: emptyNote, version: 1 });
    expect(result).toMatchObject({ title: 'A shared plan', updatedById: 'bob', version: 2 });
  });
  it('denies outsiders every note operation, including access by a known note ID', async () => {
    await expect(service.list('outsider', pair)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.create('outsider', group)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.get('outsider', 'note')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.edit('outsider', 'note', { title: 'Stolen', content: emptyNote, version: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    expect(db.sharedNote.create).not.toHaveBeenCalled();
    expect(db.sharedNote.updateMany).not.toHaveBeenCalled();
  });
  it('checks membership in the note’s actual group, independently of partner access', async () => {
    note = { ...note, ...group };
    db.circleMember.findMany.mockResolvedValue([{ userId: 'carol' }]);
    await expect(service.get('alice', 'note')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.edit('alice', 'note', { title: 'Other group', content: emptyNote, version: 1 })).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('rejects a missing note', async () => {
    note = null;
    await expect(service.get('alice', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
  it('rejects stale saves instead of silently overwriting another person’s edits', async () => {
    await service.edit('alice', 'note', { title: 'Alice’s edit', content: emptyNote, version: 1 });
    await expect(service.edit('bob', 'note', { title: 'Stale edit', content: emptyNote, version: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(note.title).toBe('Alice’s edit');
    await service.edit('bob', 'note', { title: 'Reviewed edit', content: emptyNote, version: 2 });
    expect(note).toMatchObject({ title: 'Reviewed edit', version: 3 });
  });
});

describe('rich note validation', () => {
  const text = (value: string, marks?: object[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
  const doc = (...content: object[]) => ({ type: 'doc', content });
  const paragraph = (...content: object[]) => ({ type: 'paragraph', ...(content.length ? { content } : {}) });
  it('round-trips headings, formatting, checklists, and safe links', () => {
    const content = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Weekend plans')] },
      paragraph(text('Coffee', [{ type: 'link', attrs: { href: 'https://example.com' } }, { type: 'bold' }])),
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('Book a table'))] }] },
    );
    expect(parseNoteDocument(content)).toMatchObject(content);
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', 'https://example.com\n', '//example.com'])('rejects unsafe link %s', href => {
    expect(editNoteSchema.safeParse({ title: 'A note', version: 1, content: doc(paragraph(text('Click', [{ type: 'link', attrs: { href } }]))) }).success).toBe(false);
  });
  it('rejects unknown blocks, broken nesting, missing content, oversized and over-nested documents', () => {
    const values: unknown[] = [doc({ type: 'script', content: [text('alert(1)')] }), doc(text('Not in a paragraph')), undefined, doc(paragraph(text('x'.repeat(48001))))];
    let nested: object = paragraph();
    for (let index = 0; index < 35; index++) nested = { type: 'blockquote', content: [nested] };
    values.push(doc(nested));
    for (const content of values) expect(editNoteSchema.safeParse({ title: 'A note', version: 1, content }).success).toBe(false);
  });
  it('does not allow changing a note’s space, author, or version without a positive revision', () => {
    const valid = { title: 'A note', content: emptyNote, version: 1 };
    expect(editNoteSchema.safeParse({ ...valid, scopeId: 'another-space' }).success).toBe(false);
    expect(editNoteSchema.safeParse({ ...valid, createdById: 'bob' }).success).toBe(false);
    expect(editNoteSchema.safeParse({ ...valid, version: 0 }).success).toBe(false);
  });
});
