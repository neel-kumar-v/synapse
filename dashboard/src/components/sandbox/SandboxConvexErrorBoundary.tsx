"use client";

import { Component, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class SandboxConvexErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.message ?? String(this.state.error);
      const isConvexSync =
        /Could not find public function|forget to run.*convex dev/i.test(msg);

      return (
        <div className="mx-auto max-w-[560px] px-6 py-12">
          <Alert variant="destructive">
            <AlertTitle>
              {isConvexSync ? "Convex backend not synced" : "Something went wrong"}
            </AlertTitle>
            <AlertDescription>
              {isConvexSync ? (
                <>
                  Run{" "}
                  <code className="font-mono text-destructive-foreground">
                    npm run convex:dev
                  </code>{" "}
                  in the <strong>dashboard</strong> directory so the sandboxes
                  functions are pushed to your dev deployment, then refresh.
                </>
              ) : (
                msg
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}
