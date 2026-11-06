"use client";

import { useEffect, useState } from "react";
import { OfflineBanner } from "./StatusChips";

export default function OfflineBannerClient() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return <OfflineBanner />;
}
