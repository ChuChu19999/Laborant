import React, { useState, useEffect } from 'react';
import { BiX } from 'react-icons/bi';
import Button from '../../Button/Button';
import './Modal.css';

interface ModalProps {
  editable?: boolean;
  showEditButton?: boolean;
  header?: string;
  deleteTitle?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  cancelText?: string;
  style?: React.CSSProperties;
  saveButtonText?: string;
  saveButtonColor?: string;
  onGenerate?: () => void;
  generateButtonText?: string;
  generateLoading?: boolean;
  extraButtons?: React.ReactNode;
}

const Modal = ({
  editable,
  showEditButton = true,
  header,
  deleteTitle,
  children,
  onClose,
  onSave,
  onDelete,
  onEdit,
  onCancel,
  cancelText = 'Отмена',
  style,
  saveButtonText = 'Сохранить',
  saveButtonColor,
  onGenerate,
  generateButtonText = 'Сформировать протокол',
  generateLoading = false,
  extraButtons,
}: ModalProps) => {
  const [isLoading, setLoading] = useState<{ loading: boolean; type: string }>({
    loading: false,
    type: '',
  });
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setIsClosing(false);
  }, []);

  const chooseFunc = (type: string) => {
    switch (type) {
      case 'delete':
        return onDelete;
      case 'save':
        return onSave;
      case 'close':
        return onClose;
      case 'edit':
        return onEdit;
      case 'cancel':
        return onCancel;
      default:
        return;
    }
  };

  const handleClick = (type: string) => {
    if (isLoading.loading) {
      return;
    }

    const func = chooseFunc(type);
    if (!func) {
      return;
    }

    // Для кнопки удаления не показываем лоадер, так как она только открывает модалку подтверждения
    if (type === 'delete') {
      func();
      return;
    }

    // Для закрытия модалки запускаем анимацию исчезновения
    if (type === 'close' || type === 'cancel') {
      setIsClosing(true);
      setTimeout(() => {
        func();
      }, 200);
      return;
    }

    setLoading({ loading: true, type });

    func();

    setTimeout(() => {
      setLoading({ loading: false, type: '' });
    }, 1000);
  };

  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`modal-wrapper ${isClosing ? 'modal-closing' : 'modal-opening'}`}
      style={style}
      onClick={handleModalClick}
    >
      <div className="modal-header">
        <p>{header}</p>
        <BiX size={25} className="modal-close" onClick={() => handleClick('close')} />
      </div>

      <div className="body">
        <div className="body-content">{children}</div>

        <div className="body-buttons">
          {extraButtons && <div className="body-buttons-extra">{extraButtons}</div>}
          <div className="body-buttons-main">
            {onCancel && (
              <Button title={cancelText} onClick={() => handleClick('cancel')}>
                {cancelText}
              </Button>
            )}
            {onDelete && (
              <Button danger title={deleteTitle || 'Удалить'} onClick={() => handleClick('delete')}>
                {deleteTitle || 'Удалить'}
              </Button>
            )}
            {showEditButton && editable && onEdit && (
              <Button
                loading={isLoading.loading && isLoading.type === 'edit'}
                title="Изменить"
                type="primary"
                onClick={() => handleClick('edit')}
              >
                Изменить
              </Button>
            )}
            {onSave && (
              <Button
                loading={isLoading.loading && isLoading.type === 'save'}
                title={saveButtonText}
                type="primary"
                buttonColor={saveButtonColor}
                onClick={() => handleClick('save')}
              >
                {saveButtonText}
              </Button>
            )}
            {onGenerate && (
              <Button
                loading={generateLoading}
                title={generateButtonText}
                type="primary"
                onClick={onGenerate}
              >
                {generateButtonText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
