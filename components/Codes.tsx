"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

export function QR({ text, size = 96 }: { text: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, {
      width: size * 2,
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#0E4063", light: "#ffffff" },
    })
      .then((u) => {
        if (live) setSrc(u);
      })
      .catch(() => setSrc(""));
    return () => {
      live = false;
    };
  }, [text, size]);
  return (
    <div className="qr" style={{ width: size + 8 }}>
      {src ? (
        <img src={src} width={size} height={size} alt={`QR code ${text}`} />
      ) : (
        <span className="mono" style={{ fontSize: 10 }}>
          {text}
        </span>
      )}
    </div>
  );
}

/** Code-barres Code 128 standardisé, comme demandé au cahier des charges */
export function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 1.6,
        height: 46,
        fontSize: 12,
        font: "IBM Plex Mono",
        margin: 0,
        lineColor: "#0E4063",
        background: "#ffffff",
      });
    } catch {
      /* valeur non encodable */
    }
  }, [value]);
  return <svg ref={ref} aria-label={`Code-barres ${value}`} />;
}
