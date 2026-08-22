/**
 * Safe fetch client for Next.js / Vercel frontend.
 * - Handles Vercel Security Challenges / Bot Mitigation automatically.
 * - Prevents JSON parse errors on HTML response pages (e.g. <!DOCTYPE html>).
 * - Extracts clean error messages.
 */

let isReloadingForChallenge = false;

/**
 * Parses response safely and handles Vercel edge challenges.
 * @param {Response} response 
 * @returns {Promise<any>} Parsed JSON or throws formatted Error
 */
export async function handleApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isVercelChallenge =
    response.status === 403 &&
    (response.headers.get("x-vercel-mitigated") === "challenge" ||
      Boolean(response.headers.get("x-vercel-challenge-token")));

  // 1. If Vercel blocked background API with a browser challenge
  if (isVercelChallenge) {
    if (typeof window !== "undefined" && !isReloadingForChallenge) {
      const lastReload = Number(sessionStorage.getItem("vercel_challenge_reload_time") || "0");
      const now = Date.now();

      // Only reload if we haven't reloaded in the last 15 seconds (prevents loops)
      if (now - lastReload > 15000) {
        isReloadingForChallenge = true;
        sessionStorage.setItem("vercel_challenge_reload_time", String(now));
        console.warn("[API] Vercel security challenge detected. Reloading for browser verification...");
        window.location.reload();
      }
    }
    throw new Error("Security verification required. Refreshing page...");
  }

  // 2. Safe JSON parsing
  const isJson = contentType.includes("application/json");
  let data = null;

  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    // If server returned HTML (error page, 502/504, or 403), read as text without crashing JSON parser
    const rawText = await response.text().catch(() => "");
    if (!response.ok) {
      if (rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
        throw new Error(`Server returned ${response.status} (${response.statusText || "HTML Error Page"}).`);
      }
      throw new Error(rawText || `Request failed with status ${response.status}`);
    }
  }

  // 3. Handle non-2xx status codes
  if (!response.ok) {
    const errorMsg =
      data?.error ||
      data?.message ||
      (typeof data === "string" ? data : null) ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Fetch wrapper that automatically parses JSON and handles errors / challenges.
 * @param {string} url 
 * @param {RequestInit} [options] 
 * @returns {Promise<any>}
 */
export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  return handleApiResponse(response);
}

/**
 * Safe fetch wrapper that returns the raw Response, but verifies against Vercel challenges.
 * @param {string} url 
 * @param {RequestInit} [options] 
 * @returns {Promise<Response>}
 */
export async function safeFetch(url, options = {}) {
  const response = await fetch(url, options);

  const isVercelChallenge =
    response.status === 403 &&
    (response.headers.get("x-vercel-mitigated") === "challenge" ||
      Boolean(response.headers.get("x-vercel-challenge-token")));

  if (isVercelChallenge) {
    if (typeof window !== "undefined" && !isReloadingForChallenge) {
      const lastReload = Number(sessionStorage.getItem("vercel_challenge_reload_time") || "0");
      const now = Date.now();
      if (now - lastReload > 15000) {
        isReloadingForChallenge = true;
        sessionStorage.setItem("vercel_challenge_reload_time", String(now));
        window.location.reload();
      }
    }
    throw new Error("Security verification required. Refreshing page...");
  }

  return response;
}
