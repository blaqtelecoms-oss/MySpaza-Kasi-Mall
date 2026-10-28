import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function ProductImageUpload({ value, onChange }) {
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      onChange(res.file_url);
      toast({ title: "Image added", description: "Product photo uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: "Could not upload image. Try again later.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (galleryInput.current) galleryInput.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Preview */}
      <div className="w-20 h-20 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 relative">
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        ) : value ? (
          <>
            <img src={value} alt="Product" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
              aria-label="Remove image"
            >
              <X size={12} className="text-white" />
            </button>
          </>
        ) : (
          <ImagePlus size={22} className="text-muted-foreground" />
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Camera size={16} /> Take Photo
        </button>
        <button
          type="button"
          onClick={() => galleryInput.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <ImagePlus size={16} /> Upload from Gallery
        </button>
      </div>

      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}