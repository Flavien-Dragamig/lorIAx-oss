"use client";

import { useState, useEffect, useCallback } from "react";

interface NetworkStatus {
  /** Browser navigator.onLine flag */
  isOnline: boolean;
  /** True when the server responds to /api/ping */
  isServerReachable: boolean;
}

const SERVER_CHECK_INTERVAL = 30_000; // 30 seconds
const SERVER_CHECK_TIMEOUT = 5_000; // 5 seconds

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);

  const checkServer = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        SERVER_CHECK_TIMEOUT,
      );

      const response = await fetch("/api/ping", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsServerReachable(response.ok);
    } catch {
      setIsServerReachable(false);
    }
  }, []);

  useEffect(() => {
    // Synchronize initial state
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      // Re-check server when coming back online
      checkServer();
    }

    function handleOffline() {
      setIsOnline(false);
      setIsServerReachable(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic server reachability check
    checkServer();
    const interval = setInterval(checkServer, SERVER_CHECK_INTERVAL);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkServer]);

  return { isOnline, isServerReachable };
}
