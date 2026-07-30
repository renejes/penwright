import { Extension } from '@tiptap/core';

/**
 * Adds an `attached` attribute to list nodes, recording that the list hugged
 * the paragraph above it in the source — no blank line between the two.
 *
 * Typst treats that as a real difference: a list written directly under its
 * intro line renders TIGHTER than one separated by a blank line (verified
 * against the bundled compiler, not assumed). So the round trip has to remember
 * which it was, or every attached list in the document shifts down by one
 * paragraph spacing on the first save.
 *
 * Declaring it here is what makes it survive. ProseMirror drops attributes the
 * schema does not know, so without this the deserializer would set `attached`,
 * the editor would silently discard it, and the serializer would emit the
 * separated form — the same failure mode that lost heading labels before
 * `HeadingLabel` was added, and for the same reason.
 *
 * Mirrored to `data-attached` so it also survives copy/paste and DOM
 * (de)serialization, following the HeadingLabel / TextAlign pattern.
 */
export const ListAttachment = Extension.create({
  name: 'listAttachment',

  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          attached: {
            default: false,
            parseHTML: (element) => element.getAttribute('data-attached') === 'true',
            renderHTML: (attributes) => {
              if (!attributes.attached) return {};
              return { 'data-attached': 'true' };
            },
          },
        },
      },
    ];
  },
});
