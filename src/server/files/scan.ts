/**
 * Malware scanning behind one interface. `eicar` detects the industry test
 * signature so the rejection path can be exercised in dev and CI; production
 * should use a real scanner adapter (ClamAV sidecar or a managed scanning
 * API) added here.
 */
export type ScanResult = "clean" | "infected" | "unscanned";
export interface MalwareScanner {
  name: string;
  scan(bytes: Uint8Array): Promise<ScanResult>;
}

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export const eicarScanner: MalwareScanner = {
  name: "eicar",
  async scan(bytes) {
    const head = Buffer.from(bytes.slice(0, 4096)).toString("latin1");
    return head.includes(EICAR) ? "infected" : "clean";
  },
};

export const noScanner: MalwareScanner = { name: "none", async scan() { return "unscanned"; } };

export function getScanner(kind: string): MalwareScanner {
  return kind === "eicar" ? eicarScanner : noScanner;
}
