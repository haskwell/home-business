// Unguessable, URL-safe token (16 random bytes -> 22 chars) used for public tracking links.
export function generateTrackingToken(bytes = 16): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
