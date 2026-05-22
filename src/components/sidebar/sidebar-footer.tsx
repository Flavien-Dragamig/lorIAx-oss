"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Settings, LogOut, Moon, Sun, Users } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { PresenceBadge } from "@/components/ui/presence-badge";
import { useMyStatus } from "@/hooks/use-my-status";
import { useTheme } from "@/contexts/theme-context";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface SidebarFooterProps {
  user: {
    name?: string | null;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export function SidebarFooter({ user }: SidebarFooterProps) {
  const { effectiveStatus } = useMyStatus();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="p-3 border-t border-sidebar-border">
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex flex-1 min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sidebar-accent transition-colors text-left cursor-pointer" />
            }
          >
            {user && (
              <div className="relative shrink-0">
                <UserAvatar email={user.email} avatarUrl={user.avatarUrl} size={32} />
                <PresenceBadge status={effectiveStatus} size="sm" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate leading-tight">{user?.email}</p>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal pb-2">
                <div className="flex items-center gap-2">
                  {user && (
                    <div className="relative shrink-0">
                      <UserAvatar email={user.email} avatarUrl={user.avatarUrl} size={28} />
                      <PresenceBadge status={effectiveStatus} size="sm" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <p className="font-medium text-sm truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleDarkMode}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? "Mode clair" : "Mode sombre"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.dispatchEvent(new CustomEvent("loriax:toggle-team-panel"))}
            >
              <Users className="h-4 w-4" />
              Mon équipe
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="h-4 w-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

        <NotificationsDropdown />
      </div>
    </div>
  );
}
