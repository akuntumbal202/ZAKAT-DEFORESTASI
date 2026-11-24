import { FEATURE_JOIN_KEY, type RestorationFeatureCollection } from './types';

export interface JoinReport {
  matched: string[];
  featuresWithoutProgram: string[];
  programsWithoutFeature: string[];
}

/**
 * Checks how a FeatureCollection lines up with the program list.
 * Useful when the real SHP/GPKG arrives: shows mismatched ids before anything renders.
 */
export function checkJoin(fc: RestorationFeatureCollection, programIds: string[]): JoinReport {
  const featureIds = new Set(fc.features.map((f) => String(f.properties[FEATURE_JOIN_KEY] ?? '')));
  const programs = new Set(programIds);
  return {
    matched: [...featureIds].filter((id) => programs.has(id)),
    featuresWithoutProgram: [...featureIds].filter((id) => id && !programs.has(id)),
    programsWithoutFeature: [...programs].filter((id) => !featureIds.has(id)),
  };
}
