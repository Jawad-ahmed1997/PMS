// // app/api/admin/reset-db/route.ts

// import { buildError, buildSuccess } from "@/lib/api";
// import { prisma } from "@/lib/prisma";


// export async function DELETE() {
//     try {
//         await prisma.$transaction([
//             prisma.notificationRecipient.deleteMany(),
//             prisma.notification.deleteMany(),

//             prisma.commentReadState.deleteMany(),
//             prisma.comment.deleteMany(),

//             prisma.taskWorkSession.deleteMany(),
//             prisma.taskBreak.deleteMany(),
//             prisma.taskTimeRequest.deleteMany(),
//             prisma.taskTimeLog.deleteMany(),
//             prisma.taskStatusHistory.deleteMany(),
//             prisma.checklistItem.deleteMany(),
//             prisma.activityLog.deleteMany(),

//             prisma.personalTodo.deleteMany(),
//             prisma.personalNote.deleteMany(),

//             prisma.task.deleteMany(),

//             prisma.attendanceBreak.deleteMany(),
//             prisma.attendanceWFHInterval.deleteMany(),
//             prisma.attendance.deleteMany(),

//             prisma.projectKT.deleteMany(),
//             prisma.milestone.deleteMany(),
//             prisma.projectMember.deleteMany(),
//             prisma.project.deleteMany(),

//             prisma.passwordResetToken.deleteMany(),
//             prisma.verificationToken.deleteMany(),
//             prisma.session.deleteMany(),
//             prisma.account.deleteMany(),

//             prisma.rateLimitBucket.deleteMany(),
//             prisma.securityAuditEvent.deleteMany(),


//         ]);

//         return buildSuccess("Database reset successfully.");
//     } catch (error) {
//         console.error("Database reset error:", error);
//         return buildError("Failed to reset database.", 500);
//     }
// }