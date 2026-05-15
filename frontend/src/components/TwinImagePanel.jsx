import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Link as LinkIcon, X, Check } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Resolve image src — absolute URLs as-is, relative /api/uploads/... prefixed with backend
const resolveImage = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND}${url}`;
};

export default function TwinImagePanel({ machine, onUpdated }) {
  const [mode, setMode] = useState(null); // null | "url" | "upload"
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const saveUrl = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      await api.put(`/machines/${machine.id}`, { twin_image_url: url.trim() });
      toast.success("Twin image updated.");
      setMode(null); setUrl("");
      onUpdated?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    try {
      await api.post(`/machines/${machine.id}/twin-image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Image uploaded.");
      setMode(null);
      onUpdated?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clear = async () => {
    if (!window.confirm("Reset this machine's twin image back to the default?")) return;
    setBusy(true);
    try {
      await api.delete(`/machines/${machine.id}/twin-image`);
      toast.success("Reverted to default.");
      onUpdated?.();
    } finally {
      setBusy(false);
    }
  };

  const preview = resolveImage(machine.twin_image_url);

  return (
    <div className="panel" data-testid="twin-image-panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-[#F97316]" />
          <div>
            <div className="eyebrow">Digital Twin Image</div>
            <div className="font-display font-semibold text-sm">
              {machine.twin_image_url ? "Custom image" : "Using type-based default"}
            </div>
          </div>
        </div>
        {machine.twin_image_url && (
          <button
            onClick={clear}
            disabled={busy}
            data-testid="twin-image-clear"
            className="text-xs text-muted-foreground hover:text-red-500 inline-flex items-center gap-1"
          >
            <X size={12} /> Reset
          </button>
        )}
      </div>

      <div className="panel-body space-y-3">
        {/* Preview */}
        <div className="aspect-video w-full bg-secondary border border-border overflow-hidden flex items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt="Twin background"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="text-xs text-muted-foreground text-center px-6">
              Default schematic in use.
              <br />Upload or paste a URL to show your own machine photo on the Digital Twin page.
            </div>
          )}
        </div>

        {/* Mode buttons */}
        {!mode && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("upload")}
              data-testid="twin-image-mode-upload"
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border hover:border-[#F97316] transition-colors"
            >
              <Upload size={13} /> Upload file
            </button>
            <button
              onClick={() => setMode("url")}
              data-testid="twin-image-mode-url"
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border hover:border-[#F97316] transition-colors"
            >
              <LinkIcon size={13} /> Paste URL
            </button>
          </div>
        )}

        {/* URL form */}
        {mode === "url" && (
          <form onSubmit={saveUrl} className="space-y-2" data-testid="twin-image-url-form">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/my-machine.jpg"
              className="w-full input-themed px-3 py-2 text-sm"
              data-testid="twin-image-url-input"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                data-testid="twin-image-url-save"
                className="flex-1 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-60 text-black font-medium py-2 text-sm inline-flex items-center justify-center gap-1.5"
              >
                <Check size={13} /> {busy ? "Saving…" : "Save URL"}
              </button>
              <button
                type="button"
                onClick={() => { setMode(null); setUrl(""); }}
                className="px-3 py-2 text-sm border border-border text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Upload form */}
        {mode === "upload" && (
          <div className="space-y-2" data-testid="twin-image-upload-form">
            <label className="block">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFile}
                disabled={busy}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-[#F97316] file:text-black file:font-medium file:cursor-pointer hover:file:bg-[#EA580C]"
                data-testid="twin-image-file-input"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>PNG, JPG, WebP or GIF · max 5 MB</span>
              <button
                onClick={() => setMode(null)}
                className="hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
