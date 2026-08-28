import { theme } from 'antd';
import { LoadingOutlined } from '@/shared/ui/icons';

const PrimarySpinIndicator = () => {
  const { token } = theme.useToken();

  return <LoadingOutlined style={{ fontSize: 24, color: token.colorPrimary }} spin />;
};

export default PrimarySpinIndicator;
