import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useEmployeeByHsnils } from '@/entities/Employee';
import { useLaboratory } from '@/entities/Laboratory';
import {
  useAvailableProtocolTemplates,
  useUpdateProtocol,
  type Protocol,
  type ProtocolFormValues,
  type ProtocolTemplate,
  type ProtocolUpdate,
} from '@/entities/Protocol';
import { useSamplesForProtocol } from '@/entities/Sample';
import { extractErrorMessage } from '@/shared/lib/errors';
import { notify } from '@/shared/lib/notify';

dayjs.locale('ru');

const EMPTY_FORM: ProtocolFormValues = {
  test_protocol_number: '',
  test_protocol_date: null,
  is_accredited: false,
  sampling_act_number: '',
  issued: null,
  approved: null,
  issued_position: undefined,
  approved_position: undefined,
  protocol_template_id: undefined,
  samples: [],
};

const REQUIRED_FIELDS_MESSAGE = 'Пожалуйста, заполните все обязательные поля';

export type UseEditProtocolModalParams = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  protocol: Protocol;
  laboratoryId?: number;
  departmentId?: number;
};

/** Оркестрация модалки редактирования протокола. */
export const useEditProtocolModal = ({
  open,
  onClose,
  onSuccess,
  protocol,
  laboratoryId,
  departmentId,
}: UseEditProtocolModalParams) => {
  const updateProtocolMutation = useUpdateProtocol();
  const [errors, setErrors] = useState<Partial<Record<keyof ProtocolFormValues, boolean>>>({});
  const [formData, setFormData] = useState<ProtocolFormValues>(EMPTY_FORM);

  const { data: issuedEmployee } = useEmployeeByHsnils(
    protocol.issued,
    true,
    open && !!protocol.issued
  );
  const { data: approvedEmployee } = useEmployeeByHsnils(
    protocol.approved,
    true,
    open && !!protocol.approved
  );

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
    if (open && protocol) {
      setFormData({
        test_protocol_number: protocol.test_protocol_number || '',
        test_protocol_date: protocol.test_protocol_date ? dayjs(protocol.test_protocol_date) : null,
        is_accredited: protocol.is_accredited || false,
        sampling_act_number: protocol.sampling_act_number || '',
        issued: null,
        approved: null,
        issued_position: protocol.issued_position || undefined,
        approved_position: protocol.approved_position || undefined,
        protocol_template_id: protocol.protocol_template_id || undefined,
        samples: protocol.samples || [],
      });
      setErrors({});
    }
  }, [open, protocol]);

  useEffect(() => {
    if (!open || !issuedEmployee) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      issued: {
        hsnils: issuedEmployee.hsnils,
        fullName: issuedEmployee.fullName,
        employeePhoto: issuedEmployee.employeePhoto,
        jobTitle: issuedEmployee.jobTitle,
      },
    }));
  }, [open, issuedEmployee]);

  useEffect(() => {
    if (!open || !approvedEmployee) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      approved: {
        hsnils: approvedEmployee.hsnils,
        fullName: approvedEmployee.fullName,
        employeePhoto: approvedEmployee.employeePhoto,
        jobTitle: approvedEmployee.jobTitle,
      },
    }));
  }, [open, approvedEmployee]);

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

    const protocolData: ProtocolUpdate = {
      test_protocol_number: formData.test_protocol_number || undefined,
      test_protocol_date: formData.test_protocol_date
        ? formData.test_protocol_date.format('YYYY-MM-DD')
        : undefined,
      is_accredited: formData.is_accredited,
      sampling_act_number: formData.sampling_act_number,
      issued: formData.issued?.hsnils || undefined,
      approved: formData.approved?.hsnils || undefined,
      issued_position: formData.issued_position || undefined,
      approved_position: formData.approved_position || undefined,
      protocol_template_id: formData.protocol_template_id || undefined,
      samples: formData.samples.length > 0 ? formData.samples : undefined,
    };

    try {
      await updateProtocolMutation.mutateAsync({ id: protocol.id, data: protocolData });
      onSuccess();
    } catch (error: unknown) {
      notify.error(extractErrorMessage(error, 'Не удалось обновить протокол'));
    }
  };

  const handleCancel = () => {
    setFormData({
      test_protocol_number: protocol.test_protocol_number || '',
      test_protocol_date: protocol.test_protocol_date ? dayjs(protocol.test_protocol_date) : null,
      is_accredited: protocol.is_accredited || false,
      sampling_act_number: protocol.sampling_act_number || '',
      issued: null,
      approved: null,
      issued_position: protocol.issued_position || undefined,
      approved_position: protocol.approved_position || undefined,
      protocol_template_id: protocol.protocol_template_id || undefined,
      samples: protocol.samples || [],
    });
    setErrors({});
    onClose();
  };

  return {
    formData,
    errors,
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
