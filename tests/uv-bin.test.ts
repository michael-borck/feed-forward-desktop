import { describe, expect, it } from "vitest";
import { uvBinaryName } from "../electron/uv-bin";

describe("uvBinaryName", () => {
  it("maps each supported platform/arch to its bundled binary", () => {
    expect(uvBinaryName("darwin", "arm64")).toBe("uv-aarch64-apple-darwin");
    expect(uvBinaryName("darwin", "x64")).toBe("uv-x86_64-apple-darwin");
    expect(uvBinaryName("win32", "x64")).toBe("uv-x86_64-pc-windows-msvc.exe");
    expect(uvBinaryName("linux", "x64")).toBe("uv-x86_64-unknown-linux-gnu");
  });

  it("falls back to PATH uv for unsupported combinations", () => {
    expect(uvBinaryName("linux", "arm64")).toBe("uv");
    expect(uvBinaryName("freebsd", "x64")).toBe("uv");
  });
});
