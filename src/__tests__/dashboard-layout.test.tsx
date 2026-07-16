import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DashboardLayout from "@/components/DashboardLayout";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("DashboardLayout", () => {
  it("provides an accessible mobile navigation toggle", () => {
    render(
      <DashboardLayout>
        <p>Dashboard content</p>
      </DashboardLayout>,
    );

    const openButton = screen.getByRole("button", {
      name: "ナビゲーションを開く",
    });
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Dashboard content")).toBeVisible();
  });
});
