import { useNavigate, useOutletContext } from 'react-router-dom';
import { Player } from '@lottiefiles/react-lottie-player';
import { BiUser } from 'react-icons/bi';
import packageJson from '../../../package.json';
import ChemistryLabAnimation from '../../shared/assets/animations/chemistry-lab.json';
import Bubble from '../../shared/ui/Bubble/Bubble';
import Button from '../../shared/ui/Button/Button';
import Layout from '../../shared/ui/Layout/Layout';
import './MainPage.css';

interface MainPageContext {
  minimize?: boolean;
  isAdmin?: boolean;
}

function MainPage() {
  const { minimize, isAdmin } = (useOutletContext() as MainPageContext) || {};
  const navigate = useNavigate();

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
                <Button
                  type="primary"
                  onClick={() => navigate('/components')}
                  icon={<BiUser size={18} />}
                >
                  Компоненты
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
