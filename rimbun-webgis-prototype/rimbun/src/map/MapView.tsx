import type { ProjectView } from '../types';
import { LeafletMap, type MapMode } from './LeafletMap';

export interface MapViewProps {
  mode?: MapMode;
  selectedId: string | null;
  visibleIds?: string[] | null;
  projectsByCode: Map<string, ProjectView>;
  includeDrafts?: boolean;
  onSelect: (lkCode: string) => void;
  compact?: boolean;
  className?: string;
}

export function MapView({
  mode = 'programs',
  selectedId,
  visibleIds,
  projectsByCode,
  includeDrafts = false,
  onSelect,
  compact,
  className,
}: MapViewProps) {
  const visibleSet = visibleIds ? new Set(visibleIds) : null;
  return (
    <LeafletMap
      mode={mode}
      selectedCode={selectedId}
      visibleCodes={visibleSet}
      projectsByCode={projectsByCode}
      includeDrafts={includeDrafts}
      onSelectPolygon={onSelect}
      compact={compact}
      className={className}
    />
  );
}
