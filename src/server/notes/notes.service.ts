import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import type { PlannerService } from '../planner/planner.service';
import type { EditNote, Space } from '../schemas';
import { ConflictError, NotFoundError } from '../http/errors';
import { emptyNote } from '../../shared/note-document';

export class NotesService {
  constructor(private db: PrismaService, private planner: PlannerService) {}

  async list(userId: string, space: Space) {
    await this.planner.members(this.db, userId, space, false);
    return this.db.sharedNote.findMany({
      where: space, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: { id: true, title: true, version: true, updatedAt: true, updatedById: true },
    });
  }

  async create(userId: string, space: Space) {
    return this.db.runInTransaction(async tx => {
      await this.planner.members(tx, userId, space, false);
      return tx.sharedNote.create({ data: { ...space, title: 'Untitled note', content: emptyNote as Prisma.InputJsonValue, createdById: userId, updatedById: userId } });
    });
  }

  private async requireNote(tx: Prisma.TransactionClient, userId: string, id: string) {
    const note = await tx.sharedNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundError('Note not found.');
    await this.planner.members(tx, userId, note, false);
    return note;
  }

  async get(userId: string, id: string) {
    return this.requireNote(this.db, userId, id);
  }

  async edit(userId: string, id: string, data: EditNote) {
    return this.db.runInTransaction(async tx => {
      await this.requireNote(tx, userId, id);
      const result = await tx.sharedNote.updateMany({
        where: { id, version: data.version },
        data: { title: data.title, content: data.content as Prisma.InputJsonValue, version: { increment: 1 }, updatedById: userId },
      });
      if (!result.count) throw new ConflictError('Someone updated this note. Your draft is still here; review the latest version before saving.');
      return tx.sharedNote.findUniqueOrThrow({ where: { id } });
    });
  }
}
