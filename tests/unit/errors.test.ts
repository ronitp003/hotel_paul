import { describe, it, expect } from "vitest";
import {
  AppError,
  errorResult,
  successResult,
  ERROR_MESSAGES,
} from "@/lib/errors";

describe("lib/errors (Application Errors & Results)", () => {
  it("creates AppError with mapped code and message", () => {
    const err = new AppError("ROOM_OVERLAP");
    expect(err.code).toBe("ROOM_OVERLAP");
    expect(err.message).toBe(ERROR_MESSAGES.ROOM_OVERLAP);
    expect(err.name).toBe("AppError");
  });

  it("creates errorResult object for Server Actions", () => {
    const res = errorResult("UNAUTHORIZED");
    expect(res.ok).toBe(false);
    expect(res.code).toBe("UNAUTHORIZED");
    expect(res.message).toBe(ERROR_MESSAGES.UNAUTHORIZED);
  });

  it("creates successResult object for Server Actions", () => {
    const res = successResult({ roomId: "101" });
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ roomId: "101" });
  });
});
