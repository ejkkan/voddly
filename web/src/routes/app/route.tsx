import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Sidebar } from "~/components/layout/Sidebar";

export const Route = createFileRoute("/app")({
  component: AppLayout,
  beforeLoad: async ({ context }) => {
    // Protect all app routes - redirect to login if not authenticated
    if (!context.user) {
      throw redirect({ to: "/login" });
    }
  },
});

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 ml-64">
        <Outlet />
      </main>
    </div>
  );
}
