import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectDropdown } from "@/components/ui/select-dropdown";

describe("SelectDropdown layout shift prevention", () => {
  it("keeps constant child count in space-y container when opened and closed", async () => {
    render(
      <div className="space-y-1.5" data-testid="container">
        <label htmlFor="test-select">Gender *</label>
        <SelectDropdown
          id="test-select"
          value="MALE"
          onChange={() => {}}
          options={[
            { value: "MALE", label: "Male" },
            { value: "FEMALE", label: "Female" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <div data-testid="below-element">Next Form Field / Error</div>
      </div>
    );

    const testContainer = screen.getByTestId("container");
    // Initially: <label>, <div> (wrapper), <div data-testid="below-element">
    expect(testContainer.children.length).toBe(3);
    expect(testContainer.children[0].tagName.toLowerCase()).toBe("label");
    expect(testContainer.children[1].tagName.toLowerCase()).toBe("div");
    expect(testContainer.children[2].getAttribute("data-testid")).toBe("below-element");

    // Click to open the dropdown
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // After opening: The container MUST STILL have EXACTLY 3 children!
    // No focus guards or portal elements are injected as siblings in space-y container!
    expect(testContainer.children.length).toBe(3);
    expect(testContainer.children[0].tagName.toLowerCase()).toBe("label");
    expect(testContainer.children[1].tagName.toLowerCase()).toBe("div");
    expect(testContainer.children[2].getAttribute("data-testid")).toBe("below-element");
  });
});
