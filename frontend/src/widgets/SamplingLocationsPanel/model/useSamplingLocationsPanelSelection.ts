import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { updateUrlParams } from '@/shared/lib/routing';
import type { Branch } from '@/entities/Branch';

const BRANCH_ID_PARAM = 'branchId';

/** Эффекты автовыбора филиала, sync с URL и сброс selection после удаления. */
export const useSamplingLocationsPanelSelection = (
  labId: number | undefined,
  deptId: number | undefined,
  branchesList: Branch[],
  selectedBranch: Branch | null,
  setSelectedBranch: Dispatch<SetStateAction<Branch | null>>
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const previousLabIdRef = useRef<number | undefined>(undefined);
  const previousDeptIdRef = useRef<number | undefined>(undefined);
  const isScopeInitializedRef = useRef(false);

  useEffect(() => {
    if (!isScopeInitializedRef.current) {
      isScopeInitializedRef.current = true;
      previousLabIdRef.current = labId;
      previousDeptIdRef.current = deptId;
      return;
    }

    if (labId !== previousLabIdRef.current || deptId !== previousDeptIdRef.current) {
      setSelectedBranch(null);
      if (searchParams.get(BRANCH_ID_PARAM)) {
        const newParams = updateUrlParams(searchParams, { [BRANCH_ID_PARAM]: undefined });
        setSearchParams(newParams, { replace: true });
      }
    }
    previousLabIdRef.current = labId;
    previousDeptIdRef.current = deptId;
  }, [labId, deptId, searchParams, setSearchParams, setSelectedBranch]);

  useEffect(() => {
    if (branchesList.length === 0) {
      if (selectedBranch !== null) {
        setSelectedBranch(null);
      }
      return;
    }

    const urlBranchIdRaw = searchParams.get(BRANCH_ID_PARAM);
    const urlBranchId = urlBranchIdRaw ? parseInt(urlBranchIdRaw, 10) : Number.NaN;

    if (!Number.isNaN(urlBranchId)) {
      const fromUrl = branchesList.find(branch => branch.id === urlBranchId);
      if (fromUrl) {
        if (selectedBranch?.id !== fromUrl.id) {
          setSelectedBranch(fromUrl);
        }
        return;
      }
    }

    const selectedInList = selectedBranch
      ? branchesList.find(branch => branch.id === selectedBranch.id)
      : undefined;

    if (!selectedInList) {
      const firstBranch = branchesList[0];
      if (firstBranch) {
        setSelectedBranch(firstBranch);
      }
      return;
    }

    if (selectedInList !== selectedBranch) {
      setSelectedBranch(selectedInList);
    }
  }, [branchesList, selectedBranch, setSelectedBranch, searchParams]);

  useEffect(() => {
    const currentUrlId = searchParams.get(BRANCH_ID_PARAM);
    const nextId = selectedBranch?.id;
    const nextUrlValue = nextId !== undefined ? String(nextId) : null;

    if ((currentUrlId ?? null) === nextUrlValue) {
      return;
    }
    if (nextId === undefined && !currentUrlId) {
      return;
    }

    const newParams = updateUrlParams(searchParams, {
      [BRANCH_ID_PARAM]: nextId ?? undefined,
    });
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [selectedBranch, searchParams, setSearchParams]);

  const reselectAfterBranchRemoved = (removedBranchId: number) => {
    setSelectedBranch(current => (current?.id === removedBranchId ? null : current));
  };

  return { reselectAfterBranchRemoved };
};
