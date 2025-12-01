import React from 'react';
import { Checkbox, Col, Row } from 'antd';
import { Form } from 'antd/lib';
import { BiX, BiPlus } from 'react-icons/bi';
import Button from '../../../../shared/ui/Button/Button';
import { Select } from '../../../../shared/ui/FormItems';
import Tooltip from '../../../../shared/ui/Tooltip/Tooltip';
import './ElementsList.css';

interface FormDataItem {
  name: string;
  email: string;
}

interface ElementsListProps {
  formName: string;
  formData: FormDataItem[];
}

const ElementsList = ({ formName, formData }: ElementsListProps) => {
  const [data] = React.useState(formData);
  const [removingItems, setRemovingItems] = React.useState<Set<number>>(new Set());

  const handleRemove = (name: number, remove: (index: number) => void) => {
    setRemovingItems(prev => new Set(prev).add(name));
    setTimeout(() => {
      remove(name);
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(name);
        return newSet;
      });
    }, 300);
  };

  return (
    <div className="elements-list-wrapper">
      <Form.List name={formName}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restFields }) => (
              <div
                key={key}
                className={`elements-list-item ${removingItems.has(name) ? 'removing' : ''}`}
              >
                <Row align="middle" className="elements-list-row">
                  <Col flex={1}>
                    <Row key={'flex-row'} className="flex-row">
                      <Col flex={1}>
                        <Form.Item {...restFields}>
                          <Select
                            allowClear
                            filterOption={false}
                            placeholder="Соавтор продукта"
                            options={data}
                            style={{ width: '100%' }}
                            fieldNames={{ label: 'name', value: 'name' }}
                            onChange={value => {
                              console.log(value);
                            }}
                            optionRender={option => {
                              return (
                                <div key={option.data.name}>
                                  <p className="elements-list-option-item">{option.data.name}</p>
                                  <p className="elements-list-option-item">{option.data.email}</p>
                                </div>
                              );
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col className="options">
                        <Form.Item name="checkbox">
                          <Tooltip placement="top" title="Много полезной ифнформации">
                            <Checkbox className="checkbox" />
                          </Tooltip>
                        </Form.Item>
                        <BiX
                          size={20}
                          className="button-delete-item"
                          onClick={() => handleRemove(name, remove)}
                        />
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </div>
            ))}

            <Form.Item>
              <Button
                title="Добавить элемент"
                className="button-add"
                icon={<BiPlus size={20} />}
                onClick={add}
              />
            </Form.Item>
          </>
        )}
      </Form.List>
    </div>
  );
};

export default ElementsList;
