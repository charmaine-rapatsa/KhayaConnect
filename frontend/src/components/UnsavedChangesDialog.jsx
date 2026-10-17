import { useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/UnsavedChangesDialog.css";

export default function UnsavedChangesDialog({ onStay, onLeave }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onStay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStay]);

  return createPortal(
    <div className="kc-unsaved-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onStay()}>
      <section className="kc-unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="kc-unsaved-title" aria-describedby="kc-unsaved-description">
        <div className="kc-unsaved-mark" aria-hidden="true">KC</div>
        <p className="kc-unsaved-brand">KHAYACONNECT</p>
        <h2 id="kc-unsaved-title">Leave this section?</h2>
        <p id="kc-unsaved-description">You have unsaved form changes. If you leave now, those changes will be lost.</p>
        <div className="kc-unsaved-actions">
          <button type="button" className="kc-unsaved-stay" onClick={onStay}>Stay here</button>
          <button type="button" className="kc-unsaved-leave" onClick={onLeave}>Leave section</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
