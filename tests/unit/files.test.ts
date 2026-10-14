import { describe, expect, it } from "vitest";
import { eicarScanner, noScanner } from "@/server/files/scan";
import { cleanFileName, sniffMime } from "@/server/files/sniff";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniffMime", () => {
  it("recognises allowed formats by magic bytes", () => {
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMime(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffMime(new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic")]))).toBe("image/heic");
  });
  it("rejects everything else, whatever the name claims", () => {
    expect(sniffMime(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffMime(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // Windows executable
    expect(sniffMime(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // zip/docx
    expect(sniffMime(new Uint8Array())).toBeNull();
  });
});

describe("cleanFileName", () => {
  it("strips paths and control characters", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("C:\\Users\\a\\statement.pdf")).toBe("statement.pdf");
    expect(cleanFileName('bad<>:"|?*name.jpg')).toBe("badname.jpg");
    expect(cleanFileName("")).toBe("file");
  });
});

describe("malware scanners", () => {
  it("eicar scanner flags the test signature", async () => {
    const eicar = new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    expect(await eicarScanner.scan(eicar)).toBe("infected");
    expect(await eicarScanner.scan(new TextEncoder().encode("%PDF-1.7 hello"))).toBe("clean");
  });
  it("no-op scanner reports unscanned", async () => {
    expect(await noScanner.scan(new Uint8Array([1]))).toBe("unscanned");
  });
});
