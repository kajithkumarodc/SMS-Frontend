import type { SchoolClass, Section } from '../../api/classes';

export type SectionInfo = {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  /** "Class 5 · A", or just "LKG" for a class without sections (its hidden default section). */
  label: string;
  isDefault: boolean;
};

/** How a student's placement is shown: the class alone when the class has no sections. */
export function sectionLabel(className: string, section: Pick<Section, 'name' | 'isDefault'>): string {
  return section.isDefault ? className : `${className} · ${section.name}`;
}

/** The real (named) sections of a class, sorted A, B, C -- the hidden default section is left out. */
export function namedSections(cls: SchoolClass | undefined): Section[] {
  return (cls?.sections ?? [])
    .filter((section) => !section.isDefault)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** The hidden whole-class section, when the class has no real sections. */
export function defaultSection(cls: SchoolClass | undefined): Section | undefined {
  return cls?.sections.find((section) => section.isDefault);
}

/** sectionId -> readable names + owning classId, for showing / resolving a student's section. */
export function buildSectionLookup(classes: SchoolClass[] | undefined): Map<string, SectionInfo> {
  const lookup = new Map<string, SectionInfo>();
  for (const cls of classes ?? []) {
    for (const section of cls.sections) {
      lookup.set(section.id, {
        sectionId: section.id,
        sectionName: section.isDefault ? '' : section.name,
        classId: cls.id,
        className: cls.name,
        label: sectionLabel(cls.name, section),
        isDefault: section.isDefault,
      });
    }
  }
  return lookup;
}

/** Placeholder option value used for a class that has no sections at all (never selectable). */
export const NO_SECTIONS_VALUE_PREFIX = 'no-sections:';

/**
 * Ant Design grouped `<Select>` options: one group per class (every class, in the school's class order),
 * sections underneath. A class without sections offers the class itself (its hidden default section).
 */
export function buildSectionSelectOptions(classes: SchoolClass[] | undefined) {
  return (classes ?? []).map((cls) => {
    const whole = defaultSection(cls);
    const named = namedSections(cls);
    return {
      label: cls.name,
      title: cls.name,
      options: whole
        ? [{ value: whole.id, label: cls.name }]
        : named.length > 0
          ? named.map((section) => ({ value: section.id, label: sectionLabel(cls.name, section) }))
          : [
              {
                value: `${NO_SECTIONS_VALUE_PREFIX}${cls.id}`,
                label: `${cls.name} · No sections yet`,
                title: 'Add a section on the Classes page first',
                disabled: true,
              },
            ],
    };
  });
}

/** True when at least one class has somewhere to place students. */
export function hasSelectableSection(classes: SchoolClass[] | undefined): boolean {
  return (classes ?? []).some((cls) => cls.sections.length > 0);
}
