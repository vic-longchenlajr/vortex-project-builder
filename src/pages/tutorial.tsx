import React, { useEffect } from "react";
import { useRouter } from "next/router";

export default function TutorialRedirect(): JSX.Element | null {
  const router = useRouter();

  useEffect(() => {
    router.replace("/configurator?tutorial=1&mode=temp");
  }, [router]);

  return null;
}
