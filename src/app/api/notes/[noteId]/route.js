import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { noteId } = await params;
  if (!noteId) {
    return buildError("Note id is required.", 400);
  }

  const note = await prisma.personalNote.findUnique({
    where: { id: noteId },
  });

  if (!note) {
    return buildError("Note not found.", 404);
  }

  if (note.userId !== context.user.id) {
    return buildError("You do not have permission to modify this note.", 403);
  }

  const body = await request.json();
  const updates = {};

  if (body.title !== undefined) {
    updates.title = body.title.trim() || "Untitled Note";
  }

  if (body.content !== undefined) {
    updates.content = body.content;
  }

  if (body.taskId !== undefined) {
    updates.taskId = body.taskId || null;
    if (updates.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: updates.taskId },
      });
      if (!task) {
        return buildError("Linked task not found.", 404);
      }
    }
  }

  const updatedNote = await prisma.personalNote.update({
    where: { id: noteId },
    data: updates,
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  return buildSuccess("Note updated successfully.", { note: updatedNote });
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { noteId } = await params;
  if (!noteId) {
    return buildError("Note id is required.", 400);
  }

  const note = await prisma.personalNote.findUnique({
    where: { id: noteId },
  });

  if (!note) {
    return buildError("Note not found.", 404);
  }

  if (note.userId !== context.user.id) {
    return buildError("You do not have permission to delete this note.", 403);
  }

  await prisma.personalNote.delete({
    where: { id: noteId },
  });

  return buildSuccess("Note deleted successfully.");
}
