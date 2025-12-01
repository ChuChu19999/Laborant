import React from 'react';
import { ColorPicker as AntdColorPicker, Col, Divider, Row } from 'antd';
import { presets } from '../../constants/presets';
import './ColorPicker.css';

const ColorPicker = () => {
  const customPanelRender = (
    _: unknown,
    {
      components: { Picker, Presets },
    }: { components: { Picker: React.ComponentType; Presets: React.ComponentType } }
  ) => (
    <Row justify="space-between" wrap={false}>
      <Col span={12}>
        <Presets />
      </Col>
      <Divider type="vertical" className="color-picker-divider" />
      <Col flex="auto">
        <Picker />
      </Col>
    </Row>
  );

  return (
    <AntdColorPicker
      arrow
      defaultFormat="hex"
      mode="single"
      styles={{
        popupOverlayInner: {
          width: 320,
        },
      }}
      presets={presets}
      panelRender={customPanelRender}
    />
  );
};

export default ColorPicker;
