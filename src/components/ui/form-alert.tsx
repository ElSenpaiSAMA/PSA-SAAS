"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function FormAlert({ state }: { state: ActionState }) {
  return (
    <AnimatePresence mode="wait">
      {state.message ? (
        <motion.p
          key={state.submittedAt}
          role={state.status === "error" ? "alert" : "status"}
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0, x: state.status === "error" ? [0, -6, 6, -3, 3, 0] : 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4 }}
          className={cn(
            "overflow-hidden rounded-xl px-4 py-3 text-[13px]",
            state.status === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success",
          )}
        >
          {state.message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
