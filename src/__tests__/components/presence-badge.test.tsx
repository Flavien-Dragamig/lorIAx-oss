// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PresenceBadge } from "@/components/ui/presence-badge";

describe("PresenceBadge", () => {
  it("rend un span avec la couleur online (#22c55e)", () => {
    const { container } = render(<PresenceBadge status="online" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.style.backgroundColor).toBe("rgb(34, 197, 94)");
  });

  it("rend la couleur dnd (#ef4444)", () => {
    const { container } = render(<PresenceBadge status="dnd" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.backgroundColor).toBe("rgb(239, 68, 68)");
  });

  it("applique la taille sm (8px)", () => {
    const { container } = render(<PresenceBadge status="online" size="sm" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.width).toBe("8px");
    expect(badge.style.height).toBe("8px");
  });

  it("applique la taille lg (12px) si size=lg", () => {
    const { container } = render(<PresenceBadge status="online" size="lg" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.width).toBe("12px");
    expect(badge.style.height).toBe("12px");
  });
});
