/**
 * Storage bucket taxonomy, derived from the media fields this app actually
 * has. `public` buckets can be read by anyone with the URL (product photos,
 * logos, rendered straight into <img> tags). Private buckets require an
 * authenticated session (financial documents such as expense receipts).
 */

export const BUCKETS = [
  {
    id: 'inventory-media',
    label: 'Inventory media',
    description: 'Product photos and other inventory imagery.',
    public: true,
    entityFields: [{ entity: 'Product', field: 'image_url' }],
  },
  {
    id: 'expense-receipts',
    label: 'Expense receipts',
    description: 'Receipt scans and supporting documents attached to expenses.',
    public: false,
    entityFields: [{ entity: 'Expense', field: 'receipt_image' }],
  },
  {
    id: 'wholesaler-logos',
    label: 'Wholesaler logos',
    description: 'Supplier and wholesaler brand marks.',
    public: true,
    entityFields: [{ entity: 'Wholesaler', field: 'logo_url' }],
  },
  {
    id: 'app-uploads',
    label: 'Other app uploads',
    description: 'Any other media referenced by app records that has no dedicated bucket.',
    public: false,
    entityFields: [],
    fallback: true,
  },
];

const FIELD_INDEX = new Map(
  BUCKETS.flatMap((bucket) =>
    bucket.entityFields.map(({ entity, field }) => [`${entity}.${field}`, bucket.id]),
  ),
);

/** Bucket that owns a given entity field, falling back to `app-uploads`. */
export function bucketForField(entity, field) {
  return FIELD_INDEX.get(`${entity}.${field}`) || 'app-uploads';
}

export function bucketById(id) {
  return BUCKETS.find((bucket) => bucket.id === id);
}

/** Media field declarations, grouped per entity, used for the dry-run inventory. */
export function mediaFieldsFor(entity) {
  return BUCKETS.flatMap((bucket) =>
    bucket.entityFields.filter((entry) => entry.entity === entity).map((entry) => entry.field),
  );
}
