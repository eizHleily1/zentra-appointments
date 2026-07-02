import { render, screen } from "@testing-library/react-native";
import App from "./App";

describe("App", () => {
  it("renders the mobile MVP auth entry screen", () => {
    render(<App />);

    expect(screen.getByText("Zentra MVP")).toBeTruthy();
    expect(screen.getByText("Auth")).toBeTruthy();
    expect(screen.getByText("Register")).toBeTruthy();
    expect(screen.getByText("Login")).toBeTruthy();
  });
});
