import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

global.fetch = vi.fn();

import App from "./App";

beforeEach(() => {
  localStorage.clear();
  fetch.mockReset();
});

// ── Initial render ────────────────────────────────────────────
describe("Initial render", () => {
  it("shows landing page when no token saved", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Find your/i)).toBeInTheDocument();
    });
  });

  it("shows ghost branding on landing", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText(/GHOST/i).length).toBeGreaterThan(0);
    });
  });

  it("shows upload hint on landing", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Drop your bank CSV here/i)).toBeInTheDocument();
    });
  });
});

// ── Token handling ────────────────────────────────────────────
describe("Token handling", () => {
  it("stays on landing when valid token exists", async () => {
    localStorage.setItem("ghost_token", "valid-token");
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, email: "test@example.com" }),
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Find your/i)).toBeInTheDocument();
    });
  });

  it("shows auth screen when token is invalid", async () => {
    localStorage.setItem("ghost_token", "bad-token");
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText("Log in").length).toBeGreaterThan(0);
    });
  });

  it("clears invalid token from localStorage", async () => {
    localStorage.setItem("ghost_token", "bad-token");
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<App />);
    await waitFor(() => {
      expect(localStorage.getItem("ghost_token")).toBeNull();
    });
  });
});

// ── Auth screen ───────────────────────────────────────────────
describe("Auth screen", () => {
  async function goToAuth() {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText(/Log in/i)[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText(/Log in/i)[0]);
    await waitFor(() => {
      expect(screen.getByText("Sign up")).toBeInTheDocument();
    });
  }
  it("shows login and signup tabs", async () => {
    await goToAuth();
    expect(screen.getAllByText("Log in").length).toBeGreaterThan(0);
    expect(screen.getByText("Sign up")).toBeInTheDocument();
  });

  it("shows email and password fields", async () => {
    await goToAuth();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your password")).toBeInTheDocument();
  });

  it("shows guest option", async () => {
    await goToAuth();
    expect(screen.getByText(/continue as guest/i)).toBeInTheDocument();
  });

  it("switches to signup mode", async () => {
    await goToAuth();
    fireEvent.click(screen.getByText("Sign up"));
    
    expect(screen.getAllByText("Create account").length).toBeGreaterThan(0);
  });

  it("navigates to landing after successful login", async () => {
    await goToAuth();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: "new-token",
        user: { id: 1, email: "test@example.com" },
      }),
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your password"), {
      target: { value: "pass1234" },
    });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(screen.getByText(/Export CSV/i)).toBeInTheDocument();
    });
  });

  it("guest button navigates to landing", async () => {
    await goToAuth();
    fireEvent.click(screen.getByText(/continue as guest/i));
    await waitFor(() => {
      expect(screen.getByText(/Find your/i)).toBeInTheDocument();
    });
  });
});

// ── Landing page ──────────────────────────────────────────────
describe("Landing page", () => {
  it("shows 3 how-it-works steps", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
      expect(screen.getByText("AI analysis")).toBeInTheDocument();
      expect(screen.getByText("See the ghosts")).toBeInTheDocument();
    });
  });

  it("shows supported banks", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Revolut")).toBeInTheDocument();
      expect(screen.getByText("Monzo")).toBeInTheDocument();
    });
  });

  it("shows login button when not logged in", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/log in/i)).toBeInTheDocument();
    });
  });
});
