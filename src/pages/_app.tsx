// src/pages/_app.tsx
import type { AppProps } from "next/app";
import React from "react";
import "@/styles/globals.css";
import { AppModelProvider } from "../state/app-model";
import GlobalDisclaimerGate from "@/components/ui/GlobalDisclaimerGate";
import { UIFlagsProvider } from "@/state/ui-flags";

export default function MyApp({ Component, pageProps }: AppProps) {
  const [disclaimerOpen, setDisclaimerOpen] = React.useState(false);

  return (
    <AppModelProvider>
      <UIFlagsProvider value={{ disclaimerOpen }}>
        <GlobalDisclaimerGate onOpenChange={setDisclaimerOpen} />
        <Component {...pageProps} />
      </UIFlagsProvider>
    </AppModelProvider>
  );
}
