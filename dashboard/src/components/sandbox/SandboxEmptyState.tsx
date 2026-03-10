import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

type SandboxEmptyStateProps = {
  onInviteTesters?: () => void;
};

export function SandboxEmptyState({ onInviteTesters }: SandboxEmptyStateProps) {
  return (
    <Card
      className="border-dashed text-center py-14 px-6 cursor-pointer transition-colors hover:border-primary hover:bg-muted/30"
      role={onInviteTesters ? "button" : undefined}
      onClick={onInviteTesters}
      onKeyDown={
        onInviteTesters
          ? (e) => (e.key === "Enter" || e.key === " ") && onInviteTesters()
          : undefined
      }
      tabIndex={onInviteTesters ? 0 : undefined}
    >
      <CardContent className="p-0 flex flex-col items-center gap-3">
        <p className="text-muted-foreground text-[15px]">
          Invite your first testers!
        </p>
        {onInviteTesters && (
          <span className="inline-flex items-center gap-1.5 text-sm text-primary">
            <Plus className="size-4" />
            Invite testers
          </span>
        )}
      </CardContent>
    </Card>
  );
}
