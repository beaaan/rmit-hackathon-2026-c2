import { useCallback, useEffect, useState } from "react";
import { CONTROLLER_URL } from "./controller.js";

export function usePoll(load, ms) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const res = await load();
      setData(res.data);
      setError(null);
    } catch {
      setError(`Can't reach the plant controller at ${CONTROLLER_URL}.`);
    }
  }, [load]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, ms);
    return () => clearInterval(timer);
  }, [refresh, ms]);
  return [data, error, refresh];
}

export const clock = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const kpa = (v) => Math.round(v).toLocaleString("en-AU");
export const signed = (v, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
export const actorName = (actor) => actor?.username ?? actor?.claimed ?? "unknown";
