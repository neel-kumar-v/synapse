"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Dashboard content. Add chart-area-interactive, section-cards,
            sidebar/app-sidebar, sidebar/data-table, and site-header components
            when ready.
          </p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
