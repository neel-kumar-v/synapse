import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type SandboxHeroProps = {
  onNewSandbox: () => void;
};

export function SandboxHero({ onNewSandbox }: SandboxHeroProps) {
  return (
    <div className="text-center mb-10">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2 bg-linear-to-r from-indigo-300 via-violet-300 to-emerald-400 bg-clip-text text-transparent">
        Your Sandboxes
      </h1>
      <p className="text-muted-foreground text-[15px] max-w-[420px] mx-auto mb-6">
        Create isolated web app sandboxes and shape them with AI prompts.
      </p>
      <Button
        size="lg"
        onClick={onNewSandbox}
        className="bg-linear-to-r from-[#6c72cb] to-[#8187de] text-white hover:opacity-90 shadow-lg"
      >
        <Plus className="size-5" />
        New Sandbox
      </Button>
    </div>
  );
}
