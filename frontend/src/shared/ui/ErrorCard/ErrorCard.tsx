import { Helmet } from 'react-helmet';
import { LottieAnimation } from '@/shared/ui/LottieAnimation';
import './ErrorCard.css';

interface ErrorCardProps {
  title: string;
  text: string;
  loadAnimation: () => Promise<{ default: object }>;
}

const ErrorCard = ({ title, text, loadAnimation }: ErrorCardProps) => {
  return (
    <div className="error-card-wrapper">
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className="layout">
        <LottieAnimation loadAnimation={loadAnimation} />

        <div className="text">
          <p className="text-title">Упс!</p>
          <p className="text-main">{text}</p>
        </div>
      </div>
    </div>
  );
};

export default ErrorCard;
