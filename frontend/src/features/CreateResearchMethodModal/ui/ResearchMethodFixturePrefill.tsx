import { FormField } from '@/shared/ui/FormField';
import { Spin, type SpinProps } from '@/shared/ui/Spin';
import { TreeSelect } from '@/shared/ui/TreeSelect';
import type { FixtureTreeNode } from '../lib';
import type { TreeSelectProps } from '@/shared/ui/TreeSelect';

type ResearchMethodFixturePrefillProps = {
  isLoadingFixtures: boolean;
  fixtureTreeData: FixtureTreeNode[];
  selectedFixture: string;
  spinnerIndicator: SpinProps['indicator'];
  loadData: NonNullable<TreeSelectProps['loadData']>;
  onSelect: (value: string | undefined) => void;
};

export const ResearchMethodFixturePrefill = ({
  isLoadingFixtures,
  fixtureTreeData,
  selectedFixture,
  spinnerIndicator,
  loadData,
  onSelect,
}: ResearchMethodFixturePrefillProps) => (
  <div className="method-prefill-section">
    <FormField
      label="Готовые конфигурации"
      labelMode="group"
      itemClassName="create-research-method-form-group"
      fieldId="research-method-fixture-prefill"
    >
      {(_fieldId, labelId) => (
        <div className="method-prefill-controls" aria-labelledby={labelId}>
          {isLoadingFixtures ? (
            <div className="create-research-method-modal-spinner">
              <Spin tip="Загрузка справочника..." indicator={spinnerIndicator} spinning>
                <div className="create-research-method-modal-spinner-placeholder" />
              </Spin>
            </div>
          ) : fixtureTreeData.length > 0 ? (
            <TreeSelect
              className="method-prefill-tree-select"
              showSearch
              treeNodeFilterProp="title"
              placeholder="Выберите, чтобы подставить готовую конфигурацию"
              allowClear
              listHeight={350}
              treeData={fixtureTreeData}
              loadData={loadData}
              value={selectedFixture || undefined}
              onChange={value => {
                onSelect(typeof value === 'string' ? value : undefined);
              }}
              disabled={isLoadingFixtures}
            />
          ) : (
            <div>Нет готовых конфигураций — заполните форму ниже вручную</div>
          )}
        </div>
      )}
    </FormField>
  </div>
);
