import { ChildProcess, type SpawnOptions } from "node:child_process";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";
import { runRespawnedChild } from "../../node-runtime-recovery.mjs";

const spawn = vi.hoisted(() =>
  vi.fn<(command: string, args: string[], options: SpawnOptions) => ChildProcess>(),
);
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn,
}));

let child: ChildProcess;
let exit: MockInstance<typeof process.exit>;
beforeEach(() => {
  vi.useFakeTimers();
  child = new ChildProcess();
  vi.spyOn(child, "kill").mockReturnValue(true);
  spawn.mockReturnValue(child);
  exit = vi.spyOn(process, "exit").mockImplementation(vi.fn<typeof process.exit>());
  vi.spyOn(process, "kill").mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([
  { signal: "SIGINT", code: 130 },
  { signal: "SIGTERM", code: 143 },
  { signal: "SIGBREAK", code: 149 },
] as const)(
  "maps a forwarded win32 $signal to exit code $code exactly once",
  ({ signal, code }) => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    vi.spyOn(process, "argv", "get").mockReturnValue(["node", "openclaw.mjs", "gateway", "run"]);
    const previous = new Set(process.listeners(signal));
    runRespawnedChild("node", ["child.mjs"], {});
    const listener = process.listeners(signal).find((candidate) => !previous.has(candidate));
    expect(listener).toBeDefined();
    listener!(signal);
    child.emit("exit", null, signal);
    expect(exit).toHaveBeenCalledExactlyOnceWith(code);
  },
);
