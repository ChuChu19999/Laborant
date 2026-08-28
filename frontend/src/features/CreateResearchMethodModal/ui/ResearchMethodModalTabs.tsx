type ResearchMethodModalTabsProps = {
  activeTab: 'single' | 'group';
  onTabChange: (tab: 'single' | 'group') => void;
};

export const ResearchMethodModalTabs = ({
  activeTab,
  onTabChange,
}: ResearchMethodModalTabsProps) => (
  <div className="create-research-method-tabs">
    <button
      className={`create-research-method-tab ${activeTab === 'single' ? 'active' : ''}`}
      onClick={() => onTabChange('single')}
      type="button"
    >
      Одиночный метод
    </button>
    <button
      className={`create-research-method-tab ${activeTab === 'group' ? 'active' : ''}`}
      onClick={() => onTabChange('group')}
      type="button"
    >
      Группа методов
    </button>
  </div>
);
