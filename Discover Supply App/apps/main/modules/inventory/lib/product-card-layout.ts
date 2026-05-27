export type FieldId =
  | "product"
  | "price"
  | "costPrice"
  | "available"
  | "onHand"
  | "committed"
  | "itemPerformance"
  | "barcode"
  | "brand"
  | "vendor"
  | "storefront";

export type SectionId = "main" | "side" | "footer";

export type CardSectionConfig = {
  id: SectionId;
  name: string;
  assignments: (FieldId | null)[];
};

export type ProductCardLayoutConfig = {
  sections: CardSectionConfig[];
  visible: FieldId[];
};

export const storageKeyV2 = "discover-supply.products.fields.v2";
export const storageKeyV1 = "discover-supply.products.fields.v1";

export const defaultVisible: FieldId[] = [
  "product",
  "available",
  "onHand",
  "committed",
  "price",
  "costPrice",
  "itemPerformance",
];

export const allFieldIds: FieldId[] = [
  ...defaultVisible,
  "barcode",
  "brand",
  "vendor",
  "storefront",
];

export const fieldLabels: Record<FieldId, string> = {
  product: "Product",
  available: "Available",
  onHand: "On hand",
  committed: "Committed",
  price: "Price",
  costPrice: "Cost price",
  itemPerformance: "Item performance",
  barcode: "Barcode",
  brand: "Brand",
  vendor: "Vendor",
  storefront: "Storefront",
};

const cardFieldPriority: FieldId[] = [
  "available",
  "onHand",
  "committed",
  "price",
  "costPrice",
  "itemPerformance",
];

export const defaultLayout: ProductCardLayoutConfig = {
  sections: [
    {
      id: "main",
      name: "Inventory",
      assignments: ["available", "onHand", "committed"],
    },
    {
      id: "side",
      name: "Pricing",
      assignments: ["price", "costPrice", "itemPerformance"],
    },
    {
      id: "footer",
      name: "Details",
      assignments: [],
    },
  ],
  visible: defaultVisible,
};

function sanitizeVisible(value: unknown): FieldId[] {
  if (!Array.isArray(value)) return defaultVisible;
  const valid = value.filter((id): id is FieldId => allFieldIds.includes(id as FieldId));
  return valid.length ? valid : defaultVisible;
}

function sanitizeAssignments(value: unknown, fallback: (FieldId | null)[]): (FieldId | null)[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((id) =>
    typeof id === "string" && allFieldIds.includes(id as FieldId) ? (id as FieldId) : null,
  );
}

export function sanitizeLayoutConfig(value: unknown): ProductCardLayoutConfig {
  if (!value || typeof value !== "object") return defaultLayout;

  const raw = value as {
    sections?: unknown;
    visible?: unknown;
  };

  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section, index) => {
          if (!section || typeof section !== "object") return null;
          const entry = section as {
            id?: unknown;
            name?: unknown;
            assignments?: unknown;
          };
          const fallback = defaultLayout.sections[index] ?? defaultLayout.sections[0];
          const id =
            entry.id === "main" || entry.id === "side" || entry.id === "footer"
              ? entry.id
              : fallback.id;
          const name =
            typeof entry.name === "string" && entry.name.trim()
              ? entry.name.trim().slice(0, 32)
              : fallback.name;
          const assignments = sanitizeAssignments(entry.assignments, fallback.assignments);

          return { id, name, assignments };
        })
        .filter((section): section is CardSectionConfig => Boolean(section))
    : defaultLayout.sections;

  const normalizedSections =
    sections.length === defaultLayout.sections.length
      ? sections
      : defaultLayout.sections.map((fallback, index) => sections[index] ?? fallback);

  return {
    sections: normalizedSections,
    visible: sanitizeVisible(raw.visible),
  };
}

export function migrateFromV1(raw: { order?: unknown; visible?: unknown }): ProductCardLayoutConfig {
  const visible = sanitizeVisible(raw.visible);
  const order = Array.isArray(raw.order)
    ? raw.order.filter((id): id is FieldId => allFieldIds.includes(id as FieldId))
    : allFieldIds;

  const detailFields = order.filter((id) => id !== "product" && visible.includes(id));
  const prioritized = [
    ...cardFieldPriority
      .map((id) => detailFields.find((fieldId) => fieldId === id))
      .filter((id): id is FieldId => Boolean(id)),
    ...detailFields.filter((id) => !cardFieldPriority.includes(id)),
  ];

  const main = prioritized.slice(0, 3);
  const side = prioritized.slice(3, 6);
  const footer = prioritized.slice(6);

  return {
    sections: [
      {
        id: "main",
        name: "Inventory",
        assignments: [...main, ...Array(Math.max(0, 3 - main.length)).fill(null)].slice(0, 3),
      },
      {
        id: "side",
        name: "Pricing",
        assignments: [...side, ...Array(Math.max(0, 3 - side.length)).fill(null)].slice(0, 3),
      },
      {
        id: "footer",
        name: "Details",
        assignments: footer.length ? footer : [],
      },
    ],
    visible,
  };
}

export function loadLayoutConfig(): ProductCardLayoutConfig {
  if (typeof window === "undefined") return defaultLayout;

  try {
    const rawV2 = window.localStorage.getItem(storageKeyV2);
    if (rawV2) {
      return sanitizeLayoutConfig(JSON.parse(rawV2));
    }

    const rawV1 = window.localStorage.getItem(storageKeyV1);
    if (rawV1) {
      return migrateFromV1(JSON.parse(rawV1) as { order?: unknown; visible?: unknown });
    }
  } catch {
    return defaultLayout;
  }

  return defaultLayout;
}

export function saveLayoutConfig(config: ProductCardLayoutConfig) {
  window.localStorage.setItem(storageKeyV2, JSON.stringify(config));
}

export function assignFieldToSpot(
  config: ProductCardLayoutConfig,
  sectionId: SectionId,
  spotIndex: number,
  fieldId: FieldId | null,
): ProductCardLayoutConfig {
  const sections = config.sections.map((section) => {
    const assignments = section.assignments.map((assigned, index) => {
      if (assigned === fieldId && !(section.id === sectionId && index === spotIndex)) {
        return null;
      }
      return assigned;
    });

    if (section.id !== sectionId) {
      return { ...section, assignments };
    }

    const nextAssignments = [...assignments];
    while (nextAssignments.length <= spotIndex) {
      nextAssignments.push(null);
    }
    nextAssignments[spotIndex] = fieldId;

    return { ...section, assignments: nextAssignments };
  });

  return { ...config, sections };
}

export function setSectionName(
  config: ProductCardLayoutConfig,
  sectionId: SectionId,
  name: string,
): ProductCardLayoutConfig {
  return {
    ...config,
    sections: config.sections.map((section) =>
      section.id === sectionId
        ? { ...section, name: name.trim().slice(0, 32) || section.name }
        : section,
    ),
  };
}

export function addSpot(config: ProductCardLayoutConfig, sectionId: SectionId): ProductCardLayoutConfig {
  return {
    ...config,
    sections: config.sections.map((section) =>
      section.id === sectionId && section.assignments.length < 6
        ? { ...section, assignments: [...section.assignments, null] }
        : section,
    ),
  };
}

export function removeSpot(
  config: ProductCardLayoutConfig,
  sectionId: SectionId,
  spotIndex: number,
): ProductCardLayoutConfig {
  return {
    ...config,
    sections: config.sections.map((section) => {
      if (section.id !== sectionId || section.assignments.length <= 1) return section;
      return {
        ...section,
        assignments: section.assignments.filter((_, index) => index !== spotIndex),
      };
    }),
  };
}

export function toggleFieldVisibility(
  config: ProductCardLayoutConfig,
  fieldId: FieldId,
): ProductCardLayoutConfig {
  const visible = config.visible.includes(fieldId)
    ? config.visible.filter((id) => id !== fieldId)
    : [...config.visible, fieldId];

  return { ...config, visible };
}

export function getSectionFields(
  config: ProductCardLayoutConfig,
  sectionId: SectionId,
): FieldId[] {
  const section = config.sections.find((entry) => entry.id === sectionId);
  if (!section) return [];
  return section.assignments.filter((id): id is FieldId => Boolean(id));
}
