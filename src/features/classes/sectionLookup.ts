import type { SchoolClass } from '../../api/classes';

export type SectionInfo = {
  sectionId: string;
  sectionName: string;
  className: string;
};

/** sectionId -> readable names, for showing a student's section. */
export function buildSectionLookup(classes: SchoolClass[] | undefined): Map<string, SectionInfo> {
  const lookup = new Map<string, SectionInfo>();
  for (const cls of classes ?? []) {
    for (const section of cls.sections) {
      lookup.set(section.id, {
        sectionId: section.id,
        sectionName: section.name,
        className: cls.name,
      });
    }
  }
  return lookup;
}

/** Ant Design grouped `<Select>` options: one group per class, sections underneath. */
export function buildSectionSelectOptions(classes: SchoolClass[] | undefined) {
  return (classes ?? [])
    .filter((cls) => cls.sections.length > 0)
    .map((cls) => ({
      label: cls.name,
      title: cls.name,
      options: cls.sections.map((section) => ({
        value: section.id,
        label: `${cls.name} · ${section.name}`,
      })),
    }));
}
