import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  isAdmin: boolean;
  path: string;
  children: React.ReactElement;
}

const ProtectedRoute = ({ isAdmin, path, children }: ProtectedRouteProps) => {
  // Разрешенные пути для не-админов
  const allowedPathsForNonAdmin = ['/', '/help'];

  // Если пользователь не админ и пытается зайти на недоступную страницу - редиректим на главную
  if (!isAdmin && !allowedPathsForNonAdmin.includes(path)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
