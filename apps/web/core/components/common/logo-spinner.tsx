/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import LoadingAnimation from "@/app/assets/animations/loading.json?url";

interface LogoSpinnerProps {
  onFirstLoopComplete?: () => void;
}

export function LogoSpinner({ onFirstLoopComplete }: LogoSpinnerProps = {}) {
  const animationContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isDisposed = false;
    let hasNotified = false;
    let destroyAnimation: (() => void) | undefined;
    const notifyFirstLoopComplete = () => {
      if (isDisposed || hasNotified) return;
      hasNotified = true;
      onFirstLoopComplete?.();
    };

    import("lottie-web")
      .then(({ default: lottie }) => {
        if (isDisposed || !animationContainerRef.current) return null;

        const animation = lottie.loadAnimation({
          container: animationContainerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: LoadingAnimation,
        });

        animation.setSpeed(1.5);
        animation.addEventListener("loopComplete", notifyFirstLoopComplete);
        animation.addEventListener("data_failed", notifyFirstLoopComplete);
        destroyAnimation = () => {
          animation.removeEventListener("loopComplete", notifyFirstLoopComplete);
          animation.removeEventListener("data_failed", notifyFirstLoopComplete);
          animation.destroy();
        };

        return animation;
      })
      .catch((error: unknown) => {
        console.error("Failed to load the loading animation.", error);
        notifyFirstLoopComplete();
      });

    return () => {
      isDisposed = true;
      destroyAnimation?.();
    };
  }, [onFirstLoopComplete]);

  return (
    <div className="flex items-center justify-center" role="status" aria-label="Loading">
      <div ref={animationContainerRef} aria-hidden="true" className="h-60 w-60 sm:h-60 sm:w-60" />
    </div>
  );
}
