"use client";

import { useState } from "react";
import { dismissNotification, useStore } from "@/lib/store";
import { requestBrowserNotificationPermission } from "@/lib/notifications";

export default function NotificationToast() {
  const notifications = useStore((s) => s.notifications ?? []);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default",
  );

  const latest = notifications[0];
  if (!latest) return null;

  const handleEnableDesktop = async () => {
    const granted = await requestBrowserNotificationPermission();
    setBrowserPermission(granted ? "granted" : "denied");
  };

  return (
    <aside
      aria-live="polite"
      aria-label="Recent activity alert"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-full p-2 pointer-events-none"
    >
      <div className="flyer pointer-events-auto rounded-md border-2 border-ink bg-paper p-3.5 shadow-2xl animate-dialog-in space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2 animate-ping rounded-full bg-signal" />
            <h4 className="font-bold text-sm text-ink">{latest.title}</h4>
          </div>
          <button
            onClick={() => dismissNotification(latest.id)}
            aria-label="Dismiss notification"
            className="text-xs text-muted hover:text-ink font-bold px-1"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-ink leading-snug">{latest.body}</p>

        {browserPermission === "default" && (
          <div className="tear-t pt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Get desktop alerts?</span>
            <button
              onClick={handleEnableDesktop}
              className="font-bold text-neel underline underline-offset-2 hover:text-ink"
            >
              Enable
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
