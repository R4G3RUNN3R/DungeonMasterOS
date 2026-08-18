import { useMemo, useState } from "react";
import { BookOpen, Sparkles, ScrollText, Globe2, Flag, CheckCircle2, AlertCircle } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type ParsedSection = {
  label: string;
  type?: string;
  entries?: Array<{
    key?: string;
    name?: string;
    value?: string;
    description?: string;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traits: string;
  backstory: string;
  characterData: string;
  worldState?: string;
  onSubmitReport: (description: string) => Promise<void>;
};

function safeParseCharacterData(raw: string): { sections: ParsedSection[] } {
  try {
    const parsed = JSON.parse(raw || "{}");
    return { sections: Array.isArray(parsed.sections) ? parsed.sections : [] };
  } catch {
    return { sections: [] };
  }
}

type WorldMemory = {
  summary?: string;
  activeThreads?: string[];
  discoveredFacts?: string[];
  npcNotes?: string[];
  recentConsequences?: string[];
};

function safeParseWorldState(raw?: string): { currentScene?: string; memory?: WorldMemory } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return { currentScene: parsed.currentScene, memory: parsed.memory };
  } catch {
    return {};
  }
}

function MemoryList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</div>
      <ul className="space-y-1">
        {items.map((entry, idx) => (
          <li key={idx} className="text-sm text-foreground/90 pl-3 border-l-2 border-border">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CodexModal({
  open,
  onOpenChange,
  traits,
  backstory,
  characterData,
  worldState,
  onSubmitReport,
}: Props) {
  const parsedCharacterData = useMemo(() => safeParseCharacterData(characterData), [characterData]);
  const parsedWorldState = useMemo(() => safeParseWorldState(worldState), [worldState]);

  const [reportText, setReportText] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmitReport() {
    if (!reportText.trim()) return;
    setReportSubmitting(true);
    setReportStatus("idle");
    try {
      await onSubmitReport(reportText.trim());
      setReportStatus("success");
      setReportText("");
    } catch {
      setReportStatus("error");
    } finally {
      setReportSubmitting(false);
    }
  }

  const grantedAbilitiesSection = useMemo(
    () =>
      parsedCharacterData.sections.find(
        (section) =>
          String(section.label || "").toLowerCase() === "granted abilities" ||
          String(section.type || "").toLowerCase() === "abilities",
      ),
    [parsedCharacterData],
  );

  const otherSections = useMemo(
    () =>
      parsedCharacterData.sections.filter((section) => {
        const label = String(section.label || "").toLowerCase();
        return (
          label !== "granted abilities" &&
          label !== "currency" &&
          label !== "inventory" &&
          label !== "items"
        );
      }),
    [parsedCharacterData],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Codex
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="backstory">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="backstory">Backstory</TabsTrigger>
            <TabsTrigger value="traits">Traits</TabsTrigger>
            <TabsTrigger value="abilities">Abilities</TabsTrigger>
            <TabsTrigger value="world">World State</TabsTrigger>
          </TabsList>

          <TabsContent value="backstory">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {backstory?.trim() || "No backstory entered."}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="traits">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {traits?.trim() || "No traits entered."}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="abilities" className="space-y-4">
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Abilities &amp; Features
              </div>

              {grantedAbilitiesSection?.entries?.length ? (
                <div className="space-y-2">
                  {grantedAbilitiesSection.entries.map((entry, idx) => (
                    <div
                      key={`${entry.key || entry.name || "ability"}-${idx}`}
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{entry.name || entry.key || "Ability"}</div>
                      {(entry.description || entry.value) && (
                        <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {entry.description || entry.value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No tracked granted abilities yet.</div>
              )}
            </Card>

            {otherSections.map((section, sectionIndex) => (
              <Card key={`${section.label}-${sectionIndex}`} className="p-4 space-y-3">
                <div className="font-medium flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-muted-foreground" />
                  {section.label || "Section"}
                </div>

                {section.entries?.length ? (
                  <div className="space-y-2">
                    {section.entries.map((entry, entryIndex) => (
                      <div
                        key={`${entry.key || entry.name || "entry"}-${entryIndex}`}
                        className="rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div className="font-medium">{entry.name || entry.key || "Entry"}</div>
                        {(entry.description || entry.value) && (
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {entry.description || entry.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No entries.</div>
                )}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="world">
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium">
                <Globe2 className="w-4 h-4 text-orange-400" />
                Current Story
              </div>

              {parsedWorldState.currentScene && (
                <div className="text-sm text-foreground/90 rounded-lg border border-border p-3 whitespace-pre-wrap">
                  {parsedWorldState.currentScene}
                </div>
              )}

              {parsedWorldState.memory?.summary && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {parsedWorldState.memory.summary}
                </div>
              )}

              {!parsedWorldState.currentScene && !parsedWorldState.memory?.summary && (
                <div className="text-sm text-muted-foreground">
                  The story hasn't started yet — nothing recorded.
                </div>
              )}

              <div className="space-y-4">
                <MemoryList title="Active Threads" items={parsedWorldState.memory?.activeThreads} />
                <MemoryList title="Discovered Facts" items={parsedWorldState.memory?.discoveredFacts} />
                <MemoryList title="NPC Notes" items={parsedWorldState.memory?.npcNotes} />
                <MemoryList title="Recent Consequences" items={parsedWorldState.memory?.recentConsequences} />
              </div>
            </Card>

            <Card className="p-4 space-y-3 mt-4">
              <div className="flex items-center gap-2 font-medium">
                <Flag className="w-4 h-4 text-amber-500" />
                Something look wrong?
              </div>
              <div className="text-xs text-muted-foreground">
                If the DM contradicted itself, teleported you somewhere with no explanation, or
                anything else above looks broken — paste the part that's wrong or just describe
                it in your own words. This goes straight to the team, along with the current
                world state for context.
              </div>

              <Textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="e.g. 'Reality shifted without warning' — I was in a stone chamber and suddenly I'm in a market with no transition."
                rows={4}
                className="text-sm"
              />

              {reportStatus === "success" && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sent — thanks for flagging it.
                </div>
              )}
              {reportStatus === "error" && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Couldn't send that just now. Try again in a moment.
                </div>
              )}

              <Button
                size="sm"
                disabled={!reportText.trim() || reportSubmitting}
                onClick={handleSubmitReport}
              >
                {reportSubmitting ? "Sending..." : "Report a Bug"}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
