import { message } from 'antd';
import {
  protocolsApi,
  type Protocol,
  type ProtocolCreate,
  type ProtocolUpdate,
} from '../../api/protocols';
import { useAutoInvalidateMutation } from '../lib/useMutation';

export const useCreateProtocol = () => {
  return useAutoInvalidateMutation<Protocol, unknown, ProtocolCreate>(
    data => protocolsApi.createProtocol(data),
    [['protocols']],
    {
      onSuccess: () => {
        message.success('Протокол успешно создан');
      },
    }
  );
};

export const useUpdateProtocol = () => {
  return useAutoInvalidateMutation<Protocol, unknown, { id: number; data: ProtocolUpdate }>(
    ({ id, data }) => protocolsApi.updateProtocol(id, data),
    [['protocols']],
    {
      onSuccess: () => {
        message.success('Протокол успешно обновлен');
      },
    }
  );
};

export const useDeleteProtocol = () => {
  return useAutoInvalidateMutation<void, unknown, number>(
    id => protocolsApi.deleteProtocol(id),
    [['protocols']],
    {
      onSuccess: () => {
        message.success('Протокол успешно удален');
      },
    }
  );
};
