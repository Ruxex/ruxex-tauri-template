import type { GlobalProvider } from "@ladle/react";
import { MemoryRouter } from "react-router-dom";

import "./index.css";

export const Provider: GlobalProvider = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);
