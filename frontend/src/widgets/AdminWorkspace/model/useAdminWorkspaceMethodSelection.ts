import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getActiveGroupMethodsForSelect,
  getFirstGroupMethodId,
  type ResearchMethod,
  type ResearchMethodGroup,
} from '@/entities/ResearchMethod';
import { updateUrlParams } from '@/shared/lib/routing';

const METHOD_ID_PARAM = 'methodId';

type WorkspaceListItem =
  | { type: 'method'; id: number; data: ResearchMethod }
  | { type: 'group'; id: number; data: ResearchMethodGroup };

const pickDefaultMethodId = (
  displayItems: WorkspaceListItem[],
  groups: ResearchMethodGroup[],
  methods: ResearchMethod[]
): number | null => {
  const firstItem = displayItems[0];
  if (!firstItem) {
    return null;
  }
  if (firstItem.type === 'method') {
    return firstItem.id;
  }
  const group = groups.find(item => item.id === firstItem.id);
  if (!group || group.methods.length === 0) {
    return null;
  }
  const activeGroupMethods = getActiveGroupMethodsForSelect(group.methods, methods);
  return getFirstGroupMethodId(activeGroupMethods);
};

/** Sync выбранного метода с URL (?methodId=) и автовыбор при смене scope. */
export const useAdminWorkspaceMethodSelection = (
  labId: number | undefined,
  deptId: number | undefined,
  methods: ResearchMethod[],
  groups: ResearchMethodGroup[],
  displayItems: WorkspaceListItem[],
  selectedMethodId: number | null,
  setSelectedMethodId: Dispatch<SetStateAction<number | null>>
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const shouldAutoSelectRef = useRef(false);
  const isScopeInitializedRef = useRef(false);
  const lastHydratedUrlMethodIdRef = useRef<string | null>(null);
  const methodsWereEmptyRef = useRef(true);

  useEffect(() => {
    if (!isScopeInitializedRef.current) {
      isScopeInitializedRef.current = true;
      previousLabIdRef.current = labId;
      previousDeptIdRef.current = deptId;
      shouldAutoSelectRef.current = !searchParams.get(METHOD_ID_PARAM);
      return;
    }

    if (labId !== previousLabIdRef.current || deptId !== previousDeptIdRef.current) {
      setSelectedMethodId(null);
      shouldAutoSelectRef.current = true;
      lastHydratedUrlMethodIdRef.current = null;
      setSearchParams(
        prev => {
          if (!prev.get(METHOD_ID_PARAM)) {
            return prev;
          }
          return updateUrlParams(prev, { [METHOD_ID_PARAM]: undefined });
        },
        { replace: true }
      );
    }
    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [labId, deptId, searchParams, setSearchParams, setSelectedMethodId]);

  useEffect(() => {
    setSelectedMethodId(prev => {
      if (prev !== null && !methods.some(method => method.id === prev)) {
        shouldAutoSelectRef.current = true;
        return null;
      }
      return prev;
    });
  }, [methods, setSelectedMethodId]);

  useEffect(() => {
    const methodsJustLoaded = methodsWereEmptyRef.current && methods.length > 0;
    methodsWereEmptyRef.current = methods.length === 0;

    const urlMethodIdRaw = searchParams.get(METHOD_ID_PARAM);
    const shouldHydrateFromUrl =
      urlMethodIdRaw !== lastHydratedUrlMethodIdRef.current ||
      (methodsJustLoaded && urlMethodIdRaw != null);

    if (!shouldHydrateFromUrl) {
      return;
    }

    lastHydratedUrlMethodIdRef.current = urlMethodIdRaw;

    if (!urlMethodIdRaw) {
      return;
    }

    const urlMethodId = parseInt(urlMethodIdRaw, 10);
    if (Number.isNaN(urlMethodId)) {
      shouldAutoSelectRef.current = true;
      lastHydratedUrlMethodIdRef.current = null;
      setSearchParams(prev => updateUrlParams(prev, { [METHOD_ID_PARAM]: undefined }), {
        replace: true,
      });
      return;
    }

    const fromUrl = methods.find(method => method.id === urlMethodId);
    if (fromUrl) {
      setSelectedMethodId(prev => (prev === fromUrl.id ? prev : fromUrl.id));
      shouldAutoSelectRef.current = false;
      return;
    }

    if (methods.length === 0) {
      return;
    }

    shouldAutoSelectRef.current = true;
    lastHydratedUrlMethodIdRef.current = null;
    setSearchParams(prev => updateUrlParams(prev, { [METHOD_ID_PARAM]: undefined }), {
      replace: true,
    });
  }, [searchParams, methods, setSearchParams, setSelectedMethodId]);

  useEffect(() => {
    if (!shouldAutoSelectRef.current || displayItems.length === 0) {
      return;
    }

    const defaultMethodId = pickDefaultMethodId(displayItems, groups, methods);
    if (defaultMethodId != null) {
      setSelectedMethodId(defaultMethodId);
    }
    shouldAutoSelectRef.current = false;
  }, [displayItems, groups, methods, setSelectedMethodId]);

  useEffect(() => {
    if (selectedMethodId === null) {
      return;
    }

    setSearchParams(
      prev => {
        const currentUrlId = prev.get(METHOD_ID_PARAM);
        const nextUrlValue = String(selectedMethodId);
        if (currentUrlId === nextUrlValue) {
          return prev;
        }
        return updateUrlParams(prev, {
          [METHOD_ID_PARAM]: selectedMethodId,
        });
      },
      { replace: true }
    );
  }, [selectedMethodId, setSearchParams]);
};
