import { useRef, useState } from "react";
import { Download, Award, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const LOGO_URL = "/brand/logo.png";

export default function Certificate({ open, onClose, courseTitle, ownerName, completedDate }) {
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const name = ownerName && ownerName.trim() ? ownerName.trim() : "Spaza Shop Owner";
  const dateStr = completedDate
    ? new Date(completedDate).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });

  const handleDownload = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`MySpaza-Certificate-${courseTitle.replace(/\s+/g, "-")}.pdf`);
    } catch (e) {
      console.error("Certificate download failed", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Certificate canvas */}
        <div className="p-4 bg-muted">
          <div
            ref={certRef}
            className="relative w-full mx-auto bg-white shadow-xl"
            style={{ aspectRatio: "1.414 / 1", maxWidth: 900 }}
          >
            {/* Outer border */}
            <div className="absolute inset-0 border-[6px] border-[#0D0D0D] m-0" />
            {/* Inner gold border */}
            <div className="absolute inset-3 border-2 border-[#D4A017]" />

            <div className="relative h-full flex flex-col items-center justify-center text-center px-10 py-8">
              {/* Logo */}
              <img src={LOGO_URL} alt="My Spaza" className="h-20 w-auto object-contain mb-3" crossOrigin="anonymous" />

              <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-[#0D0D0D]/60 font-semibold">
                My Spaza Academy
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0D0D0D] mt-1 mb-1">
                Certificate of Completion
              </h2>

              <div className="w-16 h-[2px] bg-[#D4A017] my-3" />

              <p className="text-xs sm:text-sm text-[#0D0D0D]/70">This certificate is proudly presented to</p>
              <p className="text-xl sm:text-3xl font-bold text-[#0D0D0D] mt-1 mb-3">{name}</p>

              <p className="text-xs sm:text-sm text-[#0D0D0D]/70 max-w-md">
                for successfully completing all lessons of the
              </p>
              <p className="text-base sm:text-xl font-semibold text-[#0D0D0D] mt-1">{courseTitle}</p>
              <p className="text-xs sm:text-sm text-[#0D0D0D]/70">course at My Spaza Academy</p>

              {/* Footer: date + signature */}
              <div className="flex items-end justify-between w-full max-w-md mt-8 px-4">
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-semibold text-[#0D0D0D]">{dateStr}</p>
                  <div className="w-28 border-t border-[#0D0D0D]/40 mt-1" />
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[#0D0D0D]/50">Date</p>
                </div>
                <Award size={36} className="text-[#D4A017]" />
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-semibold text-[#0D0D0D]" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                    My Spaza
                  </p>
                  <div className="w-28 border-t border-[#0D0D0D]/40 mt-1" />
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[#0D0D0D]/50">My Spaza Academy</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 p-4 border-t border-border">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {downloading ? "Preparing..." : "Download PDF"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}