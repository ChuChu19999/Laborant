import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useLaboratory } from '@/entities/Laboratory';
import {
  useAvailableProtocolTemplates,
  useCreateProtocol,
  type ProtocolCreate,
  type ProtocolFormValues,
  type ProtocolTemplate,
} from '@/entities/Protocol';
import {
  PROTOCOL_OPTIONAL_FIELDS,
  resolvePermissionsForScope,
  usePermissionsContext,
} from '@/entities/Role';
import { useSamplesForProtocol } from '@/entities/Sample';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

dayjs.locale('ru');

const EMPTY_FORM: ProtocolFormValues = {
  test_protocol_number: '',
  test_protocol_date: null,
  is_accredited: false,
  sampling_act_number: '',
  sampling_act_date: null,
  sampling_request_number: '',
  sampling_request_date: null,
  sampling_method_nd: '',
  sampling_plan_number: '',
  issued: null,
  approved: null,
  issued_position: undefined,
  approved_position: undefined,
  protocol_template_id: undefined,
  samples: [],
};

const REQUIRED_FIELDS_MESSAGE = 'Пожалуйста, заполните все обязательные поля';

const optionalText = (value: string) => {
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : undefined;
};

export type UseCreateProtocolModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  laboratoryId?: number;
  departmentId?: number;
};

/** Оркестрация модалки создания протокола. */
export const useCreateProtocolModal = ({
  open,
  onClose,
  onSuccess,
  laboratoryId,
  departmentId,
}: UseCreateProtocolModalParams) => {
  const { isAdmin, permissionsData } = usePermissionsContext();
  const isFullAccess = isAdmin || permissionsData.is_admin;
  const scopedPermissions = useMemo(() => {
    if (isFullAccess) {
      return null;
    }
    return (
      resolvePermissionsForScope(permissionsData.scopes, laboratoryId, departmentId) ||
      permissionsData.permissions
    );
  }, [isFullAccess, permissionsData, laboratoryId, departmentId]);

  const visibleFields = useMemo(() => {
    if (isFullAccess) {
      return new Set<string>(PROTOCOL_OPTIONAL_FIELDS);
    }
    return new Set(scopedPermissions?.protocols.visible_fields || []);
  }, [isFullAccess, scopedPermissions]);

  const canShow = (field: string) => visibleFields.has(field);

  const createProtocolMutation = useCreateProtocol();
  const [errors, setErrors] = useState<Partial<Record<keyof ProtocolFormValues, boolean>>>({});
  const [formData, setFormData] = useState<ProtocolFormValues>(EMPTY_FORM);

  const { data: templates = [], isLoading: templatesLoading } = useAvailableProtocolTemplates(
    laboratoryId,
    departmentId,
    !!laboratoryId
  );
  const { data: samplesData, isLoading: samplesLoading } = useSamplesForProtocol(
    laboratoryId,
    departmentId,
    !!laboratoryId
  );
  const { data: laboratory } = useLaboratory(laboratoryId, !!laboratoryId);
  const samples = samplesData?.items ?? [];
  const laboratoryName = laboratory?.full_name || '';

  const templateOptions = useMemo(() => {
    const grouped: Record<string, ProtocolTemplate[]> = {};
    const currentIds = new Set<number>();

    templates.forEach(template => {
      const list = grouped[template.name] ?? (grouped[template.name] = []);
      list.push(template);
    });

    Object.keys(grouped).forEach(name => {
      const groupTemplates = grouped[name];
      if (!groupTemplates) {
        return;
      }
      const activeTemplates = groupTemplates.filter(item => !item.deleted_at);
      if (activeTemplates[0]) {
        currentIds.add(activeTemplates[0].id);
      }
    });

    return templates.map(template => ({
      id: template.id,
      name: template.name,
      version: template.version,
      deleted_at: template.deleted_at,
      isCurrent: currentIds.has(template.id),
    }));
  }, [templates]);

  useEffect(() => {
    if (!open) {
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  const handleFieldChange = <K extends keyof ProtocolFormValues>(
    field: K,
    value: ProtocolFormValues[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProtocolFormValues, boolean>> = {};
    if (!formData.sampling_act_number.trim()) {
      newErrors.sampling_act_number = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(REQUIRED_FIELDS_MESSAGE);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (laboratoryId == null) {
      notify.error('Лаборатория не выбрана');
      return;
    }

    const protocolData: ProtocolCreate = {
      test_protocol_number: formData.test_protocol_number || undefined,
      test_protocol_date: formData.test_protocol_date
        ? formData.test_protocol_date.format('YYYY-MM-DD')
        : undefined,
      is_accredited: formData.is_accredited,
      sampling_act_number: formData.sampling_act_number,
      sampling_act_date: formData.sampling_act_date
        ? formData.sampling_act_date.format('YYYY-MM-DD')
        : undefined,
      sampling_request_number: optionalText(formData.sampling_request_number),
      sampling_request_date: formData.sampling_request_date
        ? formData.sampling_request_date.format('YYYY-MM-DD')
        : undefined,
      sampling_method_nd: optionalText(formData.sampling_method_nd),
      sampling_plan_number: optionalText(formData.sampling_plan_number),
      issued: formData.issued?.hsnils || undefined,
      approved: formData.approved?.hsnils || undefined,
      issued_position: formData.issued_position || undefined,
      approved_position: formData.approved_position || undefined,
      protocol_template_id: formData.protocol_template_id || undefined,
      samples: formData.samples.length > 0 ? formData.samples : undefined,
      laboratory_id: laboratoryId,
      department_id: departmentId,
    };

    try {
      await createProtocolMutation.mutateAsync(protocolData);
      onSuccess();
    } catch (error: unknown) {
      notify.error(extractErrorMessage(error, 'Не удалось добавить протокол'));
    }
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  return {
    formData,
    errors,
    canShow,
    laboratoryName,
    templateOptions,
    templatesLoading,
    samples,
    samplesLoading,
    handleFieldChange,
    handleSave,
    handleCancel,
  };
};
