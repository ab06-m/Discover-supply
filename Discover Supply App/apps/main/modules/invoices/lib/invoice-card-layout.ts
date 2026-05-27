export type FieldId =
  | "invoice"
  | "customer"
  | "viewed"
  | "issued"
  | "due"
  | "total"
  | "balance";

export type SectionId = "main" | "side" | "footer";

export type CardSectionConfig = {
  id: SectionId;
  name: string;
  assignments: (FieldId | null)[];
};

export type InvoiceCardLayoutConfig = {
  sections: CardSectionConfig[];
  visible: FieldId[];
};

export const storageKey = "discover-supply.invoices.fields.v1";

export const defaultVisible: FieldId[] = [
  "invoice",
  "customer",
  "viewed",
  "issued",
  "due",
  "total",
  "balance",
];

export const allFieldIds: FieldId[] = [...defaultVisible];

export const fieldLabels: Record<FieldId, string> = {
  invoice: "Invoice #",
  customer: "Customer / store",
  viewed: "Viewed status",
  issued: "Issued",
  due: "Due",
  total: "Total",
  balance: "Balance",
};

export const defaultLayout: InvoiceCardLayoutConfig = {
  sections: [
    {
      id: "main",
      name: "Dates",
      assignments: ["viewed", "issued", "due"],
    },
    {
      id: "side",
      name: "Amounts",
      assignments: ["total", "balance"],
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

export function sanitizeLayoutConfig(value: unknown): InvoiceCardLayoutConfig {
  if (!value || typeof value !== "object") return defaultLayout;

  const raw = value as { sections?: unknown; visible?: unknown };
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section, index) => {
          if (!section || typeof section !== "object") return null;
          const entry = section as { id?: unknown; name?: unknown; assignments?: unknown };
          const fallback = defaultLayout.sections[index] ?? defaultLayout.sections[0];
          const id =
            entry.id === "main" || entry.id === "side" || entry.id === "footer"
              ? entry.id
              : fallback.id;
          const name =
            typeof entry.name === "string" && entry.name.trim()
              ? entry.name.trim().slice(0, 32)
              : fallback.name;

          return {
            id,
            name,
            assignments: sanitizeAssignments(entry.assignments, fallback.assignments),
          };
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

export function loadLayoutConfig(): InvoiceCardLayoutConfig {
  if (typeof window === "undefined") return defaultLayout;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) return sanitizeLayoutConfig(JSON.parse(raw));
  } catch {
    return defaultLayout;
  }

  return defaultLayout;
}

export function saveLayoutConfig(config: InvoiceCardLayoutConfig) {
  window.localStorage.setItem(storageKey, JSON.stringify(config));
}

export function assignFieldToSpot(
  config: InvoiceCardLayoutConfig,
  sectionId: SectionId,
  spotIndex: number,
  fieldId: FieldId | null,
): InvoiceCardLayoutConfig {
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
  config: InvoiceCardLayoutConfig,
  sectionId: SectionId,
  name: string,
): InvoiceCardLayoutConfig {
  return {
    ...config,
    sections: config.sections.map((section) =>
      section.id === sectionId
        ? { ...section, name: name.trim().slice(0, 32) || section.name }
        : section,
    ),
  };
}

export function addSpot(config: InvoiceCardLayoutConfig, sectionId: SectionId): InvoiceCardLayoutConfig {
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
  config: InvoiceCardLayoutConfig,
  sectionId: SectionId,
  spotIndex: number,
): InvoiceCardLayoutConfig {
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
  config: InvoiceCardLayoutConfig,
  fieldId: FieldId,
): InvoiceCardLayoutConfig {
  const visible = config.visible.includes(fieldId)
    ? config.visible.filter((id) => id !== fieldId)
    : [...config.visible, fieldId];

  return { ...config, visible };
}
