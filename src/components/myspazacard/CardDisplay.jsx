import { useState } from "react";
import { Wifi, QrCode, ScanLine } from "lucide-react";

const LOGO_URL = "https://media.base44.com/images/public/6a71f906799690812c4b06c9/34e4639da_My_Spaza-removebg-preview.png";

export default function CardDisplay({ balance = 0, holderName = "Shop Owner", cardNumber = "4012 5800 2026 0918" }) {
  const [flipped, setFlipped] = useState(false);

  const qrData = encodeURIComponent(
    `MYSPAZA CARD\nHolder: ${holderName}\nBalance: R ${Number(balance).toFixed(2)}\nNumber: ${cardNumber}\nNetwork: MySpaza`
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&bgcolor=FFFFFF&color=000000&data=${qrData}`;

  return (
    <div className="w-full max-w-sm mx-auto" style={{ perspective: "1000px" }}>
      <div
        onClick={() => setFlipped(f => !f)}
        className="relative w-full aspect-[1.586/1] cursor-pointer transition-transform duration-700"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-2xl p-4 flex flex-col justify-between text-white shadow-2xl overflow-hidden"
          style={{ backfaceVisibility: "hidden", background: "linear-gradient(135deg, #111111 0%, #1a1a1a 60%, #000 100%)" }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <img src={LOGO_URL} alt="MySpaza" className="w-9 h-9 rounded-lg object-cover bg-yellow-400" />
              <div>
                <span className="font-bold text-sm tracking-wide">MySpaza Card</span>
                <p className="text-[9px] text-gray-400">MySpaza · Savings & Discount</p>
              </div>
            </div>
            <Wifi size={18} className="text-yellow-400 rotate-90" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="w-9 h-6 rounded bg-yellow-400/90 mb-2" />
              <p className="font-mono text-[13px] sm:text-sm tracking-widest">{cardNumber}</p>
              <p className="text-[9px] text-gray-400 uppercase mt-1.5">Savings Balance</p>
              <p className="text-yellow-400 font-bold text-lg leading-tight">
                R {Number(balance).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg p-1 flex-shrink-0">
              <img src={qrUrl} alt="Card QR" className="w-16 h-16 rounded" />
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] text-gray-400 uppercase">Card Holder</p>
              <p className="text-xs font-medium">{holderName}</p>
            </div>
            <div className="flex items-center gap-1">
              <QrCode size={13} className="text-yellow-400" />
              <span className="text-[10px] font-semibold text-gray-300">VISA</span>
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl text-white shadow-2xl overflow-hidden flex flex-col"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#000" }}
        >
          <div className="h-8 bg-yellow-400 -mx-4 mt-3" />
          <div className="flex items-center justify-center gap-2 py-3 text-gray-400">
            <ScanLine size={14} className="text-yellow-400" />
            <span className="text-[10px] uppercase tracking-widest">Scan to verify</span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="bg-white rounded-xl p-2 flex flex-col items-center">
              <img src={qrUrl} alt="Card QR" className="w-24 h-24" />
              <p className="text-[9px] text-gray-500 mt-1 font-mono">{cardNumber}</p>
            </div>
          </div>
          <div className="px-4 pb-3">
            <ul className="text-[10px] text-gray-300 grid grid-cols-2 gap-x-2 gap-y-0.5">
              <li>✓ Wholesaler discounts</li>
              <li>✓ Stockfell savings</li>
              <li>✓ Stokvel groups</li>
              <li>✓ Bulk buying</li>
            </ul>
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-2">Tap card to flip · Scan QR to verify</p>
    </div>
  );
}