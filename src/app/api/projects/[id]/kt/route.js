import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

const DEFAULT_QUICK_START = `### Local Setup Guide

Follow these steps to run the application locally:

1. **Clone the repository**:
   \`\`\`bash
   git clone <repository-url>
   cd <project-folder>
   \`\`\`

2. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure environment variables**:
   Copy \`.env.example\` to \`.env\` and populate it.

4. **Run development server**:
   \`\`\`bash
   npm run dev
   \`\`\`
`;

const DEFAULT_ENV_VARS = `# Environment Variables

\`\`\`env
DATABASE_URL=mongodb+srv://...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=example@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
\`\`\`
`;

const DEFAULT_ARCH = `### Architecture & Third-Party APIs

- **Database**: MongoDB hosted on Atlas, accessed via Prisma ORM.
- **Authentication**: Custom session-based JWT cookie auth.
- **Email Service**: Nodemailer SMTP transporter (Gmail App Password fallback).
- **Core Jobs**: Background reminders and duty hour validation.
`;

export async function GET(request, { params }) {
  const { id: projectId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!projectId) {
    return buildError("Project id is required.", 400);
  }

  try {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return buildError("Project not found.", 404);
    }

    // Find or create ProjectKT record
    let kt = await prisma.projectKT.findUnique({
      where: { projectId },
    });

    if (!kt) {
      kt = await prisma.projectKT.create({
        data: {
          projectId,
          quickStartGuide: DEFAULT_QUICK_START,
          envVariables: DEFAULT_ENV_VARS,
          architectureNotes: DEFAULT_ARCH,
          videoWalkthroughs: [],
        },
      });
    }

    return buildSuccess("Knowledge Transfer hub loaded.", { kt });
  } catch (error) {
    console.error("GET KT error:", error);
    return buildError("Unable to load Knowledge Transfer data.", 500);
  }
}

export async function PATCH(request, { params }) {
  const { id: projectId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!projectId) {
    return buildError("Project id is required.", 400);
  }

  try {
    const body = await request.json();
    const data = {};

    if (body.quickStartGuide !== undefined) data.quickStartGuide = body.quickStartGuide;
    if (body.envVariables !== undefined) data.envVariables = body.envVariables;
    if (body.architectureNotes !== undefined) data.architectureNotes = body.architectureNotes;
    if (body.videoWalkthroughs !== undefined) {
      // Validate that videoWalkthroughs is an array
      if (!Array.isArray(body.videoWalkthroughs)) {
        return buildError("Video walkthroughs must be an array.", 400);
      }
      data.videoWalkthroughs = body.videoWalkthroughs;
    }

    const updatedKt = await prisma.projectKT.update({
      where: { projectId },
      data,
    });

    return buildSuccess("Knowledge Transfer updated successfully.", { kt: updatedKt });
  } catch (error) {
    console.error("PATCH KT error:", error);
    return buildError("Unable to update Knowledge Transfer data.", 500);
  }
}
