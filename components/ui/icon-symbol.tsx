// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "calendar": "event",
  "bag.fill": "shopping-bag",
  "ticket.fill": "confirmation-number",
  "person.fill": "person",
  "chart.bar.fill": "bar-chart",
  "qrcode.viewfinder": "qr-code-scanner",
  "person.2.fill": "people",
  "clipboard.fill": "assignment",
  "chart.line.uptrend.xyaxis": "trending-up",
  "gearshape.fill": "settings",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "magnifyingglass": "search",
  "cart.fill": "shopping-cart",
  "xmark": "close",
  "plus": "add",
  "minus": "remove",
  "trash.fill": "delete",
  "square.and.arrow.up": "share",
  "heart.fill": "favorite",
  "heart": "favorite-border",
  "star.fill": "star",
  "mappin": "place",
  "clock": "schedule",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "exclamationmark.triangle.fill": "warning",
  "arrow.right": "arrow-forward",
  "arrow.left": "arrow-back",
  "paperplane.fill": "send",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",
  "bell.fill": "notifications",
  "doc.text.fill": "description",
  "arrow.down.circle.fill": "download",
  "eye.fill": "visibility",
  "pencil": "edit",
  "power": "logout",
  "camera.fill": "camera-alt",
  "flashlight.on.fill": "flash-on",
  "flashlight.off.fill": "flash-off",
  "chevron.left.forwardslash.chevron.right": "code",
  "banknote.fill": "payments",
  "tag.fill": "local-offer",
  "pause.circle.fill": "pause-circle-filled",
  "arrow.uturn.left.circle.fill": "replay",
  "questionmark.circle.fill": "help",
  "clock.fill": "access-time",
  "info.circle.fill": "info",
  "location.fill": "location-on",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "line.3.horizontal": "menu",
  "lock.fill": "lock",
  "eye.slash.fill": "visibility-off",
  "globe": "language",
  "shield.fill": "security",
  "text.bubble.fill": "chat",
  "hand.raised.fill": "privacy-tip",
  "storefront.fill": "storefront",
  "calendar.badge.clock": "event-available",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mappedName = MAPPING[name as string] || "help-outline";
  return <MaterialIcons color={color} size={size} name={mappedName} style={style} />;
}
