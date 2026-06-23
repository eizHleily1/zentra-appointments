import { render, screen } from "@testing-library/react-native";
import App from "./App";

describe("App", () => {
  it("renders the Phase 1 placeholder screen", () => {
    render(<App />);

    expect(screen.getByText("Appointment SaaS")).toBeTruthy();
    expect(screen.getByText("Foundation Setup Complete")).toBeTruthy();
  });
});
