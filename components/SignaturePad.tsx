"use client";

import { useEffect, useRef } from "react";

/** Signature sur écran (Sign on Glass) */
export default function SignaturePad({
  onChange,
}: {
  onChange: (signed: boolean, data?: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    c.width = c.clientWidth * 2;
    c.height = c.clientHeight * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0E4063";
    let down = false;
    const pt = (e: PointerEvent): [number, number] => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const dn = (e: PointerEvent) => {
      down = true;
      c.setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.moveTo(...pt(e));
    };
    const mv = (e: PointerEvent) => {
      if (!down) return;
      ctx.lineTo(...pt(e));
      ctx.stroke();
      cb.current(true);
    };
    const up = () => {
      if (down) cb.current(true, c.toDataURL("image/png"));
      down = false;
    };
    c.addEventListener("pointerdown", dn);
    c.addEventListener("pointermove", mv);
    c.addEventListener("pointerup", up);
    return () => {
      c.removeEventListener("pointerdown", dn);
      c.removeEventListener("pointermove", mv);
      c.removeEventListener("pointerup", up);
    };
  }, []);

  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange(false);
  };

  return (
    <div className="field">
      <span className="lab">Signature</span>
      <canvas ref={ref} className="sig" />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={clear}
      >
        Effacer
      </button>
    </div>
  );
}
