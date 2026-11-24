import type { SiteAttributes } from '../types';
import { getAllPolygonAttributes, getPolygonAttribute, polygonPropsToSiteAttributes } from './spatialService';

/**
 * Site-attribute access layer backed by the synchronous Loa Kulu 163-polygon
 * attribute index (`src/data/loakuluPolygonAttributes.ts`).
 */
export function getSiteAttributes(lkCodeOrProjectId: string): SiteAttributes | null {
  const props = getPolygonAttribute(lkCodeOrProjectId);
  return props ? polygonPropsToSiteAttributes(props) : null;
}

export function getAllSiteAttributes(): SiteAttributes[] {
  return getAllPolygonAttributes().map(polygonPropsToSiteAttributes);
}
