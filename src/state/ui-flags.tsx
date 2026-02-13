import React, { createContext, useContext } from "react";

/* -------------------------------------------------------------------------- */
/*                                 UI FLAGS                                   */
/* -------------------------------------------------------------------------- */

type UIFlags = { disclaimerOpen: boolean };
const UIFlagsContext = createContext<UIFlags>({ disclaimerOpen: false });

export function UIFlagsProvider({
  value,
  children,
}: {
  value: UIFlags;
  children: React.ReactNode;
}) {
  return (
    <UIFlagsContext.Provider value={value}>{children}</UIFlagsContext.Provider>
  );
}

export function useUIFlags() {
  return useContext(UIFlagsContext);
}
