import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams, useLocation } from 'react-router-dom';
import { Player } from '@lottiefiles/react-lottie-player';
import { FaFlask } from 'react-icons/fa';
import packageJson from '../../../package.json';
import ChemistryLabAnimation from '../../shared/assets/animations/chemistry-lab.json';
import { updateUrlParams } from '../../shared/lib/urlParams';
import Bubble from '../../shared/ui/Bubble/Bubble';
import Button from '../../shared/ui/Button/Button';
import Layout from '../../shared/ui/Layout/Layout';
import { LaboratoryManagement } from '../../widgets/LaboratoryManagement';
import './MainPage.css';

interface MainPageContext {
  minimize?: boolean;
  isAdmin?: boolean;
}

function MainPage() {
  const { minimize, isAdmin } = (useOutletContext() as MainPageContext) || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [showLaboratoryManagement, setShowLaboratoryManagement] = useState(
    () => searchParams.get('page') === 'laboratory-management'
  );
  const previousSearchRef = useRef<string>(location.search);
  const isClearingRef = useRef<boolean>(false);

  // Инициализация из URL при изменении параметров
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const currentSearch = location.search;
    const wasCleared = previousSearchRef.current !== '' && currentSearch === '';

    if (wasCleared) {
      isClearingRef.current = true;
      setShowLaboratoryManagement(false);
      setTimeout(() => {
        isClearingRef.current = false;
      }, 100);
    } else if (pageParam === 'laboratory-management') {
      setShowLaboratoryManagement(true);
    } else if (!pageParam) {
      setShowLaboratoryManagement(false);
    }

    previousSearchRef.current = currentSearch;
  }, [searchParams, location.search]);

  // Синхронизация состояния с URL
  useEffect(() => {
    // Пропускаем синхронизацию, если происходит намеренная очистка параметров
    if (isClearingRef.current) {
      return;
    }

    const updates: Record<string, string | undefined | null> = {
      page: showLaboratoryManagement ? 'laboratory-management' : undefined,
    };

    const newParams = updateUrlParams(searchParams, updates);
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [showLaboratoryManagement, searchParams, setSearchParams]);

  const handleShowManagement = () => {
    setShowLaboratoryManagement(true);
  };

  const handleBackToHome = () => {
    setShowLaboratoryManagement(false);
    const newParams = updateUrlParams(searchParams, {
      page: undefined,
    });
    setSearchParams(newParams, { replace: true });
  };

  if (showLaboratoryManagement) {
    return (
      <div className="main-page-wrapper">
        <Layout title="Управление лабораториями">
          <LaboratoryManagement onBack={handleBackToHome} />
        </Layout>
      </div>
    );
  }

  return (
    <div className="main-page-wrapper">
      <Layout title="Главная">
        <div
          className={`main-page-container ${minimize ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
        >
          <div className="welcome-content">
            <div className="welcome-text-content">
              <div className="welcome-bubbles">
                <Bubble text={`Версия ${packageJson.version}`} color="#619BEF" textColor="#fff" />
                {isAdmin && <Bubble text="Администратор" color="#1677ff" textColor="#fff" />}
              </div>
              <h1 className="welcome-title">Лаборант ФХИ</h1>
              <p className="welcome-subtitle">
                Система управления физико-химическими испытаниями и лабораторной документацией
              </p>
              <div className="welcome-actions">
                <Button type="primary" onClick={handleShowManagement} icon={<FaFlask size={18} />}>
                  Управление лабораториями
                </Button>
              </div>
            </div>
            <div className="welcome-animation">
              <div className="animation-wrapper">
                <Player
                  autoplay
                  loop
                  src={ChemistryLabAnimation}
                  className="lottie-player"
                  rendererSettings={{
                    preserveAspectRatio: 'xMidYMid meet',
                    clearCanvas: true,
                    progressiveLoad: false,
                    hideOnTransparent: true,
                    renderer: 'svg',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </div>
  );
}

export default MainPage;
