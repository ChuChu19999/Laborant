import React from 'react';
import { ConfigProvider, Tour as AntTour } from 'antd';
import ruRU from 'antd/locale/ru_RU';

const TourLocal = (props: React.ComponentProps<typeof AntTour>) => {
  return (
    <ConfigProvider locale={ruRU}>
      <AntTour {...props} />
    </ConfigProvider>
  );
};

export default TourLocal;
