/** Keep in sync with client_app_v2/src/constants.ts MAJOR_RETAILERS */
export const MAJOR_RETAILERS = ['walmart', 'kroger', 'heb', 'target', 'costco'] as const;

export function isMajorRetailerStoreName(storeName: string): boolean {
  const cleanStoreName = storeName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return MAJOR_RETAILERS.some((m) => {
    const cleanM = m.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanStoreName.includes(cleanM) || cleanM.includes(cleanStoreName);
  });
}
