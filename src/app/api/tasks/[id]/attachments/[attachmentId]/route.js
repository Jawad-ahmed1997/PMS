import { prisma } from "@/lib/prisma";
import { getAuthContext, ensureAuthenticated, buildError, buildSuccess } from "@/lib/api";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/s3";

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

export async function DELETE(_request, { params }) {
  const { id: taskId, attachmentId } = await params;
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
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId }
    });

    if (!attachment) {
      return buildError("Attachment not found.", 404);
    }

    if (attachment.taskId !== taskId) {
      return buildError("Attachment does not belong to this task.", 400);
    }

    // 1. Delete object from S3
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: attachment.key
        })
      );
    } catch (s3Err) {
      console.error("Failed to delete S3 attachment object:", s3Err);
      // We still proceed to delete from DB even if S3 fails
    }

    // 2. Delete record from database
    await prisma.taskAttachment.delete({
      where: { id: attachmentId }
    });

    return buildSuccess("Attachment deleted successfully.");
  } catch (err) {
    console.error("DELETE attachment error:", err);
    return buildError("Failed to delete task attachment.", 500);
  }
}
