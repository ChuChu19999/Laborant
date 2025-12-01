import React from 'react';
import { BiUser } from 'react-icons/bi';
import './UserInfo.css';

interface EmployeePhoto {
  photoWebp50?: string | null;
  photoWebp50sha256?: string;
  photoWebp300?: string | null;
  photoJpg300sha256?: string;
  photoWebp200?: string | null;
  photoWebp200Sha256?: string;
}

interface EmployeeData {
  fullName?: string;
  photo?: string;
  photoWebp200?: string;
  employeePhoto?: EmployeePhoto | null;
  department?: string;
  division?: string;
  jobTitle?: string;
  [key: string]: unknown;
}

interface UserCabinetData {
  id: number;
  hsnils: string;
  employee_full_name?: string;
  employee_department?: string;
  employee_division?: string;
}

interface UserInfoProps {
  userCabinet: UserCabinetData | null;
  employeeData: EmployeeData | null;
}

const formatPhotoUrl = (photoString: string): string => {
  if (!photoString || !photoString.trim()) return '';

  const trimmed = photoString.trim();

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return `data:image/webp;base64,${trimmed}`;
  }
};

const getPhotoUrl = (employeeData: EmployeeData | null): string | undefined => {
  if (!employeeData) return undefined;

  // Проверяем вложенную структуру employeePhoto
  if (employeeData.employeePhoto) {
    const photo = employeeData.employeePhoto;
    if (photo.photoWebp200) {
      const url = formatPhotoUrl(photo.photoWebp200);
      if (url) return url;
    }
    if (photo.photoWebp300) {
      const url = formatPhotoUrl(photo.photoWebp300);
      if (url) return url;
    }
    if (photo.photoWebp50) {
      const url = formatPhotoUrl(photo.photoWebp50);
      if (url) return url;
    }
  }

  // Проверяем плоскую структуру
  if (employeeData.photoWebp200) {
    const url = formatPhotoUrl(employeeData.photoWebp200);
    if (url) return url;
  }
  if (employeeData.photo) {
    const url = formatPhotoUrl(employeeData.photo);
    if (url) return url;
  }

  return undefined;
};

const UserInfo: React.FC<UserInfoProps> = ({ userCabinet, employeeData }) => {
  const displayName = employeeData?.fullName || userCabinet?.employee_full_name || 'Не указано';
  const displayDepartment =
    employeeData?.department || userCabinet?.employee_department || 'Не указано';
  const displayDivision = employeeData?.division || userCabinet?.employee_division || 'Не указано';
  const displayJobTitle = employeeData?.jobTitle || 'Не указано';
  const photoUrl = getPhotoUrl(employeeData);

  return (
    <div className="user-info">
      <div className="user-info-content">
        <div className="user-info-photo">
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} />
          ) : (
            <div className="user-info-photo-placeholder">
              <BiUser size={72} />
            </div>
          )}
        </div>
        <div className="user-info-details">
          <h2 className="user-info-name">{displayName}</h2>
          <div className="user-info-fields">
            <div className="user-info-field">
              <span className="user-info-field-label">Отдел:</span>
              <span className="user-info-field-value">{displayDepartment}</span>
            </div>
            <div className="user-info-field">
              <span className="user-info-field-label">Подразделение:</span>
              <span className="user-info-field-value">{displayDivision}</span>
            </div>
            <div className="user-info-field">
              <span className="user-info-field-label">Должность:</span>
              <span className="user-info-field-value">{displayJobTitle}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
