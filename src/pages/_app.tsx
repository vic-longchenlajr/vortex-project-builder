// src/pages/_app.tsx
import type { AppProps } from "next/app";
import "@/styles/globals.css";
import { AppModelProvider } from "../state/app-model";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppModelProvider>
      <Component {...pageProps} />
    </AppModelProvider>
  );
}
