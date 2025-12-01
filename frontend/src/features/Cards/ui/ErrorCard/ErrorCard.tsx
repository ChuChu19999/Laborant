import Lottie from 'lottie-react';
import { Helmet } from 'react-helmet';
import './ErrorCard.css';

interface ErrorCardProps {
  title: string;
  text: string;
  animation: unknown;
}

const ErrorCard = ({ title, text, animation }: ErrorCardProps) => {
  return (
    <div className="error-card-wrapper">
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className="layout">
        <Lottie animationData={animation} loop autoplay />

        <div className="text">
          <p className="text-title">Упс!</p>
          <p className="text-main">{text}</p>
        </div>
      </div>
    </div>
  );
};

export default ErrorCard;
