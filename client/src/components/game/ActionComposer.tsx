// client/src/components/game/ActionComposer.tsx
//
// The player's primary control (design spec §9). A grow-with-content
// textarea, not a single-line input — the composer must stay visually
// dominant over the contextual action row above it.

import { useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  disabled?: boolean;
  playingAs: string;
  connected: boolean;
};

const MAX_ROWS = 6;

export default function ActionComposer({ value, onChange, onSubmit, pending, disabled, playingAs, connected }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value]);

  const canSubmit = !disabled && !pending && value.trim().length > 0;

  return (
    <div className="dm-leather border-t px-3 py-3 space-y-2">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Describe what you do..."
          rows={1}
          disabled={disabled}
          className="resize-none min-h-[44px] max-h-32 dm-surface-raised border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] placeholder:text-[hsl(var(--dm-text-faint))] text-sm leading-[22px]"
        />
        <Button
          className="h-11 px-4 shrink-0"
          disabled={!canSubmit}
          onClick={onSubmit}
          aria-label="Send action"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[hsl(var(--dm-text-faint))]">
        <span>
          Playing as <span className="text-[hsl(var(--dm-text-muted))] font-medium">{playingAs}</span>
        </span>
        {connected ? (
          <span className="text-emerald-500">Live</span>
        ) : (
          <span className="dm-danger-text">Reconnecting</span>
        )}
      </div>
    </div>
  );
}
