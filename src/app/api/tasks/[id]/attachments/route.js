import { prisma } from "@/lib/prisma";
import { getAuthContext, ensureAuthenticated, buildError, buildSuccess } from "@/lib/api";

async function checkTaskAccess(context, taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, ownerId: true }
  });
  if (!task) {
    return { error: buildError("Task not found.", 404) };
  }

  // PM, CTO, CEO have global access
  if (["PM", "CTO", "CEO"].includes(context.role)) {
    return { task };
  }

  // Developer assignee has access
  if (task.ownerId === context.user.id) {
    return { task };
  }

  // Project member has access
  const member = await prisma.projectMember.findFirst({
    where: { projectId: task.projectId, userId: context.user.id }
  });
  if (!member) {
    return { error: buildError("You do not have permission to access this task.", 403) };
  }

  return { task };
}

export async function GET(_request, { params }) {
  const { id: taskId } = await params;
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { error } = await checkTaskAccess(context, taskId);
  if (error) {
    return error;
  }

  try {
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" }
    });

    return buildSuccess("Task attachments loaded.", { attachments });
  } catch (err) {
    console.error("GET attachments error:", err);
    return buildError("Failed to fetch task attachments.", 500);
  }
}

export async function POST(request, { params }) {
  const { id: taskId } = await params;
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { error } = await checkTaskAccess(context, taskId);
  if (error) {
    return error;
  }

  try {
    const { name, size, type, url, key } = await request.json();
    if (!name || !size || !type || !url || !key) {
      return buildError("All attachment metadata fields are required.", 400);
    }

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        name,
        size,
        type,
        url,
        key
      }
    });

    return buildSuccess("Attachment created successfully.", { attachment });
  } catch (err) {
    console.error("POST attachment error:", err);
    return buildError("Failed to create task attachment.", 500);
  }
}
