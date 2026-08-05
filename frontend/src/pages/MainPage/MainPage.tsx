import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { useOutletContext, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Player } from '@lottiefiles/react-lottie-player';
import packageJson from '../../../package.json';
import ChemistryLabAnimation from '../../shared/assets/animations/chemistry-lab.json';
import { PAGE_STATE_KEYS } from '../../shared/lib/pageStateKeys';
import { formatRoleType } from '../../shared/lib/roleTypeOptions';
import { usePageState } from '../../shared/model/hooks';
import Bubble from '../../shared/ui/Bubble/Bubble';
import { CalculatorIcon, ExperimentAntdIcon, FileTextIcon } from '../../shared/ui/icons';
import '../../shared/ui/icons/icons.css';
import Layout from '../../shared/ui/Layout';
import Tooltip from '../../shared/ui/Tooltip';
import type { UserPermissions } from '../../shared/api/userRole';
import './MainPage.css';

interface MainPageContext {
  minimize?: boolean;
  isAdmin?: boolean;
  permissionsData?: UserPermissions;
}

type WorkflowStepIcon = ComponentType<{ size?: number; className?: string }>;

type WorkflowStep = {
  id: string;
  title: string;
  caption: string;
  path: string | null;
  enabled: boolean;
  clickable: boolean;
  Icon: WorkflowStepIcon;
};

function MainPage() {
  const { minimize, isAdmin, permissionsData } = (useOutletContext() as MainPageContext) || {};
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const samplesPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.SAMPLES_PAGE,
    shouldSave: pathname => pathname.startsWith('/samples'),
  });
  const protocolsPageState = usePageState({
    storageKey: PAGE_STATE_KEYS.PROTOCOLS_PAGE,
    shouldSave: pathname => pathname.startsWith('/protocols'),
  });

  const isFullAccess = Boolean(isAdmin || permissionsData?.is_admin);
  const navigation = permissionsData?.permissions.navigation;
  const canSamples = isFullAccess || Boolean(navigation?.samples);
  const canCalculations =
    isFullAccess || Boolean(permissionsData?.permissions.calculations.execute);
  const canProtocols = isFullAccess || Boolean(navigation?.protocols);

  const workflowSteps: WorkflowStep[] = [
    {
      id: 'sample',
      title: 'Проба',
      caption: 'Регистрация поступления',
      path: '/samples',
      enabled: canSamples,
      clickable: true,
      Icon: ExperimentAntdIcon,
    },
    {
      id: 'calculation',
      title: 'Расчёт',
      caption: 'Методы исследования',
      path: null,
      enabled: canSamples && canCalculations,
      clickable: false,
      Icon: CalculatorIcon,
    },
    {
      id: 'protocol',
      title: 'Протокол',
      caption: 'Оформление результатов',
      path: '/protocols',
      enabled: canProtocols,
      clickable: true,
      Icon: FileTextIcon,
    },
  ];

  const roleBadges = (() => {
    if (isFullAccess) {
      return [{ text: 'Администратор', color: '#1677ff' }];
    }
    const types = permissionsData?.role_types || [];
    return types.map(roleType => ({
      text: formatRoleType(roleType),
      color: '#619BEF',
    }));
  })();

  useEffect(() => {
    if (searchParams.get('page') !== 'laboratory-management') {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    const query = next.toString();
    navigate(`/laboratory-management${query ? `?${query}` : ''}`, { replace: true });
  }, [searchParams, navigate]);

  useEffect(() => {
    if (location.hash !== '#workflow') {
      return;
    }
    const el = document.getElementById('workflow');
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [location.hash]);

  const handleStepClick = (step: WorkflowStep) => {
    if (!step.enabled || !step.clickable || !step.path) {
      return;
    }
    if (step.path === '/samples') {
      samplesPageState.restoreState('/samples', '');
      return;
    }
    if (step.path === '/protocols') {
      protocolsPageState.restoreState('/protocols', '');
      return;
    }
    navigate(step.path);
  };

  const getStepTooltip = (step: WorkflowStep) => {
    if (!step.enabled) {
      return 'Раздел недоступен при ваших правах';
    }
    if (!step.clickable) {
      return 'Выполняется в поступлениях проб';
    }
    return step.caption;
  };

  const getStepClassName = (step: WorkflowStep) => {
    if (!step.enabled) {
      return 'workflow-step workflow-step-disabled';
    }
    if (step.clickable) {
      return 'workflow-step workflow-step-enabled';
    }
    return 'workflow-step workflow-step-static';
  };

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
                {roleBadges.map(badge => (
                  <Bubble key={badge.text} text={badge.text} color={badge.color} textColor="#fff" />
                ))}
              </div>
              <h1 className="welcome-title">Лаборатории ФХИ</h1>
              <p className="welcome-subtitle">
                Система управления физико-химическими испытаниями и лабораторной документацией
              </p>

              <section id="workflow" className="workflow-section" aria-label="Рабочий процесс">
                <ol className="workflow-chain">
                  {workflowSteps.map((step, index) => (
                    <li key={step.id} className="workflow-chain-item">
                      {index > 0 ? (
                        <span className="workflow-chain-arrow" aria-hidden="true" />
                      ) : null}
                      <Tooltip title={getStepTooltip(step)} placement="top">
                        <button
                          type="button"
                          className={getStepClassName(step)}
                          onClick={() => handleStepClick(step)}
                          disabled={!step.enabled || !step.clickable}
                        >
                          <span className="workflow-step-index" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="workflow-step-icon" aria-hidden="true">
                            <step.Icon size={18} className="animated-icon" />
                          </span>
                          <span className="workflow-step-text">
                            <span className="workflow-step-title">{step.title}</span>
                            <span className="workflow-step-caption">{step.caption}</span>
                          </span>
                        </button>
                      </Tooltip>
                    </li>
                  ))}
                </ol>
              </section>
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
