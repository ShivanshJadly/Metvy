"use client";

import { ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut } from "next-auth/react"; // Use client-side signOut
import { useTheme } from "next-themes";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { toast } from "./toast";

export function SidebarUserNav({ user }: { user: User }) {
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();

	const handleNavigation = (path: string) => {
		router.push(path);
	};

	const handleSignOut = async () => {
		try {
			await signOut({ redirect: false });

			router.push("/");

			router.refresh();
		} catch (error) {
			console.error("Error signing out:", error);
			toast({
				type: "error",
				description: "Something went wrong while signing out.",
			});
		}
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							data-testid="user-nav-button"
							size="lg"
						>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-muted-foreground text-xs">
									{user.email}
								</span>
							</div>
							<ChevronUp className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-popper-anchor-width]"
						data-testid="user-nav-menu"
						side="top"
					>
						{/* Theme Toggle */}
						<DropdownMenuItem
							className="cursor-pointer"
							data-testid="user-nav-item-theme"
							onSelect={() =>
								setTheme(resolvedTheme === "dark" ? "light" : "dark")
							}
						>
							{`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
						</DropdownMenuItem>

						<DropdownMenuSeparator />

						{/* Adjusted link to match your dashboard page structure */}
						<DropdownMenuItem
							className="cursor-pointer"
							onSelect={() => handleNavigation("/dashboard/requests")}
						>
							<span>Your Requests</span>
						</DropdownMenuItem>

						<DropdownMenuSeparator />

						{/* Admin Section */}
						{user.role === "admin" && (
							<>
								<DropdownMenuLabel className="font-semibold text-muted-foreground text-xs">
									Admin
								</DropdownMenuLabel>

								<DropdownMenuItem
									className="cursor-pointer"
									onSelect={() => handleNavigation("/admin")}
								>
									<span>Dashboard</span>
								</DropdownMenuItem>

								<DropdownMenuItem
									className="cursor-pointer"
									onSelect={() => handleNavigation("/admin/conversations")}
								>
									<span>Conversations</span>
								</DropdownMenuItem>

								<DropdownMenuItem
									className="cursor-pointer"
									onSelect={() => handleNavigation("/upload")}
								>
									<span>Resume Management</span>
								</DropdownMenuItem>

								<DropdownMenuItem
									className="cursor-pointer"
									onSelect={() => handleNavigation("/admin/requests")}
								>
									<span>Resume Requests</span>
								</DropdownMenuItem>
							</>
						)}

						{/* Sign Out */}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="cursor-pointer text-red-600 dark:text-red-400"
							onSelect={handleSignOut}
						>
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
