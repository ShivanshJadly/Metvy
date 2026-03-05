import { cookies } from "next/headers";
import { auth } from "@/app/(auth)/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAdmin } from "@/lib/admin/auth";

export const experimental_ppr = true;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  await requireAdmin();

  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <DataStreamProvider>
      <SidebarProvider defaultOpen={!isCollapsed}>
        <AppSidebar user={session?.user} />
        <SidebarInset>
          <div className="flex min-h-screen w-full flex-col space-y-6 px-4">
            <div className="container grid flex-1 gap-12">
              <main className="flex w-full flex-1 flex-col overflow-hidden">
                {children}
              </main>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DataStreamProvider>
  );
}
