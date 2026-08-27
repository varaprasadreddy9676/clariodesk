import { AnimatePresence, motion } from "framer-motion";

export type ToastState = { kind: "ok" | "error"; text: string } | null;

/** Slides in from the bottom-right and fades out — replaces the old abrupt show/hide. */
export function Toast({ toast }: { toast: ToastState }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.text}
          className={`toast toast-${toast.kind}`}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
