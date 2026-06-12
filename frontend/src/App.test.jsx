import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

global.fetch = vi.fn();

import App from "./App";

beforeEach(() => {
  localStorage.clear();
  fetch.mockReset();
});

describe("App", () => {
  it("shows auth screen when no token saved", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Log in")).toBeInTheDocument();
    });
  });

  it("shows auth screen when token is invalid", async () => {
    localStorage.setItem("ghost_token", "bad-token");
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Log in")).toBeInTheDocument();
    });
  });
});
