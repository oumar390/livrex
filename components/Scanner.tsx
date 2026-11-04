"use client";
import { useEffect, useRef, useState } from "react";
interface Detector {
  detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (o: { formats: string[] }) => Detector;
export default function Scanner({
  expected,
  onRead,
  onCancel,
}: {
  expected: string;
  onRead: (code: string) => void;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    cb = useRef(onRead),
    done = useRef(false);
  const [mode, setMode] = useState<"manual" | "camera">("manual"),
    [input, setInput] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    cb.current = onRead;
  }, [onRead]);
  useEffect(() => {
    if (mode !== "camera") return;
    let live = true,
      raf = 0,
      stream: MediaStream | null = null;
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor })
      .BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices) return;
    const detector = new Ctor({ formats: ["qr_code", "code_128"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        async function loop() {
          if (!live || done.current) return;
          try {
            const result = await detector.detect(v);
            if (result[0]) {
              done.current = true;
              cb.current(result[0].rawValue);
              return;
            }
          } catch {}
          raf = requestAnimationFrame(loop);
        }
        loop();
      })
      .catch(() => {
        setMessage("Accès à la caméra refusé. Saisissez le numéro du colis.");
        setMode("manual");
      });
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);
  return (
    <div className="stack">
      {mode === "camera" && (
        <div className="scanner">
          <video
            ref={video}
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div className="frame" style={{ position: "absolute" }} />
        </div>
      )}
      <p className="note">
        Scannez l’étiquette ou saisissez le numéro imprimé sous le code-barres.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim().toUpperCase() !== expected)
            return setMessage("Ce numéro ne correspond pas au colis attendu.");
          onRead(input.trim().toUpperCase());
        }}
      >
        <label className="field">
          Numéro sur l’étiquette
          <input
            className="in mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <button className="btn btn-accent">Valider le numéro</button>
      </form>
      {message && (
        <p role="status" className="note">
          {message}
        </p>
      )}
      <div className="row">
        <button
          className="btn"
          onClick={() => {
            if (!("BarcodeDetector" in window) || !navigator.mediaDevices) {
              setMessage("Scan caméra indisponible. Saisissez le numéro.");
              return;
            }
            done.current = false;
            setMode(mode === "camera" ? "manual" : "camera");
          }}
        >
          {mode === "camera" ? "Fermer la caméra" : "Utiliser la caméra"}
        </button>
        <button className="btn" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}
