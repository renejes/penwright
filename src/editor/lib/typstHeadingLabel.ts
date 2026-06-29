import { Extension } from '@tiptap/core';

/**
 * Adds a `label` attribute to heading nodes so a Typst cross-reference label
 * (`= Title <sec:x>`) survives the WYSIWYG round-trip.
 *
 * Without this, the deserializer's label attr would be silently stripped when
 * ProseMirror builds the document (unknown attrs are dropped), so on the next
 * save the heading would be re-emitted WITHOUT its label — breaking the label
 * and every `@sec:x` reference into it. (Before the deserializer learned to
 * split the label off, the label was instead escaped to `\<sec:x\>`, which is
 * equally broken.) Declaring the attr here keeps it in the schema so it
 * round-trips losslessly: deserializer JSON → ProseMirror doc → serializer.
 *
 * The label is mirrored to a `data-label` DOM attribute so it also survives
 * copy/paste and DOM (de)serialization, mirroring the TextAlign pattern.
 */
export const HeadingLabel = Extension.create({
  name: 'headingLabel',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          label: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-label') || null,
            renderHTML: (attributes) => {
              if (!attributes.label) return {};
              return { 'data-label': attributes.label };
            },
          },
        },
      },
    ];
  },
});
