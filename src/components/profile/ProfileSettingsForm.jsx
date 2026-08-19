"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Clock, Camera, Upload, Trash2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

const timezoneOptions = [
  { value: "Asia/Karachi", label: "Pakistan Standard Time (GMT+5) - Asia/Karachi" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GMT+4) - Asia/Dubai" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time (GMT+6) - Asia/Dhaka" },
  { value: "Asia/Kolkata", label: "India Standard Time (GMT+5:30) - Asia/Kolkata" },
  { value: "Europe/London", label: "British Time (GMT+0 / GMT+1) - Europe/London" },
  { value: "Europe/Paris", label: "Central European Time (GMT+1 / GMT+2) - Europe/Paris" },
  { value: "UTC", label: "Coordinated Universal Time (UTC) - UTC" },
];

export default function ProfileSettingsForm({ initialUser }) {
  const { addToast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [timezone, setTimezone] = useState(initialUser?.timezone || "Asia/Karachi");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentImage, setCurrentImage] = useState(initialUser?.image || null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid file type",
        message: "Please select an image file (PNG, JPG, WEBP, etc.).",
        variant: "destructive",
      });
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const localUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(localUrl);
    setRemovePhoto(false);
  };

  const handleClearSelected = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveExistingPhoto = () => {
    handleClearSelected();
    setRemovePhoto(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingStatus("Updating profile...");

    try {
      const userId = initialUser?.id;
      if (!userId) {
        throw new Error("User ID not found.");
      }

      let uploadedImageUrl = currentImage;

      // 1. Upload to S3 if a new local image file was selected
      if (selectedFile) {
        setLoadingStatus("Uploading image to AWS...");
        
        const presignedRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: selectedFile.name,
            fileType: selectedFile.type,
            uploadType: "profile",
          }),
        });

        if (!presignedRes.ok) {
          const errData = await presignedRes.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to generate presigned upload URL.");
        }

        const { uploadUrl, fileUrl } = await presignedRes.json();

        // Direct PUT to S3
        const s3UploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });

        if (!s3UploadRes.ok) {
          throw new Error("Failed to upload image file to S3.");
        }

        uploadedImageUrl = fileUrl;
      } else if (removePhoto) {
        uploadedImageUrl = null;
      }

      // 2. Update user profile in database
      setLoadingStatus("Saving profile details...");
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          image: uploadedImageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile settings.");
      }

      addToast({
        title: "Profile Updated",
        message: "Your profile picture and preferences have been saved successfully.",
        variant: "success",
      });

      window.location.reload();
    } catch (err) {
      addToast({
        title: "Update Failed",
        message: err instanceof Error ? err.message : "Unable to save profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  const displayAvatarSrc = removePhoto ? null : (previewUrl || currentImage);
  const name = initialUser?.name || "User";

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* User Avatar Circle Section */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)] flex items-center gap-1.5">
          <Camera size={14} className="text-[color:var(--color-text-subtle)]" />
          Profile Picture
        </label>

        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)]/20">
          {/* Circular Avatar with Hover Overlay */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative h-24 w-24 shrink-0 rounded-full border-2 border-[color:var(--color-border)] hover:border-[color:var(--color-accent)] shadow-md overflow-hidden group cursor-pointer transition-all flex items-center justify-center bg-[color:var(--color-card)]"
            title="Click to change profile picture"
          >
            <Avatar
              src={displayAvatarSrc}
              name={name}
              alt={`${name} profile picture`}
              className="h-full w-full object-cover"
            />

            {/* Hover Camera Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-semibold transition-opacity gap-1">
              <Camera size={20} />
              <span>{previewUrl ? "Change" : "Upload"}</span>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={loading}
          />

          <div className="space-y-2 text-center sm:text-left min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="rounded-lg border border-[color:var(--color-border)] hover:border-[color:var(--color-accent)] bg-[color:var(--color-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text)] transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Upload size={13} />
                {previewUrl ? "Change Photo" : "Choose Photo"}
              </button>

              {previewUrl && (
                <button
                  type="button"
                  onClick={handleClearSelected}
                  disabled={loading}
                  className="rounded-lg border border-[color:var(--color-border)] hover:border-rose-500/50 bg-[color:var(--color-card)] px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors shadow-sm"
                >
                  Undo Preview
                </button>
              )}

              {currentImage && !previewUrl && !removePhoto && (
                <button
                  type="button"
                  onClick={handleRemoveExistingPhoto}
                  disabled={loading}
                  className="rounded-lg border border-[color:var(--color-border)] hover:border-rose-500/50 bg-[color:var(--color-card)] px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Remove Photo
                </button>
              )}
            </div>

            {previewUrl && (
              <p className="text-[11px] text-amber-400 font-medium animate-pulse">
                ✨ Photo preview active. Click &quot;Save Settings&quot; below to upload to AWS.
              </p>
            )}

            {removePhoto && (
              <p className="text-[11px] text-rose-400 font-medium">
                Photo will be removed when you click &quot;Save Settings&quot;.
              </p>
            )}

            {!previewUrl && !removePhoto && (
              <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                Supports JPG, PNG, GIF, or WEBP images.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Timezone Preference Section */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)] flex items-center gap-1.5">
          <Clock size={14} className="text-[color:var(--color-text-subtle)]" />
          Timezone Preference
        </label>
        <div className="relative">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] transition-all disabled:opacity-50 appearance-none cursor-pointer"
          >
            {timezoneOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[color:var(--color-card)]">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--color-text-subtle)]">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
        <p className="text-[11px] text-[color:var(--color-text-subtle)]">
          All log metrics, timesheets, and activity periods will format relative to this timezone.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (loadingStatus || "Saving Settings...") : "Save Settings"}
      </button>
    </form>
  );
}
