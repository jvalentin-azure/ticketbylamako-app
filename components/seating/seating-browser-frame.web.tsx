import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { isAllowedWebViewUrl } from "@/lib/webview-policy";

interface SeatingBrowserFrameProps {
  source: { uri: string };
  style?: StyleProp<ViewStyle>;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onNavigationStateChange?: (state: { url: string }) => void;
  onLoadEnd?: () => void;
  onError?: (event: { nativeEvent: { description: string } }) => void;
}

export interface SeatingBrowserFrameHandle {
  injectJavaScript: (script: string) => void;
  reload: () => void;
}

interface SeatingChildWindow extends Window {
  ReactNativeWebView?: { postMessage: (data: unknown) => void };
  lamakoMobileBack?: () => void;
  lamakoOpenSeatingChart?: () => void;
  lamakoPrimarySeatActionFromApp?: () => void;
  lamakoGoToCheckoutFromApp?: () => void;
}

const SeatingBrowserFrame = forwardRef<
  SeatingBrowserFrameHandle,
  SeatingBrowserFrameProps
>(function SeatingBrowserFrame(
  { source, style, onMessage, onNavigationStateChange, onLoadEnd, onError },
  forwardedRef,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  let expectedOrigin = "";
  try {
    expectedOrigin = new URL(source.uri, window.location.origin).origin;
  } catch {}

  const relayMessage = useCallback((data: unknown) => {
    const serialized = typeof data === "string" ? data : JSON.stringify(data);
    onMessageRef.current?.({ nativeEvent: { data: serialized } });
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== expectedOrigin) return;
      const payload =
        event.data && typeof event.data === "object" && "data" in event.data
          ? event.data.data
          : event.data;
      relayMessage(payload);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [expectedOrigin, relayMessage]);

  const installBridge = useCallback(() => {
    const childWindow = iframeRef.current
      ?.contentWindow as SeatingChildWindow | null;
    if (!childWindow) return;
    try {
      Object.defineProperty(childWindow, "ReactNativeWebView", {
        configurable: true,
        value: { postMessage: relayMessage },
      });
    } catch {
      // The first-party seating page is same-origin. If a provider navigates
      // the frame cross-origin, browser isolation correctly disables access.
    }
  }, [relayMessage]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      injectJavaScript(script: string) {
        const childWindow = iframeRef.current
          ?.contentWindow as SeatingChildWindow | null;
        if (!childWindow) return;
        try {
          if (script.includes("lamakoMobileBack")) {
            childWindow.lamakoMobileBack?.();
          } else if (script.includes("lamakoOpenSeatingChart")) {
            childWindow.lamakoOpenSeatingChart?.();
          } else if (script.includes("lamakoPrimarySeatActionFromApp")) {
            if (childWindow.lamakoPrimarySeatActionFromApp) {
              childWindow.lamakoPrimarySeatActionFromApp();
            } else {
              childWindow.lamakoGoToCheckoutFromApp?.();
            }
          }
        } catch {
          // Cross-origin pages cannot be scripted by the application shell.
        }
      },
      reload() {
        const frame = iframeRef.current;
        if (frame) frame.src = frame.src;
      },
    }),
    [],
  );

  if (!expectedOrigin || !isAllowedWebViewUrl(source.uri, "first-party")) {
    return <View style={[styles.root, style]} />;
  }

  return (
    <View style={[styles.root, style]}>
      <iframe
        ref={iframeRef}
        src={source.uri}
        title="Plan de salle interactif"
        sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        style={styles.frame as React.CSSProperties}
        onLoad={() => {
          installBridge();
          try {
            onNavigationStateChange?.({
              url:
                iframeRef.current?.contentWindow?.location.href || source.uri,
            });
          } catch {
            onNavigationStateChange?.({ url: source.uri });
          }
          onLoadEnd?.();
        }}
        onError={() =>
          onError?.({
            nativeEvent: {
              description: "Le plan de salle n'a pas pu être chargé.",
            },
          })
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  frame: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
    backgroundColor: "#FFFFFF",
  },
});

export default SeatingBrowserFrame;
