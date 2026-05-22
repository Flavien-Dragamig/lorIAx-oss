"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  MessageSquare,
  AtSign,
  Share2,
  Reply,
  CheckCheck,
  Calendar,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VizHashAvatar } from "@/components/ui/vizhash-avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface NotificationActor {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Notification {
  id: string;
  type: "mention" | "comment" | "reply" | "share" | "calendar_reminder" | "calendar_invitation" | "task_assigned" | "chat_message";
  title: string;
  message: string | null;
  read: boolean;
  createdAt: string;
  documentId: string | null;
  documentTitle: string | null;
  spaceSlug: string | null;
  actor: NotificationActor | null;
}

const typeIcons: Record<Notification["type"], typeof Bell> = {
  mention: AtSign,
  comment: MessageSquare,
  reply: Reply,
  share: Share2,
  calendar_reminder: Calendar,
  calendar_invitation: Calendar,
  task_assigned: CheckSquare,
  chat_message: MessageSquare,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationsDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [_loading, _setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Polling toutes les 30 secondes
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setOpen(false);
  };

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setOpen(false);
    if (notification.documentId && notification.spaceSlug) {
      router.push(`/s/${notification.spaceSlug}/${notification.documentId}`);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 relative hover:bg-sidebar-accent"
            title="Notifications"
          />
        }
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-80"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Notifications
          </p>
          {unreadCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Tout marquer lu
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">Aucune notification</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              return (
                <button
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={`flex items-start gap-3 px-2 py-2.5 text-left rounded-md transition-colors hover:bg-accent/50 ${
                    !notification.read ? "bg-accent/20" : ""
                  }`}
                >
                  {notification.actor?.email ? (
                    <VizHashAvatar
                      email={notification.actor.email}
                      size={28}
                      className="mt-0.5"
                    />
                  ) : (
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        !notification.read
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-tight ${
                        !notification.read ? "font-medium" : ""
                      }`}
                    >
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
