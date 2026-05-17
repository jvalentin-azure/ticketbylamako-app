import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { CartItem } from "@/lib/cart-provider";
import type {
  CheckoutFieldSchema,
  CheckoutFieldValue,
} from "@/lib/types/commerce";
import type { MobileCheckoutFieldsItem } from "@/lib/api/mobile";

export type BuyerFieldValues = Record<string, CheckoutFieldValue>;
export type TicketFieldValues = Record<
  number,
  Record<number, Record<string, CheckoutFieldValue>>
>;

interface TicketCustomFieldsFormProps {
  cartItems: CartItem[];
  fieldItems: MobileCheckoutFieldsItem[];
  buyerFields?: CheckoutFieldSchema[];
  buyerValues?: BuyerFieldValues;
  values: TicketFieldValues;
  errors?: Record<string, string>;
  onBuyerChange?: (fieldKey: string, value: CheckoutFieldValue) => void;
  onChange: (
    productId: number,
    attendeeIndex: number,
    fieldKey: string,
    value: CheckoutFieldValue,
  ) => void;
}

function fieldKey(field: CheckoutFieldSchema) {
  return field.storageKey || field.key;
}

function valueAsText(value: CheckoutFieldValue | undefined) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function checkboxValues(value: CheckoutFieldValue | undefined) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function TicketCustomFieldsForm({
  cartItems,
  fieldItems,
  buyerFields = [],
  buyerValues = {},
  values,
  errors = {},
  onBuyerChange,
  onChange,
}: TicketCustomFieldsFormProps) {
  const colors = useColors();

  const renderField = (
    field: CheckoutFieldSchema,
    value: CheckoutFieldValue | undefined,
    onValueChange: (nextValue: CheckoutFieldValue) => void,
    errorKey: string,
  ) => {
    const key = fieldKey(field);
    const error = errors[errorKey];
    const label = `${field.label}${field.required ? " *" : ""}`;
    const placeholder = field.placeholder || field.defaultValue || "";
    const isChoice = ["select", "radio", "checkbox"].includes(field.type);

    return (
      <View key={key} style={{ gap: 6 }}>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
          {label}
        </Text>
        {isChoice ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {field.options.map((option) => {
              const selectedValues = checkboxValues(value);
              const selected =
                field.type === "checkbox"
                  ? selectedValues.includes(option.value)
                  : valueAsText(value) === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    if (field.type === "checkbox") {
                      const nextValues = selected
                        ? selectedValues.filter((item) => item !== option.value)
                        : [...selectedValues, option.value];
                      onValueChange(nextValues);
                    } else {
                      onValueChange(option.value);
                    }
                  }}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary + "12" : colors.surface,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.foreground,
                      fontSize: 13,
                      fontWeight: selected ? "800" : "600",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <TextInput
            value={valueAsText(value)}
            onChangeText={onValueChange}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            keyboardType={
              field.type === "email"
                ? "email-address"
                : field.type === "number"
                  ? "numeric"
                  : "default"
            }
            autoCapitalize={field.type === "email" ? "none" : "sentences"}
            multiline={field.type === "textarea"}
            style={{
              minHeight: field.type === "textarea" ? 96 : 50,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: error ? colors.error : colors.border,
              backgroundColor: colors.surface,
              color: colors.foreground,
              fontSize: 15,
              paddingHorizontal: 14,
              paddingVertical: 12,
              textAlignVertical: field.type === "textarea" ? "top" : "center",
            }}
          />
        )}
        {!!field.description && (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {field.description}
          </Text>
        )}
        {!!error && (
          <Text style={{ color: colors.error, fontSize: 12, fontWeight: "700" }}>
            {error}
          </Text>
        )}
      </View>
    );
  };

  const formItems = fieldItems.filter((item) => item.hasFields);

  return (
    <View style={{ gap: 14 }}>
      {buyerFields.length > 0 && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>
            Informations acheteur
          </Text>
          {buyerFields.map((field) =>
            renderField(
              field,
              buyerValues[fieldKey(field)],
              (nextValue) => onBuyerChange?.(fieldKey(field), nextValue),
              `buyer:${fieldKey(field)}`,
            ),
          )}
        </View>
      )}

      {formItems.map((fieldItem) => {
        const cartItem = cartItems.find((item) => item.productId === fieldItem.productId);
        const title = cartItem?.ticketType || cartItem?.name || fieldItem.name;
        return (
          <View
            key={fieldItem.productId}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 14,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>
                {title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {fieldItem.quantity} billet{fieldItem.quantity > 1 ? "s" : ""}
              </Text>
            </View>

            {Array.from({ length: fieldItem.quantity }).map((_, index) => (
              <View
                key={`${fieldItem.productId}-${index}`}
                style={{
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  paddingTop: index === 0 ? 0 : 14,
                  gap: 12,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800" }}>
                  Participant {index + 1}
                </Text>
                {fieldItem.ownerFields.map((field) => {
                  const key = fieldKey(field);
                  return renderField(
                    field,
                    values[fieldItem.productId]?.[index]?.[key],
                    (nextValue) => onChange(fieldItem.productId, index, key, nextValue),
                    `${fieldItem.productId}:${index}:${key}`,
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
