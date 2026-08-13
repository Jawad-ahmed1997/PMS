import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/s3";
import { getAuthContext, ensureAuthenticated, buildError, buildSuccess } from "@/lib/api";

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  try {
    const { filename, fileType, uploadType = "universal" } = await request.json();
    if (!filename || !fileType) {
      return buildError("filename and fileType are required.", 400);
    }

    const allowedPrefixes = ["image/", "video/", "application/pdf", "text/plain"];
    const isAllowedType = allowedPrefixes.some(pref => fileType.startsWith(pref));
    if (!isAllowedType) {
      return buildError("Only images, videos, PDFs, and plain text files are allowed.", 400);
    }

    // Organize files into S3 folder namespaces
    let folder = "universal";
    if (uploadType === "profile") folder = "profiles";
    else if (uploadType === "task") folder = "tasks";
    else if (uploadType === "comment") folder = "comments";

    // Sanitize and generate a unique file key inside public/ namespace
    const fileExtension = filename.split(".").pop();
    const uniqueKey = `public/${folder}/${crypto.randomUUID()}.${fileExtension}`;

    // Create the upload command
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: uniqueKey,
      ContentType: fileType,
    });

    // Generate Presigned URL valid for 15 minutes (900 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    
    // The public URL of the uploaded object
    const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueKey}`;

    return buildSuccess("Presigned URL generated.", {
      uploadUrl,
      fileUrl,
      fileKey: uniqueKey
    });
  } catch (error) {
    console.error("S3 Presigned URL error:", error);
    return buildError("Failed to generate upload signature.", 500);
  }
}
